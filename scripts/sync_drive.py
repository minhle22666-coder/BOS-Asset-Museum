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
MAX_BYTES = 25 * 1024 * 1024  # Cloudflare Pages refuses any single file above 25 MiB

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
    return build("drive", "v3", credentials=creds, cache_discovery=False)


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


def main() -> int:
    root_id = os.environ.get("GDRIVE_ROOT_FOLDER_ID", "").strip()
    if not root_id:
        log("GDRIVE_ROOT_FOLDER_ID is not set - nothing to sync.")
        return 0

    cats = load_json(CATEGORIES_FILE, {"categories": []})["categories"]
    by_name = {n.lower(): c["slug"] for c in cats for n in c.get("drive_names", [])}
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
        slug = by_name.get(f["name"].strip().lower(), slugify(f["name"]))
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
        if old and old["md5"] == meta["md5"] and old["path"] == meta["path"] and dest.exists():
            continue
        if old and old["path"] != meta["path"]:
            (MEDIA / old["path"]).unlink(missing_ok=True)  # renamed / moved in Drive
        log(f"  {'update' if old else 'add'}: {meta['path']}")
        download(svc, fid, dest)
        state[fid] = meta
        changed += bool(old)
        added += not old

    for fid in removed:
        p = MEDIA / state[fid]["path"]
        log(f"  delete: {state[fid]['path']}")
        p.unlink(missing_ok=True)
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
