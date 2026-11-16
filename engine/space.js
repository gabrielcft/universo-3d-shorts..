// Biblioteca de "peças" espaciais reutilizáveis: estrelas, nebulosas, sóis,
// planetas procedurais, brilhos, atmosferas e utilitários de animação.
import * as THREE from 'three';

// ============ Matemática e animação ============
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const smoothstep = (a, b, x) => { const k = clamp01((x - a) / (b - a)); return k * k * (3 - 2 * k); };

export const ease = {
  linear: (x) => x,
  inQuad: (x) => x * x,
  outQuad: (x) => 1 - (1 - x) * (1 - x),
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  inOutSine: (x) => -(Math.cos(Math.PI * x) - 1) / 2,
  outBack: (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
};

/** Progresso 0..1 (com easing) de t entre os instantes a e b. */
export function phase(t, a, b, fn = ease.inOutCubic) {
  return fn(clamp01((t - a) / (b - a)));
}

/** Interpola valores por keyframes [[t, v], ...] com easing entre cada par. */
export function keyframes(t, keys, fn = ease.inOutCubic) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [t0, v0] = keys[i], [t1, v1] = keys[i + 1];
    if (t <= t1) return lerp(v0, v1, fn((t - t0) / (t1 - t0 || 1)));
  }
  return keys[keys.length - 1][1];
}

/** Integra uma velocidade angular w(t) de 0 até t (determinístico). */
export function integrate(w, t, dt = 1 / 120) {
  let a = 0;
  for (let x = 0; x < t; x += dt) a += w(x) * Math.min(dt, t - x);
  return a;
}

/** Gerador pseudo-aleatório com semente (resultado sempre igual). */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============ GLSL compartilhado ============
export const GLSL_NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*snoise(p); p*=2.03; a*=0.5; } return s; }
`;

// Trechos para funcionar com logarithmicDepthBuffer (cena de escala).
const VS_HEAD = '#include <common>\n#include <logdepthbuf_pars_vertex>\n';
const VS_TAIL = '\n#include <logdepthbuf_vertex>\n';
const FS_HEAD = '#include <logdepthbuf_pars_fragment>\n';
const FS_TAIL = '#include <logdepthbuf_fragment>\n';

/** Cria um ShaderMaterial já com suporte a log depth. */
export function shader({ uniforms = {}, vertex, fragment, ...opts }) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: VS_HEAD + vertex.replace(/}\s*$/, VS_TAIL + '}'),
    fragmentShader: FS_HEAD + GLSL_NOISE + fragment.replace(/void main\(\)\s*\{/, 'void main(){\n' + FS_TAIL),
    ...opts,
  });
}

const color = (c) => (c instanceof THREE.Color ? c : new THREE.Color(c));

// ============ Céu ============
export function createStarfield({ count = 6000, radius = 2000, seed = 7, size = 1 } = {}) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const sz = new Float32Array(count), ph = new Float32Array(count);
  const tints = [[1, 1, 1], [0.75, 0.85, 1], [1, 0.92, 0.75], [1, 0.8, 0.65], [0.7, 0.8, 1]];
  for (let i = 0; i < count; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(th) * radius, u * radius, s * Math.sin(th) * radius], i * 3);
    const tint = tints[Math.floor(r() * tints.length)];
    const k = 0.35 + Math.pow(r(), 3) * 1.4;
    col.set([tint[0] * k, tint[1] * k, tint[2] * k], i * 3);
    sz[i] = (1.6 + Math.pow(r(), 6) * 6.5) * size;
    ph[i] = r();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1));
  const m = shader({
    uniforms: { uTime: { value: 0 } },
    vertex: /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aPhase;
      uniform float uTime; varying vec3 vColor;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize;
        float tw = 0.72 + 0.28 * sin(uTime * (1.2 + aPhase * 2.5) + aPhase * 60.0);
        vColor = aColor * tw;
      }`,
    fragment: /* glsl */ `
      varying vec3 vColor;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = pow(smoothstep(0.5, 0.0, d), 1.8);
        gl_FragColor = vec4(vColor * a, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(g, m);
  pts.frustumCulled = false;
  pts.renderOrder = -1;
  return pts;
}

export function createNebula({ radius = 3000, a = '#1b2a6b', b = '#6b1b5e', intensity = 0.22, seed = 3.1 } = {}) {
  const m = shader({
    uniforms: { uA: { value: color(a) }, uB: { value: color(b) }, uI: { value: intensity }, uSeed: { value: seed } },
    vertex: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragment: /* glsl */ `
      uniform vec3 uA; uniform vec3 uB; uniform float uI; uniform float uSeed; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        float n = fbm(d * 1.7 + uSeed);
        float m = fbm(d * 2.6 - uSeed * 0.7);
        float dust = smoothstep(-0.25, 0.35, fbm(d * 5.0 + 9.0));
        float neb = smoothstep(-0.05, 0.75, n);
        vec3 c = mix(uA, uB, smoothstep(-0.35, 0.45, m)) * neb * (0.45 + 0.55 * dust);
        gl_FragColor = vec4(c * uI, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 32), m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -2;
  return mesh;
}

