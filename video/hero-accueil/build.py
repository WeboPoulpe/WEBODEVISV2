# Fabrique index.html et compositions/*.html à partir des dessins (assets/svg) et des réglages ci-dessous.
# Relancer après une retouche : python build.py
import io, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
FOREST, CREAM, TERRA, INK, PAPER, PEACH = '#1C2621', '#F3EEE6', '#B4502D', '#1B1A17', '#F7F3EC', '#E5AE92'

os.makedirs(os.path.join(HERE, 'compositions'), exist_ok=True)
os.makedirs(os.path.join(HERE, 'assets', 'screens'), exist_ok=True)
for src, dst in [('devis-mariage-haut.png', 'devis.png'), ('evenement-extras-haut.png', 'evenement.png'), ('accueil-haut.png', 'accueil.png')]:
    shutil.copyfile(os.path.join(HERE, 'captures', src), os.path.join(HERE, 'assets', 'screens', dst))

_uid = [0]


def svg(name):
    s = io.open(os.path.join(HERE, 'assets', 'svg', name + '.svg'), encoding='utf-8').read()
    _uid[0] += 1
    return s.replace('_R_0_', 'u%d' % _uid[0]).replace('story-van-window', 'vanwin%d' % _uid[0])


def words(text, accent=()):
    out = []
    for line in text.split('|'):
        out.append('<span class="ln">' + ' '.join(
            '<span class="w%s">%s</span>' % (' acc' if w.strip(',.') in accent else '', w) for w in line.split(' ')) + '</span>')
    return ''.join(out)


COMMON = """
@font-face{font-family:'Bricolage Grotesque';src:url('assets/fonts/bricolage.woff2') format('woff2');font-weight:200 800;}
@font-face{font-family:'Instrument Sans';src:url('assets/fonts/instrument.woff2') format('woff2');font-weight:400 700;}
#root{position:absolute;inset:0;overflow:hidden;font-family:'Instrument Sans',sans-serif;
  --n-200:230 223 211;--n-300:209 201 187;--n-400:163 156 142;--n-600:87 83 76;--n-800:42 40 37;--n-900:27 26 23;
  --p-300:229 174 146;--p-400:216 140 104;--p-700:180 80 45;--p-800:150 63 34;--sage:63 107 79;--forest:28 38 33;
  --font-display:'Bricolage Grotesque';}
.fill{position:absolute;inset:0;}
.day{position:absolute;font:600 46px 'Instrument Sans',sans-serif;letter-spacing:-0.01em;white-space:nowrap;}
.title{position:absolute;font:800 132px/1 'Bricolage Grotesque',sans-serif;letter-spacing:-0.03em;}
.title .ln{display:block;white-space:nowrap;}
.title .w{display:inline-block;}
.title .acc{color:var(--acc);}
.shot{position:absolute;overflow:hidden;border-radius:28px;background:#F3EEE6;box-shadow:0 30px 80px rgba(20,24,20,.22);}
.cam{position:absolute;left:0;top:0;width:2560px;}
.cam img{display:block;width:2560px;height:auto;}
.julien-box{position:absolute;}
.julien{display:block;width:100%;height:auto;overflow:visible;}
"""


def scene(sid, dur, css, body, js):
    html = """<template>
  <style>%s%s</style>
  <div id="root" data-composition-id="%s" data-width="1920" data-height="1080">
%s
  </div>
  <script>
    (function () {
      const tl = gsap.timeline({ paused: true });
      const D = %s;
      const titleIn = (sel, at) => tl.fromTo(sel + " .w", { opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.16, stagger: 0.07, ease: "power2.out" }, at);
      const breathe = (sel, n) => tl.fromTo(sel + " .julien-body", { scaleY: 1, transformOrigin: "50%% 100%%" }, { scaleY: 1.022, duration: 0.85, yoyo: true, repeat: n, ease: "sine.inOut" }, 0);
%s
      tl.to({}, { duration: 0.001 }, D - 0.001);
      window.__timelines["%s"] = tl;
    })();
  </script>
</template>
""" % (COMMON, css, sid, body, dur, js, sid)
    io.open(os.path.join(HERE, 'compositions', sid + '.html'), 'w', encoding='utf-8', newline='\n').write(html)


_lid = [0]


def layer(inner, dur):
    _lid[0] += 1
    return '    <div id="calque-%d" class="clip fill" data-start="0" data-duration="%s" data-track-index="0">%s</div>' % (_lid[0], dur, inner)


