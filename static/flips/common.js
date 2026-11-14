// Shared pieces for seat.html and wall.html: helpers, the crouch-leap-flip, the celebration layer,
// the "whole scene is a card" finale, and the page controls.
const RED = '#E23B3B', BLUE = '#2B6BE0', INK = '#2A2438', CREAM = '#FFF4D6', GOLD = '#FFC93C', LBLUE = '#8DB8FF';
const col = p => (p === 'D' ? BLUE : RED);
const colLight = p => (p === 'D' ? '#3B7BF0' : '#EE5A5A');
const colName = p => (p === 'D' ? 'BLUE' : 'RED');

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, p) => a + (b - a) * p;
const prog = (t, start, dur) => clamp((t - start) / dur);
const easeInOut = p => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const easeOut = p => 1 - Math.pow(1 - p, 3);
const easeIn = p => p * p * p;
const easeOutBack = p => { const c = 2.2; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); };
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed);
  x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
const f1 = n => n.toFixed(1);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

const check = (w, c, s = 1) =>
  `<path d="M${-18 * s},${2 * s} L${-5 * s},${15 * s} L${19 * s},${-13 * s}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

function rays(n, r, fill) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * 2 * Math.PI, a1 = a0 + Math.PI / n;
    d += `M0,0 L${f1(r * Math.cos(a0))},${f1(r * Math.sin(a0))} L${f1(r * Math.cos(a1))},${f1(r * Math.sin(a1))} Z `;
  }
  return `<path d="${d}" fill="${fill}"/>`;
}

// crouch -> leap -> flip -> land; returns scale, lift and whether the back is showing
function jump(t, crouchT, leapT, landT, height, squash) {
  let sx = 1, sy = 1, lift = 0, back = false;
  if (t < crouchT) return { sx, sy, lift, back };
  if (t < leapT) {
    const p = easeOut(prog(t, crouchT, leapT - crouchT));
    sy = 1 - squash * p; sx = 1 + squash * 0.6 * p;
  } else if (t < landT) {
    const q = (t - leapT) / (landT - leapT);
    lift = height * 4 * q * (1 - q);
    const c = Math.cos(3 * Math.PI * easeInOut(q));
    back = c < 0;
    const k = q < 0.15 ? q / 0.15 : 1;
    sy = q < 0.15 ? lerp(1 - squash, 1.14, k) : lerp(1.14, 1, (q - 0.15) / 0.85);
    const w = q < 0.15 ? lerp(1 + squash * 0.6, 0.93, k) : lerp(0.93, 1, (q - 0.15) / 0.85);
    sx = Math.max(Math.abs(c), 0.03) * w;
  } else {
    back = true;
    const r = prog(t, landT, 0.4);
    const b = Math.sin(Math.PI * r) * (1 - r);
    sy = 1 - squash * 1.6 * b; sx = 1 + squash * 1.0 * b;
  }
  return { sx, sy, lift, back };
}

function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return n + 'TH';
  return n + (['TH', 'ST', 'ND', 'RD'][n % 10] || 'TH');
}

// ---------- text fitting (needs the web font, so call after fonts load) ----------
function textWidth(str, size, spacing = 0) {
  const svg = $('stage');
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  el.setAttribute('font-size', size); el.setAttribute('letter-spacing', spacing); el.setAttribute('opacity', 0);
  el.textContent = str; svg.appendChild(el);
  const w = el.getComputedTextLength(); el.remove();
  return w;
}
const fitSize = (str, size, maxW) => { const w = textWidth(str, size); return w > maxW ? size * maxW / w : size; };

// ---------- stage skeleton: night sky, the scene card (front + back), celebration layer ----------
function buildStage(frontHTML, backHTML) {
  const r = rng(7);
  let stars = '';
  for (let i = 0; i < 46; i++)
    stars += `<circle cx="${f1(r() * 1080)}" cy="${f1(r() * 1080)}" r="${f1(1.5 + r() * 3)}" fill="#fff" opacity="${f1(0.25 + r() * 0.5)}"/>`;
  $('stage').innerHTML = `
    <defs><clipPath id="clip"><rect id="clipRect" width="1080" height="1080"/></clipPath></defs>
    <rect width="1080" height="1080" fill="#1B1838"/>
    ${stars}
    <ellipse id="sceneShadow" cx="540" fill="#000" opacity="0"/>
    <g id="scene">
      <g clip-path="url(#clip)">
        <g id="front">${frontHTML}</g>
        <g id="back" display="none">${backHTML}</g>
      </g>
      <rect id="sceneBorder" width="1080" height="1080" fill="none" stroke="${INK}" stroke-width="12" opacity="0"/>
    </g>
    <g id="partyLayer"></g>`;
}

// The whole scene as a card: pull back, crouch, leap, flip to the message. Z = { zoom, crouch, leap, land }.
function sceneFlip(t, Z) {
  const zp = easeInOut(prog(t, Z.zoom, 0.5));
  let s = lerp(1, 0.78, zp);
  if (t >= Z.land) s = lerp(0.78, 0.9, easeOutBack(prog(t, Z.land + 0.25, 0.5)));
  const j = jump(t, Z.crouch, Z.leap, Z.land, 150, 0.2);
  const bottom = 540 + 540 * s;
  $('scene').setAttribute('transform',
    `translate(540,${f1(bottom - j.lift)}) scale(${(s * j.sx).toFixed(4)},${(s * j.sy).toFixed(4)}) translate(-540,-1080)`);
  const rx = f1(48 * zp);
  $('clipRect').setAttribute('rx', rx);
  $('sceneBorder').setAttribute('rx', rx); $('sceneBorder').setAttribute('opacity', f1(zp));
  $('front').setAttribute('display', j.back ? 'none' : 'inline');
  $('back').setAttribute('display', j.back ? 'inline' : 'none');
  const shs = 1 - j.lift / 400;
  $('sceneShadow').setAttribute('cy', f1(bottom + 14)); $('sceneShadow').setAttribute('rx', f1(430 * s * shs));
  $('sceneShadow').setAttribute('ry', f1(16 * shs)); $('sceneShadow').setAttribute('opacity', f1(0.45 * zp));
  if (j.back && $('rays')) $('rays').setAttribute('transform', `translate(540,560) rotate(${f1(t * 9)})`);
  if (j.back && $('words')) {
    const pulse = 1 + 0.025 * Math.sin((t - Z.land) * 5);
    $('words').setAttribute('transform', `translate(540,560) scale(${pulse.toFixed(4)}) translate(-540,-560)`);
  }
  return j.back;
}

// ---------- celebration: starbursts, balloons, confetti bursts, confetti rain ----------
const PARTY_COLORS = [BLUE, LBLUE, GOLD, '#FFFFFF', '#3DD6C4', '#FFE48A'];
function makeBurst(seed, n, t0, cx, cy, vmin, vmax) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    const a = -Math.PI * (0.06 + 0.88 * r()), v = lerp(vmin, vmax, r());
    out.push({ t0, cx, cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 12 + r() * 12, h: 16 + r() * 16,
      spin: (r() - 0.5) * 900, flut: 6 + r() * 8, ph: r() * 6.28, color: PARTY_COLORS[Math.floor(r() * PARTY_COLORS.length)],
      round: r() < 0.22, life: 2.6 + r() * 0.8 });
  }
  return out;
}
function makeRain(seed, n) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) out.push({ x: r() * 1080, off: r() * 1300, vy: 170 + r() * 160, w: 12 + r() * 10, h: 16 + r() * 14,
    spin: (r() - 0.5) * 500, flut: 4 + r() * 6, ph: r() * 6.28, sway: 20 + r() * 40, color: PARTY_COLORS[Math.floor(r() * PARTY_COLORS.length)] });
  return out;
}
const BALLOON_COLORS = [BLUE, GOLD, LBLUE, '#FFFFFF', BLUE, GOLD];
// edges: true keeps balloons in the outer margins so they never cross the message
function makeBalloons(seed, n, t0, spread, edges) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) out.push(edges
    ? { t0: t0 + r() * spread, x: i % 2 ? 15 + r() * 60 : 1005 + r() * 60, v: 260 + r() * 120, sway: 8 + r() * 6,
        ph: r() * 6.28, s: 0.8 + r() * 0.3, color: BALLOON_COLORS[(i + 2) % 6] }
    : { t0: t0 + r() * spread, x: r() < 0.5 ? 70 + r() * 290 : 720 + r() * 290, v: 390 + r() * 120, sway: 14 + r() * 20,
        ph: r() * 6.28, s: 0.85 + r() * 0.35, color: BALLOON_COLORS[i % 6] });
  return out;
}
// The standard closing celebration around the message card that lands at time tLand.
function finalePops(tLand) {
  return [
    [tLand, 540, 560, 560, '#fff'], [tLand + 0.3, 120, 150, 170, GOLD], [tLand + 0.55, 960, 160, 170, GOLD],
    [tLand + 0.9, 110, 930, 160, '#fff'], [tLand + 1.2, 970, 940, 160, '#fff'],
    [tLand + 1.8, 540, 110, 150, GOLD], [tLand + 2.4, 70, 250, 120, '#fff'], [tLand + 2.7, 1010, 810, 120, '#fff'],
    [tLand + 3.4, 200, 170, 150, GOLD], [tLand + 4.0, 880, 900, 150, GOLD], [tLand + 4.6, 870, 170, 140, '#fff'],
    [tLand + 5.1, 210, 900, 140, '#fff'],
  ];
}
// P = { pops: [[t0,x,y,R,color]], balloons, bursts, rain, rainStart }
function partySVG(t, P) {
  let s = '';
  for (const [t0, x, y, R, c] of P.pops) {
    const p = prog(t, t0, 0.75);
    if (p <= 0 || p >= 1) continue;
    const e = easeOut(p), r1 = R * e * 0.55, r2 = R * e, w = 12 * (1 - p) + 2, n = R > 300 ? 18 : 12;
    let d = '';
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI + x;
      d += `M${f1(x + r1 * Math.cos(a))},${f1(y + r1 * Math.sin(a))} L${f1(x + r2 * Math.cos(a))},${f1(y + r2 * Math.sin(a))} `;
    }
    s += `<path d="${d}" stroke="${INK}" stroke-width="${f1(w + 7)}" stroke-linecap="round" opacity="${f1(1 - p * p)}" fill="none"/>`;
    s += `<path d="${d}" stroke="${c}" stroke-width="${f1(w)}" stroke-linecap="round" opacity="${f1(1 - p * p)}" fill="none"/>`;
  }
  for (const b of P.balloons) {
    const tau = t - b.t0; if (tau < 0) continue;
    const y = 1180 - b.v * tau; if (y < -260) continue;
    const x = b.x + b.sway * Math.sin(tau * 2.2 + b.ph), tilt = 6 * Math.cos(tau * 2.2 + b.ph);
    s += `<g transform="translate(${f1(x)},${f1(y)}) rotate(${f1(tilt)}) scale(${b.s.toFixed(2)})">
      <path d="M0,66 q12,28 0,56 q-12,28 0,56" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
      <path d="M-9,66 L9,66 L0,52 Z" fill="${b.color}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
      <ellipse rx="48" ry="58" fill="${b.color}" stroke="${INK}" stroke-width="6"/>
      <ellipse cx="-17" cy="-22" rx="10" ry="16" fill="#fff" opacity=".55" transform="rotate(24 -17 -22)"/></g>`;
  }
  for (const c of P.bursts) {
    const tau = t - c.t0; if (tau < 0 || tau > c.life) continue;
    const k = 1.5, d = (1 - Math.exp(-k * tau)) / k;
    const x = c.cx + c.vx * d, y = c.cy + c.vy * d + 330 * tau * tau;
    if (y > 1140) continue;
    const o = clamp((c.life - tau) / 0.5), fl = Math.cos(tau * c.flut + c.ph);
    s += c.round
      ? `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(c.w * 0.5)}" fill="${c.color}" stroke="${INK}" stroke-width="3" opacity="${f1(o)}"/>`
      : `<rect x="${f1(-c.w / 2)}" y="${f1(-c.h / 2)}" width="${f1(c.w)}" height="${f1(c.h)}" rx="3" fill="${c.color}" stroke="${INK}" stroke-width="3" opacity="${f1(o)}" transform="translate(${f1(x)},${f1(y)}) rotate(${f1(c.spin * tau)}) scale(1,${f1(fl)})"/>`;
  }
  if (t > P.rainStart) {
    const tau = t - P.rainStart, o = clamp(tau / 0.6);
    for (const c of P.rain) {
      const y = ((c.off + c.vy * tau) % 1300) - 110;
      if (c.vy * tau + c.off < 1300 && y > c.vy * tau - 110) continue;   // not yet entered from the top
      const x = c.x + c.sway * Math.sin(tau * 1.6 + c.ph), fl = Math.cos(tau * c.flut + c.ph);
      s += `<rect x="${f1(-c.w / 2)}" y="${f1(-c.h / 2)}" width="${f1(c.w)}" height="${f1(c.h)}" rx="3" fill="${c.color}" stroke="${INK}" stroke-width="3" opacity="${f1(o)}" transform="translate(${f1(x)},${f1(y)}) rotate(${f1(c.spin * tau)}) scale(1,${f1(fl)})"/>`;
    }
  }
  return s;
}

