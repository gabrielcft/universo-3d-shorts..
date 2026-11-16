// Núcleo: renderer vertical 1080x1920, bloom, céu estrelado, narração com
// legendas palavra por palavra, efeitos de câmera (punch/tremor/flash) e o
// loop de preview/gravação.
//
// Toda cena é uma função PURA do tempo t: update(t) sempre gera o mesmo quadro
// para o mesmo t — por isso a gravação quadro a quadro fica perfeita.
//
// Linha do tempo: os shorts com `script` são guiados pela narração. Dentro do
// update use  ctx.B('id')  (início da frase),  ctx.E('id')  (fim da frase) e
// ctx.W('id', 'palavra')  (instante em que a palavra é dita).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CHANNEL } from '../config.js';
import { createStarfield, createNebula, clamp01, ease } from './space.js';
import { tokenize, estimate, chunk, norm } from './script.js';

export const W = 1080;
export const H = 1920;
export const FPS = 30;

function formatText(s) {
  return s
    .replace(/\*\*([\s\S]+?)\*\*/g, '<span class="hl2">$1</span>')
    .replace(/\*([\s\S]+?)\*/g, '<span class="hl">$1</span>')
    .replace(/\n/g, '<br>');
}

/** Carrega a narração gerada (ou estima os tempos se ainda não existir). */
async function loadNarration(def) {
  try {
    const r = await fetch(`narration/${def.id}.json`, { cache: 'no-store' });
    if (r.ok) {
      const n = await r.json();
      if (n.lines.length === def.script.length) return { ...n, audio: `narration/${def.id}.mp3` };
      console.warn('Narração desatualizada (número de frases mudou) — rode: npm run narrate --', def.id);
    }
  } catch { /* sem narração */ }
  let t = def.leadIn ?? 0.15;
  const lines = def.script.map((l, i) => {
    const words = estimate(tokenize(l.text), t);
    const line = { id: l.id || `l${i}`, start: t, end: words[words.length - 1].e, words };
    t = line.end + (l.pause ?? def.pause ?? 0.22);
    return line;
  });
  return { lines, duration: t + 0.4, audio: null, estimated: true };
}

