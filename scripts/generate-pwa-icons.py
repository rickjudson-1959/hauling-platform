#!/usr/bin/env python3
"""Generate simple PWA PNG icons without third-party deps."""

from __future__ import annotations

import struct
import zlib
from pathlib import Path


BLUE = (29, 78, 216, 255)  # #1d4ed8
WHITE = (255, 255, 255, 255)
DARK = (30, 64, 175, 255)


def chunk(tag: bytes, data: bytes) -> bytes:
    return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)


def write_png(path: Path, pixels: list[list[tuple[int, int, int, int]]]) -> None:
    height = len(pixels)
    width = len(pixels[0])
    raw = b"".join(
        b"\x00" + b"".join(struct.pack("BBBB", *px) for px in row)
        for row in pixels
    )
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"".join(
        [
            b"\x89PNG\r\n\x1a\n",
            chunk(b"IHDR", ihdr),
            chunk(b"IDAT", zlib.compress(raw, 9)),
            chunk(b"IEND", b""),
        ]
    )
    path.write_bytes(png)


def fill_rect(
    pixels: list[list[tuple[int, int, int, int]]],
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    color: tuple[int, int, int, int],
) -> None:
    h = len(pixels)
    w = len(pixels[0])
    for y in range(max(0, y0), min(h, y1)):
        row = pixels[y]
        for x in range(max(0, x0), min(w, x1)):
            row[x] = color


def fill_circle(
    pixels: list[list[tuple[int, int, int, int]]],
    cx: int,
    cy: int,
    r: int,
    color: tuple[int, int, int, int],
) -> None:
    h = len(pixels)
    w = len(pixels[0])
    r2 = r * r
    for y in range(max(0, cy - r), min(h, cy + r + 1)):
        dy = y - cy
        for x in range(max(0, cx - r), min(w, cx + r + 1)):
            dx = x - cx
            if dx * dx + dy * dy <= r2:
                pixels[y][x] = color


def draw_icon(size: int, *, padded: bool) -> list[list[tuple[int, int, int, int]]]:
    pixels = [[BLUE for _ in range(size)] for _ in range(size)]
    # Safe zone for maskable icons (~80% content)
    inset = int(size * 0.12) if padded else int(size * 0.16)
    body_top = int(size * 0.46)
    body_bottom = size - inset - int(size * 0.08)
    cab_left = inset + int(size * 0.08)
    cab_right = int(size * 0.42)
    cab_top = int(size * 0.30)
    bed_left = cab_right + int(size * 0.02)
    bed_right = size - inset - int(size * 0.08)

    fill_rect(pixels, cab_left, cab_top, cab_right, body_bottom, WHITE)
    fill_rect(pixels, bed_left, body_top, bed_right, body_bottom, WHITE)
    # windshield
    fill_rect(
        pixels,
        cab_left + int(size * 0.06),
        cab_top + int(size * 0.06),
        cab_right - int(size * 0.04),
        body_top - int(size * 0.02),
        DARK,
    )
    wheel_y = body_bottom
    wheel_r = max(4, int(size * 0.08))
    fill_circle(pixels, cab_left + int(size * 0.12), wheel_y, wheel_r, DARK)
    fill_circle(pixels, bed_right - int(size * 0.10), wheel_y, wheel_r, DARK)
    return pixels


def main() -> None:
    out = Path("public/icons")
    out.mkdir(parents=True, exist_ok=True)
    write_png(out / "icon-192.png", draw_icon(192, padded=False))
    write_png(out / "icon-512.png", draw_icon(512, padded=False))
    write_png(out / "icon-512-maskable.png", draw_icon(512, padded=True))
    write_png(Path("public/apple-touch-icon.png"), draw_icon(180, padded=False))


if __name__ == "__main__":
    main()
