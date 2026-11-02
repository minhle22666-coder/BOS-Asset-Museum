#!/usr/bin/env python3
"""
Scan site/media/ and produce:
  site/thumbs/<same path>.webp   small previews (fast gallery loading)
  site/data/manifest.json        everything the website needs to draw the gallery

Works the same whether images came from the Drive sync or were uploaded
directly to GitHub, so the gallery keeps working after Drive is gone.
"""
from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageOps, ImageSequence

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "site"
MEDIA = SITE / "media"
THUMBS = SITE / "thumbs"
MANIFEST = SITE / "data" / "manifest.json"
CATEGORIES_FILE = ROOT / "scripts" / "categories.json"

RASTER = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"}
VECTOR = {".svg"}
THUMB_MAX = 720  # px, longest side (sharp on retina at ~360px cards)
DECK = {".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation", ".pdf": "application/pdf"}
SIDE_PREVIEW, SIDE_LINK = ".preview.png", ".link.json"
MIME = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
        ".gif": "image/gif", ".avif": "image/avif", ".svg": "image/svg+xml"}

Image.MAX_IMAGE_PIXELS = 300_000_000


def sha1(path: Path) -> str:
    h = hashlib.sha1()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def natural_key(s: str):
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", s)]


def pretty(name: str) -> str:
    return re.sub(r"[-_]+", " ", name).strip()


def make_thumb(src: Path, dst: Path) -> tuple[int, int]:
    with Image.open(src) as im:
        w, h = im.size
        if getattr(im, "is_animated", False):
            im = next(ImageSequence.Iterator(im))
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGBA")
        im.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, "WEBP", quality=84, method=5)
    return w, h


def deck_entry(p: Path, rel: str, digest: str, collection: str, old: dict, used: set) -> dict | None:
    """A slide deck: its first-slide picture is the preview; the file (or a link) is the download."""
    is_link = p.name.lower().endswith(SIDE_LINK)
    deck_name = p.name[: -len(SIDE_LINK)] if is_link else p.name
    deck = p.with_name(deck_name)
    if is_link and deck.exists():
        return None  # the real file is here too; the link is stale
    preview = p.with_name(deck_name + SIDE_PREVIEW)
    entry = {
        "id": hashlib.sha1(f"{rel}|{digest}".encode()).hexdigest()[:12],
        "name": Path(deck_name).stem,
        "kind": "link" if is_link else "deck",
        "format": Path(deck_name).suffix.lstrip(".").upper(),
        "file": None if is_link else rel,
        "collection": collection,
        "mime": DECK.get(Path(deck_name).suffix.lower(), "application/octet-stream"),
        "size": 0 if is_link else p.stat().st_size,
        "hash": digest,
        "src": rel,
        "w": None, "h": None, "thumb": None, "preview": None,
    }
    if is_link:
        info = json.loads(p.read_text(encoding="utf-8"))
        entry.update(href=info.get("url"), fullSize=info.get("bytes"))
    if preview.exists():
        entry["preview"] = preview.relative_to(SITE).as_posix()
        t = THUMBS / preview.relative_to(MEDIA).with_suffix(".webp")
        pdig = sha1(preview)
        prev = old.get(rel)
        if prev and prev.get("previewHash") == pdig and t.exists():
            entry.update(w=prev["w"], h=prev["h"])
        else:
            try:
                entry["w"], entry["h"] = make_thumb(preview, t)
                print(f"[thumb] {preview.relative_to(SITE).as_posix()}")
            except Exception as e:
                print(f"[thumb] FAILED {preview}: {e}")
                t = None
        entry["previewHash"] = pdig
        if t:
            entry["thumb"] = t.relative_to(SITE).as_posix()
            used.add(t)
    if not entry["thumb"]:
        entry["thumb"] = "assets/planet/deck-placeholder.svg"
    return entry


