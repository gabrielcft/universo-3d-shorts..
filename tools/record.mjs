// Grava um short em MP4 (1080x1920, 30 fps) quadro a quadro.
//
//   npm run record -- 01-estrela-de-neutrons
//   npm run record -- 01-estrela-de-neutrons --audio minha-musica.mp3
//   npm run record -- 01-estrela-de-neutrons --still 12      (capa PNG no segundo 12)
//   npm run record:all
//   npm run record -- 01 --remix            (refaz só o áudio de um vídeo já gravado)
//
// Opções: --fps 30  --from 0 --to 10  --audio musica.mp3  --no-audio  --no-voice  --no-sfx  --music-volume 0.5  --out pasta  --quality 18
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

// ---------- trilha e efeitos (gerados matematicamente, sem direitos autorais) ----------
// Trilha ambiente sintetizada (tools/music.py). Humores: cosmos, warm, epic, dark
async function makeMusic(file, dur, music = {}) {
  await run('python3', [path.join(ROOT, 'tools', 'music.py'), file, String(dur + 0.5),
    music.mood || 'cosmos', String(music.seed ?? 1), music.pulse ? '1' : '0']);
}

async function makeSfx(dir) {
  const whoosh = path.join(dir, '.whoosh.wav'), boom = path.join(dir, '.boom.wav');
  await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'anoisesrc=d=0.6:c=pink:a=0.7:r=48000',
    '-af', 'highpass=f=400,lowpass=f=5000,afade=t=in:d=0.38:curve=exp,afade=t=out:st=0.38:d=0.22,volume=0.9', whoosh]);
  await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', "aevalsrc='0.95*sin(2*PI*(70*t-30*t*t))*exp(-2.6*t)':s=48000:d=1.6",
    '-af', 'lowpass=f=300,volume=1.4', boom]);
  return { whoosh, boom };
}

async function mixAudio({ video, narration, music, sfx, events, out, dur, musicVol = 0.5 }) {
  const args = ['-y', '-i', video];
  const parts = [];
  let n = 1;
  if (narration) {
    args.push('-i', narration);
    parts.push(`[${n}]aresample=48000,aformat=channel_layouts=stereo,volume=1.0,asplit=2[nar][key]`); n++;
  }
  args.push('-i', music);
  // ducking: a música abaixa sozinha enquanto a voz fala
  parts.push(narration
    ? `[${n}]aformat=channel_layouts=stereo,volume=${musicVol}[m0];[m0][key]sidechaincompress=threshold=0.02:ratio=5:attack=40:release=500:makeup=1[mus]`
    : `[${n}]volume=0.9[mus]`);
  n++;
  const evs = events.filter((e) => sfx[e.type]);
  const sfxIdx = {};
  for (const type of Object.keys(sfx)) {
    const count = evs.filter((e) => e.type === type).length;
    if (!count) continue;
    args.push('-i', sfx[type]); sfxIdx[type] = n;
    parts.push(`[${n}]aformat=channel_layouts=stereo,asplit=${count}${Array.from({ length: count }, (_, k) => `[${type}${k}]`).join('')}`);
    n++;
  }
  const used = {};
  const labels = evs.map((e, k) => {
    const c = used[e.type] = (used[e.type] ?? -1) + 1;
    const lead = e.type === 'whoosh' ? 0.3 : 0.02;
    const ms = Math.max(0, Math.round((e.t - lead) * 1000));
    parts.push(`[${e.type}${c}]adelay=${ms}:all=1,volume=${e.type === 'whoosh' ? 0.35 : 0.6}[fx${k}]`);
    return `[fx${k}]`;
  });
  const inputs = [narration ? '[nar]' : '', '[mus]', ...labels].join('');
  const count = (narration ? 1 : 0) + 1 + labels.length;
  parts.push(`${inputs}amix=inputs=${count}:normalize=0:duration=longest,atrim=0:${dur.toFixed(2)},alimiter=limit=0.95[a]`);
  args.push('-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-t', dur.toFixed(2), '-movflags', '+faststart', out);
  await run('ffmpeg', args);
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
    const info = await page.evaluate(() => { const s = window.__short; return { duration: s.duration, fps: s.fps, youtube: s.youtube, title: s.title, audio: s.audio, estimated: s.estimated, sfx: s.sfx, music: s.music }; });

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
    if (flag('remix') && fs.existsSync(final)) {
      // reaproveita a imagem já gravada e refaz só o áudio
      console.log('  ♫ remix: refazendo só o áudio');
      await run('ffmpeg', ['-y', '-i', final, '-an', '-c:v', 'copy', silent]);
    } else await run('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
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

    // áudio: narração + trilha + efeitos
    if (info.estimated) console.warn('  ⚠ sem narração gerada — rode antes: npm run narrate --', id);
    if (flag('no-audio')) {
      fs.renameSync(silent, final);
    } else {
      const dur = to - from;
      let music = opt('audio') && path.resolve(opt('audio'));
      const tmpMusic = !music;
      if (!music) { music = path.join(OUT, `.${id}-music.wav`); await makeMusic(music, dur, info.music); }
      const sfx = flag('no-sfx') ? {} : await makeSfx(OUT);
      const narration = !flag('no-voice') && info.audio && from === 0 ? path.join(ROOT, info.audio) : null;
      await mixAudio({ video: silent, narration, music, sfx, events: info.sfx || [], out: final, dur, musicVol: Number(opt('music-volume', info.music?.volume ?? 0.5)) });
      fs.rmSync(silent, { force: true });
      if (tmpMusic) fs.rmSync(music, { force: true });
      Object.values(sfx).forEach((f) => fs.rmSync(f, { force: true }));
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
