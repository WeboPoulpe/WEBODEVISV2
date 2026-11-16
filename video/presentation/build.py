# Vidéo de présentation avec voix (fin de la page d'accueil). Fabrique index.html et compositions/*.html.
# Les plans sont calés sur la voix (assets/audio/voix.wav) : chaque plan connaît son début dans le film.
# Relancer après une retouche : python build.py
import io, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
HERO = os.path.join(HERE, '..', 'hero-accueil', 'captures')
FOREST, CREAM, TERRA, INK, PAPER, PEACH, SAGE = '#1C2621', '#F3EEE6', '#B4502D', '#1B1A17', '#F7F3EC', '#E5AE92', '#E7EDDD'
TOTAL = 91.5

os.makedirs(os.path.join(HERE, 'compositions'), exist_ok=True)
os.makedirs(os.path.join(HERE, 'assets', 'screens'), exist_ok=True)
COPIES = [
    (os.path.join(HERO, 'prospects-haut.png'), 'demandes.png'), (os.path.join(HERO, 'devis-mariage-haut.png'), 'devis.png'),
    (os.path.join(HERO, 'evenement-extras-haut.png'), 'evenement.png'), (os.path.join(HERO, 'accueil-haut.png'), 'accueil.png'),
    (os.path.join(HERE, 'captures', 'evenement-courses.png'), 'courses.png'), (os.path.join(HERE, 'captures', 'evenement-checklist.png'), 'checklist.png'),
    (os.path.join(HERE, 'captures', 'evenement-materiel.png'), 'materiel.png'), (os.path.join(HERE, 'captures', 'marge.png'), 'marge.png'),
    (os.path.join(HERE, 'captures', 'm-mission-full.png'), 'mission.png'),
]
for src, dst in COPIES:
    if os.path.exists(src):
        shutil.copyfile(src, os.path.join(HERE, 'assets', 'screens', dst))

_uid = [0]
_lid = [0]


def svg(name):
    s = io.open(os.path.join(HERE, 'assets', 'svg', name + '.svg'), encoding='utf-8').read()
    _uid[0] += 1
    return s.replace('_R_0_', 'u' + str(_uid[0])).replace('story-van-window', 'vanwin' + str(_uid[0]))


def words(text, accent=()):
    out = []
    for line in text.split('|'):
        spans = ' '.join('<span class="w' + (' acc' if w.strip(',.') in accent else '') + '">' + w + '</span>' for w in line.split(' '))
        out.append('<span class="ln">' + spans + '</span>')
    return ''.join(out)


def title(tid, text, x, y, accent=(), size=None, extra=''):
    style = 'left:' + str(x) + 'px;top:' + str(y) + 'px;' + ('font-size:' + str(size) + 'px;' if size else '') + extra
    return '<div class="title" id="' + tid + '" style="' + style + '">' + words(text, accent) + '</div>'


def shot(sid, img, l, t, w, h, extra=''):
    return ('<div class="shot" id="' + sid + '" style="left:' + str(l) + 'px;top:' + str(t) + 'px;width:' + str(w) + 'px;height:' + str(h) + 'px;' + extra + '">'
            '<div class="cam" id="' + sid + '-cam"><img src="assets/screens/' + img + '" alt=""></div></div>')


def julien(jid, pose, x, y, w):
    return '<div class="julien-box" id="' + jid + '" style="left:' + str(x) + 'px;top:' + str(y) + 'px;width:' + str(w) + 'px">' + svg('julien-' + pose) + '</div>'


def layer(inner, dur):
    _lid[0] += 1
    return ('    <div id="calque-' + str(_lid[0]) + '" class="clip fill" data-start="0" data-duration="' + str(dur)
            + '" data-track-index="0">' + inner + '</div>')


