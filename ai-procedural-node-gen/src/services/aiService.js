import { CATALOG, ENUMS, socketsOf } from './nodeCatalog.js';

// Ключ и модель — в .env (VITE_OPENROUTER_KEY, VITE_AI_MODEL). НЕ хардкодь ключ в коде.
const env = import.meta.env || {};
// убираем случайные пробелы и кавычки, которые часто попадают при копировании ключа
const clean = (v) => String(v || '').trim().replace(/^["']+|["']+$/g, '').trim();
const KEY = clean(env.VITE_OPENROUTER_KEY);
// список моделей через запятую (до 3): если первая недоступна, OpenRouter пробует следующую
const MODELS = (clean(env.VITE_AI_MODEL) || 'google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-ultra-550b-a55b:free,cohere/north-mini-code:free').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3);

const catalogText = Object.entries(CATALOG).map(([t]) => {
  const s = socketsOf(t); return `${t}: inputs [${s.ins.join(', ')}] outputs [${s.outs.join(', ')}]`;
}).join('\n');

const propDoc = Object.entries(ENUMS).map(([t, e]) => `  ${t}: ${Object.entries(e).map(([k, v]) => `${k}=${v.join('|')}`).join('; ')}`).join('\n');

const SYSTEM = `You are a senior Technical Artist. Convert the user's material description into a Blender Shader Editor node graph.
The description may be short, misspelled or Russian ("сини1" = blue). Infer the most plausible material and ALWAYS respect explicit colors/materials. Never return an unrelated material.
Use ONLY these node types and EXACT socket names:
${catalogText}
Return ONLY JSON: {"materialName":"..","nodes":[{"id":"n1","type":"..","inputs":{"Scale":5},"props":{}}],"links":[{"from":"n1.Fac","to":"n2.Fac"}]}
- inputs: numbers, "#rrggbb" for colors, [x,y,z] for Mapping Location/Scale. Set only sockets that are NOT linked.
- props (allowed values):\n${propDoc}\n  ColorRamp: {"stops":[[pos,"#hex"],...]} 2-6 stops; Math: {"clamp":bool}; MapRange: {"clamp":bool}
- Wave Texture (BANDS/RINGS, Distortion>0 + Detail) = wood grain, marble veins, stripes. Brick/Checker/Gradient Textures need TexCoord.UV (not Generated) -> Mapping as Vector. HueSaturation/BrightContrast/Invert/MapRange/Clamp refine colors and masks.
- Structure (12-20 nodes): TexCoord.Generated -> Mapping.Vector -> Vector of every texture. Large noise for color zones, fine noise for grain, Voronoi EDGE for cracks/veins ONLY if the material really has them (stone, lava, dry earth, marble) — smooth or soft materials must have NO cracks or cell lines, multi-tone ColorRamps (3-5 real-world colors), Mix OVERLAY/MULTIPLY to combine, a separate ColorRamp for Roughness, Math/Mix -> Bump.Height, Bump.Normal -> PrincipledBSDF.Normal. Use Emission only for glowing materials.
- Finish with PrincipledBSDF.BSDF -> MaterialOutput.Surface. Use physical values (metals Metallic≈1, stone/wood/plastic 0).`;

const HEX = /^#[0-9a-f]{6}$/i;
const cid = (s) => String(s).replace(/\W/g, '_');

// Проверка и починка ответа ИИ: только реальные ноды и сокеты
export function sanitize(g) {
  if (!g || !Array.isArray(g.nodes) || !Array.isArray(g.links)) return null;
  const nodes = [], ids = new Set();
  for (const n of g.nodes) {
    const c = CATALOG[n?.type], id = cid(n?.id);
    if (!c || ids.has(id)) continue; ids.add(id);
    const inputs = {};
    for (const [k, v] of Object.entries(n.inputs || {})) {
      const def = c.in.find((e) => e[0] === k)?.[1];
      if (def === undefined || def === null) continue;
      if (typeof def === 'number' && Number.isFinite(+v)) inputs[k] = +v;
      else if (typeof def === 'string' && HEX.test(v)) inputs[k] = v;
      else if (Array.isArray(def) && Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) inputs[k] = v;
    }
    const props = {};
    for (const k of Object.keys(c.props || {})) {
      let v = n.props?.[k] ?? c.props[k];
      const list = ENUMS[n.type]?.[k];
      if (list && !list.includes(v)) v = c.props[k];
      if (typeof c.props[k] === 'boolean') v = !!v;
      props[k] = v;
    }
    if (n.type === 'WaveTexture') {
      if (props.type === 'BANDS' && props.dir === 'SPHERICAL') props.dir = 'X';
      if (props.type === 'RINGS' && props.dir === 'DIAGONAL') props.dir = 'SPHERICAL';
    }
    if (n.type === 'ColorRamp') {
      props.stops = (Array.isArray(props.stops) ? props.stops : []).filter((s) => Array.isArray(s) && Number.isFinite(+s[0]) && HEX.test(s[1])).map((s) => [+s[0], s[1]]);
      if (props.stops.length < 2) props.stops = c.props.stops;
    }
    nodes.push({ id, type: n.type, inputs, props });
  }
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links = [], taken = new Set();
  for (const l of g.links) {
    const [a, ak] = String(l?.from).split(/\.(.+)/), [b, bk] = String(l?.to).split(/\.(.+)/);
    const A = by[cid(a)], B = by[cid(b)];
    if (!A || !B || !socketsOf(A.type).outs.includes(ak) || !socketsOf(B.type).ins.includes(bk) || taken.has(`${B.id}.${bk}`)) continue;
    taken.add(`${B.id}.${bk}`); links.push({ from: `${A.id}.${ak}`, to: `${B.id}.${bk}` });
  }
  const pr = nodes.find((n) => n.type === 'PrincipledBSDF');
  if (!pr || nodes.length < 4) return null;
  if (!nodes.some((n) => n.type === 'MaterialOutput')) {
    nodes.push({ id: 'out', type: 'MaterialOutput', inputs: {}, props: {} }); links.push({ from: `${pr.id}.BSDF`, to: 'out.Surface' });
  }
  return { materialName: String(g.materialName || 'AI Material'), nodes, links };
}

export async function generateNodesFromPrompt(userPrompt) {
  let aiError = '';
  { // без ключа в браузере запрос идёт через серверный прокси /api/generate
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(KEY ? 'https://openrouter.ai/api/v1/chat/completions' : '/api/generate', {
          method: 'POST',
          headers: KEY ? { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', 'HTTP-Referer': window.location.origin, 'X-Title': 'AI NodeGen Studio' } : { 'Content-Type': 'application/json' },
          // не все модели понимают response_format, поэтому вторая попытка идёт без него
          body: JSON.stringify({ ...(MODELS.length > 1 ? { models: MODELS } : { model: MODELS[0] }), temperature: 0.4, ...(attempt === 0 ? { response_format: { type: 'json_object' } } : {}),
            messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: userPrompt }] }),
        });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          aiError = `${r.status}: ${data?.error?.message || r.statusText}`;
          console.warn('OpenRouter:', aiError, data);
          if ([401, 402, 403, 404, 405, 429, 500].includes(r.status)) break; // повтор не поможет: ключ, оплата, лимит
          continue;
        }
        const text = data.choices?.[0]?.message?.content || '';
        const g = sanitize(JSON.parse(text.match(/\{[\s\S]*\}/)?.[0]));
        if (g) return { ...g, source: 'ai' };
        aiError = 'модель вернула граф, не прошедший проверку';
      } catch (e) { aiError = String(e.message || e); console.warn('Ошибка LLM:', e); }
    }
  }
  return { ...fallbackGraph(userPrompt), source: 'preset', aiError };
}

