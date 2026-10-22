"""Génère splash_dark.png / splash_logo_dark.png depuis les assets clairs.

Fond sombre aligné sur ViroPalette.dark.background (#0B1220), logo blanchi,
formes décoratives assombries (équivalent decorOpacityFactor sombre).
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BRANDING = ROOT / 'assets' / 'branding'

DARK_BG = (0x0B, 0x12, 0x20)
DECOR_OPACITY = 0.55  # ViroPalette.dark.decorOpacityFactor


def luminance(r: int, g: int, b: int) -> float:
  return 0.2126 * r + 0.7152 * g + 0.0722 * b


def is_near_white(r: int, g: int, b: int) -> bool:
  return luminance(r, g, b) > 248 and max(r, g, b) - min(r, g, b) < 12


def is_logo_ink(r: int, g: int, b: int) -> bool:
  """Encre du pictogramme (bleu nuit / gris-bleu sombre)."""
  L = luminance(r, g, b)
  if L > 140:
    return False
  # Logo : canal B >= R, saturation modérée, pas un pastel chaud.
  return b >= r - 8 and g <= b + 20


def blend(fg: tuple[int, int, int], bg: tuple[int, int, int], t: float) -> tuple[int, int, int]:
  return tuple(int(round(fg[i] * t + bg[i] * (1 - t))) for i in range(3))


def convert(src: Path, dst: Path) -> None:
  image = Image.open(src).convert('RGBA')
  pixels = list(image.getdata())
  out: list[tuple[int, int, int, int]] = []

  for r, g, b, a in pixels:
    if a == 0:
      out.append((0, 0, 0, 0))
      continue

    if is_near_white(r, g, b):
      out.append((*DARK_BG, a))
      continue

    if is_logo_ink(r, g, b):
      # Antialias : plus le pixel est sombre, plus il est opaque en blanc.
      L = luminance(r, g, b)
      strength = max(0.0, min(1.0, 1.0 - (L / 150.0)))
      white = blend((255, 255, 255), DARK_BG, strength)
      out.append((*white, a))
      continue

    # Pastels décoratifs : coller sur le fond sombre avec opacité réduite.
    L = luminance(r, g, b)
    # Distance au blanc ≈ intensité du blob.
    white_distance = max(0.0, min(1.0, (255 - L) / 80.0))
    tint_strength = white_distance * DECOR_OPACITY
    tinted = blend((r, g, b), DARK_BG, tint_strength)
    out.append((*tinted, a))

  image.putdata(out)
  image.save(dst, optimize=True)
  print(f'écrit {dst.relative_to(ROOT)} ({image.size[0]}x{image.size[1]})')


def main() -> None:
  convert(BRANDING / 'splash.png', BRANDING / 'splash_dark.png')
  convert(BRANDING / 'splash_logo.png', BRANDING / 'splash_logo_dark.png')


if __name__ == '__main__':
  main()