export async function runShort(def) {
  const params = new URLSearchParams(location.search);
  const recording = params.has('record');
  document.body.classList.toggle('recording', recording);
  document.title = `${def.title} — Universo 3D`;

  // ---------- Linha do tempo da narração ----------
  const narration = def.script ? await loadNarration(def) : null;
  const lineById = {};
  narration?.lines.forEach((l, i) => { lineById[l.id] = { ...l, ...def.script[i] }; });
  const getLine = (id) => {
    const l = lineById[id];
    if (!l) throw new Error(`Frase "${id}" não existe no roteiro`);
    return l;
  };
  const B = (id) => getLine(id).start;
  const E = (id) => getLine(id).end;
  const Wt = (id, word) => {
    const l = getLine(id);
    const k = norm(word);
    return (l.words.find((w) => norm(w.w).startsWith(k)) || l.words[0]).s;
  };
  const duration = def.duration ?? (narration ? narration.duration + (def.tail ?? 0.9) : 30);

  // ---------- Renderer ----------
  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({
    antialias: true, preserveDrawingBuffer: true, logarithmicDepthBuffer: !!def.logDepth, powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = def.exposure ?? 1.0;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(def.background ?? 0x010104);
  const baseFov = def.fov ?? 50;
  const camera = new THREE.PerspectiveCamera(baseFov, W / H, def.near ?? 0.05, def.far ?? 4000);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const b = { strength: 1.0, radius: 0.6, threshold: 0.7, ...(def.bloom || {}) };
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), b.strength, b.radius, b.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- Fundo ----------
  const sky = new THREE.Group();
  scene.add(sky);
  if (def.nebula !== false) sky.add(createNebula({ radius: camera.far * 0.8, ...(def.nebula || {}) }));
  let starfield = null;
  if (def.stars !== false) {
    starfield = createStarfield({ radius: camera.far * 0.6, ...(def.stars || {}) });
    sky.add(starfield);
  }

  // ---------- Overlay ----------
  const handleEl = document.getElementById('handle');
  const handle = def.handle ?? (CHANNEL.showHandle ? CHANNEL.handle : '');
  handleEl.textContent = handle;
  handleEl.style.display = handle ? '' : 'none';
  const hud = document.getElementById('hud');
  const flashEl = document.getElementById('flash');
  const capsEl = document.getElementById('captions');
  if (def.captionY) stage.style.setProperty('--capY', `${def.captionY}px`);

  // Legendas fixas (opcionais)
  const caps = (def.captions || []).map((c) => {
    const el = document.createElement('div');
    const pos = c.pos || def.captionPos || 'top';
    el.className = `cap size-${c.size || 'l'} pos-${pos}`;
    el.innerHTML = formatText(c.text);
    capsEl.appendChild(el);
    return { ...c, el, pos, lastKey: '' };
  });

  // Legendas da narração: blocos de 1–3 palavras que surgem conforme são faladas
  const kchunks = [];
  narration?.lines.forEach((line, li) => {
    const groups = chunk(line.words, def.captionWords ?? 3, def.captionChars ?? 15);
    groups.forEach((g, gi) => {
      const el = document.createElement('div');
      el.className = 'kchunk';
      const spans = g.map((w) => {
        const sp = document.createElement('span');
        sp.className = `kw${w.hl ? ` hl${w.hl === 2 ? '2' : ''}` : ''}`;
        sp.textContent = w.w;
        el.appendChild(sp);
        return { sp, s: w.s, key: '' };
      });
      el.style.display = 'none';
      capsEl.appendChild(el);
      const next = groups[gi + 1]?.[0].s ?? narration.lines[li + 1]?.start ?? duration;
      const end = gi < groups.length - 1 ? next - 0.02 : Math.min(next - 0.02, line.end + 0.45);
      kchunks.push({ el, spans, start: g[0].s - 0.04, end, shown: false });
    });
  });

  const ctx = { THREE, scene, camera, renderer, composer, bloom, hud, W, H, params, recording, def, B, E, W: Wt, narration, duration };
  const state = (await def.setup?.(ctx)) || {};

  // Efeitos automáticos nas viradas de frase
  const beats = narration ? narration.lines.map((l, i) => ({ t: l.start, ...def.script[i] })) : [];
  const fxAt = (t) => {
    let punch = 0, shake = 0, flash = 0;
    for (const bt of beats) {
      const dt = t - bt.t;
      if (dt < 0) break;
      punch = (bt.punch ?? def.punch ?? 0.05) * Math.exp(-dt * 6);
      if (bt.shake) shake = Math.max(shake, bt.shake * Math.exp(-dt * 3));
      if (bt.flash) flash = Math.max(flash, Math.exp(-dt * 5));
    }
    for (const x of def.fx?.(ctx) || []) { // efeitos extras em instantes específicos
      const dt = t - x.t;
      if (dt < 0) continue;
      if (x.shake) shake = Math.max(shake, x.shake * Math.exp(-dt * 3));
      if (x.flash) flash = Math.max(flash, x.flash * Math.exp(-dt * 5));
      if (x.punch) punch += x.punch * Math.exp(-dt * 6);
    }
    return { punch, shake, flash };
  };
  const wobble = (t, f) => Math.sin(t * f) * 0.6 + Math.sin(t * f * 2.31 + 1.3) * 0.3 + Math.sin(t * f * 5.17 + 4.1) * 0.1;

  function updateCaptions(t) {
    for (const c of caps) {
      const [a, z] = c.t;
      let o = 0, s = 0.9, y = 30;
      if (t >= a && t < z) {
        const pin = clamp01((t - a) / 0.32), pout = clamp01((z - t) / 0.22);
        o = Math.min(pin, pout);
        s = 0.86 + 0.14 * ease.outBack(pin);
        y = (1 - ease.outCubic(pin)) * 34 - (1 - pout) * 14;
      }
      const base = c.pos === 'center' ? 'translateY(-50%) ' : '';
      const key = `${o.toFixed(3)}|${s.toFixed(3)}|${y.toFixed(1)}`;
      if (key !== c.lastKey) {
        c.lastKey = key;
        c.el.style.opacity = o;
        c.el.style.transform = `${base}translateY(${y}px) scale(${s})`;
      }
    }
    for (const k of kchunks) {
      const on = t >= k.start && t < k.end;
      if (on !== k.shown) { k.el.style.display = on ? '' : 'none'; k.shown = on; }
      if (!on) continue;
      for (const w of k.spans) {
        const p = clamp01((t - w.s) / 0.13);
        const sc = t < w.s ? 0.6 : 0.62 + 0.38 * ease.outBack(p) + 0.08 * Math.exp(-(t - w.s) * 8);
        const key = `${(t < w.s ? 0 : 1)}|${sc.toFixed(3)}`;
        if (key !== w.key) {
          w.key = key;
          w.sp.style.opacity = t < w.s ? 0 : 1;
          w.sp.style.transform = `scale(${sc.toFixed(3)})`;
        }
      }
    }
  }

  function renderAt(t) {
    t = Math.max(0, Math.min(duration, t));
    ctx.time = t;
    camera.fov = baseFov;
    def.update?.(t, ctx, state);
    // punch-in + tremor de câmera
    const fx = fxAt(t);
    camera.fov = camera.fov * (1 - fx.punch);
    camera.updateProjectionMatrix();
    const amp = (def.handheld ?? 0.0025) + fx.shake * 0.02;
    camera.rotateZ(wobble(t, 1.1) * amp);
    camera.rotateX(wobble(t + 7, 1.7) * amp * 0.8);
    camera.rotateY(wobble(t + 3, 1.4) * amp * 0.8);
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    if (starfield) starfield.material.uniforms.uTime.value = t;
    flashEl.style.opacity = (fx.flash * 0.85).toFixed(3);
    updateCaptions(t);
    composer.render();
  }

  await document.fonts.ready;
  window.__short = {
    id: def.id, duration, fps: def.fps ?? FPS, renderAt, youtube: def.youtube, title: def.title,
    audio: narration?.audio || null, estimated: !!narration?.estimated,
    music: def.music || null,
    sfx: def.script ? beats.map((bt, i) => ({ t: bt.t, type: bt.sfx ?? (i === 0 ? null : 'whoosh') })).filter((x) => x.type)
      .concat((def.fx?.(ctx) || []).filter((x) => x.sfx).map((x) => ({ t: x.t, type: x.sfx }))) : [],
  };

  if (recording) {
    renderAt(Number(params.get('t') ?? 0));
    window.__short.ready = true;
    return;
  }

  // ---------- Preview interativo (com a voz) ----------
  const playBtn = document.getElementById('play');
  const seek = document.getElementById('seek');
  const timeEl = document.getElementById('time');
  const safe = document.getElementById('safe');
  const audio = narration?.audio ? new Audio(narration.audio) : null;
  let playing = false;
  let cur = Number(params.get('t') ?? 0);
  let last = performance.now();

  const fit = () => {
    const s = Math.min(innerWidth / W, (innerHeight - 76) / H);
    document.documentElement.style.setProperty('--s', s);
  };
  fit();
  addEventListener('resize', fit);
  const setPlaying = (p) => {
    playing = p;
    playBtn.innerHTML = p ? '&#10074;&#10074;' : '&#9654;';
    if (audio) { if (p) { audio.currentTime = cur; audio.play().catch(() => {}); } else audio.pause(); }
  };
  setPlaying(false);
  playBtn.onclick = () => setPlaying(!playing);
  stage.onclick = () => setPlaying(!playing);
  seek.oninput = () => { cur = Number(seek.value) * duration; if (audio) audio.currentTime = cur; };
  safe.onchange = () => document.body.classList.toggle('show-safe', safe.checked);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    if (e.code === 'ArrowRight') cur = Math.min(duration, cur + 1);
    if (e.code === 'ArrowLeft') cur = Math.max(0, cur - 1);
    if (e.code === 'Home') cur = 0;
    if (audio && e.code.startsWith('Arrow')) audio.currentTime = cur;
  });

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) {
      cur += dt;
      if (audio && !audio.paused && Math.abs(audio.currentTime - cur) > 0.12 && cur < audio.duration) cur = audio.currentTime;
      if (cur > duration) { cur = 0; if (audio) { audio.currentTime = 0; audio.play().catch(() => {}); } }
    }
    renderAt(cur);
    seek.value = cur / duration;
    timeEl.textContent = `${cur.toFixed(1)}s`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
