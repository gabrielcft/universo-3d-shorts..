// Personagens cartunescos: o astronauta ("você") e uma navezinha.
// Feitos só de formas simples + contorno, para combinar com o estilo de desenho.
import * as THREE from 'three';
import { toonMat, flatMat, addOutlines } from './toon.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

/**
 * Astronauta. Altura ~2.3 unidades, centro no peito.
 * astro.pose({ armL, armR, legL, legR, eyes, blink, look, wave, t })
 *   braços/pernas: ângulos em radianos (0 = solto ao lado do corpo)
 *   eyes: 'normal' | 'scared' | 'happy' | 'squint'
 */
export function createAstronaut({ suit = '#f3f4f8', accent = '#ff6a2b', visor = '#1b2350', trim = '#9aa3b8' } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const suitM = toonMat(suit), accM = toonMat(accent), trimM = toonMat(trim);

  // tronco
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.44, 0.42, 8, 24), suitM);
  body.add(torso);
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.455, 0.1, 32), trimM);
  belt.position.y = -0.22;
  body.add(belt);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.1), accM);
  panel.position.set(0, 0.05, 0.42);
  body.add(panel);
  [['#3df5ff', -0.1], ['#ffd23f', 0.0], ['#7cff6b', 0.1]].forEach(([c, x]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), flatMat(c));
    b.position.set(x, 0.07, 0.48);
    b.userData.noOutline = true;
    body.add(b);
  });

  // mochila
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.8, 0.32), trimM);
  pack.position.set(0, 0.12, -0.46);
  body.add(pack);

  // cabeça / capacete
  const head = new THREE.Group();
  head.position.y = 0.98;
  body.add(head);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.58, 40, 24), suitM);
  head.add(helmet);
  const visorMesh = new THREE.Mesh(new THREE.SphereGeometry(0.47, 40, 24), toonMat(visor, { emissive: new THREE.Color(visor).multiplyScalar(0.25) }));
  visorMesh.scale.set(1, 0.8, 0.7);
  visorMesh.position.set(0, -0.02, 0.31);
  head.add(visorMesh);
  // reflexo no visor
  const shine = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.18, 4, 8), flatMat('#ffffff', { transparent: true, opacity: 0.85 }));
  shine.position.set(-0.24, 0.14, 0.6);
  shine.rotation.z = -0.6;
  shine.userData.noOutline = true;
  head.add(shine);
  // olhos (ficam "dentro" do visor)
  const eyeM = flatMat('#ffffff');
  const eyes = [-0.13, 0.13].map((x) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), eyeM);
    e.position.set(x, -0.01, 0.615);
    e.scale.set(0.8, 1.15, 0.35);
    e.userData.noOutline = true;
    head.add(e);
    return e;
  });
  // antena
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), trimM);
  ant.position.set(0.3, 0.55, -0.05);
  ant.rotation.z = -0.35;
  head.add(ant);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8), flatMat('#ff3b3b'));
  bulb.position.set(0.355, 0.69, -0.05);
  head.add(bulb);

  // membros: pivô no ombro/quadril, malha pendurada para baixo
  const limb = (r, len, x, y, mat, endMat, endR) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 16), mat);
    m.position.y = -len / 2 - r * 0.4;
    pivot.add(m);
    const end = new THREE.Mesh(new THREE.SphereGeometry(endR, 20, 12), endMat);
    end.position.y = -len - r * 0.9;
    end.scale.set(1, 0.85, 1.15);
    pivot.add(end);
    body.add(pivot);
    return pivot;
  };
  const armL = limb(0.13, 0.42, -0.56, 0.3, suitM, accM, 0.15);
  const armR = limb(0.13, 0.42, 0.56, 0.3, suitM, accM, 0.15);
  const legL = limb(0.15, 0.3, -0.2, -0.5, suitM, trimM, 0.17);
  const legR = limb(0.15, 0.3, 0.2, -0.5, suitM, trimM, 0.17);

  addOutlines(root, 1.2);

  const api = {
    group: root, body, head, armL, armR, legL, legR, eyes,
    /** Define a pose do quadro atual. */
    pose({ armL: aL = 0.25, armR: aR = 0.25, legL: lL = 0.08, legR: lR = 0.08, eyes: ex = 'normal', blink = 0, look = 0, nod = 0, t = 0 } = {}) {
      armL.rotation.z = -aL; armR.rotation.z = aR;
      armL.rotation.x = Math.sin(t * 1.3) * 0.12; armR.rotation.x = Math.sin(t * 1.3 + 2) * 0.12;
      legL.rotation.z = -lL; legR.rotation.z = lR;
      legL.rotation.x = Math.sin(t * 1.1) * 0.15; legR.rotation.x = Math.sin(t * 1.1 + 1.5) * 0.15;
      head.rotation.y = look;
      head.rotation.x = nod;
      const shapes = { normal: [0.8, 1.15], scared: [1.25, 1.35], happy: [1.0, 0.45], squint: [1.0, 0.3] };
      const [sx, sy] = shapes[ex] || shapes.normal;
      // piscada automática a cada ~3,5 s
      const autoBlink = Math.max(0, 1 - Math.abs(((t + 0.7) % 3.5) - 0.08) / 0.08);
      const b = Math.max(blink, ex === 'normal' ? autoBlink : 0);
      eyes.forEach((e, i) => {
        e.scale.set(sx, Math.max(0.08, sy * (1 - b)), 0.35);
        e.position.y = ex === 'happy' ? 0.02 : -0.01;
        e.position.x = (i ? 0.13 : -0.13) * (ex === 'scared' ? 1.08 : 1);
      });
    },
    /** Flutuação padrão no espaço. */
    float(t, amp = 1) {
      root.position.y += Math.sin(t * 1.4) * 0.08 * amp;
      body.rotation.z = Math.sin(t * 0.9) * 0.08 * amp;
      body.rotation.x = Math.sin(t * 0.7 + 1) * 0.06 * amp;
    },
  };
  api.pose();
  return api;
}

