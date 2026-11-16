// SHORT 01 — Uma colher de estrela de nêutrons pesa ~1 bilhão de toneladas
import * as THREE from 'three';
import {
  createStarMaterial, createGlow, createFresnelMaterial, glowTexture, shader,
  phase, keyframes, integrate, smoothstep, clamp01, ease,
} from '../engine/space.js';

export default {
  title: 'Uma colher desta estrela pesa 1 bilhão de toneladas',
  bloom: { strength: 0.75, radius: 0.55, threshold: 0.85 },
  nebula: { a: '#13306e', b: '#4a1770', intensity: 0.28, seed: 2.2 },
  music: { mood: 'cosmos', seed: 1 }, // trilha ambiente (cosmos | warm | epic | dark)
  far: 3000,

  // Roteiro narrado: *amarelo*, **ciano**. Opções por frase: flash, shake, punch, sfx
  script: [
    { id: 'hook', text: 'Uma colher de chá desta estrela pesa *um bilhão de toneladas*.', sfx: 'boom' },
    { id: 'what', text: 'Isso é uma **estrela de nêutrons**.', punch: 0.09 },
    { id: 'origin', text: 'É o que sobra quando uma estrela gigante *explode*.' },
    { id: 'mass', text: 'Ela tem mais massa que o *Sol inteiro*...' },
    { id: 'city', text: 'espremida numa bola do tamanho de uma *cidade*.', punch: 0.1 },
    { id: 'spin', text: 'E ela gira. *Muito* rápido.' },
    { id: 'spin2', text: 'Algumas, *mais de setecentas vezes por segundo*!', shake: 0.6 },
    { id: 'beam', text: 'Seus feixes varrem o espaço como um **farol cósmico**.' },
    { id: 'outro', text: 'Segue pra ver mais segredos do universo!' },
  ],
  fx: ({ W }) => [{ t: W('origin', 'explode'), flash: 1, shake: 1, punch: 0.08, sfx: 'boom' }],

  youtube: {
    title: 'Uma colher desta estrela pesa 1 BILHÃO de toneladas 🤯',
    description: 'Estrelas de nêutrons são os objetos mais densos que podemos observar: mais massa que o Sol comprimida em ~20 km. Algumas giram mais de 700 vezes por segundo!',
    hashtags: ['shorts', 'universo', 'espaço', 'astronomia', 'curiosidades', 'ciência'],
    tags: ['estrela de nêutrons', 'pulsar', 'universo', 'astronomia', 'curiosidades do espaço', 'ciência'],
  },

  setup({ scene, B }) {
    const star = new THREE.Mesh(
      new THREE.SphereGeometry(1, 128, 64),
      createStarMaterial({ color: '#2f6dff', hot: '#eaf6ff', intensity: 1.15, scale: 5, speed: 2 }),
    );
    scene.add(star);
    const glow = createGlow('#6aa8ff', 4, 0.45);
    scene.add(glow);

    const spin = new THREE.Group();
    scene.add(spin);
    const mag = new THREE.Group();
    mag.rotation.z = 0.5; // eixo magnético inclinado em relação ao de rotação
    spin.add(mag);

    // Feixes de radiação
    const L = 16;
    const beamMat = shader({
      uniforms: { uO: { value: 0 }, uColor: { value: new THREE.Color('#a8d4ff') } },
      vertex: /* glsl */ `
        varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){
          vY = position.y / ${L.toFixed(1)};
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragment: /* glsl */ `
        uniform float uO; uniform vec3 uColor; varying float vY; varying vec3 vN; varying vec3 vV;
        void main(){
          float a = clamp(abs(vY), 0.0, 1.0);
          float fall = pow(1.0 - a, 1.7) * smoothstep(0.03, 0.12, a);
          float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.6);
          gl_FragColor = vec4(uColor * fall * core * uO * 0.55, 1.0);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    for (const r of [1.5, 0.55]) {
      const g = new THREE.ConeGeometry(r, L, 48, 1, true);
      g.translate(0, -L / 2, 0);
      g.rotateX(Math.PI);
      const up = new THREE.Mesh(g, beamMat);
      const down = up.clone();
      down.rotation.z = Math.PI;
      mag.add(up, down);
    }

    // Linhas de campo magnético (dipolo: r = L·sin²θ)
    const lineMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#47b4ff').multiplyScalar(1.1), transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const curves = [];
    for (const Ls of [1.9, 2.7, 3.9, 5.6]) {
      for (let k = 0; k < 6; k++) {
        const phi = (k / 6) * Math.PI * 2 + Ls;
        const th0 = Math.asin(Math.sqrt(1 / Ls));
        const pts = [];
        for (let i = 0; i <= 90; i++) {
          const th = th0 + (Math.PI - 2 * th0) * (i / 90);
          const r = Ls * Math.sin(th) ** 2;
          pts.push(new THREE.Vector3(r * Math.sin(th) * Math.cos(phi), r * Math.cos(th), r * Math.sin(th) * Math.sin(phi)));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        curves.push(curve);
        mag.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.011 + Ls * 0.003, 6), lineMat));
      }
    }
    const PER = 3;
    const pPos = new Float32Array(curves.length * PER * 3);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.22, map: glowTexture(), color: new THREE.Color('#cfeaff').multiplyScalar(2),
      transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    particles.frustumCulled = false;
    mag.add(particles);

    // Onda de choque da supernova
    const shockMat = createFresnelMaterial({ color: '#ff9a55', power: 2.2, intensity: 0 });
    const shock = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 48), shockMat);
    scene.add(shock);

    // Velocidade de giro guiada pela narração
    const s0 = B('spin'), s1 = B('spin2') + 0.6;
    const omega = (t) => 0.9 + 3 * phase(t, s0, s0 + 1.2) + 10 * phase(t, B('spin2') - 0.2, s1, ease.inCubic);

    return { star, glow, spin, mag, beamMat, lineMat, curves, PER, pPos, pGeo, pMat, shock, shockMat, omega, tmp: new THREE.Vector3(), q: new THREE.Quaternion() };
  },

  update(t, { camera, bloom, B, W, E }, s) {
    s.star.material.uniforms.uTime.value = t;
    s.spin.rotation.y = integrate(s.omega, t);

    const on = phase(t, B('what') - 0.1, B('what') + 0.9);
    s.lineMat.opacity = 0.5 * on;
    s.pMat.opacity = on;
    s.beamMat.uniforms.uO.value = on;
    s.curves.forEach((c, i) => {
      for (let k = 0; k < s.PER; k++) {
        const u = (t * 0.22 + k / s.PER + i * 0.137) % 1;
        c.getPointAt(u, s.tmp);
        s.pPos.set([s.tmp.x, s.tmp.y, s.tmp.z], (i * s.PER + k) * 3);
      }
    });
    s.pGeo.attributes.position.needsUpdate = true;

    // Câmera guiada pelas frases
    const boom = W('origin', 'explode');
    const dist = keyframes(t, [
      [0, 2.7], [E('hook'), 3.6], [B('what') + 1.0, 11], [boom, 9.5], [boom + 1.2, 15], [B('mass') + 0.8, 9],
      [B('city') + 0.6, 4.4], [B('spin') + 0.8, 7.5], [B('spin2') + 0.8, 6], [B('beam') + 1, 10.5], [B('outro') + 1, 13],
    ]);
    const el = keyframes(t, [[0, 0.1], [B('what') + 1, 0.3], [B('mass'), 0.42], [B('spin'), 0.3], [B('beam') + 0.5, 0.92], [B('outro') + 1, 0.5]]);
    const az = 0.4 + t * 0.12 + 0.9 * phase(t, B('what'), B('what') + 1.2);
    camera.position.set(dist * Math.cos(el) * Math.sin(az), dist * Math.sin(el), dist * Math.cos(el) * Math.cos(az));
    camera.lookAt(0, -0.35, 0);

    // Supernova
    const ts = t - boom;
    const flash = ts > 0 ? Math.exp(-ts * 2.2) : 0;
    const sw = clamp01(ts / 3);
    s.shock.visible = ts > 0 && ts < 3;
    s.shock.scale.setScalar(1.2 + ease.outCubic(sw) * 26);
    s.shockMat.uniforms.uI.value = (1 - sw) ** 2 * 2.5;

    // Efeito farol
    s.spin.updateMatrixWorld();
    s.mag.getWorldQuaternion(s.q);
    const axis = s.tmp.set(0, 1, 0).applyQuaternion(s.q);
    const facing = Math.abs(axis.dot(camera.position.clone().normalize()));
    const beacon = smoothstep(0.86, 0.99, facing) * on;

    s.glow.scale.setScalar(4 + flash * 26 + beacon * 3);
    s.glow.material.color.set('#6aa8ff').multiplyScalar(0.45 + flash * 1.6 + beacon * 0.6);
    bloom.strength = 0.75 + flash * 1.0 + beacon * 0.35;
  },
};
