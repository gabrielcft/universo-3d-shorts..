// MODELO para criar um short novo no estilo "E se você...".
// 1) Copie este arquivo para shorts/05-meu-tema.js (o nome precisa começar com número)
// 2) Adicione-o em shorts/manifest.js
// 3) Gere a voz:  npm run narrate -- 05
// 4) Abra http://localhost:5173/player.html?s=05-meu-tema (clique para tocar com som)
//
// Regra de ouro: update(t) deve depender SOMENTE de t (o tempo em segundos).
// Use B('id') / E('id') / W('id', 'palavra') para sincronizar com a narração.
import * as THREE from 'three';
import { planetTexture, phase } from '../engine/space.js';
import { toonMat, toonStarMat, createToonHalo, addOutlines, applyShots, shotIndex } from '../engine/toon.js';
import { createAstronaut } from '../engine/characters.js';

export default {
  title: 'E se você...?',
  toon: true,                                          // visual cartunesco
  sky: { top: '#0a0f2e', bottom: '#2b1747', seed: 5 }, // cores do céu
  bloom: { strength: 0.3, radius: 0.5, threshold: 0.93 },
  music: { mood: 'cosmos', seed: 5 },                  // trilha: cosmos | warm | epic | dark (pulse: true = batida)
  // voice: 'pt-BR-FranciscaNeural',                   // voz feminina (padrão: pt-BR-AntonioNeural)

  // Roteiro em 2ª pessoa. Legenda: *amarelo*, **ciano**.
  // Opções por frase: punch (zoom), shake (tremor), flash (clarão), sfx ('whoosh' | 'boom' | null)
  script: [
    { id: 'hook', text: 'E se você flutuasse até um *planeta desconhecido*?', sfx: 'boom' },
    { id: 'fact', text: 'Você chega perto... e descobre algo **surpreendente**!', punch: 0.08 },
    { id: 'outro', text: 'Segue pra mais histórias do universo!' },
  ],

  youtube: {
    title: 'E se você...? 🤯',
    description: 'Descrição curta com o fato principal.',
    hashtags: ['shorts', 'universo', 'astronomia', 'esevoce'],
    tags: ['universo', 'astronomia', 'e se você'],
  },

  setup({ scene, B, duration }) {
    scene.add(new THREE.AmbientLight('#b8c4ff', 0.6));
    const key = new THREE.DirectionalLight('#ffffff', 2.0);
    key.position.set(-3, 3, 5);
    scene.add(key);

    const planet = new THREE.Mesh(new THREE.SphereGeometry(3, 64, 32), toonMat('#ffffff', {
      map: planetTexture({ kind: 'gas', seed: 7, posterize: 4, stops: [[0, '#5b6ee1'], [0.5, '#9a7bff'], [1, '#d6c9ff']] }),
    }));
    planet.position.set(0, 0, -6);
    addOutlines(planet, 1.5);
    scene.add(planet);

    const sun = new THREE.Mesh(new THREE.SphereGeometry(1.5, 48, 24), toonStarMat());
    sun.position.set(-7, 6, -15);
    addOutlines(sun, 1.5);
    const halo = createToonHalo('#ffd36b', 1.5, 3, 0.3);
    halo.position.copy(sun.position);
    scene.add(sun, halo);

    const astro = createAstronaut();
    scene.add(astro.group);

    // Planos: cada um começa numa frase (corte seco) e desliza de pos → to.pos
    const shots = [
      { t: 0, pos: [2, 1, 6], look: [0, 0, -2], to: { pos: [1.6, 0.8, 5] } },
      { t: B('fact') - 0.05, pos: [0.5, 0.6, 3.2], look: [0, 0.4, 0], to: { pos: [0.4, 0.5, 2.6] } },
      { t: B('outro') - 0.05, pos: [0, 2, 12], look: [0, 0, -4], to: { pos: [0, 3, 15] } },
    ];
    return { planet, sun, halo, astro, shots, duration };
  },

  update(t, { camera, B }, s) {
    s.sun.material.uniforms.uTime.value = t;
    s.planet.rotation.y = t * 0.1;
    const idx = shotIndex(t, s.shots);
    // poses: armL/armR (braços), legL/legR, eyes: normal | scared | happy | squint, look (girar a cabeça)
    s.astro.group.position.set(0, 0, 0);
    s.astro.pose({ t, armR: idx === 1 ? 2.5 : 0.5, armL: 0.6, eyes: idx === 1 ? 'scared' : 'happy' });
    s.astro.float(t);
    applyShots(camera, t, s.shots, s.duration);
    camera.updateMatrixWorld();
    s.halo.quaternion.copy(camera.quaternion);
  },
};
