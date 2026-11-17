// SHORT 02 — E se você tentasse passar um dia inteiro em Vênus?
import * as THREE from 'three';
import { phase, clamp01, ease, lerp, planetTexture, shader } from '../engine/space.js';
import { toonMat, flatMat, toonStarMat, createToonHalo, addOutlines, applyShots, shotIndex } from '../engine/toon.js';
import { createAstronaut, createRocket, createThermometer } from '../engine/characters.js';

const YEAR = 224.7, DAY = 243;
const S = new THREE.Vector3(0, 0, 600); // "cenário" da superfície, longe do espaço

export default {
  title: 'E se você tentasse passar um dia em Vênus?',
  toon: true,
  sky: { top: '#0a0f2e', bottom: '#2b1747', seed: 21 },
  bloom: { strength: 0.3, radius: 0.5, threshold: 0.93 },
  music: { mood: 'warm', seed: 2 },

  script: [
    { id: 'hook', text: 'E se você tentasse passar *um dia inteiro* em Vênus?', sfx: 'boom' },
    { id: 'land', text: 'Você pousa... e na hora sente o calor: *460 graus*!', shake: 0.5 },
    { id: 'lead', text: 'Quente o bastante pra derreter *chumbo*!' },
    { id: 'press', text: 'E a pressão? É como estar *900 metros* debaixo d\'água.', punch: 0.08 },
    { id: 'wait', text: 'Agora é só esperar o dia acabar...' },
    { id: 'day', text: 'Só que um dia em Vênus dura *243 dias* da Terra!', shake: 0.4 },
    { id: 'year', text: 'Mais que o próprio *ano* de Vênus, que tem *225 dias*!' },
    { id: 'west', text: 'E quando o Sol finalmente aparece... ele nasce no *oeste*!', punch: 0.09 },
    { id: 'outro', text: 'Segue pra mais histórias do universo!' },
  ],
  fx: ({ W }) => [{ t: W('land', '460'), flash: 0.6, punch: 0.08, sfx: 'boom' }],

  youtube: {
    title: 'E se você tentasse passar UM DIA em Vênus? ☀️🔥',
    description: 'Em Vênus faz 460 °C, a pressão é como estar a 900 metros debaixo d\'água, um dia dura 243 dias terrestres (mais que o ano de 225 dias) e o Sol nasce no oeste!',
    hashtags: ['shorts', 'vênus', 'universo', 'astronomia', 'curiosidades', 'esevoce'],
    tags: ['vênus', 'e se você', 'sistema solar', 'astronomia', 'curiosidades do espaço', 'animação'],
  },

  setup({ scene, hud, B, duration }) {
    scene.add(new THREE.AmbientLight('#ffe2b0', 0.55));
    const key = new THREE.DirectionalLight('#fff1d6', 2.0);
    key.position.set(-5, 4, 6);
    scene.add(key);

    // ---------- ESPAÇO ----------
    const sun = new THREE.Mesh(new THREE.SphereGeometry(2.4, 64, 32), toonStarMat({ c: '#ffb22e', light: '#ffe58a', dark: '#ff7b1c' }));
    addOutlines(sun, 1.6);
    const sunHalo = createToonHalo('#ffd36b', 2.4, 3, 0.3);
    scene.add(sun, sunHalo);
    const venusTex = planetTexture({ kind: 'gas', seed: 11, posterize: 4, bandFreq: 6, turb: 1.4, scale: 1.4,
      stops: [[0, '#d9973f'], [0.33, '#e9b25a'], [0.66, '#f5cf86'], [1, '#fbe6b5']] });
    const venus = new THREE.Mesh(new THREE.SphereGeometry(1.3, 64, 32), toonMat('#ffffff', { map: venusTex }));
    const marker = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 12), flatMat('#3df5ff'));
    marker.rotation.z = -Math.PI / 2;
    marker.position.x = 1.5;
    venus.add(marker);
    addOutlines(venus, 1.5);
    scene.add(venus);
    const orbit = new THREE.Mesh(new THREE.RingGeometry(6.97, 7.03, 160), flatMat('#ffd28a', { side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
    orbit.rotation.x = -Math.PI / 2;
    scene.add(orbit);
    const rocket = createRocket();
    scene.add(rocket.group);

    // ---------- SUPERFÍCIE ----------
    const surf = new THREE.Group();
    surf.position.copy(S);
    scene.add(surf);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), shader({
      uniforms: { uTime: { value: 0 } },
      vertex: /* glsl */ `varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragment: /* glsl */ `
        uniform float uTime; varying vec3 vD;
        void main(){
          vec3 d = normalize(vD);
          float k = floor(smoothstep(-0.05, 0.6, d.y) * 5.0) / 5.0;
          vec3 c = mix(vec3(1.0, 0.82, 0.45), vec3(0.86, 0.52, 0.18), k);
          float cl = fbm(vec3(d.x * 3.0 + uTime * 0.05, d.y * 6.0, d.z * 3.0));
          if (cl > 0.15 && d.y > 0.05) c = mix(c, vec3(1.0, 0.9, 0.62), 0.55);
          gl_FragColor = vec4(c, 1.0);
        }`,
      side: THREE.BackSide,
    }));
    dome.userData.noOutline = true;
    surf.add(dome);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(110, 64), toonMat('#c46a2c'));
    ground.rotation.x = -Math.PI / 2;
    ground.userData.noOutline = true;
    surf.add(ground);
    let sd = 5;
    const rr = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
    for (let i = 0; i < 26; i++) {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3 + rr() * 0.9, 0), toonMat(i % 2 ? '#8a4a22' : '#a35a2a'));
      const a = rr() * Math.PI * 2, d = 4 + rr() * 22;
      rock.position.set(Math.cos(a) * d, 0.1, Math.sin(a) * d);
      rock.rotation.set(rr() * 3, rr() * 3, rr() * 3);
      surf.add(rock);
    }
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.ConeGeometry(6 + rr() * 6, 5 + rr() * 6, 7), toonMat('#9c5022'));
      const a = (i / 9) * Math.PI * 2;
      m.position.set(Math.cos(a) * 60, 2, Math.sin(a) * 60);
      surf.add(m);
    }
    const seat = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), toonMat('#8a4a22'));
    seat.position.set(0, 0.35, 0);
    surf.add(seat);
    const landed = createRocket();
    landed.group.rotation.x = -Math.PI / 2;
    landed.group.position.set(-3.2, 1.8, -2.5);
    surf.add(landed.group);
    const lowSun = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16), toonStarMat({ c: '#fff0b0', light: '#ffffff', dark: '#ffd36b' }));
    lowSun.userData.noOutline = true;
    surf.add(lowSun);
    const lead = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.45, 0.45), toonMat('#7c8494'));
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 32), toonMat('#9aa3b8'));
    puddle.rotation.x = -Math.PI / 2;
    puddle.userData.noOutline = true;
    surf.add(lead, puddle);
    const bubbles = [];
    const bubM = flatMat('#bfefff', { transparent: true, opacity: 0.75 });
    for (let i = 0; i < 26; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06 + rr() * 0.1, 12, 8), bubM);
      b.userData = { x: (rr() - 0.5) * 3.5, z: (rr() - 0.5) * 2, sp: 0.6 + rr(), ph: rr() * 4, noOutline: true };
      surf.add(b);
      bubbles.push(b);
    }
    const thermo = createThermometer();
    surf.add(thermo.group);
    addOutlines(surf, 1.3);

    const astro = createAstronaut();
    scene.add(astro.group);

    hud.innerHTML = `
      <div class="panel" id="vp">
        <div class="row"><span>Ano de Vênus</span><b id="vy">0%</b></div>
        <div class="bar"><i id="vyb" style="background:linear-gradient(90deg,#ff9a3c,#ffd23f)"></i></div>
        <div class="row"><span>Dia de Vênus</span><b id="vd">0%</b></div>
        <div class="bar"><i id="vdb" style="background:linear-gradient(90deg,#1aa7ff,#3df5ff)"></i></div>
        <div class="big">Dias terrestres: <b id="vn">0</b></div>
      </div>
      <div class="label3d" id="westL"><b style="font-size:72px;color:#ffd23f">OESTE</b></div>`;
    const $ = (id) => hud.querySelector('#' + id);

    const P = (x, y, z) => [S.x + x, S.y + y, S.z + z];
    const s = {
      sun, sunHalo, venus, rocket, surf, dome, lowSun, lead, puddle, bubbles, thermo, astro, landed, duration,
      venusPos: [7, 0, 0],
      ui: { panel: $('vp'), y: $('vy'), yb: $('vyb'), d: $('vd'), db: $('vdb'), n: $('vn'), west: $('westL') },
      v: new THREE.Vector3(),
    };
    s.shots = [
      { t: 0, pos: [5, 2.5, 13], look: [1.5, 0, 6], to: { pos: [4.2, 2.2, 11.5] } },
      { t: B('land') - 0.05, pos: P(2.2, 1.6, 5.5), look: P(0, 1.1, 0), to: { pos: P(1.8, 1.4, 4.8) } },
      { t: B('lead') - 0.05, pos: P(2.4, 1.3, 3.2), look: P(1.6, 0.3, 0.6), to: { pos: P(2.2, 1.1, 2.8) } },
      { t: B('press') - 0.05, pos: P(0, 1.4, 5.2), look: P(0, 1.0, 0), to: { pos: P(0, 1.2, 4.4) } },
      { t: B('wait') - 0.05, pos: P(-4.5, 2, 6), look: P(0, 1.2, 0), to: { pos: P(-3.8, 1.8, 5.2) } },
      { t: B('day') - 0.05, pos: P(3, 1.8, 5), look: P(0, 1.3, 0), to: { pos: P(2.4, 1.6, 4.2) } },
      { t: B('year') - 0.05, pos: [0, 15, 18], look: [0, -1.5, 0], to: { pos: [0, 13, 15] } },
      { t: B('west') - 0.05, pos: P(0.8, 2.0, 5.5), look: P(0, 3.5, -30), to: { pos: P(0.6, 1.8, 4.6) } },
      { t: B('outro') - 0.05, pos: [6, 3, 9], look: () => s.venusPos, to: { pos: [5, 2.5, 7] } },
    ];
    return s;
  },

  update(t, { camera, B, E, W, H }, s) {
    s.sun.material.uniforms.uTime.value = t;
    s.lowSun.material.uniforms.uTime.value = t;
    s.dome.material.uniforms.uTime.value = t;
    const idx = shotIndex(t, s.shots);
    const local = t - s.shots[idx].t;
    const span = (s.shots[idx + 1]?.t ?? s.duration) - s.shots[idx].t;
    const prog = clamp01(local / span);
    const onSurface = (idx >= 1 && idx <= 5) || idx === 7;
    s.surf.visible = onSurface;

    // Vênus: parada na frente da câmera (gancho) ou orbitando (plano do "ano")
    const c0 = B('wait'), c1 = E('year') - 0.3;
    const count = DAY * clamp01((t - c0) / (c1 - c0));
    if (idx === 6 || idx === 8) {
      const ang = (2 * Math.PI * (count + (idx === 8 ? (t - B('outro')) * 8 : 0))) / YEAR;
      s.venus.position.set(7 * Math.cos(ang), 0, -7 * Math.sin(ang));
      s.venus.rotation.y = Math.PI - (2 * Math.PI * count) / DAY;
    } else {
      s.venus.position.set(1.5, 0, 6);
      s.venus.rotation.y = t * 0.15;
    }
    s.venusPos = [s.venus.position.x, s.venus.position.y, s.venus.position.z];
    s.rocket.group.visible = idx === 0;
    if (idx === 0) {
      const p = ease.inOutSine(prog);
      s.rocket.group.position.set(lerp(6, 3, p), lerp(2.5, 0.9, p), lerp(12, 8.2, p));
      s.rocket.group.lookAt(1.5, 0, 6);
      s.rocket.update(t);
    }

    // HUD
    const show = phase(t, B('day'), B('day') + 0.4) * (1 - phase(t, E('year') + 0.2, E('year') + 0.6));
    const y = Math.min(1, count / YEAR), dd = Math.min(1, count / DAY);
    s.ui.panel.style.opacity = show;
    s.ui.y.textContent = y >= 1 ? 'completo ✓' : `${Math.floor(y * 100)}%`;
    s.ui.d.textContent = dd >= 1 ? 'completo ✓' : `${Math.floor(dd * 100)}%`;
    s.ui.yb.style.width = `${y * 100}%`;
    s.ui.db.style.width = `${dd * 100}%`;
    s.ui.n.textContent = Math.floor(count);

    // Astronauta + adereços
    const A = s.astro;
    A.group.visible = onSurface;
    A.group.rotation.set(0, 0, 0);
    A.body.scale.set(1, 1, 1);
    A.group.position.set(S.x, S.y + 1.25, S.z);
    s.lead.visible = s.puddle.visible = idx === 2;
    s.thermo.group.visible = idx === 1;
    s.bubbles.forEach((b) => { b.visible = idx === 3; });
    s.lowSun.position.set(0, -5 + 15 * phase(t, B('west') + 0.3, E('west') + 0.2, ease.outCubic), -70);
    s.lowSun.visible = idx === 7;
    let pose = { t };
    switch (idx) {
      case 1: {
        const heat = phase(t, B('land') + 0.4, W('land', '460') + 0.2, ease.outCubic);
        s.thermo.group.position.set(1.5, 1.6, 0.6);
        s.thermo.set(heat);
        A.group.position.y += Math.abs(Math.sin(t * 9)) * 0.15 * heat;
        pose = { t, armL: 0.5 + heat * 2.2, armR: 0.4 + heat * 2.2, eyes: heat > 0.6 ? 'scared' : 'normal', legL: 0.25, legR: 0.25 };
        break;
      }
      case 2: {
        const m = phase(t, B('lead') + 0.2, E('lead') + 0.2, ease.inOutSine);
        s.lead.position.set(1.6, 0.225 * Math.max(0.05, 1 - m), 0.6);
        s.lead.scale.set(1 + m * 0.4, Math.max(0.05, 1 - m), 1 + m * 0.4);
        s.puddle.position.set(1.6, 0.01, 0.6);
        s.puddle.scale.setScalar(0.2 + m * 0.7);
        A.group.rotation.y = 0.5;
        pose = { t, armL: 0.6, armR: 0.9, eyes: 'scared', look: 0.5, nod: 0.35 };
        break;
      }
      case 3: {
        const p = phase(t, B('press'), B('press') + 0.8, ease.outBack);
        A.body.scale.set(1 + 0.22 * p, 1 - 0.28 * p, 1 + 0.22 * p);
        A.group.position.y -= 0.3 * p;
        s.bubbles.forEach((b) => {
          const u = b.userData;
          b.position.set(u.x, (t * u.sp + u.ph) % 4, u.z);
        });
        pose = { t, armL: 0.9, armR: 0.9, eyes: 'squint' };
        break;
      }
      case 4: case 5:
        A.group.position.set(S.x, S.y + 1.35, S.z + 0.15);
        pose = { t, armL: 0.25, armR: 0.25, eyes: idx === 5 ? 'scared' : 'normal', legL: 0.15, legR: 0.15, look: idx === 4 ? Math.sin(t * 0.8) * 0.4 : 0 };
        break;
      case 7:
        A.group.position.set(S.x - 0.2, S.y + 1.25, S.z + 2.3);
        A.group.rotation.y = Math.PI * 0.8;
        pose = { t, armL: 0.4, armR: 2.6, eyes: 'scared', nod: -0.25 };
        break;
      default:
        pose = { t, armL: 0.3, armR: 2.6, eyes: 'happy' };
    }
    A.pose(pose);
    if (idx === 4 || idx === 5) { A.legL.rotation.x = -1.4; A.legR.rotation.x = -1.4; }

    applyShots(camera, t, s.shots, s.duration);
    camera.updateMatrixWorld();
    s.sunHalo.quaternion.copy(camera.quaternion);

    // rótulo "OESTE" sobre o sol nascente
    const wl = s.ui.west;
    const wo = idx === 7 ? phase(t, W('west', 'oeste') - 0.2, W('west', 'oeste') + 0.2) : 0;
    s.v.set(S.x, S.y + s.lowSun.position.y + 6, S.z - 70).project(camera);
    wl.style.opacity = wo.toFixed(3);
    wl.style.transform = `translate(${((s.v.x * 0.5 + 0.5) * 1080).toFixed(1)}px, ${((-s.v.y * 0.5 + 0.5) * H).toFixed(1)}px) translate(-50%, -100%) scale(${(0.8 + 0.2 * ease.outBack(wo)).toFixed(3)})`;
  },
};
