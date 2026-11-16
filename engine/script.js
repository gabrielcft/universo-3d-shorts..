// Roteiro narrado: tokenização das falas, alinhamento com os tempos da voz
// e divisão das legendas em blocos curtos. Usado no navegador e no Node.

/** Normaliza uma palavra para comparação (sem acento, pontuação ou maiúscula). */
export const norm = (w) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');

/** Texto falado: remove as marcações de destaque. */
export const spoken = (text) => text.replace(/\*/g, '');

/**
 * Quebra a fala em palavras mantendo a pontuação e o destaque:
 * *amarelo*  **ciano**
 */
export function tokenize(text) {
  const out = [];
  let hl = 0;
  let cur = null;
  for (const tok of text.match(/\*\*|\*|\s+|[^\s*]+/g) || []) {
    if (tok === '**') { hl = hl === 2 ? 0 : 2; continue; }
    if (tok === '*') { hl = hl === 1 ? 0 : 1; continue; }
    if (/^\s+$/.test(tok)) { cur = null; continue; }
    if (cur) { cur.w += tok; continue; }
    if (!norm(tok) && out.length) { out[out.length - 1].w += tok; continue; } // pontuação solta
    cur = { w: tok, hl };
    out.push(cur);
  }
  return out;
}

/** Associa cada palavra do roteiro ao tempo em que a voz a pronuncia. */
export function align(tokens, bounds) {
  let j = 0;
  for (const tk of tokens) {
    const key = norm(tk.w);
    for (let k = j; k < Math.min(bounds.length, j + 4); k++) {
      const b = norm(bounds[k].w);
      if (b && (b === key || b.startsWith(key) || key.startsWith(b))) {
        tk.s = bounds[k].s; tk.e = bounds[k].e; j = k + 1;
        break;
      }
    }
  }
  fillGaps(tokens);
  return tokens;
}

/** Estimativa de tempo (usada quando ainda não existe narração gerada). */
export function estimate(tokens, start = 0.1) {
  let t = start;
  for (const tk of tokens) {
    const d = 0.1 + 0.058 * tk.w.length;
    tk.s = t; tk.e = t + d;
    t += d + (/[.,!?…:;]$/.test(tk.w) ? 0.25 : 0.02);
  }
  return tokens;
}

function fillGaps(tokens) {
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].s !== undefined) continue;
    const prev = tokens.slice(0, i).reverse().find((t) => t.s !== undefined);
    const next = tokens.slice(i + 1).find((t) => t.s !== undefined);
    const a = prev ? prev.e : (next ? Math.max(0, next.s - 0.3) : 0.1);
    const b = next ? next.s : a + 0.35;
    tokens[i].s = a; tokens[i].e = Math.max(a + 0.05, b - 0.02);
  }
}

/** Divide as palavras em blocos curtos (estilo Shorts: 1 a 3 palavras). */
export function chunk(words, maxWords = 3, maxChars = 15) {
  const out = [];
  let cur = [], len = 0;
  for (const w of words) {
    if (cur.length && (cur.length >= maxWords || len + w.w.length > maxChars)) { out.push(cur); cur = []; len = 0; }
    cur.push(w);
    len += w.w.length + 1;
    if (/[.,!?…:;]$/.test(w.w)) { out.push(cur); cur = []; len = 0; }
  }
  if (cur.length) out.push(cur);
  return out;
}