# ── 0. L'accroche ────────────────────────────────────────────────────────────
D0 = 4.4
scene('s0', D0, """
#root{background:%s;color:%s;--acc:#E5AE92;}
#s0-title{left:110px;top:300px;font-size:168px;}
#s0-sub{left:116px;top:712px;font:600 68px/1.18 'Bricolage Grotesque',sans-serif;letter-spacing:-0.015em;color:rgba(247,243,236,.82);}
#s0-rule{position:absolute;left:116px;top:668px;width:150px;height:8px;border-radius:4px;background:%s;}
""" % (FOREST, PAPER, TERRA),
      '\n'.join([
          layer('<div class="title" id="s0-title">%s</div>' % words('Le logiciel clé en main|des traiteurs', ('clé', 'en', 'main')), D0),
          layer('<div id="s0-rule"></div><div class="title" id="s0-sub">%s</div>' % words('De la demande à la facturation,|en passant par l’organisation'), D0),
      ]),
      """
      tl.fromTo("#s0-rule", { scaleX: 0, transformOrigin: "0 50%" }, { scaleX: 1, duration: 0.45, ease: "expo.out" }, 0.45);
      tl.fromTo("#s0-sub .w", { opacity: 0.18 }, { opacity: 1, duration: 0.22, stagger: 0.11, ease: "power1.out" }, 0.6);
      tl.to(["#s0-title", "#s0-sub", "#s0-rule"], { opacity: 0, filter: "blur(12px)", duration: 0.22, ease: "power2.in" }, D - 0.26);
""")

# ── 1. Lundi 7 h 30 : six demandes ───────────────────────────────────────────
NOTIFS = [('Camille Berthier', 'Mariage · 110 couverts'), ('Emmanuel Roussel', 'Séminaire · 35 couverts'),
          ('Anaïs Pichon', 'Anniversaire · 50 couverts'), ('Céline Marchal', 'Baptême · 45 couverts'),
          ('Sophie Delaunay', 'Mariage · 140 couverts'), ('Laure Chevalier', 'Mariage · 120 couverts')]
notifs = ''.join(
    '<div class="notif" id="s1-n%d" style="top:%dpx"><div class="tile">%s</div><div><b>%s</b><span>%s</span></div></div>'
    % (i, 318 + i * 114, svg('logo-dark'), n, d) for i, (n, d) in enumerate(NOTIFS))
D1 = 3.8
scene('s1', D1, """
#root{background:%s;color:%s;--acc:#E5AE92;}
#s1-phone{position:absolute;left:1070px;top:64px;width:600px;height:1120px;border-radius:76px;background:#0B100E;}
#s1-screen{position:absolute;inset:18px;border-radius:60px;background:#2B3A33;overflow:hidden;}
#s1-clock{position:absolute;left:0;right:0;top:64px;text-align:center;font:700 150px/1 'Bricolage Grotesque';letter-spacing:-0.03em;color:%s;}
#s1-date{position:absolute;left:0;right:0;top:226px;text-align:center;font:500 32px 'Instrument Sans';color:rgba(247,243,236,.7);}
.notif{position:absolute;left:22px;width:520px;height:102px;border-radius:26px;background:#fff;color:%s;display:flex;align-items:center;gap:18px;padding:0 20px;box-sizing:border-box;}
.notif .tile{width:62px;height:62px;border-radius:16px;background:%s;display:flex;align-items:center;justify-content:center;flex:none;}
.notif .tile svg{width:42px;height:auto;}
.notif b{display:block;font:700 31px/1.15 'Instrument Sans';}
.notif span{display:block;font:500 28px/1.2 'Instrument Sans';color:#57534C;}
#s1-flood{background:#fff;clip-path:inset(400px 308px 578px 1110px round 26px);}
""" % (FOREST, PAPER, PAPER, INK, FOREST),
      '\n'.join([
          layer('<div class="day" style="left:110px;top:140px;color:%s">Lundi, 7 h 30</div>'
                '<div class="title" id="s1-title" style="left:106px;top:214px">%s</div>' % (PEACH, words('Six demandes|ce week-end', ('Six',))), D1),
          layer('<div class="julien-box" id="s1-julien" style="left:150px;top:590px;width:340px">%s</div>' % svg('julien-cafe'), D1),
          layer('<div id="s1-phone"><div id="s1-screen"><div id="s1-clock">07:30</div><div id="s1-date">lundi matin</div>%s</div></div>' % notifs, D1),
          layer('<div class="fill" id="s1-flood"></div>', D1),
      ]),
      """
      breathe("#s1-julien", 3);
      titleIn("#s1-title", 0.05);
      tl.fromTo("#s1-julien", { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.45, ease: "expo.out" }, 0.1);
      tl.fromTo("#s1-phone", { y: 260, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "expo.out" }, 0);
      for (let i = 0; i < 6; i++) {
        tl.fromTo("#s1-n" + i, { opacity: 0, y: -46, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.36, ease: "back.out(1.4)" }, 0.45 + i * 0.27);
      }
      tl.fromTo("#s1-flood", { opacity: 0 }, { opacity: 1, duration: 0.05 }, 2.92);
      tl.fromTo("#s1-flood", { clipPath: "inset(400px 308px 578px 1110px round 26px)", backgroundColor: "#ffffff" },
        { clipPath: "inset(0px 0px 0px 0px round 0px)", backgroundColor: "CREAMHEX", duration: 0.66, ease: "power2.inOut" }, 2.98);
""".replace("CREAMHEX", CREAM))