COMMON = """
@font-face{font-family:'Bricolage Grotesque';src:url('assets/fonts/bricolage.woff2') format('woff2');font-weight:200 800;}
@font-face{font-family:'Instrument Sans';src:url('assets/fonts/instrument.woff2') format('woff2');font-weight:400 700;}
#root{position:absolute;inset:0;overflow:hidden;font-family:'Instrument Sans',sans-serif;
  --n-200:230 223 211;--n-300:209 201 187;--n-400:163 156 142;--n-600:87 83 76;--n-800:42 40 37;--n-900:27 26 23;
  --p-300:229 174 146;--p-400:216 140 104;--p-700:180 80 45;--p-800:150 63 34;--sage:63 107 79;--forest:28 38 33;
  --font-display:'Bricolage Grotesque';}
.fill{position:absolute;inset:0;}
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

HELPERS = """
      const wordsIn = (sel, at, gap) => tl.fromTo(sel + " .w", { opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.18, stagger: gap || 0.09, ease: "power2.out" }, at);
      const lineIn = (sel, n, at, gap) => tl.fromTo(sel + " .ln:nth-child(" + n + ") .w", { opacity: 0, filter: "blur(10px)" }, { opacity: 1, filter: "blur(0px)", duration: 0.18, stagger: gap || 0.09, ease: "power2.out" }, at);
      const hide = (sel) => tl.set(sel, { opacity: 0 }, 0);
      const pop = (sel, at) => tl.fromTo(sel, { opacity: 0, y: 46 }, { opacity: 1, y: 0, duration: 0.5, ease: "expo.out" }, at);
      const out = (sel, at) => tl.to(sel, { opacity: 0, filter: "blur(12px)", duration: 0.22, ease: "power2.in" }, at);
      const cam = (sel, x, y, s) => tl.fromTo(sel, { x: x, y: y, scale: s, transformOrigin: "0 0" }, { x: x, y: y, scale: s, duration: 0.01 }, 0);
      const camTo = (sel, x, y, s, at, d) => tl.to(sel, { x: x, y: y, scale: s, duration: d || 0.85, ease: "power2.inOut" }, at);
      const breathe = (sel, n) => tl.fromTo(sel + " .julien-body", { scaleY: 1, transformOrigin: "50% 100%" }, { scaleY: 1.022, duration: 0.85, yoyo: true, repeat: n, ease: "sine.inOut" }, 0);
      const wipeUp = (sel) => tl.fromTo(sel, { yPercent: 100 }, { yPercent: 0, duration: 0.42, ease: "power2.inOut" }, D - 0.46);
      const wipeSide = (sel) => tl.fromTo(sel, { xPercent: -100 }, { xPercent: 0, duration: 0.42, ease: "power3.in" }, D - 0.45);