// ============ Estrelas / sóis ============
/** Superfície de estrela com granulação animada e escurecimento de borda. */
export function createStarMaterial({ color: c = '#ff8a1f', hot = '#fff3c4', intensity = 2, scale = 4, speed = 1 } = {}) {
  return shader({
    uniforms: {
      uTime: { value: 0 }, uColor: { value: color(c) }, uHot: { value: color(hot) },
      uI: { value: intensity }, uScale: { value: scale }, uSpeed: { value: speed },
    },
    vertex: /* glsl */ `
      varying vec3 vPos; varying vec3 vN; varying vec3 vV;
      void main(){
        vPos = position;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragment: /* glsl */ `
      uniform float uTime; uniform vec3 uColor; uniform vec3 uHot; uniform float uI; uniform float uScale; uniform float uSpeed;
      varying vec3 vPos; varying vec3 vN; varying vec3 vV;
      void main(){
        vec3 p = normalize(vPos) * uScale;
        float tt = uTime * uSpeed;
        float n = snoise(p + vec3(0.0, tt * 0.12, 0.0)) * 0.5
                + snoise(p * 2.7 - vec3(tt * 0.18)) * 0.3
                + snoise(p * 7.0 + vec3(tt * 0.35)) * 0.2;
        float cells = smoothstep(-0.45, 0.75, n);
        float spots = smoothstep(0.55, 0.75, snoise(p * 0.8 + 11.0)) * 0.55;
        float mu = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float limb = pow(mu, 0.5);
        vec3 col = mix(uColor, uHot, cells) * (0.5 + 0.8 * limb) * (1.0 - spots);
        col += uColor * pow(1.0 - mu, 3.0) * 0.8;
        gl_FragColor = vec4(col * uI, 1.0);
      }`,
  });
}

// ============ Brilhos ============
let _glowTex = null;
export function glowTexture() {
  if (_glowTex) return _glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.12, 'rgba(255,255,255,0.7)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.18)');
  gr.addColorStop(0.65, 'rgba(255,255,255,0.04)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  _glowTex = new THREE.CanvasTexture(cv);
  return _glowTex;
}

export function createGlow(c = '#ffffff', size = 4, strength = 1) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(), color: color(c).multiplyScalar(strength),
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  });
  const s = new THREE.Sprite(m);
  s.scale.setScalar(size);
  return s;
}

/** Brilho de borda (atmosferas, ondas de choque). */
export function createFresnelMaterial({ color: c = '#7fb2ff', power = 3, intensity = 1.2 } = {}) {
  return shader({
    uniforms: { uColor: { value: color(c) }, uPow: { value: power }, uI: { value: intensity } },
    vertex: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main(){
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragment: /* glsl */ `
      uniform vec3 uColor; uniform float uPow; uniform float uI; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
        gl_FragColor = vec4(uColor * f * uI, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
}

export function createAtmosphere(radius, c, intensity = 1.2, power = 3.5) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 48), createFresnelMaterial({ color: c, intensity, power }));
}

// ============ Planetas procedurais ============
function makeNoise3(seed) {
  const r = rng(seed);
  const perm = new Uint8Array(512);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256).map(() => r());
  const h = (x, y, z) => vals[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const f = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const u = f(x - xi), v = f(y - yi), w = f(z - zi);
    const l = (a, b, k) => a + (b - a) * k;
    return l(
      l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
      l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
      w);
  };
  return (x, y, z, oct = 5) => {
    let s = 0, a = 0.5, n = 0;
    for (let i = 0; i < oct; i++) { s += a * noise(x, y, z); n += a; x *= 2.02; y *= 2.02; z *= 2.02; a *= 0.5; }
    return s / n;
  };
}

