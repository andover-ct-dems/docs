// Renders the animations frame by frame and stitches MP4s into out/.
//   node export.mjs all [house|senate]         every flipped seat plus the wall
//   node export.mjs seat house 55 [107 ...]    chosen districts
//   node export.mjs wall house
//   node export.mjs stills "seat.html?c=house&d=107" 1.5 9.3 17    PNG check frames into stills/
import pw from 'file:///c:/Users/scott/Dev/Andover/ct-super-scraper/node_modules/playwright/index.js';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const { chromium } = pw;
const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30, PARALLEL = 4;
const [mode = 'all', ...rest] = process.argv.slice(2);
const clip = { x: 0, y: 0, width: 1080, height: 1080 };
const base = pathToFileURL(here).href + '/';

function chambers() {
  const ctx = { window: {}, console };
  vm.runInNewContext(readFileSync(path.join(here, 'data.js'), 'utf8'), ctx);
  return ctx.window.CHAMBERS;
}
const browser = await chromium.launch();
async function open(url) {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.log('PAGE ERROR', url, e.message));
  await page.goto(base + url + (url.includes('?') ? '&' : '?') + 'export');
  await page.evaluate(() => window.READY);
  const ok = await page.evaluate(() => document.fonts.check('92px "Luckiest Guy"'));
  if (!ok) console.log('WARNING: web font did not load for', url);
  return page;
}
async function video(url, name) {
  const page = await open(url);
  const duration = await page.evaluate(() => window.DURATION);
  const dir = path.join(here, 'frames-' + name);
  rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  const n = Math.ceil(duration * FPS);
  for (let f = 0; f <= n; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    await page.screenshot({ path: path.join(dir, `f${String(f).padStart(4, '0')}.png`), clip });
  }
  await page.close();
  mkdirSync(path.join(here, 'out'), { recursive: true });
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-movflags', '+faststart', path.join(here, 'out', name + '.mp4')],
    { stdio: 'inherit' });
  rmSync(dir, { recursive: true, force: true });
  console.log(`${name}.mp4  ${duration.toFixed(1)}s  ffmpeg exit ${r.status}`);
}

if (mode === 'stills') {
  const [url, ...times] = rest;
  const dir = path.join(here, 'stills'); mkdirSync(dir, { recursive: true });
  const page = await open(url);
  console.log('duration', (await page.evaluate(() => window.DURATION)).toFixed(2));
  const tag = url.replace(/\.html|c=|d=/g, '').replace(/[^a-z0-9]+/gi, '-');
  for (const t of times.map(Number)) {
    await page.evaluate(t => window.renderAt(t), t);
    await page.screenshot({ path: path.join(dir, `${tag}-t${t.toFixed(2).padStart(5, '0')}.png`), clip });
  }
} else {
  const jobs = [];
  const all = chambers();
  if (mode === 'seat') for (const d of rest.slice(1)) jobs.push([`seat.html?c=${rest[0]}&d=${d}`, `${rest[0]}-${d}`]);
  else if (mode === 'wall') jobs.push([`wall.html?c=${rest[0] || 'house'}`, `${rest[0] || 'house'}-wall`]);
  else for (const key of rest.length ? rest : Object.keys(all)) {
    if (!all[key]) continue;
    jobs.push([`wall.html?c=${key}`, `${key}-wall`]);
    for (const d of Object.keys(all[key].flips)) jobs.push([`seat.html?c=${key}&d=${d}`, `${key}-${d}`]);
  }
  const workers = Array.from({ length: Math.min(PARALLEL, jobs.length) }, async () => {
    while (jobs.length) { const [url, name] = jobs.shift(); await video(url, name); }
  });
  await Promise.all(workers);
}
await browser.close();
