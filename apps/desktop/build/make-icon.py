#!/usr/bin/env python3
"""
Generate the NoTomorrow macOS app icon.

Source: a single 1024x1024 RGBA PNG with the sunset-dusk gradient applied
to a Big Sur–style squircle, an NT monogram in the display font, a rooftop
horizon line, and a tiny sun disc behind the monogram.

Output: build/icon.iconset/icon_{16,32,128,256,512}{,@2x}.png — the format
`iconutil` expects to fold into a .icns.

Run from apps/desktop:  python3 build/make-icon.py
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT_DIR = os.path.join(os.path.dirname(__file__), 'icon.iconset')
os.makedirs(OUT_DIR, exist_ok=True)

SIZE = 1024

# Sunset palette — same stops as packages/ui/src/tailwind.preset.ts
SUNSET = [
    (0.00, (0x1A, 0x12, 0x38)),   # night
    (0.32, (0x4B, 0x1E, 0x55)),   # plum
    (0.58, (0xB7, 0x3E, 0x63)),   # magenta
    (0.78, (0xE6, 0x6B, 0x4A)),   # coral
    (1.00, (0xF2, 0xA6, 0x68)),   # peach
]
SUN = (0xF7, 0xC5, 0x66)
HORIZON = (0x0B, 0x09, 0x08)
INK = (0xEA, 0xE4, 0xD6)   # warm off-white (charcoal token)


def lerp(a, b, t):
    return int(a + (b - a) * t)


def gradient_color(y_norm):
    """Pick a sunset color by vertical position 0..1."""
    for i in range(len(SUNSET) - 1):
        t0, c0 = SUNSET[i]
        t1, c1 = SUNSET[i + 1]
        if t0 <= y_norm <= t1:
            tt = (y_norm - t0) / (t1 - t0)
            return (lerp(c0[0], c1[0], tt), lerp(c0[1], c1[1], tt), lerp(c0[2], c1[2], tt))
    return SUNSET[-1][1]


def squircle_mask(size, radius_ratio=0.225):
    """Big Sur–style continuous-curvature squircle approximated with a
    rounded rectangle. macOS apps use ~22.5% corner radius at 1024."""
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    r = int(size * radius_ratio)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    return mask


def render_gradient(size):
    grad = Image.new('RGB', (size, size))
    pixels = grad.load()
    for y in range(size):
        c = gradient_color(y / (size - 1))
        for x in range(size):
            pixels[x, y] = c
    return grad


def composite_sun(base, size):
    """Soft radial sun disc behind where the monogram will sit."""
    cx = size * 0.5
    cy = size * 0.55
    rmax = size * 0.42
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    pixels = overlay.load()
    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            d = (dx * dx + dy * dy) ** 0.5
            if d < rmax:
                # alpha falls off smoothly to zero at rmax
                a = 1.0 - (d / rmax)
                a = a * a * a   # cubic falloff — softer halo
                alpha = int(180 * a)
                pixels[x, y] = (*SUN, alpha)
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=size * 0.015))
    return Image.alpha_composite(base, overlay)


def draw_horizon(base, size):
    """A thin dark rooftop horizon line near the bottom third."""
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    y0 = int(size * 0.76)
    # subtle roof skyline — a couple of stepped blocks
    poly = [
        (0, y0),
        (size * 0.18, y0),
        (size * 0.18, y0 - size * 0.018),
        (size * 0.34, y0 - size * 0.018),
        (size * 0.34, y0 + size * 0.012),
        (size * 0.52, y0 + size * 0.012),
        (size * 0.52, y0 - size * 0.022),
        (size * 0.68, y0 - size * 0.022),
        (size * 0.68, y0),
        (size, y0),
        (size, size),
        (0, size),
    ]
    draw.polygon(poly, fill=(*HORIZON, 235))
    return Image.alpha_composite(base, overlay)


def draw_monogram(base, size):
    """Centered 'NT' in the display font with a faint warm drop shadow."""
    overlay = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    # Try to find a heavy condensed display face; fall back to default.
    candidates = [
        '/System/Library/Fonts/Supplemental/Impact.ttf',
        '/System/Library/Fonts/Supplemental/Futura.ttc',
        '/System/Library/Fonts/HelveticaNeue.ttc',
    ]
    font = None
    px = int(size * 0.52)
    for path in candidates:
        try:
            font = ImageFont.truetype(path, px)
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()
    text = 'NT'
    bbox = draw.textbbox((0, 0), text, font=font, anchor='lt')
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size - w) / 2 - bbox[0]
    y = (size - h) / 2 - bbox[1] - size * 0.03
    # warm drop shadow
    shadow_layer = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.text((x + size * 0.012, y + size * 0.018), text, font=font, fill=(0, 0, 0, 180))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(radius=size * 0.012))
    overlay = Image.alpha_composite(overlay, shadow_layer)
    draw = ImageDraw.Draw(overlay)
    draw.text((x, y), text, font=font, fill=(*INK, 255))
    return Image.alpha_composite(base, overlay)


def make_icon(size=SIZE):
    grad = render_gradient(size).convert('RGBA')
    grad = composite_sun(grad, size)
    grad = draw_horizon(grad, size)
    grad = draw_monogram(grad, size)
    # Apply squircle mask so corners are properly rounded.
    mask = squircle_mask(size)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask=mask)
    return out


def main():
    master = make_icon(SIZE)
    master.save(os.path.join(OUT_DIR, '..', 'icon-1024.png'))
    # macOS iconset naming: icon_{size}{@2x}.png
    plan = [
        (16, 'icon_16x16.png'),
        (32, 'icon_16x16@2x.png'),
        (32, 'icon_32x32.png'),
        (64, 'icon_32x32@2x.png'),
        (128, 'icon_128x128.png'),
        (256, 'icon_128x128@2x.png'),
        (256, 'icon_256x256.png'),
        (512, 'icon_256x256@2x.png'),
        (512, 'icon_512x512.png'),
        (1024, 'icon_512x512@2x.png'),
    ]
    for px, name in plan:
        resized = master.resize((px, px), Image.LANCZOS)
        out = os.path.join(OUT_DIR, name)
        resized.save(out, optimize=True)
        print(f'  {px:>4}px  -> {name}')


if __name__ == '__main__':
    main()
