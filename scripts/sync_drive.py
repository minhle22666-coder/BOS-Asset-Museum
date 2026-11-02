#!/usr/bin/env python3
"""
Mirror a Google Drive folder tree into site/media/ (one-way: Drive -> repo).

  Drive root folder
    ├── Logo & Mascot/            -> site/media/logo-mascot/
    ├── Mascot-Slide Design/      -> site/media/slide-design/
    │     └── Avatar-Head-For-Quiz/  -> site/media/slide-design/Avatar-Head-For-Quiz/
    └── ...

Only files that came from Drive are ever deleted (tracked in .sync/drive_state.json),
so images someone uploads straight to GitHub are never touched.

Safety: if Drive cannot be reached, or the listing suddenly comes back nearly empty
(e.g. the owner account was deactivated), the script stops WITHOUT deleting anything.

Environment:
  GDRIVE_ROOT_FOLDER_ID   required  - id of the "BOS-Asset" folder
  GDRIVE_SA_KEY           optional  - full JSON of a service-account key
                                      (if absent, Application Default Credentials are used,
                                       e.g. Workload Identity Federation in GitHub Actions)
  ALLOW_MASS_DELETE       optional  - "true" to allow deleting more than 30% of synced files
"""
from __future__ import annotations

import io
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / "site" / "media"
STATE_FILE = ROOT / ".sync" / "drive_state.json"
CATEGORIES_FILE = ROOT / "scripts" / "categories.json"

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]
FOLDER = "application/vnd.google-apps.folder"
SHORTCUT = "application/vnd.google-apps.shortcut"
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"}
MASS_DELETE_RATIO = 0.30
MAX_BYTES = 24 * 1024 * 1024  # Cloudflare refuses any single file above 25 MiB; keep a little margin

# Slide decks: Google Slides (exported as PowerPoint), uploaded .pptx and .pdf files.
GSLIDES = "application/vnd.google-apps.presentation"
PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
DECK_EXT = {".pptx": PPTX, ".pdf": "application/pdf"}
SIDE_PREVIEW = ".preview.png"   # first-slide picture saved next to each deck
SIDE_LINK = ".link.json"        # written instead of the deck when it is too big even after shrinking
CREDS = None

BAD_CHARS = re.compile(r'[\\/:*?"<>|#%\x00-\x1f]')


def log(msg: str) -> None:
    print(f"[sync] {msg}", flush=True)


def safe_name(name: str) -> str:
    name = BAD_CHARS.sub("-", name).strip().strip(".")
    return name or "untitled"


