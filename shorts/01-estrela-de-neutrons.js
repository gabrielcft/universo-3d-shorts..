// SHORT 01 — E se você pegasse uma colher de estrela de nêutrons?
import * as THREE from 'three';
import { phase, clamp01, ease, integrate, lerp } from '../engine/space.js';
import { toonStarMat, createToonHalo, flatMat, addOutlines, applyShots, shotIndex } from '../engine/toon.js';
import { createAstronaut, createRocket, createSpoon, createBuildings, createSpeedLines } from '../engine/characters.js';

const STAR_R = 2;

export default {
  title: 'E se você pegasse uma colher de estrela de nêutrons?',
  toon: true,
  sky: { top: '#070b26', bottom: '#1d1446', seed: 11 },
  bloom: { strength: 0.35, radius: 0.5, threshold: 0.92 },
  music: { mood: 'cosmos', seed: 1 },

  script: [
    { id: 'hook', text: 'E se você pegasse uma colher de chá de uma *estrela de nêutrons*?', sfx: 'boom' },
    { id: 'ship', text: 'Você chega pertinho com a sua nave... e estica a *colher*.' },
    { id: 'weight', text: 'Só esse pouquinho pesa cerca de *um bilhão de toneladas*!', shake: 0.5 },
    { id: 'city', text: 'É como segurar *milhares de prédios* numa colher.' },
    { id: 'fall', text: 'A colher despenca... e *te puxa junto*!', shake: 0.8, sfx: 'whoosh' },
    { id: 'dense', text: 'Essa estrela tem mais massa que o *Sol*, num tamanho de *cidade*.' },
    { id: 'spin', text: 'E ainda gira *mais de setecentas vezes por segundo*!', shake: 0.4 },
    { id: 'moral', text: 'Moral da história: *nunca* leve uma colher pra uma estrela de nêutrons.', punch: 0.08 },
    { id: 'outro', text: 'Segue pra mais histórias do universo!' },
  ],
  fx: ({ W }) => [{ t: W('weight', 'bilhão'), flash: 0.7, punch: 0.1, sfx: 'boom' }],

  youtube: {
    title: 'E se você pegasse uma COLHER de estrela de nêutrons? 🥄⭐',
    description: 'Uma colher de chá de estrela de nêutrons pesa cerca de 1 bilhão de toneladas! Essas estrelas têm mais massa que o Sol num tamanho de cidade e giram centenas de vezes por segundo.',
    hashtags: ['shorts', 'universo', 'espaço', 'astronomia', 'curiosidades', 'esevoce'],
    tags: ['estrela de nêutrons', 'e se você', 'universo', 'astronomia', 'curiosidades do espaço', 'animação'],
  },

  setup({ scene, B, E, W, duration }) {
    scene.add(new THREE.DirectionalLight('#ffffff', 2.0).translateX(-4).translateY(3).translateZ(5));
    scene.add(new THREE.AmbientLight('#9fb4ff', 0.6));
    const starLight = new THREE.PointLight('#9fd8ff', 30, 40, 1.5);
    scene.add(starLight);

    // estrela de nêutrons
    const star = new THREE.Mesh(new THREE.SphereGeometry(STAR_R, 64, 32), toonStarMat({ c: '#86c9ff', light: '#effaff', dark: '#3d7dff', scale: 4 }));
    addOutlines(star, 1.6);
    scene.add(star);
    const halo = createToonHalo('#bfe6ff', STAR_R, 4, 0.35);
    scene.add(halo);
    const spinG = new THREE.Group();
    spinG.rotation.z = 0.45;
    scene.add(spinG);
    const beamM = flatMat('#d8f3ff', { transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
    for (const dir of [1, -1]) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.4, 14, 32, 1, true), beamM);
      cone.geometry.translate(0, -7, 0);
      cone.rotation.x = dir > 0 ? Math.PI : 0;
      cone.userData.noOutline = true;
      spinG.add(cone);
    }

    // você
    const astro = createAstronaut();
    scene.add(astro.group);
    const spoon = createSpoon({ glow: '#86e1ff' });
    astro.armR.add(spoon.group);
    spoon.group.position.y = -0.5;
    spoon.group.rotation.x = 0.2;

    const rocket = createRocket();
    scene.add(rocket.group);

    const city = createBuildings({ count: 30, radius: 5 });
    scene.add(city.group);

    const speed = createSpeedLines({ count: 60, radius: 2.5, length: 10 });
    scene.add(speed.group);

    // planos (cortes de câmera) guiados pela narração
    const shots = [
      { t: 0, pos: [4.5, 1.2, 12], look: [0.5, 0, 0], to: { pos: [3.8, 0.9, 10.5] } },
      { t: B('ship') - 0.1, pos: [17, 3.5, 3], look: [7.5, 1.2, 8], to: { pos: [16, 3, 4.5] } },
      { t: W('ship', 'estica'), pos: [7.6, 1.7, 7.4], look: [1.5, 0, 1.5], to: { pos: [7.0, 1.5, 6.8] } },
      { t: B('weight') - 0.05, pos: () => st.closeCam, look: () => st.spoonW, to: { pos: () => st.closeCam2, look: () => st.spoonW } },
      { t: B('city') - 0.05, pos: [0, 4, -24], look: [0, 1.5, -34], to: { pos: [0, 5, -21] } },
      { t: B('fall') - 0.05, pos: [6.5, 2.2, 9.5], look: [3, 0, 3], to: { pos: [4.2, 1.2, 6.5] } },
      { t: B('dense') - 0.05, pos: [-3.2, 2.8, 23], look: [-3.2, 0.4, 0], to: { pos: [-3.2, 2.5, 21] } },
      { t: B('spin') - 0.05, pos: [0, 2, 9], look: [0, 0, 0], to: { pos: [2.5, 3, 8] } },
      { t: B('moral') - 0.05, pos: [0.4, 0.6, -36.5], look: [0, 0.2, -40], to: { pos: [0.2, 0.5, -37.5] } },
      { t: B('outro') - 0.05, pos: [0, 4, 18], look: [0, 0, 0], to: { pos: [0, 6, 24] } },
    ];

    const omega = (t) => 0.8 + 18 * phase(t, B('spin') - 0.2, B('spin') + 1.2, ease.inCubic);
    const st = { spoonW: [0, 0, 0], closeCam: [0, 0, 0], closeCam2: [0, 0, 0] };
    return { star, halo, spinG, beamM, astro, spoon, rocket, city, speed, shots, omega, duration, st, v: new THREE.Vector3() };
  },

  update(t, { camera, B, E, W }, s) {
    s.star.material.uniforms.uTime.value = t;
    const shot = { index: shotIndex(t, s.shots) };
    shot.local = t - s.shots[shot.index].t;
    shot.progress = clamp01(shot.local / Math.max(0.1, (s.shots[shot.index + 1]?.t ?? s.duration) - s.shots[shot.index].t));
    s.halo.quaternion.copy(camera.quaternion);
    const spinA = integrate(s.omega, t);
    s.star.rotation.y = spinA;
    s.spinG.rotation.y = spinA;
    s.beamM.opacity = 0.32 + 0.12 * Math.sin(t * 9);

    const A = s.astro;
    A.group.visible = true;
    A.group.scale.setScalar(1);
    A.body.scale.set(1, 1, 1);
    s.rocket.group.visible = false;
    s.city.group.visible = false;
    s.speed.group.visible = false;
    s.spoon.blob.visible = t > W('ship', 'estica') + 0.3;
    let poseArgs = { t };

    switch (shot.index) {
      case 0: // gancho: você flutuando diante da estrela
        A.group.position.set(3.2, -0.6, 6.5);
        A.group.rotation.set(0, 0.6, 0);
        poseArgs = { t, armR: 0.5, armL: 0.6, look: -0.5 };
        break;
      case 1: { // a nave chegando
        A.group.visible = false;
        s.rocket.group.visible = true;
        const p = shot.progress;
        s.rocket.group.position.set(lerp(11, 6, p), lerp(2, 1.2, p), lerp(12, 6, p));
        s.rocket.group.lookAt(0, 0, 0);
        s.rocket.update(t);
        break;
      }
      case 2: // esticando a colher
        A.group.position.set(4.2, 0, 4.4);
        A.group.rotation.set(0, -2.3, 0);
        poseArgs = { t, armR: 1.9 * ease.outBack(clamp01(shot.local / 0.6)), armL: 0.4, look: 0.2 };
        break;
      case 3: // close na colher pesadíssima
        A.group.position.set(3.4, -0.2, 3.0);
        A.group.rotation.set(0, -2.3, 0);
        poseArgs = { t, armR: 1.4 - 0.5 * phase(t, W('weight', 'bilhão'), W('weight', 'bilhão') + 0.4), armL: 1.2, eyes: t > W('weight', 'bilhão') ? 'scared' : 'normal', look: 0.4 };
        break;
      case 4: { // "milhares de prédios"
        s.city.group.visible = true;
        s.city.group.position.set(0, 0, -34);
        s.city.group.scale.setScalar(1);
        s.city.grow(phase(t, B('city'), E('city'), ease.linear));
        A.group.position.set(0, 1.4, -32.5);
        A.group.rotation.set(0, 0, 0);
        A.group.scale.setScalar(0.8);
        poseArgs = { t, armR: 2.6, armL: 0.6, eyes: 'scared' };
        break;
      }
      case 5: { // puxado pela colher
        const p = ease.inQuad(shot.progress);
        A.group.position.set(lerp(5, 2.6, p), lerp(0.4, 0.1, p), lerp(6, 2.6, p));
        A.group.lookAt(0, 0, 0);
        A.group.rotateY(Math.PI);
        A.group.rotateX(-0.5);
        poseArgs = { t, armR: 2.9, armL: 2.6, legL: 0.6, legR: 0.5, eyes: 'scared' };
        s.speed.group.visible = true;
        s.speed.group.position.copy(A.group.position);
        s.speed.group.lookAt(0, 0, 0);
        s.speed.update(t);
        break;
      }
      case 6: // tamanho de cidade: estrela ao lado de uma cidade do mesmo tamanho
        A.group.visible = false;
        s.city.group.visible = true;
        s.city.group.position.set(-6.3, -1.6, 0);
        s.city.group.scale.set(0.42, 1.0, 0.42);
        s.city.grow(1);
        break;
      case 7: // girando muito rápido, você tonto
        A.group.position.set(Math.cos(t * 2.2) * 4.5, 0.8, Math.sin(t * 2.2) * 4.5);
        A.group.rotation.set(t * 4, t * 3, 0.5);
        poseArgs = { t, armR: 2.2, armL: 2.4, legL: 0.7, legR: 0.4, eyes: 'squint' };
        break;
      case 8: // moral da história (num canto tranquilo do espaço)
        A.group.position.set(0, -0.7, -40);
        A.group.rotation.set(0, 0.25, 0);
        poseArgs = { t, armR: 0.35 + 0.2 * Math.sin(t * 3), armL: 0.9, eyes: 'happy', look: Math.sin(t * 5) * 0.35 * (1 - phase(t, E('moral') - 0.6, E('moral'))) };
        break;
      default:
        A.group.position.set(3.5, 1.5, 3.5);
        A.group.rotation.set(0, t, 0);
        poseArgs = { t, armR: 2.5, armL: 0.3, eyes: 'happy' };
    }
    A.pose(poseArgs);
    if (shot.index !== 5 && shot.index !== 7) A.float(t);

    // câmera: o close da colher mira a posição real da colher na mão
    A.group.updateMatrixWorld(true);
    s.spoon.blob.getWorldPosition(s.v);
    s.st.spoonW = [s.v.x, s.v.y, s.v.z];
    const away = new THREE.Vector3(s.v.x - A.group.position.x, 0, s.v.z - A.group.position.z).normalize();
    s.st.closeCam = [s.v.x + away.x * 1.6 + 0.9, s.v.y + 0.7, s.v.z + away.z * 1.6 + 0.9];
    s.st.closeCam2 = [s.v.x + away.x * 1.2 + 0.7, s.v.y + 0.5, s.v.z + away.z * 1.2 + 0.7];
    applyShots(camera, t, s.shots, s.duration);
  },
};
