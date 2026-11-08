// Реальные ноды Blender: bl = bl_idname, in = [имя сокета, значение по умолчанию, ключ в bpy (если не имя)]
const V3 = [0, 0, 0];
export const CATALOG = {
  TexCoord: { bl: 'ShaderNodeTexCoord', label: 'Texture Coordinate', in: [], out: ['Generated', 'Object', 'UV'] },
  Mapping: { bl: 'ShaderNodeMapping', label: 'Mapping', in: [['Vector', null], ['Location', V3], ['Scale', [1, 1, 1]]], out: ['Vector'] },
  NoiseTexture: { bl: 'ShaderNodeTexNoise', label: 'Noise Texture', in: [['Vector', null], ['Scale', 5], ['Detail', 2], ['Roughness', 0.5], ['Lacunarity', 2], ['Distortion', 0]], out: ['Fac', 'Color'] },
  VoronoiTexture: { bl: 'ShaderNodeTexVoronoi', label: 'Voronoi Texture', in: [['Vector', null], ['Scale', 5], ['Randomness', 1]], out: ['Distance', 'Color'], props: { feature: 'F1' } },
  ColorRamp: { bl: 'ShaderNodeValToRGB', label: 'Color Ramp', in: [['Fac', 0.5]], out: ['Color', 'Alpha'], props: { stops: [[0, '#000000'], [1, '#ffffff']] } },
  Mix: { bl: 'ShaderNodeMix', label: 'Mix (Color)', in: [['Factor', 0.5, 0], ['A', '#808080', 6], ['B', '#808080', 7]], out: ['Result'], props: { blend: 'MIX' } },
  Math: { bl: 'ShaderNodeMath', label: 'Math', in: [['Value', 0.5, 0], ['Value_001', 0.5, 1]], out: ['Value'], props: { op: 'ADD', clamp: false } },
  Bump: { bl: 'ShaderNodeBump', label: 'Bump', in: [['Strength', 1], ['Distance', 1], ['Height', 0]], out: ['Normal'] },
  PrincipledBSDF: { bl: 'ShaderNodeBsdfPrincipled', label: 'Principled BSDF', in: [['Base Color', '#808080'], ['Metallic', 0], ['Roughness', 0.5], ['Emission Color', '#000000'], ['Emission Strength', 0], ['Normal', null]], out: ['BSDF'] },
  WaveTexture: { bl: 'ShaderNodeTexWave', label: 'Wave Texture', in: [['Vector', null], ['Scale', 5], ['Distortion', 0], ['Detail', 2], ['Detail Scale', 1], ['Detail Roughness', 0.5], ['Phase Offset', 0]], out: ['Color', 'Fac'], props: { type: 'BANDS', dir: 'X', profile: 'SIN' } },
  GradientTexture: { bl: 'ShaderNodeTexGradient', label: 'Gradient Texture', in: [['Vector', null]], out: ['Color', 'Fac'], props: { type: 'LINEAR' } },
  CheckerTexture: { bl: 'ShaderNodeTexChecker', label: 'Checker Texture', in: [['Vector', null], ['Color1', '#cccccc'], ['Color2', '#333333'], ['Scale', 5]], out: ['Color', 'Fac'] },
  BrickTexture: { bl: 'ShaderNodeTexBrick', label: 'Brick Texture', in: [['Vector', null], ['Color1', '#8b3a2a'], ['Color2', '#a85a3c'], ['Mortar', '#9a9a9a'], ['Scale', 5], ['Mortar Size', 0.02], ['Brick Width', 0.5], ['Row Height', 0.25]], out: ['Color', 'Fac'] },
  WhiteNoise: { bl: 'ShaderNodeTexWhiteNoise', label: 'White Noise', in: [['Vector', null]], out: ['Value', 'Color'] },
  MapRange: { bl: 'ShaderNodeMapRange', label: 'Map Range', in: [['Value', 0.5], ['From Min', 0], ['From Max', 1], ['To Min', 0], ['To Max', 1]], out: ['Result'], props: { clamp: true } },
  Clamp: { bl: 'ShaderNodeClamp', label: 'Clamp', in: [['Value', 0.5], ['Min', 0], ['Max', 1]], out: ['Result'] },
  HueSaturation: { bl: 'ShaderNodeHueSaturation', label: 'Hue/Saturation/Value', in: [['Hue', 0.5], ['Saturation', 1], ['Value', 1], ['Fac', 1], ['Color', '#808080']], out: ['Color'] },
  BrightContrast: { bl: 'ShaderNodeBrightContrast', label: 'Brightness/Contrast', in: [['Color', '#808080'], ['Bright', 0], ['Contrast', 0]], out: ['Color'] },
  Invert: { bl: 'ShaderNodeInvert', label: 'Invert', in: [['Fac', 1], ['Color', '#000000']], out: ['Color'] },
  MaterialOutput: { bl: 'ShaderNodeOutputMaterial', label: 'Material Output', in: [['Surface', null]], out: [] },
};
export const socketsOf = (t) => ({ ins: CATALOG[t].in.map((e) => e[0]), outs: CATALOG[t].out });

// Раскладка слева направо по глубине графа (общая для редактора и экспорта)
export const HEAD = 26, ROW = 20, W = 190;
export function layoutGraph(g) {
  const incoming = {}, depth = {};
  g.links.forEach((l) => { const a = l.from.split('.')[0], b = l.to.split('.')[0]; (incoming[b] ||= []).push(a); });
  const d = (id) => { if (depth[id] !== undefined) return depth[id]; depth[id] = 0; return (depth[id] = Math.max(-1, ...(incoming[id] || []).map(d)) + 1); };
  const cols = {}, pos = {}; let H = 0;
  g.nodes.forEach((n) => (cols[d(n.id)] ||= []).push(n));
  Object.entries(cols).forEach(([c, ns]) => {
    let y = 10;
    ns.forEach((n) => {
      const s = socketsOf(n.type), h = HEAD + (s.ins.length + s.outs.length + (CATALOG[n.type].props ? 1 : 0)) * ROW + 8;
      pos[n.id] = { x: 10 + c * (W + 60), y, h }; y += h + 14;
    });
    H = Math.max(H, y);
  });
  return { pos, W, w: 20 + Object.keys(cols).length * (W + 60), h: H };
}

// Белый список значений свойств (всё, что не из списка, заменяется на значение по умолчанию)
export const ENUMS = {
  VoronoiTexture: { feature: ['F1', 'F2', 'EDGE'] },
  Mix: { blend: ['MIX', 'MULTIPLY', 'ADD', 'OVERLAY', 'SCREEN', 'SUBTRACT', 'DARKEN', 'LIGHTEN', 'DIFFERENCE', 'SOFT_LIGHT', 'LINEAR_LIGHT', 'DIVIDE'] },
  Math: { op: ['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE', 'POWER', 'SINE', 'COSINE', 'ABSOLUTE', 'MINIMUM', 'MAXIMUM', 'GREATER_THAN', 'LESS_THAN', 'FLOOR', 'FRACT', 'SQRT', 'ROUND'] },
  WaveTexture: { type: ['BANDS', 'RINGS'], dir: ['X', 'Y', 'Z', 'DIAGONAL', 'SPHERICAL'], profile: ['SIN', 'SAW', 'TRI'] },
  GradientTexture: { type: ['LINEAR', 'QUADRATIC', 'DIAGONAL', 'SPHERICAL'] },
};