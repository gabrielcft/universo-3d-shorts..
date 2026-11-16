// Gera a narração de um short a partir do roteiro (campo `script`).
//
//   npm run narrate -- 01            (um short)
//   npm run narrate -- --all         (todos)
//   npm run narrate -- 01 --voice pt-BR-FranciscaNeural --rate +8%
//
// Requer: pip install edge-tts   e   ffmpeg
// Saída: narration/<id>.mp3 + narration/<id>.json (tempos de cada frase e palavra).
// As falas ficam em cache (narration/cache) — só frases alteradas são regeradas.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tokenize, align, spoken } from '../engine/script.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const valued = new Set(['voice', 'rate']);
const ids = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]?.replace(/^--/, '')));
const all = fs.readdirSync(path.join(ROOT, 'shorts')).filter((f) => /^\d.*\.js$/.test(f)).map((f) => f.replace(/\.js$/, '')).sort();
const targets = argv.includes('--all') ? all : ids.map((id) => all.find((s) => s === id || s.startsWith(id)) || id);
if (!targets.length) { console.log('Uso: npm run narrate -- <id> | --all'); process.exit(0); }

const OUT = path.join(ROOT, 'narration');
const CACHE = path.join(OUT, 'cache');
fs.mkdirSync(CACHE, { recursive: true });

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } });
    let out = '', err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    p.on('error', reject);
    p.on('close', (c) => (c === 0 ? resolve(out) : reject(new Error(`${cmd} falhou (${c}):\n${err.slice(-1500)}`))));
  });
}

const sslEnv = fs.existsSync('/root/.ccr/ca-bundle.crt') ? { SSL_CERT_FILE: '/root/.ccr/ca-bundle.crt' } : {};

for (const id of targets) {
  const def = (await import(pathToFileURL(path.join(ROOT, 'shorts', `${id}.js`)).href)).default;
  if (!def.script) { console.log(`- ${id}: sem roteiro (script), pulando`); continue; }
  const voice = opt('voice', def.voice || 'pt-BR-AntonioNeural');
  const rate = opt('rate', def.rate || '+10%');
  console.log(`\n🎙  ${id}  (${voice}, ${rate})`);

  const lines = [];
  let t = def.leadIn ?? 0.15;
  for (const [i, line] of def.script.entries()) {
    const text = spoken(line.text);
    const hash = crypto.createHash('sha1').update(`${voice}|${rate}|${text}`).digest('hex').slice(0, 16);
    const mp3 = path.join(CACHE, `${hash}.mp3`), js = path.join(CACHE, `${hash}.json`);
    if (!fs.existsSync(mp3) || !fs.existsSync(js) || fs.statSync(mp3).size === 0) {
      await run('python3', [path.join(ROOT, 'tools', 'tts.py'), text, voice, rate, mp3, js], sslEnv);
    }
    const bounds = JSON.parse(fs.readFileSync(js, 'utf8'));
    const words = align(tokenize(line.text), bounds);
    const speechEnd = Math.max(...words.map((w) => w.e));
    const start = t;
    lines.push({
      id: line.id || `l${i}`, start: +start.toFixed(3), end: +(start + speechEnd).toFixed(3), file: mp3,
      words: words.map((w) => ({ w: w.w, hl: w.hl, s: +(start + w.s).toFixed(3), e: +(start + w.e).toFixed(3) })),
    });
    t = start + speechEnd + (line.pause ?? def.pause ?? 0.22);
    process.stdout.write(`  ✓ ${String(i + 1).padStart(2)}  ${start.toFixed(2)}s  ${text}\n`);
  }

  // Junta todas as falas em uma faixa só, cada uma no seu instante
  const total = lines[lines.length - 1].end + 0.6;
  const args = ['-y'];
  lines.forEach((l) => args.push('-i', l.file));
  const f = lines.map((l, i) => `[${i}]adelay=${Math.round(l.start * 1000)}:all=1[a${i}]`).join(';')
    + `;${lines.map((_, i) => `[a${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,apad,atrim=0:${total.toFixed(2)}[out]`;
  args.push('-filter_complex', f, '-map', '[out]', '-ar', '48000', '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '160k', path.join(OUT, `${id}.mp3`));
  await run('ffmpeg', args);

  const json = { voice, rate, duration: +total.toFixed(3), lines: lines.map(({ file, ...l }) => l) };
  fs.writeFileSync(path.join(OUT, `${id}.json`), JSON.stringify(json, null, 1));
  console.log(`  → narration/${id}.mp3  (${total.toFixed(1)}s)`);
}
