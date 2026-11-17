// SHORT 03 — E se você fosse de foguete até a maior estrela?
// Unidade da cena: 1 = raio da Terra. Usa logarithmicDepthBuffer por causa das escalas gigantes.
import * as THREE from 'three';
import { planetTexture, lerp, clamp01, ease, smoothstep, phase } from '../engine/space.js';
import { toonMat, toonStarMat, createToonHalo, addOutlines, flatMat, shotIndex, applyShots } from '../engine/toon.js';
import { createAstronaut, createRocket } from '../engine/characters.js';

// Raios aproximados em raios terrestres (R☉ ≈ 109 R⊕). `line` = frase em que a câmera chega nele.
const BODIES = [
  { name: 'Terra', sub: '12.742 km de diâmetro', R: 1, kind: 'earth', line: 'earth' },
  { name: 'Júpiter', sub: '11× a Terra', R: 11.2, kind: 'jupiter', line: 'jup' },
  { name: 'Sol', sub: '109× a Terra', R: 109, kind: 'star', pal: ['#ffb22e', '#ffe58a', '#ff7b1c'], line: 'sun' },
  { name: 'Arcturus', sub: '25× o Sol', R: 2770, kind: 'star', pal: ['#ff8a3a', '#ffc58a', '#e0541a'], line: 'arc' },
  { name: 'Rigel', sub: '79× o Sol', R: 8610, kind: 'star', pal: ['#7fb0ff', '#eaf1ff', '#4b72e8'], line: 'rigel' },
  { name: 'Betelgeuse', sub: '~760× o Sol', R: 82800, kind: 'star', pal: ['#e8432a', '#ff9a5a', '#a8200e'], line: 'bet' },
];

let x = 0;
BODIES.forEach((b, i) => {
  if (i > 0) x += BODIES[i - 1].R + b.R * 0.12 + BODIES[i - 1].R * 0.15 + b.R;
  b.x = x;
  b.dist = b.R * 5.2;
  b.target = b.x - b.R * 0.18;
});
const REACT = new THREE.Vector3(0, 3e5, 0); // cenário das reações, longe dos astros
const REACT_LINES = ['hook', 'react', 'pixel'];

function cameraAt(t, FOCUS, TRANS) {
  let k = 0;
  for (let i = 1; i < BODIES.length; i++) if (t >= FOCUS[i] - TRANS[i]) k = i;
  const b = BODIES[k];
  if (k === 0 || t >= FOCUS[k]) return { x: b.target, d: b.dist * (1 + 0.05 * Math.max(0, t - FOCUS[k])) };
  const a = BODIES[k - 1];
  const p = ease.inOutCubic(clamp01((t - (FOCUS[k] - TRANS[k])) / TRANS[k]));
  const dA = a.dist * (1 + 0.05 * Math.max(0, FOCUS[k] - TRANS[k] - FOCUS[k - 1]));
  const d = Math.exp(lerp(Math.log(dA), Math.log(b.dist), p));
  return { x: lerp(a.target, b.target, (d - dA) / (b.dist - dA)), d };
}

