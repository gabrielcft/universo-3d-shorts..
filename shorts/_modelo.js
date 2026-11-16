// MODELO para criar um short novo.
// 1) Copie este arquivo para shorts/05-meu-tema.js (o nome precisa começar com número)
// 2) Adicione-o em shorts/manifest.js
// 3) Abra http://localhost:5173/player.html?s=05-meu-tema
//
// Regra de ouro: update(t) deve depender SOMENTE de t (o tempo em segundos).
// Nada de Math.random() ou contadores dentro do update — use rng(seed) no setup.
import * as THREE from 'three';
import { CHANNEL } from '../config.js';
import { createStarMaterial, createGlow, createAtmosphere, planetTexture, PALETTES, phase, keyframes } from '../engine/space.js';

export default {
  title: 'Título do short',
  duration: 30,                 // segundos (Shorts: ideal entre 25 e 45 s)
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.85 },
  nebula: { a: '#1b2a6b', b: '#6b1b5e', intensity: 0.22, seed: 4 },

  // Legendas: *amarelo*, **ciano**, \n quebra linha. size: xl | l | m. pos: top | center | bottom
  captions: [
    { t: [0, 3], text: 'Gancho forte nos *3 primeiros segundos*', size: 'xl' },
    { t: [3, 8], text: 'Desenvolva a curiosidade com **um dado surpreendente**' },
    { t: [27, 30], text: CHANNEL.outro, size: 'm' },
  ],

  youtube: {
    title: 'Título para o YouTube 🤯',
    description: 'Descrição curta com o fato principal.',
    hashtags: ['shorts', 'universo', 'astronomia'],
    tags: ['universo', 'astronomia'],
  },

  setup({ scene }) {
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 64),
      new THREE.MeshStandardMaterial({ map: planetTexture({ kind: 'rocky', seed: 3, stops: PALETTES.earth, ice: 0.85 }) }),
    );
    planet.position.set(0, 0, 0);
    scene.add(planet);
    const sun = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 32), createStarMaterial({ intensity: 1.4 }));
    sun.position.set(-9, 3, 4);
    const light = new THREE.PointLight('#ffffff', 3, 0, 0);
    const glow = createGlow('#ffaa44', 6, 0.5);
    light.position.copy(sun.position);
    glow.position.copy(sun.position);
    scene.add(sun, light, glow);
    return { planet, sun };
  },

  update(t, { camera }, s) {
    s.sun.material.uniforms.uTime.value = t;
    s.planet.rotation.y = t * 0.2;
    const dist = keyframes(t, [[0, 6], [10, 4], [30, 5]]);
    camera.position.set(Math.sin(t * 0.1) * dist, 0.8, Math.cos(t * 0.1) * dist);
    camera.lookAt(0, 0, 0);
  },
};
