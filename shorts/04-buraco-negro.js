// SHORT 04 — E se você caísse num buraco negro?
import * as THREE from 'three';
import { shader, phase, clamp01, ease, lerp } from '../engine/space.js';
import { flatMat, applyShots, shotIndex, addOutlines } from '../engine/toon.js';
import { createAstronaut, createSpeedLines } from '../engine/characters.js';

const IN = 1.7, OUT = 5.8;
const VOID = new THREE.Vector3(0, 0, -800); // cenário escuro "dentro" do buraco negro

const pad = (n) => String(Math.floor(n)).padStart(2, '0');
const hms = (sec) => `${pad(sec / 3600)}:${pad((sec / 60) % 60)}:${pad(sec % 60)}`;
const longTime = (sec) => {
  const days = sec / 86400;
  if (days >= 365) { const y = Math.floor(days / 365); return `${y} ${y === 1 ? 'ano' : 'anos'}`; }
  if (days >= 1) return `${Math.floor(days)} dias`;
  return hms(sec);
};

// paleta chapada do disco (de dentro para fora)
const DISK_GLSL = /* glsl */ `
  vec3 band(float k){
    if (k > 0.78) return vec3(1.0, 0.97, 0.85);
    if (k > 0.55) return vec3(1.0, 0.82, 0.32);
    if (k > 0.32) return vec3(1.0, 0.55, 0.16);
    return vec3(0.86, 0.27, 0.12);
  }`;