# ── 2. Lundi 9 h : le devis ──────────────────────────────────────────────────
D2 = 4.8
scene('s2', D2, """
#root{background:%s;color:%s;--acc:#B4502D;}
#s2-wipe{background:%s;}
""" % (CREAM, INK, TERRA),
      '\n'.join([
          layer('<div class="day" style="left:110px;top:140px;color:%s">Lundi, 9 h</div>'
                '<div class="title" id="s2-title" style="left:106px;top:214px">%s</div>' % (TERRA, words('Le devis|est parti', ('devis',))), D2),
          layer('<div class="julien-box" id="s2-julien" style="left:150px;top:590px;width:340px">%s</div>' % svg('julien-bureau'), D2),
          layer('<div class="shot" id="s2-shot" style="left:820px;top:96px;width:1200px;height:1100px"><div class="cam" id="s2-cam"><img src="assets/screens/devis.png" alt=""></div></div>', D2),
          layer('<div class="fill" id="s2-wipe"></div>', D2),
      ]),
      """
      breathe("#s2-julien", 4);
      titleIn("#s2-title", 0.15);
      tl.fromTo("#s2-shot", { opacity: 0, y: 70 }, { opacity: 1, y: 0, duration: 0.55, ease: "expo.out" }, 0.05);
      tl.fromTo("#s2-cam", { x: -327, y: -186, scale: 0.62, transformOrigin: "0 0" }, { x: -327, y: -186, scale: 0.62, duration: 0.01 }, 0);
      tl.to("#s2-cam", { x: -3960, y: -2011, scale: 1.9, duration: 1.15, ease: "power2.inOut" }, 1.55);
      tl.fromTo("#s2-wipe", { yPercent: 100 }, { yPercent: 0, duration: 0.45, ease: "power2.inOut" }, D - 0.5);
""")

# ── 3. Mercredi : signé, acompte reçu ────────────────────────────────────────
D3 = 3.2
scene('s3', D3, """
#root{background:%s;color:%s;}
#s3-wipe{background:%s;}
""" % (TERRA, PAPER, CREAM),
      '\n'.join([
          layer('<div class="day" style="left:110px;top:120px;color:rgba(247,243,236,.75)">Mercredi</div>'
                '<div class="title" id="s3-title" style="left:106px;top:194px">%s</div>' % words('Signé, acompte reçu'), D3),
          layer('<div class="shot" id="s3-shot" style="left:110px;top:440px;width:1700px;height:581px"><div class="cam" id="s3-cam"><img src="assets/screens/evenement.png" alt=""></div></div>', D3),
          layer('<div class="fill" id="s3-wipe"></div>', D3),
      ]),
      """
      titleIn("#s3-title", 0.1);
      tl.fromTo("#s3-shot", { opacity: 0, y: 90 }, { opacity: 1, y: 0, duration: 0.55, ease: "expo.out" }, 0.15);
      tl.fromTo("#s3-cam", { x: -506, y: -297, scale: 0.878, transformOrigin: "0 0" }, { x: -506, y: -297, scale: 0.878, duration: 0.01 }, 0);
      tl.to("#s3-cam", { x: -810, y: -486, scale: 1.38, duration: 0.8, ease: "power2.inOut" }, 1.15);
      tl.fromTo("#s3-wipe", { yPercent: 100 }, { yPercent: 0, duration: 0.42, ease: "power2.inOut" }, D - 0.47);
""")