// ---------- page controls, playback and export hooks ----------
// init() runs once the font is ready and must return { render, duration }.
function setupPage({ init, video, caption }) {
  const exporting = new URLSearchParams(location.search).has('export');
  if (exporting) document.body.classList.add('export');
  const fileName = video.split('/').pop();
  document.body.insertAdjacentHTML('beforeend', `
    <div id="ui"><button id="replay">Replay</button><input id="scrub" type="range" min="0" max="1000" value="0" aria-label="Scrub"></div>
    <div id="links"><a href="${video}" download="${fileName}">Download video</a><button id="fbPost">Post to Facebook</button><a class="alt" href="index.html">All videos</a></div>
    <p id="shareNote" hidden>The video is downloading and the caption below is copied. On
      <a href="https://www.facebook.com/" target="_blank" rel="noopener">Facebook</a>, start a post, choose Photo/video,
      pick <b>${fileName}</b>, and paste the caption.<span id="caption"></span></p>`);
  $('caption').textContent = caption;

  // A web page cannot put a video into Facebook's composer. On a phone we hand the file to the system
  // share sheet (Facebook is one of the choices); elsewhere we download it and walk the user through.
  const isPhone = (navigator.userAgentData && navigator.userAgentData.mobile) || /Android|iPhone|iPad|iPod/.test(navigator.userAgent);
  function manualPost() {
    const a = document.createElement('a');
    a.href = video; a.download = fileName;
    document.body.appendChild(a); a.click(); a.remove();
    if (navigator.clipboard) navigator.clipboard.writeText(caption).catch(() => {});
    $('shareNote').hidden = false;
  }
  $('fbPost').onclick = async () => {
    if (isPhone && navigator.canShare) {
      try {
        const blob = await (await fetch(video)).blob();
        const file = new File([blob], fileName, { type: 'video/mp4' });
        if (navigator.canShare({ files: [file] })) {
          if (navigator.clipboard) navigator.clipboard.writeText(caption).catch(() => {});
          await navigator.share({ files: [file], text: caption });
          return;
        }
      } catch (e) { if (e.name === 'AbortError') return; }
    }
    manualPost();
  };

  const fonts = document.fonts ? document.fonts.load('92px "Luckiest Guy"').catch(() => {}) : Promise.resolve();
  window.READY = fonts.then(() => {
    const { render, duration } = init();
    window.renderAt = render; window.DURATION = duration;
    const scrub = $('scrub');
    let startAt = null, playing = false;
    function tick(now) {
      if (!playing) return;
      if (startAt === null) startAt = now;
      const t = (now - startAt) / 1000;
      render(t);
      scrub.value = Math.round(1000 * clamp(t / duration));
      if (t < duration) requestAnimationFrame(tick); else playing = false;
    }
    const play = () => { startAt = null; playing = true; requestAnimationFrame(tick); };
    $('replay').onclick = play;
    scrub.oninput = () => { playing = false; render((scrub.value / 1000) * duration); };
    render(0);
    if (!exporting) play();
  });
}