export default {
  title: 'E se você caísse num buraco negro?',
  toon: true,
  sky: { top: '#060818', bottom: '#1d0f33', seed: 41 },
  bloom: { strength: 0.35, radius: 0.5, threshold: 0.92 },
  music: { mood: 'dark', seed: 4, pulse: true },

  script: [
    { id: 'hook', text: 'E se você caísse num *buraco negro*?', sfx: 'boom' },
    { id: 'ring', text: 'Primeiro, você ia ver um anel de fogo girando a uma *fração da velocidade da luz*.' },
    { id: 'time', text: 'Quanto mais perto, mais o *tempo desacelera* pra você.' },
    { id: 'years', text: 'Poucos minutos no seu relógio... e *anos* passariam na Terra!', punch: 0.08 },
    { id: 'pull', text: 'Aí a gravidade começa a puxar seus pés com mais força que a cabeça...', shake: 0.3 },
    { id: 'spag', text: 'E você vira um *espaguete* de astronauta!', flash: true, shake: 0.7, sfx: 'boom' },
    { id: 'horizon', text: 'Depois do horizonte de eventos, *nada* volta. Nem a luz.' },
    { id: 'secret', text: 'Você descobriria o maior segredo do universo... mas não poderia *contar pra ninguém*.', punch: 0.08 },
    { id: 'outro', text: 'Segue pra mais histórias do universo!' },
  ],

  youtube: {
    title: 'E se você caísse num BURACO NEGRO? 🕳️👨‍🚀',
    description: 'Perto de um buraco negro o tempo desacelera, a gravidade te estica como espaguete e, depois do horizonte de eventos, nada volta, nem a luz. Animação ilustrativa.',
    hashtags: ['shorts', 'buraconegro', 'universo', 'astronomia', 'curiosidades', 'esevoce'],
    tags: ['buraco negro', 'espaguetificação', 'e se você', 'dilatação do tempo', 'universo', 'animação'],
  },

  setup({ scene, hud, B, duration }) {
    scene.add(new THREE.AmbientLight('#c8c0ff', 0.6));
    const key = new THREE.DirectionalLight('#fff2e2', 2.0);
    key.position.set(2, 1, 4);
    scene.add(key);

    const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), flatMat('#000000'));
    scene.add(hole);

    const diskMat = shader({
      uniforms: { uTime: { value: 0 } },
      vertex: /* glsl */ `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragment: DISK_GLSL + /* glsl */ `
        uniform float uTime; varying vec3 vL;
        void main(){
          float r = length(vL.xy); float a = atan(vL.y, vL.x);
          float a2 = a + uTime * 1.2 / pow(r / ${IN.toFixed(1)}, 1.5);
          float n = snoise(vec3(cos(a2) * 1.8, sin(a2) * 1.8, r * 2.2));
          float x = (r - ${IN.toFixed(1)}) / ${(OUT - IN).toFixed(1)};
          float k = (1.0 - x) * 0.85 + n * 0.22;
          if (x > 0.92 - n * 0.06) discard;
          gl_FragColor = vec4(band(k), 1.0);
        }`,
      side: THREE.DoubleSide,
    });
    const disk = new THREE.Mesh(new THREE.RingGeometry(IN, OUT, 192, 6), diskMat);
    disk.rotation.x = -Math.PI / 2;
    scene.add(disk);

    const haloMat = shader({
      uniforms: { uTime: { value: 0 } },
      vertex: /* glsl */ `varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragment: DISK_GLSL + /* glsl */ `
        uniform float uTime; varying vec3 vL;
        void main(){
          float r = length(vL.xy); float th = atan(vL.y, vL.x); float s = sin(th);
          float rc = 1.45 + 0.1 * s;
          float w = 0.1 + 0.28 * max(s, 0.0) + 0.04 * max(-s, 0.0);
          float d = abs(r - rc) / w;
          float n = snoise(vec3(cos(th - uTime * 0.6) * 2.0, sin(th - uTime * 0.6) * 2.0, r * 3.0));
          if (d > 1.0 + n * 0.15) discard;
          gl_FragColor = vec4(band(0.9 - d * 0.6 + n * 0.15), 1.0);
        }`,
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(1.05, 2.6, 192, 4), haloMat);
    scene.add(halo);
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.02, 1.1, 128), flatMat('#fff6e0'));
    scene.add(ring);

    const astro = createAstronaut();
    scene.add(astro.group);
    const speed = createSpeedLines({ count: 50, radius: 2.2, length: 9, c: '#ffd9a0' });
    scene.add(speed.group);

    // "dentro" do buraco negro: escuridão total + luz roxa
    const voidSet = new THREE.Group();
    voidSet.position.copy(VOID);
    const voidSky = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), flatMat('#05030c', { side: THREE.BackSide }));
    voidSet.add(voidSky);
    const qm = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.13, 12, 32, Math.PI * 1.4), flatMat('#a98bff'));
    qm.rotation.z = -Math.PI * 0.2;
    const qd = new THREE.Mesh(new THREE.SphereGeometry(0.14, 16, 8), flatMat('#a98bff'));
    qd.position.set(0, -1.0, 0);
    const qs = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.35, 12), flatMat('#a98bff'));
    qs.position.set(0.0, -0.55, 0);
    const question = new THREE.Group();
    question.add(qm, qd, qs);
    question.position.set(0.9, 1.9, -1.5);
    addOutlines(question, 1.2);
    voidSet.add(question);
    const purple = new THREE.PointLight('#8f6bff', 25, 12, 1.5);
    purple.position.set(1.5, 2, 2);
    voidSet.add(purple);
    scene.add(voidSet);

    hud.innerHTML = `
      <div class="panel" id="clk">
        <div class="row"><span>Seu relógio</span><b id="c1" style="color:#3df5ff">00:00:00</b></div>
        <div class="row"><span>Relógio na Terra</span><b id="c2" style="color:#ffd23f">00:00:00</b></div>
      </div>`;

    const V = (x, y, z) => [VOID.x + x, VOID.y + y, VOID.z + z];
    const s = {
      hole, disk, diskMat, halo, haloMat, ring, astro, speed, voidSet, question, duration,
      clk: hud.querySelector('#clk'), c1: hud.querySelector('#c1'), c2: hud.querySelector('#c2'),
      astroPos: [0, 0, 0],
    };
    s.shots = [
      { t: 0, pos: [3.2, 1.3, 15], look: [0.6, 0.2, 0], to: { pos: [2.6, 1.0, 12.5] } },
      { t: B('ring') - 0.05, pos: [-7.5, 1.0, 7], look: [0, 0, 0], to: { pos: [-4, 0.7, 9.5] } },
      { t: B('time') - 0.05, pos: () => [s.astroPos[0] * 1.45 + 1.0, s.astroPos[1] + 1.4, s.astroPos[2] * 1.45 + 1.0], look: () => [s.astroPos[0] * 0.45, s.astroPos[1] * 0.4 + 0.5, s.astroPos[2] * 0.45] },
      { t: B('years') - 0.05, pos: () => [s.astroPos[0] + 2.4, s.astroPos[1] + 0.7, s.astroPos[2] + 3.6], look: () => [s.astroPos[0], s.astroPos[1] + 0.55, s.astroPos[2]] },
      { t: B('pull') - 0.05, pos: () => [s.astroPos[0] * 1.3 + 3.5, s.astroPos[1] + 2.4, s.astroPos[2] * 1.3 + 3.5], look: () => [s.astroPos[0] * 0.8, s.astroPos[1] * 0.7, s.astroPos[2] * 0.8] },
      { t: B('spag') - 0.05, pos: () => [s.astroPos[0] * 1.2 + 5.5, s.astroPos[1] + 3.2, s.astroPos[2] * 1.2 + 5.5], look: () => [s.astroPos[0] * 0.75, s.astroPos[1] * 0.6, s.astroPos[2] * 0.75] },
      { t: B('horizon') - 0.05, pos: [0.4, 0.5, 5.2], look: [0, 0, 0], to: { pos: [0.2, 0.3, 3.6] } },
      { t: B('secret') - 0.05, pos: V(0.4, 0.7, 4.6), look: V(0, 0.4, 0), to: { pos: V(0.2, 0.6, 3.6) } },
      { t: B('outro') - 0.05, pos: [0, 2.2, 13], look: [0, 0, 0], to: { pos: [0, 3, 17] } },
    ];
    return s;
  },

  update(t, { camera, B, E }, s) {
    s.diskMat.uniforms.uTime.value = t;
    s.haloMat.uniforms.uTime.value = t;
    const idx = shotIndex(t, s.shots);
    const A = s.astro;
    A.group.visible = true;
    A.group.scale.set(1, 1, 1);
    A.body.scale.set(1, 1, 1);
    A.group.rotation.set(0, 0, 0);
    s.speed.group.visible = false;
    let pose = { t };

    // queda em espiral do lado de fora do disco até o horizonte
    const f0 = B('time'), f1 = E('spag') + 0.3;
    const fp = clamp01((t - f0) / (f1 - f0));
    const r = lerp(8, 1.3, ease.inQuad(fp));
    const ang = 0.9 + fp * 1.4;
    const fallPos = new THREE.Vector3(r * Math.sin(ang), 0.9 * (1 - fp) + 0.2, r * Math.cos(ang));

    switch (idx) {
      case 0:
        A.group.position.set(2.0, -1.0, 7.8);
        A.group.rotation.set(0, 0.7, 0);
        pose = { t, armL: 0.5, armR: 0.8, look: -0.4 };
        break;
      case 2: case 3:
        A.group.position.copy(fallPos);
        A.group.lookAt(0, 0, 0);
        A.group.rotateY(Math.PI * 0.75);
        pose = idx === 3
          ? { t, armL: 1.6, armR: 0.3, eyes: 'scared', nod: 0.35, look: -0.4 }
          : { t, armL: 0.6, armR: 0.6, look: -0.6 };
        break;
      case 4: case 5: {
        A.group.position.copy(fallPos);
        A.group.lookAt(0, 0, 0);
        A.group.rotateX(Math.PI / 2); // pés apontando para o buraco negro
        const st = idx === 5 ? 1 + 3.5 * phase(t, B('spag'), B('spag') + 0.9, ease.outBack) : 1 + 0.25 * phase(t, B('pull'), E('pull'));
        A.group.scale.set(1 / Math.sqrt(st), st, 1 / Math.sqrt(st));
        pose = { t, armL: 2.8, armR: 2.8, legL: 0.05, legR: 0.05, eyes: 'scared' };
        s.speed.group.visible = true;
        s.speed.group.position.copy(fallPos);
        s.speed.group.lookAt(0, 0, 0);
        s.speed.update(t);
        break;
      }
      case 7:
        A.group.position.copy(VOID);
        A.group.rotation.set(0, 0.25, 0);
        pose = { t, armL: 0.3, armR: 2.0, eyes: 'happy', look: 0.15 };
        break;
      default:
        A.group.visible = false;
    }
    A.pose(pose);
    if (idx === 0 || idx === 2 || idx === 3 || idx === 7) A.float(t, idx === 7 ? 0.5 : 0.7);
    if (idx === 3) A.armL.rotation.x = -1.2;   // olhando o relógio no pulso
    if (idx === 7) A.armR.rotation.x = -1.3;   // mão no visor: "shhh"
    s.astroPos = [A.group.position.x, A.group.position.y, A.group.position.z];

    applyShots(camera, t, s.shots, s.duration);
    camera.updateMatrixWorld();
    s.halo.quaternion.copy(camera.quaternion);
    s.ring.quaternion.copy(camera.quaternion);
    s.voidSet.visible = idx === 7;

    // relógios (dilatação do tempo, ilustrativo)
    const t0 = B('time'), t1 = E('years');
    const k = clamp01((t - t0) / (t1 - t0));
    const you = Math.max(0, Math.min(t, t1) - t0) * 10;
    s.clk.style.opacity = phase(t, t0, t0 + 0.4) * (1 - phase(t, B('pull') - 0.3, B('pull')));
    s.c1.textContent = hms(you);
    s.c2.textContent = longTime(you * (1 + 4e6 * Math.pow(k, 4)));
  },
};