# ── 4. Jeudi : les missions partent ──────────────────────────────────────────
D4 = 3.4
CURSOR = '<svg viewBox="0 0 40 52" width="92"><path d="M4 3 L4 41 L14 32 L21 48 L28 45 L21 29 L35 29 Z" fill="#1B1A17" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>'
scene('s4', D4, """
#root{background:%s;color:%s;--acc:#B4502D;}
#s4-cursor{position:absolute;left:0;top:0;}
#s4-wipe{background:%s;}
""" % (CREAM, INK, FOREST),
      '\n'.join([
          layer('<div class="shot" id="s4-shot" style="left:90px;top:96px;width:1130px;height:1100px"><div class="cam" id="s4-cam"><img src="assets/screens/evenement.png" alt=""></div></div>', D4),
          layer('<div class="day" style="left:1300px;top:140px;color:%s">Jeudi</div>'
                '<div class="title" id="s4-title" style="left:1296px;top:214px;font-size:104px">%s</div>' % (TERRA, words('Les missions|partent en|un clic', ('un', 'clic'))), D4),
          layer('<div class="julien-box" id="s4-julien" style="left:1440px;top:640px;width:310px">%s</div>' % svg('julien-telephone'), D4),
          layer('<div id="s4-cursor">%s</div>' % CURSOR, D4),
          layer('<div class="fill" id="s4-wipe"></div>', D4),
      ]),
      """
      breathe("#s4-julien", 4);
      titleIn("#s4-title", 0.2);
      tl.fromTo("#s4-shot", { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.55, ease: "expo.out" }, 0.05);
      tl.fromTo("#s4-cam", { x: -336, y: -668, scale: 0.584, transformOrigin: "0 0" }, { x: -336, y: -668, scale: 0.584, duration: 0.01 }, 0);
      tl.to("#s4-cam", { x: -1885, y: -1489, scale: 1.15, duration: 0.75, ease: "power2.inOut" }, 0.85);
      tl.fromTo("#s4-cursor", { x: 1500, y: 1150, scale: 1 }, { x: 880, y: 520, duration: 0.6, ease: "power3.out" }, 1.1);
      tl.to("#s4-cursor", { scale: 0.82, duration: 0.08, ease: "power2.in" }, 1.78);
      tl.to("#s4-cursor", { scale: 1, duration: 0.14, ease: "power2.out" }, 1.86);
      tl.to("#s4-cam", { scale: 1.19, x: -1965, y: -1553, duration: 0.08, ease: "power2.in" }, 1.78);
      tl.to("#s4-cam", { scale: 1.15, x: -1885, y: -1489, duration: 0.3, ease: "expo.out" }, 1.86);
      tl.fromTo("#s4-wipe", { xPercent: -100 }, { xPercent: 0, duration: 0.4, ease: "power3.in" }, D - 0.43);
""")

# ── 5. Samedi : le jour J ────────────────────────────────────────────────────
D5 = 3.4
dashes = ''.join('<i style="left:%dpx"></i>' % (i * 260) for i in range(16))
scene('s5', D5, """
#root{background:%s;color:%s;--acc:#E5AE92;}
#s5-road{position:absolute;left:0;right:0;top:930px;bottom:0;background:#2B3A33;}
#s5-dashes{position:absolute;left:0;top:1010px;width:4200px;height:10px;}
#s5-dashes i{position:absolute;top:0;width:130px;height:10px;border-radius:5px;background:rgba(247,243,236,.35);}
#s5-van{position:absolute;left:0;top:452px;width:980px;}
#s5-van .story-van svg{display:block;width:100%%;height:auto;overflow:visible;}
#s5-wipe{background:%s;}
""" % (FOREST, PAPER, CREAM),
      '\n'.join([
          layer('<div id="s5-road"></div><div id="s5-dashes">%s</div>' % dashes, D5),
          layer('<div class="day" style="left:110px;top:110px;color:%s">Samedi</div>'
                '<div class="title" id="s5-title" style="left:106px;top:184px">%s</div>' % (PEACH, words('Le jour J,|tout est prêt', ('prêt',))), D5),
          layer('<div id="s5-van">%s</div>' % svg('van'), D5),
          layer('<div class="fill" id="s5-wipe"></div>', D5),
      ]),
      """
      titleIn("#s5-title", 0.15);
      tl.fromTo("#s5-dashes", { x: 0 }, { x: -1900, duration: D, ease: "none" }, 0);
      tl.fromTo("#s5-van", { x: -1050 }, { x: 700, duration: 0.95, ease: "expo.out" }, 0.05);
      tl.to("#s5-van", { x: 820, duration: 1.55, ease: "none" }, 1.0);
      tl.to("#s5-van", { x: 2100, duration: 0.6, ease: "power3.in" }, 2.55);
      tl.fromTo("#s5-van .story-van-body", { y: 0 }, { y: -7, duration: 0.22, yoyo: true, repeat: 13, ease: "sine.inOut" }, 0.1);
      tl.fromTo("#s5-wipe", { xPercent: -100 }, { xPercent: 0, duration: 0.5, ease: "power3.in" }, D - 0.53);
""")

