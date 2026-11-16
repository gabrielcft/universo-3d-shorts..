import { runShort } from './engine.js';

const id = new URLSearchParams(location.search).get('s');
if (!id) {
  location.href = 'index.html';
} else {
  const mod = await import(`../shorts/${id}.js`);
  await runShort({ id, ...mod.default });
}
