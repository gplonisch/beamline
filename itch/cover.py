"""Compose the itch.io cover from a real screenshot of the board.

    node itch/shots.mjs && python3 itch/cover.py

itch shows the cover at 630x500 in listings and much smaller in search results,
so the title has to carry it at thumbnail size. The board behind the title is an
actual capture from itch/shots.mjs, not a drawing of one.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent
BOARD = OUT / "board-18.png"
W, H = 630, 500

INK = (248, 250, 252)
DIM = (150, 158, 172)
GROUND = (9, 11, 15)

# Fraunces ships with the game, so the cover uses the same face as the page.
DISPLAY = OUT.parent / "fonts" / "fraunces-opsz.woff2"
FALLBACK_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FALLBACK_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    """Pillow cannot read woff2, so the cover falls back to a system face.

    Worth stating plainly rather than silently: the cover's lettering is not
    the same typeface as the page's. Converting the woff2 to a ttf would fix
    it and needs a tool that is not installed here.
    """
    return ImageFont.truetype(FALLBACK_BOLD if bold else FALLBACK_REG, size)


def main() -> int:
    if not BOARD.exists():
        print(f"missing {BOARD.name}. Run: node itch/shots.mjs", file=sys.stderr)
        return 1

    img = Image.new("RGB", (W, H), GROUND)
    d = ImageDraw.Draw(img)

    board = Image.open(BOARD).convert("RGB")

    # Fit the whole board between the title and the footer band rather than
    # filling the space and cropping. A cropped board with beams running off the
    # edge reads as a mistake, and the footer needs a clear strip of its own so
    # the caption never lands on top of a sensor.
    TOP, BOTTOM = 136, 452
    area_h = BOTTOM - TOP
    scale = min(W / board.width, area_h / board.height)
    board = board.resize((round(board.width * scale), round(board.height * scale)), Image.LANCZOS)
    img.paste(board, ((W - board.width) // 2, TOP + (area_h - board.height) // 2))

    # Solid band under the board, so the caption sits on the ground colour.
    d.rectangle([0, BOTTOM, W, H], fill=GROUND)

    d.text((40, 34), "BEAMLINE", font=font(66), fill=INK)

    # The spectrum rule under the wordmark, as on the page.
    spectrum = [(255, 74, 61), (255, 224, 74), (61, 255, 110),
                (61, 242, 255), (74, 109, 255), (255, 82, 240)]
    x0, x1, y = 44, 412, 110
    for i in range(x1 - x0):
        t = i / (x1 - x0) * (len(spectrum) - 1)
        a, b = spectrum[int(t)], spectrum[min(int(t) + 1, len(spectrum) - 1)]
        f = t - int(t)
        d.line([(x0 + i, y), (x0 + i, y + 4)],
               fill=tuple(round(a[c] + (b[c] - a[c]) * f) for c in range(3)))

    d.text((44, H - 32), "20 levels      keyboard playable      colourblind safe      free",
           font=font(15, bold=False), fill=DIM, anchor="lm")

    img.save(OUT / "cover.png")
    print(f"cover.png          {W}x{H}  (composed from board-18.png)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