# ── 6. Lundi suivant : ce que j'ai gagné ─────────────────────────────────────
D6 = 2.6
scene('s6', D6, """
#root{background:%s;color:%s;--acc:#B4502D;}
#s6-flood{background:%s;clip-path:inset(120px 81px 122px 1010px round 44px);}
""" % (CREAM, INK, FOREST),
      '\n'.join([
          layer('<div class="day" style="left:110px;top:140px;color:%s">Lundi suivant</div>'
                '<div class="title" id="s6-title" style="left:106px;top:214px">%s</div>' % (TERRA, words('Je sais ce|que je gagne', ('gagne',))), D6),
          layer('<div class="julien-box" id="s6-julien" style="left:150px;top:590px;width:340px">%s</div>' % svg('julien-victoire'), D6),
          layer('<div class="shot" id="s6-shot" style="left:1010px;top:120px;width:829px;height:838px;border-radius:44px;background:#1C2621"><div class="cam" id="s6-cam"><img src="assets/screens/accueil.png" alt=""></div></div>', D6),
          layer('<div class="fill" id="s6-flood"></div>', D6),
      ]),
      """
      breathe("#s6-julien", 2);
      titleIn("#s6-title", 0.15);
      tl.fromTo("#s6-cam", { x: -1947, y: -559, scale: 1.105, transformOrigin: "0 0" }, { x: -1947, y: -559, scale: 1.105, duration: 0.01 }, 0);
      tl.fromTo("#s6-shot", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.55, ease: "expo.out" }, 0.05);
      tl.fromTo("#s6-flood", { opacity: 0 }, { opacity: 1, duration: 0.12 }, D - 0.62);
      tl.fromTo("#s6-flood", { clipPath: "inset(120px 81px 122px 1010px round 44px)" }, { clipPath: "inset(0px 0px 0px 0px round 0px)", duration: 0.5, ease: "power2.inOut" }, D - 0.55);
""")

# ── 7. Fin ───────────────────────────────────────────────────────────────────
D7 = 3.0
scene('s7', D7, """
#root{background:%s;color:%s;}
#s7-lock{position:absolute;left:0;right:0;top:350px;display:flex;align-items:center;justify-content:center;gap:44px;}
#s7-mark svg{display:block;height:170px;width:auto;}
#s7-name{font:500 190px/1 'Outfit',sans-serif;letter-spacing:-0.02em;white-space:nowrap;}
#s7-title{left:0;right:0;top:620px;text-align:center;font-size:84px;font-weight:700;color:%s;}
""" % (FOREST, PAPER, PEACH),
      '\n'.join([
          layer('<div id="s7-lock"><div id="s7-mark">%s</div><div id="s7-name">WeboDevis</div></div>' % svg('logo-dark'), D7),
          layer('<div class="title" id="s7-title">%s</div>' % words('Le logiciel des traiteurs'), D7),
      ]),
      """
      tl.fromTo("#s7-mark", { opacity: 0, scale: 0.5, rotation: -14 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: "back.out(1.6)" }, 0.05);
      tl.fromTo("#s7-name", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: "power3.out" }, 0.28);
      titleIn("#s7-title", 0.75);
""")

# ── Racine ───────────────────────────────────────────────────────────────────
SCENES = [('s0', D0), ('s1', D1), ('s2', D2), ('s3', D3), ('s4', D4), ('s5', D5), ('s6', D6), ('s7', D7)]
hosts, t = [], 0.0
for i, (sid, d) in enumerate(SCENES):
    hosts.append('      <div id="%s" class="clip" data-composition-id="%s" data-composition-src="compositions/%s.html" data-start="%s" data-duration="%s" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index:%d"></div>'
                 % (sid, sid, sid, round(t, 2), d, i + 1))
    t += d
index = """<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: %s; }
      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="%s" data-width="1920" data-height="1080">
%s
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
""" % (FOREST, round(t, 2), '\n'.join(hosts))
io.open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8', newline='\n').write(index)
print('ok', round(t, 2), 's')
