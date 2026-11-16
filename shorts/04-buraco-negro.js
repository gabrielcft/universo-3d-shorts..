// SHORT 04 — O que acontece se você cair em um buraco negro?
import * as THREE from 'three';
import { CHANNEL } from '../config.js';
import { shader, createGlow, phase, keyframes, clamp01, ease } from '../engine/space.js';

const IN = 1.7, OUT = 6.5; // raio interno/externo do disco de acreção

const pad = (n) => String(Math.floor(n)).padStart(2, '0');
const hms = (sec) => `${pad(sec / 3600)}:${pad((sec / 60) % 60)}:${pad(sec % 60)}`;

export default {
  title: 'O que acontece se você cair em um buraco negro?',
  duration: 36,
  bloom: { strength: 0.6, radius: 0.55, threshold: 0.9 },
  nebula: { a: '#2a1440', b: '#0f2a4a', intensity: 0.18, seed: 1.3 },
  far: 3000,

  captions: [
    { t: [0.0, 3.5], text: 'O que acontece se você cair em um *buraco negro*?', size: 'xl' },
    { t: [3.5, 8.0], text: 'Nada escapa dele.\n*Nem a luz.*' },
    { t: [8.0, 13.0], text: 'Esse anel é gás girando a uma *fração da velocidade da luz*' },
    { t: [13.0, 18.3], text: 'Perto dele, o *tempo passa mais devagar*' },
    { t: [18.3, 24.0], text: 'E a gravidade te esticaria como um espaguete: a **espaguetificação**' },
    { t: [24.0, 29.5], text: 'O maior já medido, *TON 618*, tem dezenas de *bilhões* de vezes a massa do Sol' },
    { t: [29.5, 33.0], text: 'Seu horizonte é muito maior que a *órbita de Netuno*' },
    { t: [33.0, 36.0], text: CHANNEL.outro, size: 'm' },
  ],

  youtube: {
    title: 'E se você caísse em um BURACO NEGRO? 🕳️',
    description: 'Nada escapa de um buraco negro, nem a luz. Perto dele o tempo desacelera e a gravidade te esticaria como espaguete. Animação ilustrativa.',
    hashtags: ['shorts', 'buraconegro', 'universo', 'astronomia', 'curiosidades', 'ciência'],
    tags: ['buraco negro', 'espaguetificação', 'TON 618', 'dilatação do tempo', 'universo', 'astronomia'],
  },

  setup({ scene, hud }) {
    // Horizonte de eventos
    const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    scene.add(hole);

    const palette = /* glsl */ `
      vec3 heat(float k){
        vec3 c = mix(vec3(0.55,0.08,0.01), vec3(1.0,0.45,0.12), smoothstep(0.0,0.45,k));
        return mix(c, vec3(1.0,0.92,0.78), smoothstep(0.5,1.0,k));
      }`;

    // Disco de acreção (rotação diferencial: o interno gira mais rápido)
    const diskMat = shader({
      uniforms: { uTime: { value: 0 }, uB: { value: 1 } },
      vertex: /* glsl */ `
        varying vec3 vL; varying vec3 vW;
        void main(){ vL = position; vW = (modelMatrix * vec4(position,1.0)).xyz;
          gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragment: palette + /* glsl */ `
        uniform float uTime; uniform float uB; varying vec3 vL; varying vec3 vW;
        void main(){
          float r = length(vL.xy); float a = atan(vL.y, vL.x);
          float a2 = a + uTime * 1.4 / pow(r / ${IN.toFixed(1)}, 1.5);
          float n = fbm(vec3(cos(a2)*1.6, sin(a2)*1.6, r*2.6));
          float n2 = snoise(vec3(cos(a2)*5.0, sin(a2)*5.0, r*9.0));
          float dens = clamp(0.55 + 0.75*n + 0.25*n2, 0.0, 2.0);
          float x = (r - ${IN.toFixed(1)}) / ${(OUT - IN).toFixed(1)};
          float temp = pow(clamp(1.0 - x, 0.0, 1.0), 2.0);
          float edge = smoothstep(0.0, 0.05, x) * smoothstep(1.0, 0.45, x);
          vec3 vel = vec3(sin(a), 0.0, cos(a)); // tangente local (x,y)->(x,-y) no mundo
          float dop = clamp(1.0 + 0.45 * dot(vel, normalize(cameraPosition - vW)), 0.45, 1.5);
          float I = 0.38 * uB * dens * edge * (0.2 + 1.6*temp) * pow(dop, 2.2);
          gl_FragColor = vec4(heat(temp * dop * 0.85) * I, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const disk = new THREE.Mesh(new THREE.RingGeometry(IN, OUT, 256, 8), diskMat);
    disk.rotation.x = -Math.PI / 2;
    scene.add(disk);

    // Imagem "lenteada" da parte de trás do disco (arco por cima/baixo do horizonte)
    const haloMat = shader({
      uniforms: { uTime: { value: 0 }, uB: { value: 1 } },
      vertex: /* glsl */ `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragment: palette + /* glsl */ `
        uniform float uTime; uniform float uB; varying vec3 vL;
        void main(){
          float r = length(vL.xy); float th = atan(vL.y, vL.x);
          float s = sin(th);
          float rc = 1.5 + 0.12 * s;
          float w = 0.12 + 0.3 * max(s, 0.0) + 0.05 * max(-s, 0.0);
          float prof = exp(-pow((r - rc) / w, 2.0)) * smoothstep(1.12, 1.3, r);
          float th2 = th - uTime * 0.6;
          float n = fbm(vec3(cos(th2)*2.0, sin(th2)*2.0, r*3.0));
          float dop = 1.0 + 0.3 * cos(th);
          float I = uB * prof * (0.65 + 0.6*n) * pow(dop, 2.0) * (0.55 + 0.45*abs(s));
          gl_FragColor = vec4(heat(0.55 + 0.25*n) * I * 0.55, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.02, 3.0, 256, 8), haloMat);
    scene.add(halo);

    // Anel de fótons (fininho e muito brilhante)
    const ringMat = shader({
      uniforms: { uB: { value: 1 } },
      vertex: /* glsl */ `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragment: /* glsl */ `
        uniform float uB; varying vec3 vL;
        void main(){ float r = length(vL.xy); float th = atan(vL.y, vL.x);
          float I = exp(-pow((r - 1.07) / 0.022, 2.0)) * (1.0 + 0.5*cos(th));
          gl_FragColor = vec4(vec3(1.0, 0.85, 0.65) * I * 1.4 * uB, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.2, 256, 2), ringMat);
    scene.add(ring);

    // Objeto em queda (sofre espaguetificação)
    const capsule = new THREE.CapsuleGeometry(0.07, 0.16, 8, 16);
    capsule.rotateX(Math.PI / 2);
    const faller = new THREE.Mesh(capsule, new THREE.MeshBasicMaterial({ color: new THREE.Color('#7fe7ff').multiplyScalar(2.2), transparent: true }));
    const fallerGlow = createGlow('#7fe7ff', 0.9, 0.8);
    faller.add(fallerGlow);
    scene.add(faller);

    hud.innerHTML = `
      <div class="panel" id="clk">
        <div class="row"><span>Seu relógio</span><b id="c1" style="color:#3df5ff">00:00:00</b></div>
        <div class="row"><span>Relógio na Terra</span><b id="c2" style="color:#ffd23f">00:00:00</b></div>
      </div>`;

    return { disk, diskMat, halo, haloMat, ring, ringMat, faller, fallerGlow, clk: hud.querySelector('#clk'), c1: hud.querySelector('#c1'), c2: hud.querySelector('#c2') };
  },

  update(t, { camera }, s) {
    s.diskMat.uniforms.uTime.value = t;
    s.haloMat.uniforms.uTime.value = t;

    // Câmera orbitando levemente acima do plano do disco
    const dist = keyframes(t, [[0, 19], [3.5, 15], [8, 12], [13, 9.5], [18.3, 10.5], [24, 11], [30, 21], [36, 24]]);
    const el = keyframes(t, [[0, 0.2], [8, 0.13], [18, 0.16], [24, 0.12], [33, 0.2]]);
    const az = -0.5 + t * 0.045;
    camera.position.set(dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(0, -0.25, 0);
    camera.updateMatrixWorld();
    s.halo.quaternion.copy(camera.quaternion);
    s.ring.quaternion.copy(camera.quaternion);

    // Relógios (dilatação do tempo — ilustrativo)
    const k = clamp01((t - 13) / 5);
    const you = Math.max(0, t - 13);
    s.clk.style.opacity = phase(t, 13.2, 13.8) * (1 - phase(t, 17.8, 18.3));
    s.c1.textContent = hms(you);
    s.c2.textContent = hms(you * (1 + 900 * k * k));

    // Espaguetificação
    const p = clamp01((t - 18.5) / 5.2);
    s.faller.visible = t > 18.5 && t < 23.7;
    if (s.faller.visible) {
      const pe = ease.inQuad(p);
      const r = 5.2 + (1.02 - 5.2) * Math.pow(pe, 0.9);
      const phi = az + 0.9 - pe * 2.4;
      s.faller.position.set(r * Math.sin(phi), 0.5 * (1 - pe), r * Math.cos(phi));
      s.faller.lookAt(0, 0, 0);
      const stretch = 1 + 18 * Math.pow(p, 3);
      s.faller.scale.set(1 / Math.sqrt(stretch), 1 / Math.sqrt(stretch), stretch);
      s.faller.material.opacity = 1 - phase(t, 23.2, 23.7);
      s.fallerGlow.material.opacity = s.faller.material.opacity;
    }
  },
};
