# 產生 PWA 圖示：深紅布面電話簿＋燙金框＋白色圓牌上的綠色話筒
import os
from PIL import Image, ImageDraw
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(out, exist_ok=True)

def draw(size, pad):
    s = 4 * size
    im = Image.new('RGB', (s, s), '#4A3426')
    d = ImageDraw.Draw(im)
    x0, x1 = pad * s, (1 - pad) * s
    w = x1 - x0
    bx0, by0, bx1, by1 = x0 + w * .14, x0 + w * .06, x1 - w * .1, x1 - w * .06
    d.rounded_rectangle([bx0 + w * .03, by0 + w * .03, bx1 + w * .03, by1 + w * .03], radius=w * .05, fill='#D9C894')
    d.rounded_rectangle([bx0, by0, bx1, by1], radius=w * .05, fill='#7A1E1E')
    d.rounded_rectangle([bx0 + w * .04, by0 + w * .04, bx1 - w * .04, by1 - w * .04], radius=w * .03, outline='#E3C26A', width=max(2, int(w * .012)))
    for k, c in enumerate(('#C8553D', '#3A7CA5', '#2E8B57', '#B8860B')):
        ty = by0 + w * (.16 + k * .16)
        d.rectangle([bx1, ty, bx1 + w * .07, ty + w * .12], fill=c)
    cx, cy, r = (bx0 + bx1) / 2, (by0 + by1) / 2, w * .25
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill='#FFF8E3')
    g = r * .62
    d.ellipse([cx - g, cy - g, cx + g, cy + g], fill='#1E8E3E')
    # 話筒：兩端圓頭＋中間弧
    h = g * .55
    d.rounded_rectangle([cx - h * .95, cy - h * .9, cx - h * .35, cy - h * .1], radius=h * .2, fill='#FFFFFF')
    d.rounded_rectangle([cx + h * .1, cy + h * .35, cx + h * .9, cy + h * .95], radius=h * .2, fill='#FFFFFF')
    d.line([cx - h * .6, cy - h * .2, cx - h * .2, cy + h * .35, cx + h * .25, cy + h * .62], fill='#FFFFFF', width=int(h * .38), joint='curve')
    return im.resize((size, size), Image.LANCZOS)

draw(192, .04).save(os.path.join(out, 'icon-192.png'))
draw(512, .04).save(os.path.join(out, 'icon-512.png'))
draw(512, .16).save(os.path.join(out, 'icon-maskable-512.png'))
print('ok')
