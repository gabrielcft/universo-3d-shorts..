// SHORT 03 — O quão pequena a Terra é? (Terra → Betelgeuse)
// Unidade da cena: 1 = raio da Terra. Usa logarithmicDepthBuffer por causa das escalas gigantes.
import * as THREE from 'three';
import {
  createStarMaterial, createGlow, createAtmosphere, planetTexture, PALETTES,
  lerp, clamp01, ease, smoothstep, phase,
} from '../engine/space.js';

// Raios aproximados em raios terrestres (R☉ ≈ 109 R⊕). `line` = frase em que a câmera chega nele.
const BODIES = [
  { name: 'Terra', sub: '12.742 km de diâmetro', R: 1, kind: 'earth', line: 'hook' },
  { name: 'Júpiter', sub: '11× a Terra', R: 11.2, kind: 'jupiter', line: 'jup' },
  { name: 'Sol', sub: '109× a Terra', R: 109, kind: 'star', color: '#ff7a14', hot: '#fff0b0', scale: 4, line: 'sun' },
  { name: 'Sirius A', sub: '1,7× o Sol', R: 186, kind: 'star', color: '#8fb4ff', hot: '#ffffff', scale: 4, line: 'sirius' },
  { name: 'Arcturus', sub: '25× o Sol', R: 2770, kind: 'star', color: '#ff6a1a', hot: '#ffc58a', scale: 3.5, line: 'arc' },
  { name: 'Rigel', sub: '79× o Sol', R: 8610, kind: 'star', color: '#4f86ff', hot: '#eaf1ff', scale: 4, line: 'rigel' },
  { name: 'Betelgeuse', sub: '~760× o Sol', R: 82800, kind: 'star', color: '#b3200a', hot: '#ff8c42', scale: 2.2, line: 'bet' },
];

// Posições: lado a lado, tangentes, da esquerda para a direita
let x = 0;
BODIES.forEach((b, i) => {
  if (i > 0) x += BODIES[i - 1].R + b.R * 0.12 + BODIES[i - 1].R * 0.15 + b.R;
  b.x = x;
  b.dist = b.R * 5.2;
  b.target = b.x - b.R * 0.18;
});

/** Estado da câmera (alvo x e distância) em função do tempo. */
function cameraAt(t, FOCUS, TRANS) {
  let k = 0;
  for (let i = 1; i < BODIES.length; i++) if (t >= FOCUS[i] - TRANS[i]) k = i;
  const b = BODIES[k];
  if (k === 0 || t >= FOCUS[k]) {
    const drift = 1 + 0.05 * Math.max(0, t - FOCUS[k]);
    return { x: b.target, d: b.dist * drift };
  }
  const a = BODIES[k - 1];
  const p = ease.inOutCubic(clamp01((t - (FOCUS[k] - TRANS[k])) / TRANS[k]));
  const dA = a.dist * (1 + 0.05 * Math.max(0, FOCUS[k] - TRANS[k] - FOCUS[k - 1]));
  const d = Math.exp(lerp(Math.log(dA), Math.log(b.dist), p));
  // o deslocamento lateral acompanha o zoom, para o corpo anterior não "escorregar" da tela
  const xs = (d - dA) / (b.dist - dA);
  return { x: lerp(a.target, b.target, xs), d };
}