def main() -> None:
    cfg = json.loads(CATEGORIES_FILE.read_text(encoding="utf-8"))["categories"]
    old = {}
    if MANIFEST.exists():
        for c in json.loads(MANIFEST.read_text(encoding="utf-8")).get("categories", []):
            for it in c["items"]:
                old[it.get("src") or it.get("file") or it["id"]] = it

    known = {c["slug"] for c in cfg}
    extra = sorted(d.name for d in MEDIA.iterdir() if d.is_dir() and d.name not in known) if MEDIA.exists() else []
    wings = cfg + [{"slug": s, "title": pretty(s).title(), "description": "", "frame": "square"} for s in extra]

    used_thumbs: set[Path] = set()
    out = []
    for w in wings:
        base = MEDIA / w["slug"]
        def wanted(p: Path) -> bool:
            n = p.name.lower()
            if n.endswith(SIDE_PREVIEW):
                return False  # a deck's preview picture, shown with the deck
            if n.endswith(SIDE_LINK):
                return True   # a deck too big to host: preview + link
            return p.suffix.lower() in RASTER | VECTOR | set(DECK)
        files = sorted((p for p in base.rglob("*") if p.is_file() and wanted(p)),
                       key=lambda p: natural_key(str(p.relative_to(base)))) if base.exists() else []
        items = []
        for p in files:
            rel = p.relative_to(SITE).as_posix()
            digest = sha1(p)
            ext = p.suffix.lower()
            collection = p.parent.relative_to(base).as_posix()
            collection = "" if collection == "." else collection
            if p.name.lower().endswith(SIDE_LINK) or ext in DECK:
                entry = deck_entry(p, rel, digest, collection, old, used_thumbs)
                if entry:
                    items.append(entry)
                continue
            entry = {
                "id": hashlib.sha1(f"{rel}|{digest}".encode()).hexdigest()[:12],
                "name": p.stem,
                "file": rel,
                "collection": collection,
                "mime": MIME.get(ext, "application/octet-stream"),
                "size": p.stat().st_size,
                "hash": digest,
            }
            if ext in VECTOR:
                entry.update(thumb=rel, w=None, h=None)
            else:
                t = THUMBS / p.relative_to(MEDIA).with_suffix(p.suffix + ".webp")
                prev = old.get(rel)
                if prev and prev.get("hash") == digest and t.exists():
                    entry.update(w=prev["w"], h=prev["h"])
                else:
                    try:
                        entry["w"], entry["h"] = make_thumb(p, t)
                        print(f"[thumb] {rel}")
                    except Exception as e:
                        print(f"[thumb] FAILED {rel}: {e} - using original as preview")
                        entry.update(w=None, h=None)
                        t = p
                entry["thumb"] = t.relative_to(SITE).as_posix()
                used_thumbs.add(t)
            items.append(entry)
        out.append({
            "slug": w["slug"], "title": w["title"], "description": w.get("description", ""),
            "frame": w.get("frame", "square"), "count": len(items),
            "bytes": sum(i["size"] for i in items), "items": items,
        })

    # drop thumbnails whose source image is gone
    if THUMBS.exists():
        for t in THUMBS.rglob("*.webp"):
            if t not in used_thumbs:
                t.unlink()
        for d in sorted(THUMBS.rglob("*"), key=lambda p: len(p.parts), reverse=True):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()

    new = {"categories": out}
    prev_body = None
    if MANIFEST.exists():
        prev = json.loads(MANIFEST.read_text(encoding="utf-8"))
        prev_body = {"categories": prev.get("categories")}
    stamp = (datetime.now(timezone.utc).isoformat(timespec="seconds")
             if prev_body != new else json.loads(MANIFEST.read_text(encoding="utf-8"))["generatedAt"])
    MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST.write_text(json.dumps({"generatedAt": stamp, **new}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"[manifest] {sum(c['count'] for c in out)} images in {len(out)} wings")


if __name__ == "__main__":
    main()