export default {
  title: 'E se você fosse até a maior estrela?',
  toon: true,
  sky: { top: '#080c28', bottom: '#241540', seed: 31 },
  music: { mood: 'epic', seed: 3 },
  logDepth: true,
  near: 0.01,
  far: 4e6,
  bloom: { strength: 0.3, radius: 0.5, threshold: 0.93 },

  script: [
    { id: 'hook', text: 'E se você pegasse um foguete e fosse até a *maior estrela* que a gente conhece?', sfx: 'boom' },
    { id: 'earth', text: 'Você decola da *Terra*...' },
    { id: 'jup', text: 'e logo passa por *Júpiter*. Cabem *mil e trezentas Terras* nele!' },
    { id: 'sun', text: 'Depois, o *Sol*: mais de *um milhão* de Terras!', punch: 0.08 },
    { id: 'arc', text: 'Mas você continua... *Arcturus*, 25 vezes maior que o Sol.' },
    { id: 'rigel', text: '*Rigel*: quase *80 vezes*!' },
    { id: 'bet', text: 'E então você vê... **Betelgeuse**.', flash: true, shake: 0.8, sfx: 'boom' },
    { id: 'react', text: 'Cerca de *760 vezes* o tamanho do Sol!', shake: 0.4 },
    { id: 'orbit', text: 'No lugar do Sol, ela engoliria a órbita da *Terra*... e até a de *Marte*!' },
    { id: 'pixel', text: 'E você? Menor que *um pixel*.', punch: 0.09 },
    { id: 'outro', text: 'Segue pra mais histórias do universo!' },
  ],

  youtube: {
    title: 'E se você fosse até a MAIOR estrela? 🚀⭐',
    description: 'Uma viagem de foguete da Terra até Betelgeuse: Júpiter, o Sol, Arcturus, Rigel... Betelgeuse é tão grande que, no lugar do Sol, engoliria até a órbita de Marte. (Tamanhos aproximados.)',
    hashtags: ['shorts', 'universo', 'escala', 'estrelas', 'astronomia', 'esevoce'],
    tags: ['tamanho das estrelas', 'betelgeuse', 'e se você', 'comparação de tamanho', 'universo', 'animação'],
  },

  setup({ scene, hud, B, duration }) {
    const sunLight = new THREE.DirectionalLight('#fff4e6', 2.2);
    sunLight.position.set(0.7, 0.35, 1);
    scene.add(sunLight, new THREE.AmbientLight('#b8c4ff', 0.6));

    const spinners = [], starMats = [], halos = [];
    for (const b of BODIES) {
      const g = new THREE.Group();
      g.position.x = b.x;
      scene.add(g);
      let mesh;
      if (b.kind === 'earth') {
        const tex = planetTexture({ kind: 'rocky', seed: 4, contrast: 2.2, ice: 0.8, posterize: 1, scale: 1.8,
          stops: [[0, '#1f6fd1'], [0.55, '#2a86e8'], [0.551, '#58c25a'], [0.72, '#3fa04a'], [0.721, '#3fa04a'], [1, '#2f8a3c']] });
        mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), toonMat('#ffffff', { map: tex }));
        const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.02, 64, 32), toonMat('#ffffff', { map: planetTexture({ kind: 'clouds', seed: 9, scale: 2.4, posterize: 1 }), transparent: true, depthWrite: false }));
        clouds.userData.noOutline = true;
        mesh.add(clouds);
      } else if (b.kind === 'jupiter') {
        const tex = planetTexture({ kind: 'gas', seed: 21, bandFreq: 11, turb: 0.4, scale: 2.5, posterize: 5,
          stops: [[0, '#b97a4f'], [0.3, '#d9a36f'], [0.55, '#f2dfc2'], [0.8, '#e0b184'], [1, '#a86a44']] });
        mesh = new THREE.Mesh(new THREE.SphereGeometry(b.R, 64, 32), toonMat('#ffffff', { map: tex }));
      } else {
        const mat = toonStarMat({ c: b.pal[0], light: b.pal[1], dark: b.pal[2], scale: 3 });
        starMats.push(mat);
        mesh = new THREE.Mesh(new THREE.SphereGeometry(b.R, 64, 32), mat);
        const halo = createToonHalo(b.pal[1], b.R, 3, 0.25);
        g.add(halo);
        halos.push({ halo, b });
      }
      mesh.rotation.z = 0.35;
      addOutlines(mesh, 1.6);
      g.add(mesh);
      spinners.push(mesh);
    }
    const launch = createRocket();
    launch.group.scale.setScalar(0.12);
    scene.add(launch.group);

    // órbitas da Terra e de Marte sobre Betelgeuse (1 UA ≈ 23.455 raios terrestres)
    const bet = BODIES[BODIES.length - 1];
    const orbits = [['Terra', 1.0, '#3df5ff'], ['Marte', 1.52, '#ffd23f']].map(([, au, c]) => {
      const r = au * 23455;
      const mat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthTest: false, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 1300, r + 1300, 256), mat);
      ring.position.set(bet.x, 0, bet.R * 1.05);
      ring.renderOrder = 10;
      scene.add(ring);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(2600, 16, 8), mat);
      dot.position.set(r, 0, 0);
      ring.add(dot);
      return { ring, mat, r };
    });

    // cenário das reações: você na frente do foguete
    const astro = createAstronaut();
    astro.group.position.copy(REACT);
    scene.add(astro.group);
    const myRocket = createRocket();
    myRocket.group.position.set(REACT.x - 2.2, REACT.y - 0.5, REACT.z - 2);
    myRocket.group.rotation.set(-0.3, 0.6, 0.2);
    scene.add(myRocket.group);
    const backdrop = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 24), toonStarMat({ c: '#e8432a', light: '#ff9a5a', dark: '#a8200e', scale: 2 }));
    backdrop.position.set(REACT.x + 10, REACT.y + 4, REACT.z - 70);
    scene.add(backdrop);

    hud.innerHTML = BODIES.map((b) => `<div class="label3d"><b>${b.name}</b><span>${b.sub}</span></div>`).join('')
      + '<div class="label3d orb"><b style="font-size:46px;color:#3df5ff">Órbita da Terra</b></div><div class="label3d orb"><b style="font-size:46px;color:#ffd23f">Órbita de Marte</b></div>';

    const FOCUS = BODIES.map((b, i) => (i === 0 ? 0 : B(b.line) + 0.9));
    const TRANS = BODIES.map((b, i) => (i === 0 ? 0 : i === BODIES.length - 1 ? 1.7 : 1.3));
    const R = (x2, y2, z2) => [REACT.x + x2, REACT.y + y2, REACT.z + z2];
    const reactShots = {
      hook: { pos: R(1.6, 0.9, 5.5), look: R(-0.6, 0.2, 0), to: { pos: R(1.2, 0.7, 4.6) } },
      react: { pos: R(0.3, 0.4, 3.6), look: R(0, 0.5, 0), to: { pos: R(0.2, 0.35, 3.0) } },
      pixel: { pos: R(0, 0.6, 7), look: R(0, 0.2, 0), to: { pos: R(0, 0.8, 11) } },
    };
    return { spinners, starMats, halos, FOCUS, TRANS, orbits, launch, astro, myRocket, backdrop, reactShots, duration,
      labels: [...hud.querySelectorAll('.label3d:not(.orb)')], orbLabels: [...hud.querySelectorAll('.orb')], v: new THREE.Vector3() };
  },

  update(t, { camera, H, B, E, W }, s) {
    s.starMats.forEach((m) => { m.uniforms.uTime.value = t; });
    s.backdrop.material.uniforms.uTime.value = t;
    s.spinners.forEach((m, i) => { m.rotation.y = t * (0.12 - i * 0.008); });
    s.myRocket.update(t);
    s.launch.update(t);

    // qual frase está tocando? reações usam o cenário do astronauta
    const lineIds = ['hook', 'earth', 'jup', 'sun', 'arc', 'rigel', 'bet', 'react', 'orbit', 'pixel', 'outro'];
    let cur = 'hook';
    for (const id of lineIds) if (t >= B(id) - 0.05) cur = id;
    const reacting = REACT_LINES.includes(cur);
    s.backdrop.visible = cur === 'react';

    const A = s.astro;
    if (reacting) {
      const sh = s.reactShots[cur];
      const t0 = B(cur) - 0.05, t1 = cur === 'pixel' ? B('outro') : E(cur) + 0.25;
      applyShots(camera, t, [{ t: t0, ...sh }, { t: t1, ...sh }], t1);
      camera.near = 0.01;
      if (cur === 'hook') A.pose({ t, armR: 2.5 + Math.sin(t * 8) * 0.3, armL: 0.4, eyes: 'happy', look: 0.3 });
      else if (cur === 'react') A.pose({ t, armR: 2.4, armL: 2.4, eyes: 'scared', legL: 0.4, legR: 0.4 });
      else A.pose({ t, armR: 1.2, armL: 1.2, eyes: 'squint', look: Math.sin(t * 3) * 0.2, nod: 0.1 });
      A.group.position.copy(REACT);
      A.group.rotation.set(0, cur === 'react' ? Math.PI * 0.9 : 0.2, 0);
      if (cur === 'react') { A.group.position.y += 0.2; A.group.position.x -= 0.3 - Math.sin(t * 30) * 0.02; }
      A.float(t);
    } else {
      const { x: cx, d } = cameraAt(t, s.FOCUS, s.TRANS);
      const az = 0.22 * Math.sin(t * 0.25);
      camera.position.set(cx + d * Math.sin(az), d * 0.1, d * Math.cos(az));
      camera.lookAt(cx, -d * 0.05, 0);
      camera.near = d * 0.002;
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // auréola só quando a estrela cabe na tela (senão ela "lava" o quadro inteiro)
    const kk = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    s.halos.forEach(({ halo, b }) => {
      halo.quaternion.copy(camera.quaternion);
      const rpx = (b.R / camera.position.distanceTo(s.v.set(b.x, 0, 0))) * kk;
      const a = 0.25 * (1 - smoothstep(420, 700, rpx));
      halo.material.uniforms.uA.value = a;
      halo.visible = a > 0.005;
    });

    // foguetinho decolando da Terra
    s.launch.group.visible = cur === 'earth' || cur === 'jup';
    const lp = phase(t, B('earth'), B('jup') + 1.5, ease.inQuad);
    s.launch.group.position.set(0.9 + lp * 8, 0.7 + lp * 1.2, 0.3);
    s.launch.group.lookAt(20, 3, 0.3);

    // órbitas
    s.orbits.forEach((o, i) => {
      const op = phase(t, W('orbit', i === 0 ? 'Terra' : 'Marte') - 0.1, W('orbit', i === 0 ? 'Terra' : 'Marte') + 0.4) * (1 - phase(t, B('pixel') - 0.2, B('pixel')));
      o.mat.opacity = op;
      o.ring.visible = op > 0.001 && !reacting;
      o.ring.rotation.z = t * 0.6 + i * 2;
      s.v.set(o.ring.position.x, o.r + 3500, o.ring.position.z).project(camera);
      const el = s.orbLabels[i];
      el.style.opacity = o.ring.visible ? op.toFixed(3) : 0;
      el.style.transform = `translate(${((s.v.x * 0.5 + 0.5) * 1080).toFixed(1)}px, ${((-s.v.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%, -100%)`;
    });

    // rótulos de cada astro
    const k = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    BODIES.forEach((b, i) => {
      const el = s.labels[i];
      const dist = camera.position.distanceTo(s.v.set(b.x, 0, 0));
      const rpx = (b.R / dist) * k;
      s.v.set(b.x, b.R * 1.08, 0).project(camera);
      const sx = (s.v.x * 0.5 + 0.5) * 1080, sy = (-s.v.y * 0.5 + 0.5) * H;
      let o = smoothstep(25, 60, rpx) * (1 - smoothstep(650, 900, rpx));
      if (reacting || sx < 60 || sx > 1020 || sy < 260 || s.v.z > 1) o = 0;
      el.style.opacity = o.toFixed(3);
      el.style.transform = `translate(${sx.toFixed(1)}px, ${(sy - 10).toFixed(1)}px) translate(-50%, -100%)`;
    });
  },
};
