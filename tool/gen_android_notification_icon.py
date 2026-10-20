"""Génère `@drawable/ic_notification` (silhouette blanche, alpha) depuis le logo.

Usage : `py tool/gen_android_notification_icon.py`

Android n'utilise que le canal alpha de la smallIcon : un logo coloré / fond
opaque devient un carré ou disque blanc dans la barre de statut.
"""

from __future__ import annotations

import collections
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCES = [
    ROOT / "assets/logo/logo_seul.png",
    ROOT / "assets/logo/logo_seul_launcher_icons.png",
    ROOT / "assets/logo/logo_seul_launcher_icons2.png",
    ROOT / "android/app/src/main/res/drawable-xxxhdpi/ic_launcher_foreground.png",
]

# Densités Android pour smallIcon (baseline 24dp).
DENSITIES = {
    "mdpi": 24,
    "hdpi": 36,
    "xhdpi": 48,
    "xxhdpi": 72,
    "xxxhdpi": 96,
}


def analyze(path: Path) -> None:
    im = Image.open(path).convert("RGBA")
    print(path.relative_to(ROOT), im.size)
    colors: collections.Counter[tuple[int, int, int]] = collections.Counter()
    opaque = transparent = 0
    for r, g, b, a in im.getdata():
        if a < 16:
            transparent += 1
            continue
        opaque += 1
        colors[((r // 16) * 16, (g // 16) * 16, (b // 16) * 16)] += 1
    print("  opaque", opaque, "transparent", transparent)
    print("  top", colors.most_common(6))


def is_ink(r: int, g: int, b: int, a: int) -> bool:
    """Pixels du pictogramme (pas le fond noir/blanc)."""
    if a < 16:
        return False
    lum = (r + g + b) / 3
    if lum < 28:
        return False  # fond noir
    if lum > 235 and abs(r - g) < 12 and abs(g - b) < 12:
        return False  # fond blanc
    # Logo navy + éventuel contour légèrement plus clair.
    return True


def extract_mask(path: Path) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    mask = Image.new("L", im.size, 0)
    pixels = mask.load()
    src = im.load()
    assert pixels is not None and src is not None
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = src[x, y]
            if is_ink(r, g, b, a):
                pixels[x, y] = a if a > 0 else 255
    # Bounding box du pictogramme.
    bbox = mask.getbbox()
    if bbox is None:
        raise RuntimeError(f"Aucun pixel logo dans {path}")
    mask = mask.crop(bbox)
    # Carré avec marge (~12 %) pour le safe zone status bar.
    side = max(mask.size)
    pad = int(side * 0.14)
    canvas = Image.new("L", (side + 2 * pad, side + 2 * pad), 0)
    ox = (canvas.width - mask.width) // 2
    oy = (canvas.height - mask.height) // 2
    canvas.paste(mask, (ox, oy))
    return canvas


def to_white_silhouette(mask: Image.Image, size: int) -> Image.Image:
    resized = mask.resize((size, size), Image.Resampling.LANCZOS)
    # Léger blur puis seuil pour un alpha propre à petite taille.
    soft = resized.filter(ImageFilter.GaussianBlur(radius=0.4))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    alpha = soft.load()
    pixels = out.load()
    assert alpha is not None and pixels is not None
    for y in range(size):
        for x in range(size):
            a = alpha[x, y]
            if a < 40:
                continue
            # Alpha plein pour les pixels du glyph (Android lit l'alpha).
            pixels[x, y] = (255, 255, 255, 255 if a >= 128 else a)
    return out


def pick_best_source() -> Path:
    # Préférer la source avec le plus de pixels « ink » (logo net).
    best: Path | None = None
    best_count = -1
    for path in SOURCES:
        if not path.exists():
            continue
        im = Image.open(path).convert("RGBA")
        count = sum(1 for r, g, b, a in im.getdata() if is_ink(r, g, b, a))
        print(f"candidate {path.name}: ink={count}")
        if count > best_count:
            best_count = count
            best = path
    if best is None:
        raise RuntimeError("Aucune source logo trouvée")
    return best


def main() -> None:
    for path in SOURCES:
        if path.exists():
            analyze(path)

    source = pick_best_source()
    print("using", source)
    mask = extract_mask(source)
    preview_dir = ROOT / "tool" / "_notification_icon_preview"
    preview_dir.mkdir(exist_ok=True)
    mask.save(preview_dir / "mask.png")

    res = ROOT / "android/app/src/main/res"
    # Remplace le vector placeholder : PNG dans drawable-*dpi.
    # Garde aussi drawable/ic_notification.png comme fallback API bas.
    for density, size in DENSITIES.items():
        folder = res / f"drawable-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        icon = to_white_silhouette(mask, size)
        out = folder / "ic_notification.png"
        icon.save(out, optimize=True)
        print("wrote", out.relative_to(ROOT), size)

    # Preview 96px pour contrôle visuel.
    to_white_silhouette(mask, 96).save(preview_dir / "ic_notification_96.png")
    print("preview", preview_dir / "ic_notification_96.png")


if __name__ == "__main__":
    main()
