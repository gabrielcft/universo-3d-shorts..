// MODELO para criar um short novo.
// 1) Copie este arquivo para shorts/05-meu-tema.js (o nome precisa começar com número)
// 2) Adicione-o em shorts/manifest.js
// 3) Gere a voz:  npm run narrate -- 05
// 4) Abra http://localhost:5173/player.html?s=05-meu-tema (clique para tocar com som)
//
// Regra de ouro: update(t) deve depender SOMENTE de t (o tempo em segundos).
// Use B('id') / E('id') / W('id', 'palavra') para sincronizar com a narração.
import * as THREE from 'three';
import { createStarMaterial, createGlow, planetTexture, PALETTES, keyframes } from '../engine/space.js';

export default {
  title: 'Título do short',
  bloom: { strength: 0.7, radius: 0.6, threshold: 0.85 },
  nebula: { a: '#1b2a6b', b: '#6b1b5e', intensity: 0.22, seed: 4 },
  // voice: 'pt-BR-FranciscaNeural',  // voz feminina (padrão: pt-BR-AntonioNeural)
  // rate: '+10%',                     // velocidade da fala

  // Roteiro narrado. Legenda: *amarelo*, **ciano**.
  // Opções por frase: punch (zoom), shake (tremor), flash (clarão), sfx ('whoosh' | 'boom' | null)
  script: [
    { id: 'hook', text: 'Um gancho forte nos *três primeiros segundos*.', sfx: 'boom' },
    { id: 'fact', text: 'Depois, um dado **surpreendente** que prende a atenção.', punch: 0.08 },
    { id: 'outro', text: 'Segue pra mais curiosidades do universo!' },
  ],
  // Efeitos extras em palavras específicas:
  fx: ({ W }) => [{ t: W('fact', 'surpreendente'), flash: 0.6, shake: 0.5, sfx: 'boom' }],

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

  update(t, { camera, B }, s) {
    s.sun.material.uniforms.uTime.value = t;
    s.planet.rotation.y = t * 0.2;
    // aproxima a câmera quando a frase "fact" começa
    const dist = keyframes(t, [[0, 7], [B('fact'), 4], [B('outro'), 5]]);
    camera.position.set(Math.sin(t * 0.15) * dist, 0.8, Math.cos(t * 0.15) * dist);
    camera.lookAt(0, 0, 0);
  },
};