// ---------- Локальный запасной генератор: нормальный граф, цвета по ключевым основам слов ----------
const PAL = [
  [/син|голуб|лазур|blue|lapis|cyan/, ['#081a4a', '#1d4fd7', '#7fb2ff'], { r: [0.25, 0.5] }],
  [/красн|рубин|red|кров/, ['#2a0508', '#a0121c', '#e5535a'], { r: [0.3, 0.6] }],
  [/зел|изумруд|green|малахит/, ['#04210f', '#14803c', '#6fdc9a'], { r: [0.2, 0.5] }],
  [/золот|gold|латун|brass/, ['#6b4a06', '#d6a420', '#fff0a0'], { r: [0.12, 0.35], m: 1 }],
  [/ржав|rust/, ['#2b1408', '#9a3d12', '#d7893f'], { r: [0.6, 0.95], m: 0.5, cracks: 0.5 }],
  [/серебр|silver|хром|chrome|сталь|steel|металл/, ['#4a4d52', '#a8adb4', '#f2f4f7'], { r: [0.15, 0.4], m: 1 }],
  [/лав|магм|lava|magma/, ['#120806', '#2b1510', '#4a2a20'], { r: [0.7, 0.95], emis: 12, cracks: 1, lava: 1 }],
  [/мрамор|marble|бел/, ['#bdbdc4', '#ececf0', '#ffffff'], { r: [0.1, 0.3], cracks: 0.25 }],
  [/дерев|wood|доск/, ['#3b2110', '#7a4a24', '#b98550'], { r: [0.5, 0.8], wood: 1 }],
  [/черн|black|уголь|базальт/, ['#050507', '#16161c', '#3a3a44'], { r: [0.4, 0.8] }],
  [/камен|stone|rock|скал|гранит/, ['#2b2b2f', '#6b6b73', '#b4b4bc'], { r: [0.6, 0.9], cracks: 0.35 }],
];
const gray = (v) => '#' + Math.round(v * 255).toString(16).padStart(2, '0').repeat(3);