"""

SCENES = []


def scene(sid, start, end, css, layers, js, wipe=None):
    dur = round(end - start, 2)
    if wipe:
        layers = layers + ['<div class="fill" id="' + sid + '-wipe" style="background:' + wipe + '"></div>']
    body = '\n'.join(layer(l, dur) for l in layers)
    html = ('<template>\n  <style>' + COMMON + css + '</style>\n  <div id="root" data-composition-id="' + sid
            + '" data-width="1920" data-height="1080">\n' + body + '\n  </div>\n  <script>\n    (function () {\n'
            + '      const tl = gsap.timeline({ paused: true });\n      const D = ' + str(dur) + ';\n' + HELPERS + js
            + '\n      tl.to({}, { duration: 0.001 }, D - 0.001);\n      window.__timelines["' + sid + '"] = tl;\n    })();\n  </script>\n</template>\n')
    io.open(os.path.join(HERE, 'compositions', sid + '.html'), 'w', encoding='utf-8', newline='\n').write(html)
    SCENES.append((sid, start, dur))


def ground(bg, ink, acc):
    return '#root{background:' + bg + ';color:' + ink + ';--acc:' + acc + ';}\n'


# ── 1. Avant : Word, WhatsApp, le dimanche soir (0 – 9,3) ────────────────────
scene('p1', 0, 9.3, ground('#E6DFD3', INK, TERRA) + """
.row{position:absolute;left:112px;font:800 92px/1 'Bricolage Grotesque';letter-spacing:-0.03em;white-space:nowrap;}
.row em{font-style:normal;font-weight:500;color:#57534C;}
""", [
    title('p1-t', 'Vous êtes traiteur', 106, 150, size=150),
    '<div class="row" id="p1-r1" style="top:420px">Vos devis <em>dans Word</em></div>'
    '<div class="row" id="p1-r2" style="top:560px">Vos extras <em>sur WhatsApp</em></div>'
    '<div class="row" id="p1-r3" style="top:700px">Vos factures <em>le dimanche soir</em></div>',
    julien('p1-j', 'perdu', 1390, 400, 400),
], """
      breathe("#p1-j", 9);
      wordsIn("#p1-t", 1.35, 0.14);
      [["#p1-r1", 3.0], ["#p1-r2", 4.7], ["#p1-r3", 7.25]].forEach((r) => tl.fromTo(r[0], { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out" }, r[1]));
      wipeUp("#p1-wipe");
""", wipe=FOREST)

# ── 2. WeboDevis remet tout au même endroit (9,3 – 16,5) ─────────────────────
scene('p2', 9.3, 16.5, ground(FOREST, PAPER, PEACH) + """
#p2-lock{position:absolute;left:110px;top:150px;display:flex;align-items:center;gap:30px;}
#p2-mark svg{display:block;height:104px;width:auto;}
#p2-name{font:500 116px/1 'Outfit',sans-serif;letter-spacing:-0.02em;}
#p2-line{position:absolute;left:300px;top:796px;width:1320px;height:8px;border-radius:4px;background:#B4502D;}
.stop{position:absolute;top:760px;width:80px;height:80px;margin-left:-40px;border-radius:40px;background:#F7F3EC;}
.stop.mid{background:#E5AE92;}
.lab{position:absolute;top:872px;width:600px;margin-left:-300px;text-align:center;font:700 64px/1 'Bricolage Grotesque';letter-spacing:-0.02em;}
""", [
    '<div id="p2-lock"><div id="p2-mark">' + svg('logo-dark') + '</div><div id="p2-name">WeboDevis</div></div>',
    title('p2-t', 'remet tout|au même endroit', 106, 300, ('même', 'endroit')),
    '<div id="p2-line"></div>'
    '<div class="stop" id="p2-s1" style="left:300px"></div><div class="lab" id="p2-l1" style="left:300px">La demande</div>'
    '<div class="stop mid" id="p2-s2" style="left:960px"></div><div class="lab" id="p2-l2" style="left:960px;color:#E5AE92">L’organisation</div>'
    '<div class="stop" id="p2-s3" style="left:1620px"></div><div class="lab" id="p2-l3" style="left:1620px">La facturation</div>',
], """
      tl.fromTo("#p2-mark", { opacity: 0, scale: 0.5, rotation: -14 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: "back.out(1.6)" }, 0.25);
      tl.fromTo("#p2-name", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: "power3.out" }, 0.4);
      wordsIn("#p2-t", 0.95, 0.2);
      const stop = (n, at) => { tl.fromTo("#p2-s" + n, { scale: 0 }, { scale: 1, duration: 0.4, ease: "back.out(1.8)" }, at); tl.fromTo("#p2-l" + n, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" }, at + 0.08); };
      stop(1, 3.1);
      tl.fromTo("#p2-line", { scaleX: 0, transformOrigin: "0 50%" }, { scaleX: 1, duration: 0.85, ease: "power2.inOut" }, 3.25);
      stop(3, 4.0);
      stop(2, 5.2);
      wipeUp("#p2-wipe");
""", wipe=CREAM)

# ── 3. La demande (16,5 – 26,3) ──────────────────────────────────────────────
scene('p3', 16.5, 26.3, ground(CREAM, INK, TERRA), [
    title('p3-t1', 'Tout commence|par une demande', 106, 190, ('demande',), size=104),
    title('p3-t2', 'Votre client|choisit dans|votre brochure', 106, 190, ('brochure',), size=104),
    title('p3-t3', 'Sa demande|arrive chez vous', 106, 190, ('chez', 'vous'), size=104),
    julien('p3-j', 'cafe', 150, 620, 320),
    shot('p3-s', 'demandes.png', 880, 96, 1140, 1100),
], """
      breathe("#p3-j", 11);
      hide("#p3-t2 .w"); hide("#p3-t3 .w");
      wordsIn("#p3-t1", 0.3, 0.2);
      pop("#p3-s", 0.1);
      cam("#p3-s-cam", -290, -168, 0.558);
      out("#p3-t1", 2.0); wordsIn("#p3-t2", 2.25, 0.16);
      camTo("#p3-s-cam", -335, -196, 0.63, 2.2, 1.2);
      out("#p3-t2", 5.6); wordsIn("#p3-t3", 5.95, 0.22);
      camTo("#p3-s-cam", -436, -608, 0.8, 5.7, 0.95);
      wipeUp("#p3-wipe");
""", wipe=CREAM)

# ── 4. Le devis (26,3 – 33,6) ────────────────────────────────────────────────
scene('p4', 26.3, 33.6, ground(CREAM, INK, TERRA), [
    title('p4-t1', 'Un devis depuis|vos modèles', 106, 190, ('devis',), size=104),
    title('p4-t2', 'Vous changez|les convives,|le prix suit', 106, 190, ('prix', 'suit'), size=104),
    julien('p4-j', 'bureau', 150, 620, 320),
    shot('p4-s', 'devis.png', 880, 96, 1140, 1100),
], """
      breathe("#p4-j", 8);
      hide("#p4-t2 .w");
      wordsIn("#p4-t1", 0.3, 0.3);
      tl.fromTo("#p4-s", { opacity: 0 }, { opacity: 1, duration: 0.3 }, 0.02);
      cam("#p4-s-cam", -327, -186, 0.62);
      out("#p4-t1", 3.7);
      lineIn("#p4-t2", 1, 4.0, 0.2); lineIn("#p4-t2", 2, 4.5, 0.2); lineIn("#p4-t2", 3, 5.75, 0.18);
      camTo("#p4-s-cam", -1567, -1600, 1.5, 3.95, 0.8);
      camTo("#p4-s-cam", -640, -1640, 1.05, 5.5, 0.8);
      wipeUp("#p4-wipe");
""", wipe=TERRA)

# ── 5. Reçu par mail, signé en ligne (33,6 – 38,7) ───────────────────────────
scene('p5', 33.6, 38.7, ground(TERRA, PAPER, PAPER), [
    title('p5-t', 'Reçu par mail,|signé en ligne', 106, 110),
    shot('p5-s', 'evenement.png', 110, 440, 1700, 581),
], """
      hide("#p5-t .w");
      lineIn("#p5-t", 1, 0.3, 0.3); lineIn("#p5-t", 2, 2.85, 0.16);
      pop("#p5-s", 0.5);
      cam("#p5-s-cam", -506, -297, 0.878);
      camTo("#p5-s-cam", -810, -486, 1.38, 2.8, 0.8);
      wipeUp("#p5-wipe");
""", wipe=CREAM)

# ── 6. L'organisation suit (38,7 – 46,1) ─────────────────────────────────────
scene('p6', 38.7, 46.1, ground(CREAM, INK, TERRA) + """
.item{position:absolute;left:1300px;font:700 76px/1 'Bricolage Grotesque';letter-spacing:-0.025em;color:#57534C;white-space:nowrap;}
#p6-s .cam{opacity:0;} #p6-s #p6-s-cam{opacity:1;}
""", [
    '<div class="shot" id="p6-s" style="left:90px;top:96px;width:1130px;height:1100px">'
    '<div class="cam" id="p6-s-cam"><img src="assets/screens/evenement.png" alt=""></div>'
    '<div class="cam" id="p6-c1"><img src="assets/screens/courses.png" alt=""></div>'
    '<div class="cam" id="p6-c2"><img src="assets/screens/checklist.png" alt=""></div>'
    '<div class="cam" id="p6-c3"><img src="assets/screens/materiel.png" alt=""></div></div>',
    title('p6-t', 'L’organisation|suit', 1296, 150, ('suit',), size=104),
    '<div class="item" id="p6-i1" style="top:470px">Les courses</div><div class="item" id="p6-i2" style="top:580px">La checklist</div>'
    '<div class="item" id="p6-i3" style="top:690px">Le matériel</div>',
], """
      wordsIn("#p6-t", 0.3, 0.35);
      tl.fromTo("#p6-s", { opacity: 0, x: -80 }, { opacity: 1, x: 0, duration: 0.55, ease: "expo.out" }, 0.05);
      cam("#p6-s-cam", -336, -180, 0.584);
      cam("#p6-c1", -707, -1152, 1.2); ["#p6-c2", "#p6-c3"].forEach((c) => cam(c, -420, -690, 0.73));
      camTo("#p6-s-cam", -420, -690, 0.73, 1.9, 0.9);
      [["#p6-c1", "#p6-i1", 3.05], ["#p6-c2", "#p6-i2", 4.55], ["#p6-c3", "#p6-i3", 5.55]].forEach((s, i, all) => {
        tl.fromTo(s[0], { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "power1.out" }, s[2]);
        tl.fromTo(s[1], { opacity: 0, x: 40 }, { opacity: 1, x: 0, color: "#B4502D", duration: 0.4, ease: "expo.out" }, s[2]);
        if (all[i + 1]) tl.to(s[1], { color: "#57534C", duration: 0.25 }, all[i + 1][2]);
      });
      wipeSide("#p6-wipe");
""", wipe=SAGE)

# ── 7. Les extras (46,1 – 52,4) ──────────────────────────────────────────────
TAP = '<svg viewBox="0 0 40 52" width="96"><path d="M4 3 L4 41 L14 32 L21 48 L28 45 L21 29 L35 29 Z" fill="#1B1A17" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/></svg>'
scene('p7', 46.1, 52.4, ground(SAGE, INK, TERRA) + """
#p7-phone{position:absolute;left:1120px;top:64px;width:600px;height:1120px;border-radius:76px;background:#0B100E;}
#p7-screen{position:absolute;inset:18px;border-radius:60px;background:#F3EEE6;overflow:hidden;}
#p7-scroll{position:absolute;left:0;top:0;width:564px;}
#p7-scroll img{display:block;width:564px;height:auto;}
#p7-tap{position:absolute;left:0;top:0;}
#p7-btn{border-radius:22px;box-shadow:0 18px 50px rgba(20,24,20,.2);}
""", [
    title('p7-t1', 'Chaque extra|reçoit sa mission', 106, 170, ('mission',), size=104),
    title('p7-t2', 'Il confirme', 106, 170, ('confirme',), size=104),
    title('p7-t3', 'Son contrat|se signe en ligne', 106, 170, ('en', 'ligne'), size=104),
    '<div id="p7-phone"><div id="p7-screen"><div id="p7-scroll"><img src="assets/screens/mission.png" alt=""></div></div></div>',
    shot('p7-btn', 'evenement.png', 110, 560, 640, 150),
    '<div id="p7-tap">' + TAP + '</div>',
], """
      hide("#p7-t2 .w"); hide("#p7-t3 .w");
      wordsIn("#p7-t1", 0.3, 0.3);
      tl.fromTo("#p7-phone", { y: 240, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: "expo.out" }, 0.05);
      tl.fromTo("#p7-scroll", { y: -492 }, { y: -492, duration: 0.01 }, 0);
      out("#p7-t1", 2.8); wordsIn("#p7-t2", 3.05, 0.2);
      tl.fromTo("#p7-tap", { x: 1980, y: 1150, scale: 1 }, { x: 1410, y: 480, duration: 0.6, ease: "power3.out" }, 2.4);
      tl.to("#p7-tap", { scale: 0.82, duration: 0.08, ease: "power2.in" }, 3.1);
      tl.to("#p7-tap", { scale: 1, duration: 0.14, ease: "power2.out" }, 3.18);
      tl.to("#p7-phone", { scale: 0.985, duration: 0.08, ease: "power2.in" }, 3.1);
      tl.to("#p7-phone", { scale: 1, duration: 0.3, ease: "expo.out" }, 3.18);
      out("#p7-t2", 3.6); wordsIn("#p7-t3", 3.85, 0.2);
      cam("#p7-btn-cam", -1632, -3551, 1.6);
      tl.fromTo("#p7-btn", { opacity: 0, scale: 0.8 }, { opacity: 1, scale: 1, duration: 0.45, ease: "back.out(1.5)" }, 4.0);
      wipeSide("#p7-wipe");
""", wipe=FOREST)

# ── 8. Le jour J (52,4 – 56,8) ───────────────────────────────────────────────
dashes = ''.join('<i style="left:' + str(i * 260) + 'px"></i>' for i in range(18))
scene('p8', 52.4, 56.8, ground(FOREST, PAPER, PEACH) + """
#p8-road{position:absolute;left:0;right:0;top:930px;bottom:0;background:#2B3A33;}
#p8-dashes{position:absolute;left:0;top:1010px;width:4700px;height:10px;}
#p8-dashes i{position:absolute;top:0;width:130px;height:10px;border-radius:5px;background:rgba(247,243,236,.35);}
#p8-van{position:absolute;left:0;top:452px;width:980px;}
#p8-van svg{display:block;width:100%;height:auto;overflow:visible;}
#p8-sub{position:absolute;left:112px;top:420px;font:700 72px/1 'Bricolage Grotesque';letter-spacing:-0.02em;color:#E5AE92;}
""", [
    '<div id="p8-road"></div><div id="p8-dashes">' + dashes + '</div>',
    title('p8-t', 'Le jour J, chacun|sait où il va', 106, 130, ('J',)),
    '<div id="p8-sub">et à quelle heure</div>',
    '<div id="p8-van">' + svg('van') + '</div>',
], """
      hide("#p8-t .w");
      lineIn("#p8-t", 1, 0.3, 0.16); lineIn("#p8-t", 2, 1.25, 0.14);
      tl.fromTo("#p8-sub", { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }, 3.0);
      tl.fromTo("#p8-dashes", { x: 0 }, { x: -2400, duration: D, ease: "none" }, 0);
      tl.fromTo("#p8-van", { x: -1050 }, { x: 760, duration: 0.95, ease: "expo.out" }, 0.1);
      tl.to("#p8-van", { x: 900, duration: 2.5, ease: "none" }, 1.05);
      tl.to("#p8-van", { x: 2100, duration: 0.55, ease: "power3.in" }, 3.6);
      tl.fromTo("#p8-van .story-van-body", { y: 0 }, { y: -7, duration: 0.22, yoyo: true, repeat: 17, ease: "sine.inOut" }, 0.1);
      wipeSide("#p8-wipe");
""", wipe=CREAM)

# ── 9. La facture (56,8 – 61,1) ──────────────────────────────────────────────
scene('p9', 56.8, 61.1, ground(CREAM, INK, TERRA) + """
#p9-sub{position:absolute;left:112px;top:560px;font:800 132px/1 'Bricolage Grotesque';letter-spacing:-0.03em;color:#B4502D;}
""", [
    title('p9-t', 'La facture|reprend le devis', 106, 190),
    '<div id="p9-sub">acomptes déduits</div>',
    julien('p9-j', 'caisse', 1420, 480, 380),
], """
      breathe("#p9-j", 4);
      wordsIn("#p9-t", 1.25, 0.24);
      tl.fromTo("#p9-sub", { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.5, ease: "expo.out" }, 2.75);
      wipeUp("#p9-wipe");
""", wipe=FOREST)

# ── 10. La marge (61,1 – 66,7) ───────────────────────────────────────────────
scene('p10', 61.1, 66.7, ground(FOREST, PAPER, PEACH) + """
#p10-b{opacity:0;}
""", [
    title('p10-t', 'Ce que vous avez|vraiment gagné', 106, 100, ('vraiment', 'gagné'), size=120),
    '<div class="shot" id="p10-s" style="left:110px;top:420px;width:1700px;height:570px;background:#FDFCF9">'
    '<div class="cam" id="p10-s-cam"><img src="assets/screens/marge.png" alt=""></div>'
    '<div class="cam" id="p10-b"><img src="assets/screens/accueil.png" alt=""></div></div>',
], """
      wordsIn("#p10-t", 0.3, 0.2);
      pop("#p10-s", 0.5);
      cam("#p10-s-cam", -1538, -230, 1.265);
      camTo("#p10-s-cam", -4234, -500, 2.2, 2.15, 0.8);
      cam("#p10-b", -3830, -1560, 2.25);
      tl.to("#p10-b", { opacity: 1, duration: 0.25, ease: "power1.out" }, 3.6);
      wipeUp("#p10-wipe");
""", wipe=CREAM)

# ── 11. L'installation (66,7 – 78,4) ─────────────────────────────────────────
CHECK = '<svg viewBox="0 0 48 48" width="64"><path d="M9 25 L20 36 L40 13" fill="none" stroke="#B4502D" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
scene('p11', 66.7, 78.4, ground(CREAM, INK, TERRA) + """
.inc{position:absolute;left:112px;display:flex;align-items:center;gap:28px;font:700 80px/1 'Bricolage Grotesque';letter-spacing:-0.025em;white-space:nowrap;}
""", [
    title('p11-t1', 'Nous l’installons|avec vous', 106, 130, ('avec', 'vous')),
    '<div class="inc" id="p11-i1" style="top:500px">' + CHECK + '3 séances de formation</div>'
    '<div class="inc" id="p11-i2" style="top:620px">' + CHECK + 'Vos modèles de devis</div>'
    '<div class="inc" id="p11-i3" style="top:740px">' + CHECK + 'Vos prestations</div>',
    title('p11-t2', 'Dès le premier jour,|votre premier devis', 106, 330, ('premier', 'devis'), size=150),
    julien('p11-j', 'salut', 1440, 470, 380),
], """
      breathe("#p11-j", 12);
      hide("#p11-t2 .w");
      wordsIn("#p11-t1", 0.3, 0.22);
      [["#p11-i1", 2.45], ["#p11-i2", 4.15], ["#p11-i3", 5.15]].forEach((r) => tl.fromTo(r[0], { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }, r[1]));
      out(["#p11-t1", "#p11-i1", "#p11-i2", "#p11-i3"], 7.15);
      tl.to("#p11-j", { opacity: 0, duration: 0.25 }, 7.15);
      lineIn("#p11-t2", 1, 7.55, 0.2); lineIn("#p11-t2", 2, 9.05, 0.26);
      wipeUp("#p11-wipe");
""", wipe=FOREST)

# ── 12. Le prix (78,4 – 85,5) ────────────────────────────────────────────────
scene('p12', 78.4, 85.5, ground(FOREST, PAPER, PEACH) + """
#p12-a{position:absolute;left:110px;top:150px;}
#p12-a b{display:block;font:800 270px/0.95 'Bricolage Grotesque';letter-spacing:-0.04em;}
#p12-a b small{font-size:110px;font-weight:700;letter-spacing:-0.02em;color:#E5AE92;}
#p12-a span{display:block;margin-top:26px;font:600 62px/1.15 'Bricolage Grotesque';letter-spacing:-0.015em;color:rgba(247,243,236,.82);}
#p12-b{position:absolute;left:110px;top:600px;}
#p12-b b{display:block;font:800 210px/0.95 'Bricolage Grotesque';letter-spacing:-0.04em;}
#p12-b b small{font-size:92px;font-weight:700;letter-spacing:-0.02em;color:#E5AE92;}
#p12-b span{display:block;margin-top:22px;font:600 62px/1.15 'Bricolage Grotesque';color:#E5AE92;}
""", [
    '<div id="p12-a"><b>1 250 € <small>HT</small></b><span id="p12-a2">le premier mois, mise en service comprise</span></div>',
    '<div id="p12-b"><b>puis 100 € <small>par mois</small></b><span id="p12-b2">sans engagement</span></div>',
], """
      tl.fromTo("#p12-a b", { opacity: 0, scale: 0.82, transformOrigin: "0 100%" }, { opacity: 1, scale: 1, duration: 0.55, ease: "expo.out" }, 0.45);
      tl.fromTo("#p12-a2", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 1.7);
      tl.to("#p12-a", { scale: 0.7, y: -50, opacity: 0.7, transformOrigin: "0 0", duration: 0.6, ease: "power2.inOut" }, 4.15);
      tl.fromTo("#p12-b b", { opacity: 0, x: -70 }, { opacity: 1, x: 0, duration: 0.55, ease: "expo.out" }, 4.55);
      tl.fromTo("#p12-b2", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 5.75);
      wipeUp("#p12-wipe");
""", wipe=CREAM)

# ── 13. Essayez la démo (85,5 – 91,5) ────────────────────────────────────────
scene('p13', 85.5, TOTAL, ground(CREAM, INK, TERRA) + """
#p13-sub{position:absolute;left:112px;top:420px;font:700 76px/1.1 'Bricolage Grotesque';letter-spacing:-0.02em;color:#57534C;}
#p13-lock{position:absolute;left:110px;top:760px;display:flex;align-items:center;gap:26px;}
#p13-mark svg{display:block;height:96px;width:auto;}
#p13-name{font:500 104px/1 'Outfit',sans-serif;letter-spacing:-0.02em;}
#p13-url{position:absolute;left:116px;top:900px;font:600 46px/1 'Instrument Sans';color:#B4502D;}
""", [
    title('p13-t', 'Essayez la démo', 106, 190, ('démo',), size=190),
    '<div id="p13-sub">Gratuite, sans carte bancaire</div>',
    '<div id="p13-lock"><div id="p13-mark">' + svg('logo-light') + '</div><div id="p13-name">WeboDevis</div></div><div id="p13-url">webodevis.fr</div>',
    julien('p13-j', 'salut', 1420, 440, 400),
], """
      breathe("#p13-j", 6);
      wordsIn("#p13-t", 0.3, 0.2);
      tl.fromTo("#p13-sub", { opacity: 0, x: -50 }, { opacity: 1, x: 0, duration: 0.45, ease: "expo.out" }, 1.45);
      tl.fromTo("#p13-mark", { opacity: 0, scale: 0.5, rotation: -14 }, { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: "back.out(1.6)" }, 2.9);
      tl.fromTo("#p13-name", { clipPath: "inset(0% 100% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 0.5, ease: "power3.out" }, 3.05);
      tl.fromTo("#p13-url", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 3.5);
""")

# ── Racine ───────────────────────────────────────────────────────────────────
hosts = []
for i, (sid, start, dur) in enumerate(SCENES):
    hosts.append('      <div id="' + sid + '" class="clip" data-composition-id="' + sid + '" data-composition-src="compositions/' + sid + '.html" data-start="'
                 + str(start) + '" data-duration="' + str(dur) + '" data-track-index="1" data-track-kind="graphics" data-width="1920" data-height="1080" style="z-index:'
                 + str(i + 1) + '"></div>')
MUSIC = os.path.exists(os.path.join(HERE, 'assets', 'audio', 'musique.mp3'))
audio = '      <audio id="voix" src="assets/audio/voix.wav" data-start="0" data-duration="89.4" data-track-index="2" data-volume="1"></audio>\n'
if MUSIC:
    audio += '      <audio id="musique" src="assets/audio/musique.mp3" data-start="0" data-duration="' + str(TOTAL) + '" data-track-index="3" data-volume="0.14"></audio>\n'
index = ('<!doctype html>\n<html lang="fr">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=1920, height=1080" />\n'
         '    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>\n    <style>\n'
         '      * { margin: 0; padding: 0; box-sizing: border-box; }\n'
         '      html, body { margin: 0; width: 1920px; height: 1080px; overflow: hidden; background: ' + FOREST + '; }\n'
         '      #root { position: relative; width: 1920px; height: 1080px; overflow: hidden; }\n    </style>\n  </head>\n  <body>\n'
         '    <div id="root" data-composition-id="main" data-start="0" data-duration="' + str(TOTAL) + '" data-width="1920" data-height="1080">\n'
         + '\n'.join(hosts) + '\n' + audio + '    </div>\n    <script>\n      window.__timelines = window.__timelines || {};\n'
         '      window.__timelines["main"] = gsap.timeline({ paused: true });\n    </script>\n  </body>\n</html>\n')
io.open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8', newline='\n').write(index)
print('ok', TOTAL, 's,', len(SCENES), 'plans, musique:', MUSIC)
