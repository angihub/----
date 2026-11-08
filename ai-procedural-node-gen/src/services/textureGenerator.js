import * as THREE from 'three';
import { compileGraph } from './graphCompiler.js';

const VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const KEYS = ['albedo', 'roughness', 'metallic', 'height', 'emission'];

// Реально считает граф на GPU и возвращает canvas-карты
export function renderMaps(graph, size = 1024) {
  const { frag } = compileGraph(graph);
  const r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(size, size, false);
  const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: frag, uniforms: { uMode: { value: 0 } } });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); mesh.frustumCulled = false;
  const scene = new THREE.Scene(); scene.add(mesh);
  const cam = new THREE.Camera(), out = {};
  KEYS.forEach((k, i) => {
    mat.uniforms.uMode.value = i; r.render(scene, cam);
    const c = document.createElement('canvas'); c.width = c.height = size;
    c.getContext('2d').drawImage(r.domElement, 0, 0); out[k] = c;
  });
  mat.dispose(); r.dispose(); r.forceContextLoss();
  return out;
}

export function createMaterialMaps(graph, size = 1024) {
  const c = renderMaps(graph, size);
  const T = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  return { albedo: T(c.albedo, 1), roughness: T(c.roughness), metallic: T(c.metallic), height: T(c.height), emission: T(c.emission, 1) };
}

// Normal map (OpenGL, +Y) из height — для экспорта
export function normalMapCanvas(h, s = 4) {
  const w = h.width, d = h.getContext('2d').getImageData(0, 0, w, w).data;
  const o = document.createElement('canvas'); o.width = o.height = w;
  const oc = o.getContext('2d'), im = oc.createImageData(w, w);
  const H = (x, y) => d[(((y + w) % w) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * s, dy = (H(x, y + 1) - H(x, y - 1)) * s, l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    im.data[i] = (-dx / l * 0.5 + 0.5) * 255; im.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; im.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[i + 3] = 255;
  }
  oc.putImageData(im, 0, 0); return o;
}