function gradient(stops) {
  const parsed = stops.map(([k, c]) => [k, color(c)]);
  return (v) => {
    if (v <= parsed[0][0]) return parsed[0][1];
    for (let i = 0; i < parsed.length - 1; i++) {
      const [k0, c0] = parsed[i], [k1, c1] = parsed[i + 1];
      if (v <= k1) return c0.clone().lerp(c1, (v - k0) / (k1 - k0));
    }
    return parsed[parsed.length - 1][1];
  };
}

/**
 * Textura equiretangular gerada por ruído 3D amostrado na esfera (sem emenda).
 * kind: 'gas' (faixas), 'rocky' (continentes), 'clouds' (alpha).
 */
export function planetTexture({ w = 1024, h = 512, seed = 1, kind = 'rocky', stops, scale = 2, bandFreq = 12, turb = 1.2, ice = 0, contrast = 2 } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const img = g.createImageData(w, h);
  const fbm = makeNoise3(seed);
  const grad = stops ? gradient(stops) : null;
  const white = new THREE.Color('#f4f6fa');
  for (let y = 0; y < h; y++) {
    const lat = (0.5 - (y + 0.5) / h) * Math.PI;
    const cl = Math.cos(lat), sl = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const lon = ((x + 0.5) / w) * Math.PI * 2;
      const px = cl * Math.cos(lon), py = sl, pz = cl * Math.sin(lon);
      const i = (y * w + x) * 4;
      if (kind === 'clouds') {
        const n = fbm(px * scale + 5, py * scale * 1.6, pz * scale, 6);
        const a = smoothstep(0.56, 0.74, n) * 0.85;
        img.data.set([255, 255, 255, a * 255], i);
        continue;
      }
      let v, c;
      if (kind === 'gas') {
        const warp = fbm(px * scale, py * scale, pz * scale, 5) - 0.5;
        v = 0.5 + 0.5 * Math.sin(lat * bandFreq + warp * turb * 8);
        v += (fbm(px * 9, py * 9, pz * 9, 3) - 0.5) * 0.25;
        c = grad(clamp01(v));
      } else {
        v = clamp01((fbm(px * scale, py * scale, pz * scale, 6) - 0.5) * contrast + 0.5);
        c = grad(v);
        if (ice) {
          const k = smoothstep(ice, ice + 0.06, Math.abs(sl) + (fbm(px * 6, py * 6, pz * 6, 3) - 0.5) * 0.15);
          c = c.clone().lerp(white, k);
        }
      }
      img.data.set([c.r * 255, c.g * 255, c.b * 255, 255], i);
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = kind === 'clouds' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

export const PALETTES = {
  earth: [[0, '#06204a'], [0.5, '#1a5ca6'], [0.56, '#2f78bf'], [0.575, '#d8c48f'], [0.6, '#4b8a3c'],
    [0.7, '#2e5f28'], [0.8, '#7d6b4c'], [0.9, '#b9ad9a'], [1, '#ffffff']],
  jupiter: [[0, '#a8754f'], [0.25, '#d1a173'], [0.45, '#ead7b8'], [0.6, '#f4ead8'], [0.8, '#c9946a'], [1, '#9a6a4c']],
  venus: [[0, '#b0844a'], [0.35, '#d2a964'], [0.65, '#e8cc92'], [1, '#f6e7bf']],
};

// ============ Setas em arco (indicadores de movimento) ============
export function createArcArrow({ radius = 3, from = 0, to = 1, c = '#ffd23f', thickness = 0.05, strength = 1.6 } = {}) {
  const pts = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const a = from + (to - from) * (i / N);
    pts.push(new THREE.Vector3(radius * Math.cos(a), 0, -radius * Math.sin(a)));
  }
  const mat = new THREE.MeshBasicMaterial({
    color: color(c).multiplyScalar(strength), transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, thickness, 8), mat));
  const head = new THREE.Mesh(new THREE.ConeGeometry(thickness * 3.2, thickness * 8, 20), mat);
  const sgn = Math.sign(to - from);
  const tangent = new THREE.Vector3(-Math.sin(to), 0, -Math.cos(to)).multiplyScalar(sgn).normalize();
  head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
  head.position.copy(pts[N]).addScaledVector(tangent, thickness * 3);
  group.add(head);
  return { group, material: mat };
}
