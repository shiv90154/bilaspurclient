"""Builds every logo-derived asset (app icons, notification icon, splash, Play graphics, web icons)
from the single logo PNG the client gave. Run from the repo root: python branding/make_assets.py .  (needs Pillow)"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = sys.argv[1]
SRC = os.path.join(ROOT, "admin-web/public/logo.png")
BG = (253, 250, 243)          # logo cream
FOREST = (31, 77, 44)         # #1F4D2C
FOREST_DEEP = (13, 48, 28)    # #0D301C
GOLD = (171, 128, 59)         # #AB803B
GOLD_TINT = (245, 232, 200)
FONT = os.path.join(ROOT, "student-app/assets/fonts")


def p(*parts):
    path = os.path.join(ROOT, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


logo = Image.open(SRC).convert("RGB")
W, H = logo.size

# --- Transparent logo: alpha from the distance to the cream page, colour un-mixed from it.
diff = ImageChops.difference(logo, Image.new("RGB", logo.size, BG)).convert("L")
alpha = diff.point(lambda v: 0 if v < 6 else min(255, (v - 6) * 4))
src_px, a_px = logo.load(), alpha.load()
clear = Image.new("RGBA", logo.size)
out = clear.load()
for y in range(H):
    for x in range(W):
        a = a_px[x, y]
        if a == 0:
            continue
        r, g, b = src_px[x, y]
        f = a / 255
        out[x, y] = tuple(max(0, min(255, round((c - bg * (1 - f)) / f))) for c, bg in zip((r, g, b), BG)) + (a,)

# Ī's macron sits just right of the book; erase it so the emblem stands alone.
emblem_box = (262, 136, 988, 752)
emblem = clear.crop(emblem_box)
ImageDraw.Draw(emblem).rectangle((870 - 262, 728 - 136, 988 - 262, 752 - 136), fill=(0, 0, 0, 0))
emblem = emblem.crop(emblem.getbbox())
wordmark = clear.crop((150, 136, 1100, 1020))  # emblem + DHĪ, no tagline
wordmark = wordmark.crop(wordmark.getbbox())


def white(img):
    w = Image.new("RGBA", img.size, (255, 255, 255, 0))
    w.putalpha(img.getchannel("A"))
    return Image.composite(Image.new("RGBA", img.size, (255, 255, 255, 255)), w, img.getchannel("A"))


def fit(img, box_w, box_h):
    s = min(box_w / img.width, box_h / img.height)
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def on_canvas(img, size, scale, bg=None, dy=0.0):
    """img centred on a size×size canvas, its longer side = scale×size."""
    c = Image.new("RGBA", (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    e = fit(img, size * scale, size * scale)
    c.alpha_composite(e, ((size - e.width) // 2, (size - e.height) // 2 + round(dy * size)))
    return c


# --- Branding pack for the client / printers
clear.crop(clear.getbbox()).save(p("branding/logo-transparent.png"))
white(clear).crop(clear.getbbox()).save(p("branding/logo-white.png"))
emblem.save(p("branding/emblem-transparent.png"))
white(emblem).save(p("branding/emblem-white.png"))
on_canvas(emblem, 1024, 0.78, BG).convert("RGB").save(p("branding/emblem-square-1024.png"))

# --- Android launcher icon: legacy squares + adaptive layers + themed (monochrome) layer
res = p("student-app/android/app/src/main/res/x")[:-1]
DENS = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for d, k in DENS.items():
    on_canvas(emblem, round(48 * k), 0.80, BG).save(p(res, f"mipmap-{d}", "ic_launcher.png"))
    # Adaptive: 108dp canvas, the launcher mask keeps the middle 66dp, so stay inside ~60%.
    on_canvas(emblem, round(108 * k), 0.60).save(p(res, f"mipmap-{d}", "ic_launcher_foreground.png"))
    on_canvas(white(emblem), round(108 * k), 0.60).save(p(res, f"mipmap-{d}", "ic_launcher_monochrome.png"))
    # Status-bar notification icon: white silhouette on transparent, 24dp.
    on_canvas(white(emblem), round(24 * k), 0.92).save(p(res, f"drawable-{d}", "ic_stat_notify.png"))
    # Splash image (pre-Android 12): emblem, 160dp.
    on_canvas(emblem, round(160 * k), 0.90).save(p(res, f"drawable-{d}", "splash_logo.png"))

# --- Play Store graphics
play = "play-store/graphics"
on_canvas(emblem, 512, 0.78, BG).convert("RGB").save(p(play, "icon-512.png"))

fg = Image.new("RGBA", (1024, 500), BG + (255,))
d = ImageDraw.Draw(fg)
d.rectangle((470, 0, 1024, 500), fill=FOREST_DEEP + (255,))
d.ellipse((860, -140, 1160, 160), outline=GOLD + (90,), width=26)
mark = fit(wordmark, 380, 420)
fg.alpha_composite(mark, ((470 - mark.width) // 2, (500 - mark.height) // 2))
bold = ImageFont.truetype(os.path.join(FONT, "Poppins-Bold.ttf"), 44)
semi = ImageFont.truetype(os.path.join(FONT, "Poppins-SemiBold.ttf"), 22)
reg = ImageFont.truetype(os.path.join(FONT, "Poppins-Regular.ttf"), 21)
x = 520
d.text((x, 120), "AYURVEDA CLASSROOM", font=semi, fill=GOLD_TINT)
d.text((x, 152), "Crack AIAPGET", font=bold, fill=(255, 255, 255))
d.text((x, 206), "& AMO with Dr. Pardeuman", font=bold.font_variant(size=34), fill=(255, 255, 255))
d.line((x, 270, x + 70, 270), fill=GOLD, width=4)
for i, t in enumerate(["Live classes  ·  PDF notes", "Test series with ranks  ·  Doubt solving"]):
    d.text((x, 292 + i * 34), t, font=reg, fill=(225, 235, 225))
fg.convert("RGB").save(p(play, "feature-graphic-1024x500.png"))

# --- Website icons (favicon was the full logo: unreadable at 16 px)
web = "admin-web/src/app"
on_canvas(emblem, 512, 0.82, BG).save(p(web, "icon.png"))
on_canvas(emblem, 180, 0.80, BG).convert("RGB").save(p(web, "apple-icon.png"))
on_canvas(emblem, 256, 0.92, BG).save(p(web, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("done")
