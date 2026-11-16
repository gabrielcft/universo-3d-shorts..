// SHORT 02 — Em Vênus, um dia dura mais que um ano
import * as THREE from 'three';
import {
  createStarMaterial, createGlow, createAtmosphere, createArcArrow, planetTexture, PALETTES,
  phase, keyframes, lerp, clamp01,
} from '../engine/space.js';

const YEAR = 224.7;   // dias terrestres para orbitar o Sol
const DAY = 243.0;    // dias terrestres para girar em torno de si (sideral)
const ORBIT_R = 7;
const VENUS_R = 1.4;

export default {
  title: 'Em Vênus, um dia dura mais que um ano',
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.85 },
  nebula: { a: '#3a1f12', b: '#13254f', intensity: 0.2, seed: 5.4 },
  far: 3000,

  script: [
    { id: 'hook', text: 'Em Vênus, um *dia* dura mais que um *ano*.', sfx: 'boom' },
    { id: 'year', text: 'Pra dar uma volta completa no Sol, ela leva *225 dias*.' },
    { id: 'day', text: 'Mas pra girar uma única vez em torno de si... *243 dias*!', punch: 0.08 },
    { id: 'so', text: 'Ou seja: o *ano acaba antes* do dia terminar!', punch: 0.09 },
    { id: 'more', text: 'E tem mais: Vênus gira **ao contrário**.', shake: 0.5, sfx: 'boom' },
    { id: 'sun', text: 'Lá, o Sol nasce no *oeste*... e se põe no *leste*.' },
    { id: 'hell', text: 'Tudo isso a *460 graus*, debaixo de nuvens de *ácido sulfúrico*.', punch: 0.08 },
    { id: 'outro', text: 'Segue pra mais curiosidades do universo!' },
  ],

  youtube: {
    title: 'Em Vênus um DIA dura mais que um ANO 😳',
    description: 'Vênus leva 225 dias terrestres para dar a volta no Sol, mas 243 dias para girar em torno de si mesma. E ainda gira ao contrário: lá o Sol nasce no oeste!',
    hashtags: ['shorts', 'vênus', 'universo', 'astronomia', 'curiosidades', 'sistemasolar'],
    tags: ['vênus', 'planeta vênus', 'sistema solar', 'astronomia', 'curiosidades do espaço', 'universo'],
  },

  setup({ scene, hud }) {
    const sun = new THREE.Mesh(new THREE.SphereGeometry(2.2, 96, 48),
      createStarMaterial({ color: '#ff7a14', hot: '#fff0b0', intensity: 1.5, scale: 3.5 }));
    scene.add(sun);
    scene.add(createGlow('#ffaa44', 13, 0.6));
    scene.add(new THREE.PointLight('#fff1dc', 3.2, 0, 0));
    scene.add(new THREE.AmbientLight('#ffffff', 0.04));

    const orbit = new THREE.Mesh(new THREE.RingGeometry(ORBIT_R - 0.025, ORBIT_R + 0.025, 256),
      new THREE.MeshBasicMaterial({ color: '#ffd28a', transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    orbit.rotation.x = -Math.PI / 2;
    scene.add(orbit);

    // Vênus: grupo que orbita (não gira) + malha que gira
    const venus = new THREE.Group();
    scene.add(venus);
    const body = new THREE.Mesh(new THREE.SphereGeometry(VENUS_R, 128, 64),
      new THREE.MeshStandardMaterial({ map: planetTexture({ kind: 'gas', seed: 11, stops: PALETTES.venus, bandFreq: 5, turb: 1.1, scale: 1.3 }), roughness: 1, metalness: 0 }));
    venus.add(body);
    venus.add(createAtmosphere(VENUS_R * 1.05, '#ffd9a0', 1.1, 3));

    // Marcador fixo na superfície (mostra o giro)
    const markMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#3df5ff').multiplyScalar(1.6) });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.8, 12), markMat);
    pole.rotation.z = Math.PI / 2;
    pole.position.x = VENUS_R + 0.4;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 8), markMat);
    tip.position.x = VENUS_R + 0.8;
    const tipGlow = createGlow('#3df5ff', 1.6, 0.9);
    tipGlow.position.x = VENUS_R + 0.8;
    body.add(pole, tip, tipGlow);

    // Setas: órbita (anti-horário) e giro (horário = retrógrado)
    const orbitArrow = createArcArrow({ radius: ORBIT_R, from: -0.28, to: 0.28, c: '#ffd23f', thickness: 0.06, strength: 1.1 });
    scene.add(orbitArrow.group);
    const spinArrow = createArcArrow({ radius: VENUS_R * 1.45, from: 1.2, to: -1.2, c: '#3df5ff', thickness: 0.045, strength: 0.9 });
    venus.add(spinArrow.group);

    hud.innerHTML = `
      <div class="panel" id="vp">
        <div class="row"><span>Ano de Vênus</span><b id="vy">0%</b></div>
        <div class="bar"><i id="vyb" style="background:linear-gradient(90deg,#ff9a3c,#ffd23f)"></i></div>
        <div class="row"><span>Dia de Vênus</span><b id="vd">0%</b></div>
        <div class="bar"><i id="vdb" style="background:linear-gradient(90deg,#1aa7ff,#3df5ff)"></i></div>
        <div class="big">Dias terrestres: <b id="vn">0</b></div>
      </div>`;
    const $ = (id) => hud.querySelector('#' + id);

    return {
      sun, venus, body, orbitArrow, spinArrow,
      ui: { panel: $('vp'), y: $('vy'), yb: $('vyb'), d: $('vd'), db: $('vdb'), n: $('vn') },
      v: new THREE.Vector3(), look: new THREE.Vector3(), over: new THREE.Vector3(), chase: new THREE.Vector3(),
    };
  },

  update(t, { camera, B, E }, s) {
    s.sun.material.uniforms.uTime.value = t;
    // Dias terrestres: o contador corre durante as frases "year" e "day"
    const c0 = B('year') + 0.2, c1 = E('day') + 0.1;
    const count = DAY * clamp01((t - c0) / (c1 - c0));
    const d = t * 1.5 + count + Math.max(0, t - c1) * 14;
    const ang = (2 * Math.PI * d) / YEAR;
    s.venus.position.set(ORBIT_R * Math.cos(ang), 0, -ORBIT_R * Math.sin(ang));
    s.body.rotation.y = Math.PI - (2 * Math.PI * d) / DAY; // começa apontando p/ o Sol; gira ao contrário

    // Setas
    s.orbitArrow.group.rotation.y = ang;
    const arrows = phase(t, B('more') + 0.3, B('more') + 1.1) * (1 - phase(t, B('hell'), B('hell') + 0.6));
    s.orbitArrow.material.opacity = arrows;
    s.spinArrow.material.opacity = arrows;
    s.orbitArrow.group.visible = s.spinArrow.group.visible = arrows > 0.001;

    // HUD
    const show = phase(t, B('year'), B('year') + 0.5) * (1 - phase(t, B('more') - 0.4, B('more')));
    const y = Math.min(1, count / YEAR), dd = Math.min(1, count / DAY);
    s.ui.panel.style.opacity = show;
    s.ui.y.textContent = y >= 1 ? 'completo ✓' : `${Math.floor(y * 100)}%`;
    s.ui.d.textContent = dd >= 1 ? 'completo ✓' : `${Math.floor(dd * 100)}%`;
    s.ui.yb.style.width = `${y * 100}%`;
    s.ui.db.style.width = `${dd * 100}%`;
    s.ui.n.textContent = Math.floor(count);

    // Câmera: alterna entre "perseguir Vênus" e "visão geral da órbita"
    const vp = s.v.copy(s.venus.position);
    const out = vp.clone().normalize();
    const tan = new THREE.Vector3(-out.z, 0, out.x);
    const cd = keyframes(t, [[0, 9], [B('year'), 6.5], [B('more'), 7.4], [B('sun') + 0.5, 6], [B('hell') + 0.4, 4.6], [B('outro') + 1, 6.5]]);
    s.chase.copy(vp).addScaledVector(out, -cd * 0.15).addScaledVector(tan, cd).add(new THREE.Vector3(0, cd * 0.4, 0));
    const chaseLook = vp.clone().lerp(new THREE.Vector3(), 0.04).add(new THREE.Vector3(0, -0.5, 0));
    s.over.set(0, 19, 25);
    const w = keyframes(t, [[0, 1], [B('year') - 0.1, 1], [B('year') + 1.1, 0], [B('more') - 0.5, 0], [B('more') + 0.7, 1]]);
    camera.position.lerpVectors(s.over, s.chase, w);
    s.look.lerpVectors(new THREE.Vector3(0, -1.2, 0), chaseLook, w);
    camera.lookAt(s.look);
  },
};
