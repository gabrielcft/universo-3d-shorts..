// Kit "3D cartunesco": cores chapadas em faixas, contorno preto, céu de desenho,
// sóis estilo cartoon e utilitário de planos (cortes de câmera).
import * as THREE from 'three';
import { shader, rng, clamp01, lerp, ease } from './space.js';

const color = (c) => (c instanceof THREE.Color ? c : new THREE.Color(c));

// ---------- Materiais ----------
let _grad = null;
/** Mapa de 3 tons (sombra, meio, luz) para o MeshToonMaterial. */
export function toonGradient() {
  if (_grad) return _grad;
  const data = new Uint8Array([70, 70, 70, 255, 160, 160, 160, 255, 255, 255, 255, 255]);
  _grad = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  _grad.minFilter = _grad.magFilter = THREE.NearestFilter;
  _grad.needsUpdate = true;
  return _grad;
}

export function toonMat(c, opts = {}) {
  return new THREE.MeshToonMaterial({ color: color(c), gradientMap: toonGradient(), ...opts });
}

/** Material chapado que ignora luz (bom para coisas que brilham). */
export function flatMat(c, opts = {}) {
  return new THREE.MeshBasicMaterial({ color: color(c), ...opts });
}

// ---------- Contorno (técnica "casca invertida", espessura constante na tela) ----------
const outlineCache = new Map();
export function outlineMat(width = 1, c = '#0a0a16') {
  const key = `${width}|${c}`;
  if (outlineCache.has(key)) return outlineCache.get(key);
  const m = shader({
    uniforms: { uW: { value: 0.0035 * width }, uColor: { value: color(c) } },
    vertex: /* glsl */ `
      uniform float uW;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        mv.xyz += n * uW * max(1.0, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragment: /* glsl */ `uniform vec3 uColor; void main(){ gl_FragColor = vec4(uColor, 1.0); }`,
    side: THREE.BackSide,
  });
  outlineCache.set(key, m);
  return m;
}

/** Adiciona contorno a todas as malhas do objeto (exceto userData.noOutline). */
export function addOutlines(obj, width = 1, c) {
  const meshes = [];
  obj.traverse((o) => { if (o.isMesh && !o.userData.noOutline && !o.userData.isOutline) meshes.push(o); });
  for (const m of meshes) {
    const o = new THREE.Mesh(m.geometry, outlineMat(m.userData.outline ?? width, c));
    o.userData.isOutline = true;
    o.renderOrder = m.renderOrder;
    m.add(o);
  }
  return obj;
}

// ---------- Céu de desenho ----------
export function createToonSky({ radius = 2000, top = '#0a0f2e', bottom = '#2b1747', count = 900, seed = 5 } = {}) {
  const group = new THREE.Group();
  const bg = shader({
    uniforms: { uTop: { value: color(top) }, uBot: { value: color(bottom) } },
    vertex: /* glsl */ `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragment: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uBot; varying vec3 vD;
      void main(){
        vec3 d = normalize(vD);
        float k = smoothstep(-0.6, 0.7, d.y);
        k = floor(k * 6.0) / 6.0;                // faixas, como pintura chapada
        float blob = smoothstep(0.25, 0.6, fbm(d * 1.4 + 2.0));
        vec3 c = mix(uBot, uTop, k);
        c = mix(c, c * 1.35 + vec3(0.02, 0.0, 0.05), floor(blob * 2.0) / 2.0 * 0.6);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false,
  });
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), bg);
  sphere.renderOrder = -2;
  sphere.frustumCulled = false;
  group.add(sphere);

  // estrelinhas: brilhos de 4 pontas + bolinhas
  const r = rng(seed);
  const pos = new Float32Array(count * 3), sz = new Float32Array(count), ph = new Float32Array(count), kind = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    const R = radius * 0.9;
    pos.set([s * Math.cos(th) * R, u * R, s * Math.sin(th) * R], i * 3);
    const big = r() < 0.12;
    sz[i] = big ? 18 + r() * 22 : 3 + r() * 5;
    kind[i] = big ? 1 : 0;
    ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  const m = shader({
    uniforms: { uTime: { value: 0 } },
    vertex: /* glsl */ `
      attribute float aSize; attribute float aPhase; attribute float aKind;
      uniform float uTime; varying float vKind; varying float vTw;
      void main(){
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vTw = 0.75 + 0.25 * sin(uTime * (1.5 + aPhase * 2.0) + aPhase * 40.0);
        gl_PointSize = aSize * (aKind > 0.5 ? vTw : 1.0);
        vKind = aKind;
      }`,
    fragment: /* glsl */ `
      varying float vKind; varying float vTw;
      void main(){
        vec2 p = (gl_PointCoord - 0.5) * 2.0;
        float a;
        if (vKind > 0.5) {
          // brilho de 4 pontas (losango côncavo)
          float d = pow(abs(p.x), 0.5) + pow(abs(p.y), 0.5);
          a = step(d, 1.0);
        } else {
          a = step(length(p), 1.0);
        }
        if (a < 0.5) discard;
        gl_FragColor = vec4(vec3(1.0, 0.97, 0.85) * (vKind > 0.5 ? 1.0 : 0.75 * vTw), 1.0);
      }`,
    depthWrite: false, depthTest: false,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = -1;
  group.add(pts);
  group.userData.stars = m;
  return group;
}

// ---------- Sol / estrela de desenho ----------
export function toonStarMat({ c = '#ffb22e', light = '#ffe58a', dark = '#ff7b1c', scale = 3 } = {}) {
  return shader({
    uniforms: { uTime: { value: 0 }, uC: { value: color(c) }, uL: { value: color(light) }, uD: { value: color(dark) }, uS: { value: scale } },
    vertex: /* glsl */ `
      varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){ vP = position; vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragment: /* glsl */ `
      uniform float uTime; uniform vec3 uC; uniform vec3 uL; uniform vec3 uD; uniform float uS;
      varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 p = normalize(vP) * uS;
        float n = snoise(p + vec3(0.0, uTime * 0.25, 0.0)) * 0.6 + snoise(p * 2.2 - uTime * 0.3) * 0.4;
        float mu = dot(normalize(vN), normalize(vV));
        vec3 col = uC;
        if (n > 0.35) col = uL;          // manchas claras
        if (n < -0.4) col = uD;          // manchas escuras
        if (mu < 0.32) col = uD;         // borda
        if (mu > 0.72 && n > -0.1) col = mix(col, uL, 0.6);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** Auréola de desenho: anéis concêntricos chapados atrás do astro (sempre de frente). */
export function createToonHalo(c = '#ffb22e', radius = 1, rings = 3, strength = 0.55) {
  const m = shader({
    uniforms: { uC: { value: color(c) }, uR: { value: rings }, uA: { value: strength }, uTime: { value: 0 } },
    vertex: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragment: /* glsl */ `
      uniform vec3 uC; uniform float uR; uniform float uA; uniform float uTime; varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;           // 0 centro, 1 borda
        float x = (d - 0.5) / 0.5;                    // 0 na superfície do astro
        if (x < 0.0 || x > 1.0) discard;
        float band = floor((1.0 - x) * uR + 0.15 * sin(uTime * 2.0)) / uR;
        float a = band * uA;
        if (a <= 0.01) discard;
        gl_FragColor = vec4(uC, a);
      }`,
    transparent: true, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 4, radius * 4), m);
  mesh.userData.noOutline = true;
  return mesh;
}

// ---------- Planos de câmera (cortes secos + movimento lento dentro do plano) ----------
/**
 * shots: [{ t, pos: [x,y,z], look: [x,y,z], to?: { pos, look }, fov? }]
 * Dentro de cada plano a câmera desliza de `pos/look` para `to.pos/to.look`.
 * Cada campo pode ser uma função (t) => [x,y,z] para acompanhar objetos.
 */
export function shotIndex(t, shots) {
  let i = 0;
  for (let k = 0; k < shots.length; k++) if (t >= shots[k].t) i = k;
  return i;
}

export function applyShots(camera, t, shots, end = Infinity) {
  const i = shotIndex(t, shots);
  const s = shots[i];
  const t1 = shots[i + 1]?.t ?? end;
  const p = ease.inOutSine(clamp01((t - s.t) / Math.max(0.1, t1 - s.t)));
  const val = (v) => (typeof v === 'function' ? v(t) : v);
  const a = val(s.pos), b = s.to?.pos ? val(s.to.pos) : a;
  const la = val(s.look), lb = s.to?.look ? val(s.to.look) : la;
  camera.position.set(lerp(a[0], b[0], p), lerp(a[1], b[1], p), lerp(a[2], b[2], p));
  camera.lookAt(lerp(la[0], lb[0], p), lerp(la[1], lb[1], p), lerp(la[2], lb[2], p));
  if (s.fov) camera.fov = s.fov;
  return { index: i, progress: p, local: t - s.t };
}