export function fallbackGraph(prompt) {
  const t = prompt.toLowerCase();
  if (/кирпич|brick|кладк/.test(t)) return brickGraph(prompt);
  const [, cols, o] = PAL.find(([re]) => re.test(t)) || [0, ['#2b2b2f', '#6b6b73', '#b4b4bc'], {}];
  const { r = [0.5, 0.85], m = 0, cracks = 0, emis = 0, wood = 0 } = o, s = 4;
  const nodes = [], links = [];
  const add = (id, type, inputs = {}, props = {}) => nodes.push({ id, type, inputs, props });
  const ln = (a, b) => links.push({ from: a, to: b });
  add('tc', 'TexCoord'); add('map', 'Mapping'); ln('tc.Generated', 'map.Vector');
  add('big', 'NoiseTexture', { Scale: s * 0.6, Detail: 6, Roughness: 0.55, Distortion: 0.7 });
  add('fine', 'NoiseTexture', { Scale: s * 5, Detail: 10, Roughness: 0.65 });
  const hasV = cracks > 0 || emis > 0; // ячейки Voronoi (линии-«грани») только если материал реально с трещинами
  if (hasV) add('vor', 'VoronoiTexture', { Scale: s * 1.2, Randomness: 1 }, { feature: 'EDGE' });
  ['big', 'fine', ...(hasV ? ['vor'] : [])].forEach((id) => ln('map.Vector', `${id}.Vector`));
  add('ramp', 'ColorRamp', {}, { stops: [[0.25, cols[0]], [0.55, cols[1]], [0.85, cols[2]]] }); ln(wood ? 'wave.Fac' : 'big.Fac', 'ramp.Fac');
  if (wood) { add('wave', 'WaveTexture', { Scale: 5, Distortion: 7, Detail: 3 }, { type: 'BANDS', dir: 'Z' }); ln('map.Vector', 'wave.Vector'); }
  add('grain', 'Mix', { Factor: 0.4 }, { blend: 'OVERLAY' }); ln('ramp.Color', 'grain.A'); ln('fine.Color', 'grain.B');
  if (cracks > 0) {
    add('crk', 'ColorRamp', {}, { stops: [[0, '#101010'], [0.12, '#ffffff']] }); ln('vor.Distance', 'crk.Fac');
    add('tint', 'Mix', { Factor: cracks }, { blend: 'MULTIPLY' }); ln('grain.Result', 'tint.A'); ln('crk.Color', 'tint.B');
  }
  add('rr', 'ColorRamp', {}, { stops: [[0, gray(r[0])], [1, gray(r[1])]] }); ln('fine.Fac', 'rr.Fac');
  add('hgt', 'Math', cracks > 0 ? {} : { Value_001: 1 }, { op: 'MULTIPLY' }); ln('fine.Fac', 'hgt.Value'); if (cracks > 0) ln('crk.Color', 'hgt.Value_001');
  add('bump', 'Bump', { Strength: 0.6 }); ln('hgt.Value', 'bump.Height');
  add('bsdf', 'PrincipledBSDF', { Metallic: m }); ln(cracks > 0 ? 'tint.Result' : 'grain.Result', 'bsdf.Base Color'); ln('rr.Color', 'bsdf.Roughness'); ln('bump.Normal', 'bsdf.Normal');
  if (emis) {
    add('glow', 'ColorRamp', {}, { stops: [[0, '#ff7a1a'], [0.18, '#000000']] }); ln('vor.Distance', 'glow.Fac');
    ln('glow.Color', 'bsdf.Emission Color'); nodes.find((n) => n.id === 'bsdf').inputs['Emission Strength'] = emis;
  }
  add('out', 'MaterialOutput'); ln('bsdf.BSDF', 'out.Surface');
  return sanitize({ materialName: prompt, nodes, links });
}

function brickGraph(prompt) {
  const nodes = [], links = [];
  const add = (id, type, inputs = {}, props = {}) => nodes.push({ id, type, inputs, props });
  const ln = (a, b) => links.push({ from: a, to: b });
  add('tc', 'TexCoord'); add('map', 'Mapping'); ln('tc.UV', 'map.Vector');
  add('brick', 'BrickTexture', { Scale: 4, 'Mortar Size': 0.03 }); ln('map.Vector', 'brick.Vector');
  add('fine', 'NoiseTexture', { Scale: 30, Detail: 8, Roughness: 0.6 }); ln('tc.Generated', 'fine.Vector');
  add('grime', 'Mix', { Factor: 0.45 }, { blend: 'OVERLAY' }); ln('brick.Color', 'grime.A'); ln('fine.Color', 'grime.B');
  add('inv', 'Math', { Value: 1 }, { op: 'SUBTRACT' }); ln('brick.Fac', 'inv.Value_001');
  add('h', 'Math', {}, { op: 'MULTIPLY' }); ln('inv.Value', 'h.Value'); ln('fine.Fac', 'h.Value_001');
  add('bump', 'Bump', { Strength: 0.8 }); ln('h.Value', 'bump.Height');
  add('bsdf', 'PrincipledBSDF', { Roughness: 0.9 }); ln('grime.Result', 'bsdf.Base Color'); ln('bump.Normal', 'bsdf.Normal');
  add('out', 'MaterialOutput'); ln('bsdf.BSDF', 'out.Surface');
  return sanitize({ materialName: prompt, nodes, links });
}
