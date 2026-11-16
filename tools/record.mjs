// Grava um short em MP4 (1080x1920, 30 fps) quadro a quadro.
//
//   npm run record -- 01-estrela-de-neutrons
//   npm run record -- 01-estrela-de-neutrons --audio minha-musica.mp3
//   npm run record -- 01-estrela-de-neutrons --still 12      (capa PNG no segundo 12)
//   npm run record:all
//
// Opções: --fps 30  --from 0 --to 10  --no-audio  --audio arquivo  --out pasta  --quality 18
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { startServer } from './server.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

let chromium;
try { ({ chromium } = require('playwright')); } catch {
  console.error('Playwright não encontrado. Instale com:\n  npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

// ---------- argumentos ----------
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : def; };
const flag = (name) => argv.includes(`--${name}`);
const valued = new Set(['fps', 'from', 'to', 'audio', 'out', 'quality', 'still', 'port']);
const ids = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]?.replace(/^--/, '')));
const all = fs.readdirSync(path.join(ROOT, 'shorts')).filter((f) => /^\d.*\.js$/.test(f)).map((f) => f.replace(/\.js$/, '')).sort();
const targets = flag('all') ? all : ids.map((id) => all.find((s) => s === id || s.startsWith(id)) || id);
if (!targets.length) {
  console.log('Uso: npm run record -- <id-do-short> [opções]\n\nShorts disponíveis:\n  ' + all.join('\n  '));
  process.exit(0);
}
const OUT = path.resolve(ROOT, opt('out', 'out'));
fs.mkdirSync(OUT, { recursive: true });

// ---------- ffmpeg ----------
function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} saiu com código ${code}\n${err.slice(-2000)}`))));
    if (input) input(p.stdin);
  });
}

// Trilha ambiente "espacial" gerada matematicamente (sem direitos autorais).
async function makeDrone(file, dur) {
  const expr = [
    '0.20*sin(2*PI*55*t)*(0.65+0.35*sin(2*PI*0.07*t))',
    '0.12*sin(2*PI*82.41*t+0.8*sin(2*PI*0.13*t))',
    '0.08*sin(2*PI*110*t)*(0.5+0.5*sin(2*PI*0.11*t+1))',
    '0.05*sin(2*PI*164.81*t)*(0.5+0.5*sin(2*PI*0.05*t+2))',
    '0.03*sin(2*PI*329.63*t)*(0.5+0.5*sin(2*PI*0.17*t))',
  ].join('+');
  await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', `aevalsrc=${expr}|${expr.replace(/0\.8\*sin/, '0.9*sin')}:s=48000:d=${dur}`,
    '-af', `lowpass=f=1400,aecho=0.8:0.85:700|1300:0.35|0.25,afade=t=in:d=1.5,afade=t=out:st=${Math.max(0, dur - 1.5)}:d=1.5,volume=0.9`,
    '-c:a', 'pcm_s16le', file]);
}

// ---------- gravação ----------
const port = Number(opt('port', 5179));
const server = await startServer(port);
const browser = await chromium.launch({
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling'],
});

try {
  for (const id of targets) {
    const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => console.error(`[${id}] erro na página:`, e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.error(`[${id}]`, m.text()); });
    await page.goto(`http://127.0.0.1:${port}/player.html?s=${id}&record=1`);
    await page.waitForFunction(() => window.__short?.ready, null, { timeout: 120000 });
    const info = await page.evaluate(() => ({ duration: window.__short.duration, fps: window.__short.fps, youtube: window.__short.youtube, title: window.__short.title }));

    const still = opt('still');
    if (still !== undefined) {
      await page.evaluate((t) => window.__short.renderAt(t), Number(still));
      const file = path.join(OUT, `${id}-capa.png`);
      await page.screenshot({ path: file, type: 'png' });
      console.log(`✔ capa salva em ${path.relative(ROOT, file)}`);
      await page.close();
      continue;
    }

    const fps = Number(opt('fps', info.fps));
    const from = Number(opt('from', 0));
    const to = Math.min(info.duration, Number(opt('to', info.duration)));
    const frames = Math.round((to - from) * fps);
    const silent = path.join(OUT, `.${id}-video.mp4`);
    const final = path.join(OUT, `${id}.mp4`);
    console.log(`\n▶ ${id} — "${info.title}"  (${(to - from).toFixed(1)}s, ${frames} quadros)`);

    const t0 = Date.now();
    await run('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt('quality', 18)), '-pix_fmt', 'yuv420p',
      '-r', String(fps), '-movflags', '+faststart', silent], async (stdin) => {
      for (let f = 0; f < frames; f++) {
        await page.evaluate((t) => window.__short.renderAt(t), from + f / fps);
        const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
        if (!stdin.write(buf)) await new Promise((r) => stdin.once('drain', r));
        if (f % 30 === 29 || f === frames - 1) {
          const el = (Date.now() - t0) / 1000, eta = (el / (f + 1)) * (frames - f - 1);
          process.stdout.write(`\r  quadro ${f + 1}/${frames}  (${((f + 1) / el).toFixed(1)} q/s, faltam ~${Math.ceil(eta)}s)   `);
        }
      }
      stdin.end();
    });
    process.stdout.write('\n');

    // áudio
    const audio = opt('audio');
    if (flag('no-audio')) {
      fs.renameSync(silent, final);
    } else {
      let track = audio && path.resolve(audio);
      if (!track) { track = path.join(OUT, `.${id}-drone.wav`); await makeDrone(track, to - from); }
      await run('ffmpeg', ['-y', '-i', silent, '-i', track, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
      fs.rmSync(silent, { force: true });
      if (!audio) fs.rmSync(track, { force: true });
    }

    // metadados para o upload
    if (info.youtube) {
      const y = info.youtube;
      const txt = `TÍTULO:\n${y.title}\n\nDESCRIÇÃO:\n${y.description}\n\n${(y.hashtags || []).map((h) => '#' + h).join(' ')}\n\nTAGS:\n${(y.tags || []).join(', ')}\n`;
      fs.writeFileSync(path.join(OUT, `${id}.txt`), txt);
    }
    console.log(`✔ ${path.relative(ROOT, final)}  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