def slugify(name: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", name).strip("-").lower()
    return s or "wing"


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def drive_service():
    from googleapiclient.discovery import build

    key = os.environ.get("GDRIVE_SA_KEY", "").strip()
    if key:
        from google.oauth2 import service_account

        creds = service_account.Credentials.from_service_account_info(json.loads(key), scopes=SCOPES)
    else:
        import google.auth

        creds, _ = google.auth.default(scopes=SCOPES)
    global CREDS
    CREDS = creds
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def session():
    from google.auth.transport.requests import AuthorizedSession

    return AuthorizedSession(CREDS)


def deck_kind(f: dict) -> str | None:
    """'gslides' for Google Slides, 'pptx' / 'pdf' for uploaded files, None for anything else."""
    if f["mimeType"] == GSLIDES:
        return "gslides"
    ext = Path(f["name"]).suffix.lower()
    if f["mimeType"] == PPTX or ext == ".pptx":
        return "pptx"
    if f["mimeType"] == "application/pdf" or ext == ".pdf":
        return "pdf"
    return None


def list_children(svc, folder_id: str) -> list[dict]:
    out, token = [], None
    while True:
        resp = (
            svc.files()
            .list(
                q=f"'{folder_id}' in parents and trashed = false",
                fields="nextPageToken, files(id, name, mimeType, md5Checksum, modifiedTime, size, shortcutDetails)",
                pageSize=1000,
                pageToken=token,
                supportsAllDrives=True,
                includeItemsFromAllDrives=True,
            )
            .execute()
        )
        out.extend(resp.get("files", []))
        token = resp.get("nextPageToken")
        if not token:
            return out


def resolve_shortcut(svc, f: dict) -> dict | None:
    if f["mimeType"] != SHORTCUT:
        return f
    target = (f.get("shortcutDetails") or {}).get("targetId")
    if not target:
        return None
    try:
        t = (
            svc.files()
            .get(fileId=target, fields="id, name, mimeType, md5Checksum, modifiedTime, size", supportsAllDrives=True)
            .execute()
        )
        t["name"] = f["name"]  # keep the shortcut's visible name
        return t
    except Exception as e:  # target not shared with us
        log(f"  skip shortcut {f['name']}: {e}")
        return None


def walk(svc, folder_id: str, rel: Path, found: dict) -> None:
    for f in list_children(svc, folder_id):
        f = resolve_shortcut(svc, f)
        if not f:
            continue
        if f["mimeType"] == FOLDER:
            walk(svc, f["id"], rel / safe_name(f["name"]), found)
            continue
        ext = Path(f["name"]).suffix.lower()
        kind = deck_kind(f)
        if kind:
            name = safe_name(f["name"])
            stem = name[: -len(Path(name).suffix)] if Path(name).suffix.lower() in DECK_EXT else name
            path = rel / f"{stem}.{'pdf' if kind == 'pdf' else 'pptx'}"
            if str(path) in {v["path"] for v in found.values()}:
                path = rel / f"{stem}-{f['id'][:6]}{path.suffix}"
            found[f["id"]] = {
                "path": str(path).replace("\\", "/"),
                "md5": f.get("md5Checksum") or f.get("modifiedTime"),
                "modified": f.get("modifiedTime"),
                "kind": kind,
            }
            continue
        if not (f["mimeType"].startswith("image/") or ext in IMAGE_EXT):
            log(f"  skip (not an image): {rel / f['name']}")
            continue
        if f["mimeType"].startswith("application/vnd.google-apps"):
            continue  # Google-native files have no binary to download
        if int(f.get("size") or 0) > MAX_BYTES:
            log(f"  skip (over 25 MB, too big for the website - export a smaller copy): {rel / f['name']}")
            continue
        name = safe_name(f["name"])
        if not Path(name).suffix:
            name += "." + f["mimeType"].split("/")[-1].replace("jpeg", "jpg").replace("svg+xml", "svg")
        path = rel / name
        # two Drive files with the same name in one folder -> keep both
        if str(path) in {v["path"] for v in found.values()}:
            path = rel / f"{Path(name).stem}-{f['id'][:6]}{Path(name).suffix}"
        found[f["id"]] = {
            "path": str(path).replace("\\", "/"),
            "md5": f.get("md5Checksum") or f.get("modifiedTime"),
            "modified": f.get("modifiedTime"),
        }


def download(svc, file_id: str, dest: Path) -> None:
    from googleapiclient.http import MediaIoBaseDownload

    dest.parent.mkdir(parents=True, exist_ok=True)
    buf = io.BytesIO()
    req = svc.files().get_media(fileId=file_id, supportsAllDrives=True)
    dl = MediaIoBaseDownload(buf, req, chunksize=8 * 1024 * 1024)
    done = False
    while not done:
        _, done = dl.next_chunk()
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(buf.getvalue())
    tmp.replace(dest)


def deck_report(src: Path, top: int = 6) -> None:
    """Log what takes up the space inside a .pptx, so a too-big deck can be explained."""
    import zipfile
    with zipfile.ZipFile(src) as z:
        parts = sorted(z.infolist(), key=lambda i: i.compress_size, reverse=True)[:top]
    for i in parts:
        log(f"      {i.compress_size / 1e6:6.1f} MB  {i.filename}")


def shrink_pptx(src: Path, limit: int, side: int = 1920, quality: int = 80, palette: bool = False) -> bool:
    """Re-save the pictures inside a .pptx smaller. True if it now fits.

    Pictures wider than `side` are scaled down. Pictures without transparency become JPEGs
    (renamed, with the slide links and content types fixed to match), since big PNG photos
    are what usually bloats a deck. With `palette`, transparent pictures are also cut down to
    256 colours (fine for drawings and mascots). Identical pictures are stored once.
    Videos and animated GIFs are left alone.
    """
    import hashlib
    import zipfile
    from PIL import Image

    entries, renames = [], {}
    with zipfile.ZipFile(src) as zin:
        for item in zin.infolist():
            name, data = item.filename, zin.read(item.filename)
            low = name.lower()
            ext = low.rsplit(".", 1)[-1]
            if low.startswith("ppt/media/") and ext in ("png", "jpg", "jpeg", "bmp", "tif", "tiff", "gif") and len(data) > 150_000:
                try:
                    with Image.open(io.BytesIO(data)) as im:
                        if getattr(im, "n_frames", 1) > 1:
                            raise ValueError("animated")
                        im.load()
                        if max(im.size) > side:
                            im.thumbnail((side, side), Image.LANCZOS)
                        clear = False
                        if im.mode in ("RGBA", "LA", "PA") or (im.mode == "P" and "transparency" in im.info):
                            clear = im.convert("RGBA").getchannel("A").getextrema()[0] < 250
                        out = io.BytesIO()
                        if clear and palette:
                            im.convert("RGBA").quantize(256, method=Image.Quantize.FASTOCTREE).save(out, "PNG", optimize=True)
                            new_ext = "png"
                        elif clear:
                            im.save(out, "PNG", optimize=True)
                            new_ext = "png"
                        else:
                            im.convert("RGB").save(out, "JPEG", quality=quality, optimize=True, progressive=True)
                            new_ext = "jpeg"
                    if out.tell() < len(data) * 0.9:
                        data = out.getvalue()
                        if new_ext != ext and not (new_ext == "jpeg" and ext == "jpg"):
                            new_name = name.rsplit(".", 1)[0] + "." + new_ext
                            renames[name] = new_name
                            name = new_name
                except Exception:
                    pass
            entries.append((name, data))

    # store identical pictures once
    seen, dropped, kept = {}, set(), []
    for name, data in entries:
        if name.lower().startswith("ppt/media/"):
            h = hashlib.sha1(data).hexdigest()
            if h in seen and seen[h].rsplit(".", 1)[-1] == name.rsplit(".", 1)[-1]:
                first = next((o for o, n in renames.items() if n == name), name)
                renames[first] = seen[h]
                dropped.add(name)
                continue
            seen[h] = name
        kept.append((name, data))
    entries = kept

    # point slides at the renamed / merged pictures
    base = {o.rsplit("/", 1)[-1]: n.rsplit("/", 1)[-1] for o, n in renames.items()}
    fixed = []
    for name, data in entries:
        if base and name.endswith(".rels"):
            text = data.decode("utf-8")
            for o, n in base.items():
                text = text.replace(f"media/{o}\"", f"media/{n}\"")
            data = text.encode("utf-8")
        elif (renames or dropped) and name == "[Content_Types].xml":
            text = data.decode("utf-8")
            for o in list(renames) + list(dropped):
                text = re.sub(rf'<Override\s+PartName="/{re.escape(o)}"[^>]*/>', "", text)
            if renames and 'Extension="jpeg"' not in text:
                text = text.replace("<Default ", '<Default Extension="jpeg" ContentType="image/jpeg"/><Default ', 1)
            data = text.encode("utf-8")
        fixed.append((name, data))

    tmp = src.with_suffix(".shrink.pptx")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
        for name, data in fixed:
            zout.writestr(name, data)
    tmp.replace(src)
    extra = f", {len(dropped)} duplicate pictures merged" if dropped else ""
    log(f"    shrunk pictures to {side}px{' + 256 colours' if palette else ''}{extra}: now {src.stat().st_size / 1e6:.1f} MB")
    return src.stat().st_size <= limit


def fetch_deck(svc, fid: str, meta: dict, dest: Path) -> None:
    """Save the deck (or a link to it when too big) plus a picture of its first slide."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    s = session()
    info = svc.files().get(fileId=fid, fields="name, webViewLink, exportLinks, thumbnailLink", supportsAllDrives=True).execute()
    preview = dest.with_name(dest.name + SIDE_PREVIEW)
    link = dest.with_name(dest.name + SIDE_LINK)

    # first slide as a picture
    pic = None
    if meta["kind"] == "gslides" and (info.get("exportLinks") or {}).get("image/png"):
        r = s.get(info["exportLinks"]["image/png"], timeout=120)
        pic = r.content if r.ok else None
    if not pic and info.get("thumbnailLink"):
        r = s.get(re.sub(r"=s\d+$", "=s1600", info["thumbnailLink"]), timeout=60)
        pic = r.content if r.ok else None
    if pic:
        preview.write_bytes(pic)

    # the deck itself
    tmp = dest.with_suffix(dest.suffix + ".part")
    if meta["kind"] == "gslides":
        url = (info.get("exportLinks") or {}).get(PPTX)
        if not url:
            raise RuntimeError("Google did not offer a PowerPoint export for this deck")
        with s.get(url, stream=True, timeout=600) as r:
            r.raise_for_status()
            with tmp.open("wb") as fh:
                for chunk in r.iter_content(1 << 20):
                    fh.write(chunk)
    else:
        download(svc, fid, tmp)
    size = tmp.stat().st_size
    fits = size <= MAX_BYTES
    if not fits and dest.suffix == ".pptx":
        log(f"    deck is {size / 1e6:.1f} MB, over the {MAX_BYTES // 1_000_000} MB limit. Biggest parts:")
        deck_report(tmp)
        fits = (shrink_pptx(tmp, MAX_BYTES)
                or shrink_pptx(tmp, MAX_BYTES, 1600, 75, palette=True)
                or shrink_pptx(tmp, MAX_BYTES, 1280, 68, palette=True)
                or shrink_pptx(tmp, MAX_BYTES, 1024, 62, palette=True))
        if not fits:
            log("    still too big. Biggest parts now:")
            deck_report(tmp)
    if fits:
        tmp.replace(dest)
        link.unlink(missing_ok=True)
        log(f"    deck saved ({dest.stat().st_size / 1e6:.1f} MB)")
    else:
        tmp.unlink(missing_ok=True)
        dest.unlink(missing_ok=True)
        link.write_text(json.dumps({"title": info["name"], "url": info.get("webViewLink"), "bytes": size}, ensure_ascii=False), encoding="utf-8")
        log("    too big for the website even after shrinking; keeping a preview + link instead")


def remove_with_sidecars(rel: str) -> None:
    p = MEDIA / rel
    for q in (p, p.with_name(p.name + SIDE_PREVIEW), p.with_name(p.name + SIDE_LINK)):
        q.unlink(missing_ok=True)


def main() -> int:
    root_id = os.environ.get("GDRIVE_ROOT_FOLDER_ID", "").strip()
    if not root_id:
        log("GDRIVE_ROOT_FOLDER_ID is not set - nothing to sync.")
        return 0

    cats = load_json(CATEGORIES_FILE, {"categories": []})["categories"]
    # compare names by their letters and digits only, so emoji and brackets in Drive folder names don't matter
    by_name = {slugify(n): c["slug"] for c in cats for n in c.get("drive_names", [])}
    state: dict = load_json(STATE_FILE, {})

    try:
        svc = drive_service()
        top = [resolve_shortcut(svc, f) for f in list_children(svc, root_id)]
    except Exception as e:
        log(f"Cannot reach Google Drive ({e.__class__.__name__}: {e}).")
        log("Keeping every existing image untouched. Gallery stays online from GitHub.")
        return 0

    found: dict = {}
    for f in filter(None, top):
        if f["mimeType"] != FOLDER:
            log(f"  skip file at root level (put it inside a wing folder): {f['name']}")
            continue
        slug = by_name.get(slugify(f["name"]), slugify(f["name"]))
        log(f"Wing '{f['name']}' -> media/{slug}/")
        walk(svc, f["id"], Path(slug), found)

    # --- safety net -------------------------------------------------------
    removed = [fid for fid in state if fid not in found]
    if state and len(removed) > MASS_DELETE_RATIO * len(state) and os.environ.get("ALLOW_MASS_DELETE") != "true":
        log(f"Drive now lists {len(found)} files but {len(removed)} of {len(state)} synced files would be deleted.")
        log("This looks like lost access, not a real clean-up. Aborting with no changes.")
        log("If the deletion is intended, re-run with ALLOW_MASS_DELETE=true.")
        return 0

    added = changed = deleted = 0
    for fid, meta in found.items():
        old = state.get(fid)
        dest = MEDIA / meta["path"]
        have = dest.exists() or dest.with_name(dest.name + SIDE_LINK).exists()
        if old and old["md5"] == meta["md5"] and old["path"] == meta["path"] and have:
            continue
        if old and old["path"] != meta["path"]:
            remove_with_sidecars(old["path"])  # renamed / moved in Drive
        log(f"  {'update' if old else 'add'}: {meta['path']}")
        try:
            if meta.get("kind"):
                fetch_deck(svc, fid, meta, dest)
            else:
                download(svc, fid, dest)
        except Exception as e:
            log(f"    FAILED ({e.__class__.__name__}: {e}) - will retry next time")
            continue
        state[fid] = meta
        changed += bool(old)
        added += not old

    for fid in removed:
        log(f"  delete: {state[fid]['path']}")
        remove_with_sidecars(state[fid]["path"])
        del state[fid]
        deleted += 1

    # tidy empty folders
    for d in sorted(MEDIA.rglob("*"), key=lambda p: len(p.parts), reverse=True):
        if d.is_dir() and not any(d.iterdir()):
            d.rmdir()

    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(state, indent=1, sort_keys=True, ensure_ascii=False), encoding="utf-8")
    log(f"Done. added={added} updated={changed} deleted={deleted} total_from_drive={len(state)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