export default {
  title: 'O quão pequena a Terra é?',
  logDepth: true,
  near: 0.01,
  far: 4e6,
  bloom: { strength: 0.55, radius: 0.5, threshold: 0.9 },
  nebula: { a: '#1b2a6b', b: '#5e1b4f', intensity: 0.2, seed: 8.8 },
  captionY: 430, // legendas no alto: os astros ocupam o centro

  script: [
    { id: 'hook', text: 'Você sabe o quão *pequena* a Terra é?', sfx: 'boom' },
    { id: 'jup', text: 'Olha *Júpiter*. Cabem *mil e trezentas Terras* dentro dele.' },
    { id: 'sun', text: 'Agora o *Sol*: mais de *um milhão* de Terras!', punch: 0.08 },
    { id: 'sirius', text: '*Sirius*, a estrela mais brilhante do céu noturno.' },
    { id: 'arc', text: '*Arcturus*: 25 vezes maior que o Sol.' },
    { id: 'rigel', text: '*Rigel*: quase *80 vezes* o Sol.' },
    { id: 'bet', text: 'E então... **Betelgeuse**.', flash: true, shake: 0.8, sfx: 'boom' },
    { id: 'bet2', text: 'Cerca de *760 vezes* o tamanho do Sol.' },
    { id: 'orbit', text: 'No lugar do Sol, ela engoliria a órbita da *Terra*... e até a de *Marte*.' },
    { id: 'pixel', text: 'E a Terra? *Nem um pixel*.', punch: 0.09 },
    { id: 'outro', text: 'Segue pra mais curiosidades do universo!' },
  ],

  youtube: {
    title: 'O quão PEQUENA a Terra realmente é? 🌍➡️⭐',
    description: 'Da Terra a Betelgeuse: uma viagem de escala pelo universo. Betelgeuse é tão grande que, no lugar do Sol, engoliria até a órbita de Marte. (Tamanhos aproximados.)',
    hashtags: ['shorts', 'universo', 'escala', 'estrelas', 'astronomia', 'curiosidades'],
    tags: ['tamanho das estrelas', 'betelgeuse', 'comparação de tamanho', 'universo', 'astronomia', 'espaço'],
  },

  setup({ scene, hud, B }) {
    const sunLight = new THREE.DirectionalLight('#fff4e6', 2.6);
    sunLight.position.set(0.7, 0.35, 1);
    scene.add(sunLight, new THREE.AmbientLight('#ffffff', 0.05));

    const spinners = [], starMats = [];
    for (const b of BODIES) {
      const g = new THREE.Group();
      g.position.x = b.x;
      scene.add(g);
      let mesh;
      if (b.kind === 'earth') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), new THREE.MeshStandardMaterial({
          map: planetTexture({ kind: 'rocky', seed: 4, stops: PALETTES.earth, scale: 1.8, contrast: 2.2, ice: 0.86 }), roughness: 0.85,
        }));
        const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 128, 64), new THREE.MeshStandardMaterial({
          map: planetTexture({ kind: 'clouds', seed: 9, scale: 2.4 }), transparent: true, depthWrite: false,
        }));
        mesh.add(clouds);
        g.add(createAtmosphere(1.045, '#5fa8ff', 1.4, 3.2));
      } else if (b.kind === 'jupiter') {
        mesh = new THREE.Mesh(new THREE.SphereGeometry(b.R, 128, 64), new THREE.MeshStandardMaterial({
          map: planetTexture({ kind: 'gas', seed: 21, stops: PALETTES.jupiter, bandFreq: 11, turb: 0.35, scale: 2.5 }), roughness: 1,
        }));
        g.add(createAtmosphere(b.R * 1.02, '#ffd9b0', 0.6, 4));
      } else {
        const mat = createStarMaterial({ color: b.color, hot: b.hot, intensity: 1.25, scale: b.scale });
        starMats.push(mat);
        mesh = new THREE.Mesh(new THREE.SphereGeometry(b.R, 128, 64), mat);
        g.add(createGlow(b.color, b.R * 3.2, 0.35));
      }
      mesh.rotation.z = 0.35;
      g.add(mesh);
      spinners.push(mesh);
    }

    hud.innerHTML = BODIES.map((b) => `<div class="label3d"><b>${b.name}</b><span>${b.sub}</span></div>`).join('');
    // Órbitas da Terra e de Marte desenhadas sobre Betelgeuse (1 UA ≈ 23.455 raios terrestres)
    const bet = BODIES[BODIES.length - 1];
    const orbits = [['Terra', 1.0, '#3df5ff'], ['Marte', 1.52, '#ff7b5c']].map(([name, au, c]) => {
      const r = au * 23455;
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.0), transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 1100, r + 1100, 256), mat);
      ring.position.set(bet.x, 0, bet.R * 1.05);
      ring.renderOrder = 10;
      scene.add(ring);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(2200, 16, 8), mat);
      dot.position.set(r, 0, 0);
      ring.add(dot);
      return { ring, mat, r };
    });
    hud.insertAdjacentHTML('beforeend', '<div class="label3d orb"><b style="font-size:46px;color:#3df5ff">Órbita da Terra</b></div><div class="label3d orb"><b style="font-size:46px;color:#ff7b5c">Órbita de Marte</b></div>');

    // A câmera chega em cada astro ~1 s depois que seu nome começa a ser falado
    const FOCUS = BODIES.map((b, i) => (i === 0 ? 0 : B(b.line) + 0.9));
    const TRANS = BODIES.map((b, i) => (i === 0 ? 0 : i === BODIES.length - 1 ? 1.7 : 1.3));
    return { spinners, starMats, FOCUS, TRANS, orbits, labels: [...hud.querySelectorAll('.label3d:not(.orb)')], orbLabels: [...hud.querySelectorAll('.orb')], v: new THREE.Vector3() };
  },

  update(t, { camera, H, B, W }, s) {
    s.starMats.forEach((m) => { m.uniforms.uTime.value = t; });
    s.spinners.forEach((m, i) => { m.rotation.y = t * (0.12 - i * 0.008); });

    const { x: cx, d } = cameraAt(t, s.FOCUS, s.TRANS);
    const az = 0.22 * Math.sin(t * 0.25);
    camera.position.set(cx + d * Math.sin(az), d * 0.1, d * Math.cos(az));
    camera.lookAt(cx, d * 0.085, 0);
    camera.near = d * 0.002;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // Órbitas aparecem quando a narração as cita
    s.orbits.forEach((o, i) => {
      const op = phase(t, W('orbit', i === 0 ? 'Terra' : 'Marte') - 0.1, W('orbit', i === 0 ? 'Terra' : 'Marte') + 0.4) * (1 - phase(t, B('pixel') - 0.2, B('pixel') + 0.3));
      o.mat.opacity = op;
      o.ring.visible = op > 0.001;
      o.ring.rotation.z = t * 0.6 + i * 2;
      s.v.set(o.ring.position.x, o.r + 3500, o.ring.position.z).project(camera);
      const el = s.orbLabels[i];
      el.style.opacity = op.toFixed(3);
      el.style.transform = `translate(${((s.v.x * 0.5 + 0.5) * 1080).toFixed(1)}px, ${((-s.v.y * 0.5 + 0.5) * H - (i ? 0 : 0)).toFixed(1)}px) translate(-50%, -100%)`;
    });

    // Rótulos que acompanham cada corpo
    const k = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    BODIES.forEach((b, i) => {
      const el = s.labels[i];
      const dist = camera.position.distanceTo(s.v.set(b.x, 0, 0));
      const rpx = (b.R / dist) * k;
      s.v.set(b.x, b.R * 1.08, 0).project(camera);
      const sx = (s.v.x * 0.5 + 0.5) * 1080, sy = (-s.v.y * 0.5 + 0.5) * H;
      let o = smoothstep(25, 60, rpx) * (1 - smoothstep(650, 900, rpx));
      if (sx < 60 || sx > 1020 || sy < 700 || s.v.z > 1) o = 0;
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate(${sx.toFixed(1)}px, ${(sy - 10).toFixed(1)}px) translate(-50%, -100%)`;
    });
  },
};
