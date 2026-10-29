"""Builds the GD heart (with a leaf) as SVG from simple geometry, mirroring the original logo."""
import math, sys

W = 58            # stroke width
R = 178           # lobe radius
C1 = (325, 290)   # left lobe (G)
C2 = (675, 290)   # right lobe (D)
TIP = (500, 742)

def pt(c, deg):
    a = math.radians(deg)
    return (c[0] + R * math.cos(a), c[1] + R * math.sin(a))

def tangent(c, p, side):
    dx, dy = p[0] - c[0], p[1] - c[1]
    d = math.hypot(dx, dy)
    base = math.atan2(dy, dx)
    off = math.acos(R / d)
    a = base + off if side == 'left' else base - off
    return (c[0] + R * math.cos(a), c[1] + R * math.sin(a))

def f(p): return f"{p[0]:.1f} {p[1]:.1f}"

def heart_paths(g_end_deg=-40):
    gs = pt(C1, g_end_deg)
    left = (C1[0] - R, C1[1])
    right = (C2[0] + R, C2[1])
    # Sides bulge outward like the original, then run into the stem at the bottom.
    g = (f"M {f(gs)} A {R} {R} 0 0 0 {f(left)} "
         f"C {left[0]} 430 300 585 490 708")
    bar = "M 392 463 H 498 V 736"
    d = (f"M 498 408 V 290 A {R} {R} 0 1 1 {f(right)} "
         f"C {right[0]} 430 700 585 536 712")
    return g, bar, d, gs

def leaf(base, angle_deg, length, width):
    """Almond leaf from base pointing along angle (degrees, SVG coords)."""
    a = math.radians(angle_deg)
    ux, uy = math.cos(a), math.sin(a)
    nx, ny = -uy, ux
    tip = (base[0] + ux * length, base[1] + uy * length)
    c1 = (base[0] + ux * length * 0.25 + nx * width, base[1] + uy * length * 0.25 + ny * width)
    c2 = (base[0] + ux * length * 0.8 + nx * width * 0.55, base[1] + uy * length * 0.8 + ny * width * 0.55)
    c3 = (base[0] + ux * length * 0.8 - nx * width * 0.55, base[1] + uy * length * 0.8 - ny * width * 0.55)
    c4 = (base[0] + ux * length * 0.25 - nx * width, base[1] + uy * length * 0.25 - ny * width)
    body = f"M {f(base)} C {f(c1)} {f(c2)} {f(tip)} C {f(c3)} {f(c4)} {f(base)} Z"
    vein = f"M {f(base)} Q {f((base[0] + ux * length * 0.5 + nx * 6, base[1] + uy * length * 0.5 + ny * 6))} {f((base[0] + ux * length * 0.82, base[1] + uy * length * 0.82))}"
    return body, vein

def svg(variant):
    g, bar, d, gs = heart_paths()
    # The G's top end turns into a leaf that grows up and to the right.
    body, vein = leaf((gs[0] - 14, gs[1] + 14), -58, 245, 78)
    gap = '<rect x="527" y="560" width="30" height="220" fill="black"/>'
    if variant == 'original':
        stroke, leaf_fill, vein_col, bg = '#3a3a3c', None, None, None
    elif variant == 'light':
        stroke, leaf_fill, vein_col, bg = '#1f2a26', 'url(#leaf)', '#0d4d2e', None
    elif variant == 'mark':
        stroke, leaf_fill, vein_col, bg = 'url(#heart)', 'url(#leaf)', '#0b3d25', None
    else:  # app icon on the app's dark background
        stroke, leaf_fill, vein_col, bg = 'url(#heart)', 'url(#leaf)', '#0b3d25', 'url(#bg)'
    defs = '''<defs>
    <linearGradient id="heart" gradientUnits="userSpaceOnUse" x1="0" y1="100" x2="0" y2="740"><stop offset="0" stop-color="#f4fff9"/><stop offset="1" stop-color="#bfeed6"/></linearGradient>
    <linearGradient id="leaf" gradientUnits="userSpaceOnUse" x1="440" y1="180" x2="580" y2="-40"><stop offset="0" stop-color="#21c977"/><stop offset="1" stop-color="#7dffc0"/></linearGradient>
    <radialGradient id="bg" cx="0.5" cy="0.42" r="0.75"><stop offset="0" stop-color="#123327"/><stop offset="0.6" stop-color="#08100d"/><stop offset="1" stop-color="#05080a"/></radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <mask id="cut"><rect x="-200" y="-200" width="1400" height="1400" fill="white"/>GAP</mask>
  </defs>'''.replace('GAP', gap)
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="50 -115 900 900">', defs]
    if bg:
        s = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-30 -125 1060 1060">', defs, '<rect x="-30" y="-125" width="1060" height="1060" fill="url(#bg)"/>']
    s.append(f'<g mask="url(#cut)" fill="none" stroke="{stroke}" stroke-width="{W}" stroke-linejoin="miter" stroke-miterlimit="10">')
    for p in (g, bar, d):
        s.append(f'<path d="{p}"/>')
    s.append('</g>')
    if leaf_fill:
        glow = ' filter="url(#glow)"' if variant in ('app', 'mark') else ''
        s.append(f'<g{glow}><path d="{body}" fill="{leaf_fill}"/><path d="{vein}" fill="none" stroke="{vein_col}" stroke-width="9" stroke-linecap="round"/></g>')
    s.append('</svg>')
    return '\n'.join(s)

for v in sys.argv[1:]:
    open(f'{v}.svg', 'w').write(svg(v))
    print(v)
