import { CATALOG, layoutGraph } from './nodeCatalog.js';

const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const col = (h) => { const n = parseInt(h.slice(1), 16); return `(${[16, 8, 0].map((s) => lin(((n >> s) & 255) / 255).toFixed(5)).join(', ')}, 1.0)`; };
const val = (v) => (typeof v === 'string' ? col(v) : Array.isArray(v) ? `(${v.join(', ')})` : String(v));
const key = (k) => (typeof k === 'number' ? k : JSON.stringify(k));
const safe = (s) => String(s).replace(/[^\wа-яё -]/gi, '').trim() || 'AI_Material';

// Генерирует Python-скрипт, который строит этот же граф нод в Blender (3.4+ / 4.x)
export function buildBlenderScript(g) {
  const { pos } = layoutGraph(g);
  const out = [
    'import bpy', '',
    `mat = bpy.data.materials.new(${JSON.stringify(safe(g.materialName))})`,
    'mat.use_nodes = True', 'nt = mat.node_tree', 'nt.nodes.clear()', 'N = {}', '',
    'def put(n, k, v):', '    try: n.inputs[k].default_value = v', '    except Exception as e: print("skip input", k, e)', '',
  ];
  const linked = new Set(g.links.map((l) => l.to));
  g.nodes.forEach((n) => {
    const c = CATALOG[n.type], p = n.props || {}, v = `N["${n.id}"]`;
    out.push(`${v} = nt.nodes.new("${c.bl}"); ${v}.location = (${pos[n.id].x * 1.6}, ${-pos[n.id].y * 1.6})`);
    if (n.type === 'VoronoiTexture') out.push(`${v}.feature = "${p.feature === 'EDGE' ? 'DISTANCE_TO_EDGE' : p.feature}"`);
    if (n.type === 'Mix') out.push(`${v}.data_type = "RGBA"; ${v}.blend_type = "${p.blend}"`);
    if (n.type === 'Math') out.push(`${v}.operation = "${p.op}"; ${v}.use_clamp = ${p.clamp ? 'True' : 'False'}`);
    if (n.type === 'WaveTexture') out.push(`${v}.wave_type = "${p.type}"; ${v}.${p.type === 'RINGS' ? 'rings_direction' : 'bands_direction'} = "${p.dir}"; ${v}.wave_profile = "${p.profile}"`);
    if (n.type === 'GradientTexture') out.push(`${v}.gradient_type = "${p.type}"`);
    if (n.type === 'MapRange') out.push(`${v}.clamp = ${p.clamp ? 'True' : 'False'}`);
    if (n.type === 'ColorRamp') {
      const st = [...p.stops].sort((a, b) => a[0] - b[0]);
      out.push(`els = ${v}.color_ramp.elements`, `while len(els) < ${st.length}: els.new(0.5)`);
      st.forEach((s, i) => out.push(`els[${i}].position = ${s[0]}; els[${i}].color = ${col(s[1])}`));
    }
    c.in.forEach(([name, def, bk]) => {
      if (linked.has(`${n.id}.${name}`)) return;
      const x = n.inputs?.[name] ?? def;
      if (x != null && n.type !== 'ColorRamp') out.push(`put(${v}, ${key(bk ?? name)}, ${val(x)})`);
    });
  });
  out.push('');
  g.links.forEach((l) => {
    const [a, ak] = [l.from.slice(0, l.from.indexOf('.')), l.from.slice(l.from.indexOf('.') + 1)];
    const [b, bk] = [l.to.slice(0, l.to.indexOf('.')), l.to.slice(l.to.indexOf('.') + 1)];
    const ik = CATALOG[g.nodes.find((n) => n.id === b).type].in.find((e) => e[0] === bk)[2] ?? bk;
    const ok = g.nodes.find((n) => n.id === a).type === 'Mix' ? 2 : ak;
    out.push(`nt.links.new(N["${a}"].outputs[${key(ok)}], N["${b}"].inputs[${key(ik)}])`);
  });
  out.push('', 'obj = bpy.context.active_object',
    'if obj and obj.type == "MESH":', '    obj.data.materials.clear(); obj.data.materials.append(mat)',
    'print("Material created:", mat.name)');
  return out.join('\n');
}

function download(name, data, type) {
  const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
export const exportBlenderScript = (g) => download(`${safe(g.materialName)}_blender.py`, buildBlenderScript(g), 'text/x-python');
export const exportGraphJson = (g) => download(`${safe(g.materialName)}.json`, JSON.stringify(g, null, 2), 'application/json');

export async function downloadMaps(g, size = 2048) {
  const { renderMaps, normalMapCanvas } = await import('./textureGenerator.js');
  const m = renderMaps(g, size); m.normal = normalMapCanvas(m.height);
  const n = safe(g.materialName).replace(/\s+/g, '_');
  for (const k of ['albedo', 'roughness', 'metallic', 'height', 'normal'])
    await new Promise((res) => m[k].toBlob((b) => { download(`${n}_${k}.png`, b); setTimeout(res, 250); }));
}