/** Navezinha cartunesca (foguete). Aponta para +Z. */
export function createRocket({ hull = '#f3f4f8', accent = '#ff6a2b', window = '#3df5ff' } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.4, 8, 24), toonMat(hull));
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.7, 24), toonMat(accent));
  nose.rotation.x = Math.PI / 2;
  nose.position.z = 1.25;
  g.add(nose);
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 12), toonMat(window, { emissive: new THREE.Color(window).multiplyScalar(0.4) }));
  win.position.set(0, 0.42, 0.35);
  win.scale.set(1, 1, 0.5);
  g.add(win);
  for (let k = 0; k < 3; k++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.55, 0.6), toonMat(accent));
    const a = (k / 3) * Math.PI * 2;
    fin.position.set(Math.sin(a) * 0.55, Math.cos(a) * 0.55, -0.85);
    fin.rotation.z = -a;
    g.add(fin);
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.0, 16), flatMat('#ffd23f'));
  flame.rotation.x = -Math.PI / 2;
  flame.position.z = -1.55;
  flame.userData.noOutline = true;
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 16), flatMat('#ff6a2b'));
  flame2.rotation.x = -Math.PI / 2;
  flame2.position.z = -1.35;
  flame2.userData.noOutline = true;
  g.add(flame, flame2);
  addOutlines(g, 1.2);
  return {
    group: g,
    update(t) { const k = 1 + Math.sin(t * 30) * 0.12; flame.scale.set(1, k, 1); flame2.scale.set(1, 2 - k, 1); },
  };
}

/** Colher de chá (cabo ao longo de -Y, concha na ponta). */
export function createSpoon({ metal = '#cfd6e6', glow = null } = {}) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.75, 4, 12), toonMat(metal));
  handle.position.y = -0.4;
  g.add(handle);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 12), toonMat(metal));
  bowl.scale.set(1, 1.45, 0.4);
  bowl.position.y = -0.95;
  g.add(bowl);
  let blob = null;
  if (glow) {
    blob = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 12), flatMat(glow));
    blob.scale.set(1.05, 1.25, 0.8);
    blob.position.set(0, -0.95, 0);
    g.add(blob);
  }
  addOutlines(g, 1.1);
  return { group: g, blob };
}

/** Cidade de desenho: prédios com janelinhas, que podem "brotar" do chão. */
export function createBuildings({ count = 24, radius = 4, seed = 3, colors = ['#5b6ee1', '#7b5be1', '#e15b8c', '#3fb8a8', '#f0a33a'] } = {}) {
  const g = new THREE.Group();
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const items = [];
  const winM = flatMat('#ffe58a');
  for (let i = 0; i < count; i++) {
    const h = 0.8 + r() * 2.4, w = 0.45 + r() * 0.4;
    const b = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), toonMat(colors[i % colors.length]));
    box.position.y = h / 2;
    b.add(box);
    for (let y = 0.35; y < h - 0.2; y += 0.42) {
      for (const x of [-w * 0.22, w * 0.22]) {
        if (r() < 0.25) continue;
        const win = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.2, 0.18), winM);
        win.position.set(x, y, w / 2 + 0.005);
        win.userData.noOutline = true;
        b.add(win);
      }
    }
    const a = (i / count) * Math.PI * 2 + r() * 0.2;
    const rr = radius * (0.35 + r() * 0.65);
    b.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
    b.rotation.y = r() * Math.PI;
    g.add(b);
    items.push({ obj: b, delay: r() });
  }
  addOutlines(g, 1.0);
  return {
    group: g,
    /** k: 0 = escondidos, 1 = todos de pé (cada prédio com um atraso diferente) */
    grow(k) {
      for (const it of items) {
        const p = Math.min(1, Math.max(0, (k - it.delay * 0.6) / 0.4));
        const sc = p <= 0 ? 0.0001 : 1 + 0.25 * Math.sin(p * Math.PI) * (1 - p);
        it.obj.scale.set(1, Math.max(0.0001, p * sc), 1);
        it.obj.visible = p > 0;
      }
    },
  };
}

/** Linhas de velocidade em volta de um eixo (sensação de queda/viagem). */
export function createSpeedLines({ count = 50, radius = 3, length = 6, c = '#ffffff' } = {}) {
  const g = new THREE.Group();
  const m = flatMat(c, { transparent: true, opacity: 0.7 });
  const lines = [];
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < count; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.6 + r() * 1.4), m);
    const a = r() * Math.PI * 2, rr = radius * (0.5 + r());
    l.position.set(Math.cos(a) * rr, Math.sin(a) * rr, 0);
    l.userData = { noOutline: true, z0: r() * length, speed: 8 + r() * 10 };
    g.add(l);
    lines.push(l);
  }
  return {
    group: g, material: m,
    update(t) { for (const l of lines) l.position.z = length / 2 - ((l.userData.z0 + t * l.userData.speed) % length); },
  };
}

/** Termômetro de desenho. level 0..1 */
export function createThermometer() {
  const g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.6, 6, 16), toonMat('#f3f4f8'));
  g.add(tube);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.28, 20, 12), toonMat('#ff3b3b'));
  bulb.position.y = -0.95;
  g.add(bulb);
  const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 12), flatMat('#ff3b3b'));
  fill.geometry.translate(0, 0.5, 0);
  fill.position.set(0, -0.8, 0.08);
  fill.userData.noOutline = true;
  g.add(fill);
  addOutlines(g, 1.1);
  return { group: g, set(level) { fill.scale.y = Math.max(0.02, level * 1.7); } };
}
