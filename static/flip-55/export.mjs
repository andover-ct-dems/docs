// Renders index.html frame by frame and stitches an MP4 (and optional stills).
//   node export.mjs            -> flip-55.mp4
//   node export.mjs stills     -> stills/*.png at a few key moments
import pw from 'file:///c:/Users/scott/Dev/Andover/ct-super-scraper/node_modules/playwright/index.js';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const { chromium } = pw;
const here = path.dirname(fileURLToPath(import.meta.url));
const FPS = 30;
const mode = process.argv[2] || 'video';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, 'index.html')).href + '?export');
await page.evaluate(() => document.fonts.load('92px "Luckiest Guy"').then(() => document.fonts.ready));
const fontOk = await page.evaluate(() => document.fonts.check('92px "Luckiest Guy"'));
const duration = await page.evaluate(() => window.DURATION);
console.log(`font loaded: ${fontOk}, duration: ${duration.toFixed(2)}s`);
const clip = { x: 0, y: 0, width: 1080, height: 1080 };

if (mode === 'stills') {
  const dir = path.join(here, 'stills');
  mkdirSync(dir, { recursive: true });
  const times = process.argv.slice(3).map(Number);
  for (const t of times) {
    await page.evaluate(t => window.renderAt(t), t);
    await page.screenshot({ path: path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`), clip });
  }
} else {
  const dir = path.join(here, 'frames');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const n = Math.ceil(duration * FPS);
  for (let f = 0; f <= n; f++) {
    await page.evaluate(t => window.renderAt(t), f / FPS);
    await page.screenshot({ path: path.join(dir, `f${String(f).padStart(4, '0')}.png`), clip });
    if (f % 60 === 0) console.log(`frame ${f}/${n}`);
  }
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, 'f%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-movflags', '+faststart', path.join(here, 'flip-55.mp4')],
    { stdio: 'inherit' });
  console.log('ffmpeg exit', r.status);
  rmSync(dir, { recursive: true, force: true });
}
await browser.close();
