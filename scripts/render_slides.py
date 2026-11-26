#!/usr/bin/env python3
"""
Turn a slide deck (.pptx or .pdf) into one picture per slide, so the website can show every slide,
not just the first one.

How a .pptx becomes pictures:
  1. The fonts the deck carries inside itself (ppt/fonts/*.fntdata, Embedded OpenType) are unpacked
     with `eot2ttf` and installed for this deck only. Without them LibreOffice falls back to other
     fonts and the slides look wrong (text too wide, script fonts gone).
  2. LibreOffice turns the deck into a PDF, with its own font folder and profile.
  3. `pdftoppm` draws each page of the PDF as a PNG.

Needs (on GitHub Actions they are installed by sync.yml):
  libreoffice-impress, poppler-utils, eot2ttf, fonttools (pip)
When one of them is missing, `available()` is False and the gallery keeps whatever slides it already had.
"""
from __future__ import annotations

import shutil
import struct
import subprocess
import tempfile
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape

RENDER_VERSION = 1  # bump to redraw every deck after the drawing improves

NS = {
    "p": "http://schemas.openxmlformats.org/presentationml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "rel": "http://schemas.openxmlformats.org/package/2006/relationships",
}
EOT_SUBSET = 0x1  # the font only carries the letters the deck uses


def available() -> bool:
    return all(shutil.which(t) for t in ("soffice", "pdftoppm", "eot2ttf"))


def _font_names(ttf: Path) -> tuple[str, str] | None:
    try:
        from fontTools.ttLib import TTFont
        with TTFont(ttf, lazy=True) as f:
            n = f["name"]
            return (n.getDebugName(1) or "").strip(), (n.getDebugName(2) or "Regular").strip()
    except Exception:
        return None


def unpack_fonts(pptx: Path, out: Path) -> list[tuple[str, str]]:
    """Save the deck's embedded fonts as .ttf files in `out`.
    Returns (name the slides ask for, name the font file really has) pairs that differ, for aliasing."""
    out.mkdir(parents=True, exist_ok=True)
    aliases: list[tuple[str, str]] = []
    try:
        zf = zipfile.ZipFile(pptx)
    except zipfile.BadZipFile:
        return aliases
    with zf:
        names = set(zf.namelist())
        # which typeface each font part belongs to (presentation.xml -> embeddedFontLst)
        asked: dict[str, str] = {}
        try:
            rels = ET.fromstring(zf.read("ppt/_rels/presentation.xml.rels"))
            target = {r.get("Id"): "ppt/" + r.get("Target").lstrip("/").removeprefix("ppt/") for r in rels.findall("rel:Relationship", NS)}
            pres = ET.fromstring(zf.read("ppt/presentation.xml"))
            for ef in pres.iterfind(".//p:embeddedFont", NS):
                face = ef.find("p:font", NS).get("typeface", "")
                for style in ef:
                    rid = style.get(f"{{{NS['r']}}}id")
                    if rid in target:
                        asked[target[rid]] = face
        except Exception:
            pass
        parts = sorted(n for n in names if n.startswith("ppt/fonts/"))
        # full fonts first, so a full copy wins over a subset copy of the same face
        def is_subset(n: str) -> bool:
            head = zf.read(n)[:16]
            return len(head) >= 16 and bool(struct.unpack("<I", head[12:16])[0] & EOT_SUBSET)
        parts.sort(key=is_subset)
        seen: set[tuple[str, str]] = set()
        with tempfile.TemporaryDirectory() as tmp:
            eot = Path(tmp) / "in.eot"
            for i, part in enumerate(parts):
                eot.write_bytes(zf.read(part))
                ttf = out / f"font{i:02d}.ttf"
                r = subprocess.run(["eot2ttf", str(eot), str(ttf)], capture_output=True, timeout=60)
                got = _font_names(ttf) if r.returncode == 0 and ttf.exists() else None
                if not got or not got[0]:
                    ttf.unlink(missing_ok=True)
                    continue
                if got in seen:  # same face already saved (the full copy, when there is one)
                    ttf.unlink()
                    continue
                seen.add(got)
                face = asked.get(part, "")
                if face and face.lower() != got[0].lower():
                    aliases.append((face, got[0]))
    return aliases


def _fonts_conf(font_dir: Path, cache: Path, aliases: list[tuple[str, str]]) -> str:
    alias_xml = "".join(
        f"<alias binding=\"same\"><family>{escape(a)}</family><prefer><family>{escape(b)}</family></prefer></alias>"
        for a, b in dict.fromkeys(aliases)
    )
    return (
        '<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig>'
        f"<include ignore_missing=\"yes\">/etc/fonts/fonts.conf</include>"
        f"<dir>{escape(str(font_dir))}</dir><cachedir>{escape(str(cache))}</cachedir>{alias_xml}"
        "</fontconfig>"
    )


def deck_to_pdf(pptx: Path, work: Path) -> Path:
    fonts = work / "fonts"
    aliases = unpack_fonts(pptx, fonts)
    conf = work / "fonts.conf"
    conf.write_text(_fonts_conf(fonts, work / "fc-cache", aliases), encoding="utf-8")
    # LibreOffice can trip over unusual file names; give it a plain one
    src = work / "deck.pptx"
    shutil.copyfile(pptx, src)
    env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "HOME": str(work),
        "FONTCONFIG_FILE": str(conf),
        "SAL_USE_VCLPLUGIN": "svp",
    }
    subprocess.run(
        ["soffice", f"-env:UserInstallation=file://{work / 'profile'}", "--headless", "--norestore",
         "--convert-to", "pdf", "--outdir", str(work), str(src)],
        env=env, capture_output=True, timeout=600, check=False,
    )
    pdf = work / "deck.pdf"
    if not pdf.exists():
        raise RuntimeError("LibreOffice could not turn this deck into a PDF")
    return pdf


def render(deck: Path, out_dir: Path, width: int = 1600) -> list[Path]:
    """Draw every slide of `deck` as out_dir/001.png, 002.png, ... `width` pixels wide. Returns the files in order."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.png"):
        old.unlink()
    with tempfile.TemporaryDirectory(prefix="slides-") as tmp:
        work = Path(tmp)
        pdf = deck if deck.suffix.lower() == ".pdf" else deck_to_pdf(deck, work)
        subprocess.run(["pdftoppm", "-png", "-scale-to-x", str(width), "-scale-to-y", "-1", str(pdf), str(work / "s")],
                       capture_output=True, timeout=600, check=True)
        pages = sorted(work.glob("s-*.png"), key=lambda p: int(p.stem.split("-")[-1]))
        files = []
        for i, p in enumerate(pages, 1):
            dst = out_dir / f"{i:03d}.png"
            shutil.move(str(p), dst)
            files.append(dst)
    return files


if __name__ == "__main__":  # quick manual test: python scripts/render_slides.py deck.pptx out/
    import sys
    print("\n".join(str(p) for p in render(Path(sys.argv[1]), Path(sys.argv[2]))))
