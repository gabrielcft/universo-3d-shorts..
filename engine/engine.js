// Núcleo: cria o renderer vertical 1080x1920, pós-processamento (bloom),
// céu estrelado, legendas temporizadas e o loop de preview/gravação.
//
// Toda cena é uma função PURA do tempo t (segundos): update(t) sempre gera o
// mesmo quadro para o mesmo t. É isso que permite gravar quadro a quadro, sem
// travadas, mesmo em máquinas lentas.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CHANNEL } from '../config.js';
import { createStarfield, createNebula, clamp01, ease } from './space.js';

export const W = 1080;
export const H = 1920;
export const FPS = 30;

function formatText(s) {
  return s
    .replace(/\*\*([\s\S]+?)\*\*/g, '<span class="hl2">$1</span>')
    .replace(/\*([\s\S]+?)\*/g, '<span class="hl">$1</span>')
    .replace(/\n/g, '<br>');
}

export async function runShort(def) {
  const params = new URLSearchParams(location.search);
  const recording = params.has('record');
  document.body.classList.toggle('recording', recording);
  document.title = `${def.title} — Universo 3D`;

  // ---------- Renderer ----------
  const stage = document.getElementById('stage');
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
    logarithmicDepthBuffer: !!def.logDepth,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = def.exposure ?? 1.0;
  stage.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(def.background ?? 0x010104);
  const camera = new THREE.PerspectiveCamera(def.fov ?? 50, W / H, def.near ?? 0.05, def.far ?? 4000);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(W, H);
  composer.addPass(new RenderPass(scene, camera));
  const b = { strength: 1.0, radius: 0.6, threshold: 0.7, ...(def.bloom || {}) };
  const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), b.strength, b.radius, b.threshold);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- Fundo: nebulosa + estrelas (seguem a câmera = "infinito") ----------
  const sky = new THREE.Group();
  scene.add(sky);
  if (def.nebula !== false) {
    sky.add(createNebula({ radius: camera.far * 0.8, ...(def.nebula || {}) }));
  }
  let starfield = null;
  if (def.stars !== false) {
    starfield = createStarfield({ radius: camera.far * 0.6, ...(def.stars || {}) });
    sky.add(starfield);
  }

  // ---------- Overlay HTML ----------
  document.getElementById('handle').textContent = def.handle ?? CHANNEL.handle;
  const hud = document.getElementById('hud');
  const capsEl = document.getElementById('captions');
  const caps = (def.captions || []).map((c) => {
    const el = document.createElement('div');
    const pos = c.pos || def.captionPos || 'top';
    el.className = `cap size-${c.size || 'l'} pos-${pos}`;
    el.innerHTML = formatText(c.text);
    capsEl.appendChild(el);
    return { ...c, el, pos, lastKey: '' };
  });

  const ctx = { THREE, scene, camera, renderer, composer, bloom, hud, W, H, params, recording, def };
  const state = (await def.setup?.(ctx)) || {};

  function updateCaptions(t) {
    for (const c of caps) {
      const [a, z] = c.t;
      let o = 0, s = 0.9, y = 30;
      if (t >= a && t < z) {
        const pin = clamp01((t - a) / 0.32);
        const pout = clamp01((z - t) / 0.22);
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
  }

  const duration = def.duration;
  function renderAt(t) {
    t = Math.max(0, Math.min(duration, t));
    ctx.time = t;
    def.update?.(t, ctx, state);
    camera.updateMatrixWorld();
    sky.position.copy(camera.position);
    if (starfield) starfield.material.uniforms.uTime.value = t;
    updateCaptions(t);
    composer.render();
  }

  await document.fonts.ready;
  window.__short = { id: def.id, duration, fps: def.fps ?? FPS, renderAt, youtube: def.youtube, title: def.title };

  if (recording) {
    renderAt(Number(params.get('t') ?? 0));
    window.__short.ready = true;
    return;
  }

  // ---------- Preview interativo ----------
  const playBtn = document.getElementById('play');
  const seek = document.getElementById('seek');
  const timeEl = document.getElementById('time');
  const safe = document.getElementById('safe');
  let playing = !params.has('t');
  let cur = Number(params.get('t') ?? 0);
  let last = performance.now();

  const fit = () => {
    const s = Math.min(innerWidth / W, (innerHeight - 76) / H);
    document.documentElement.style.setProperty('--s', s);
  };
  fit();
  addEventListener('resize', fit);
  const setPlaying = (p) => { playing = p; playBtn.innerHTML = p ? '&#10074;&#10074;' : '&#9654;'; };
  setPlaying(playing);
  playBtn.onclick = () => setPlaying(!playing);
  seek.oninput = () => { cur = Number(seek.value) * duration; };
  safe.onchange = () => document.body.classList.toggle('show-safe', safe.checked);
  addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); setPlaying(!playing); }
    if (e.code === 'ArrowRight') cur = Math.min(duration, cur + 1);
    if (e.code === 'ArrowLeft') cur = Math.max(0, cur - 1);
    if (e.code === 'Home') cur = 0;
  });

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (playing) { cur += dt; if (cur > duration) cur = 0; }
    renderAt(cur);
    seek.value = cur / duration;
    timeEl.textContent = `${cur.toFixed(1)}s`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
