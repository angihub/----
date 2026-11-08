import { CATALOG } from './nodeCatalog.js';

const f = (x) => { const s = String(+x); return /[.e]/.test(s) ? s : s + '.0'; };
const hex = (h) => { const n = parseInt(h.slice(1), 16); return `vec3(${[16, 8, 0].map((s) => f(((n >> s) & 255) / 255)).join(',')})`; };
const lit = (v) => (typeof v === 'string' ? hex(v) : Array.isArray(v) ? `vec3(${v.map(f).join(',')})` : `vec3(${f(v)})`);
const MIX = { MIX: 0, MULTIPLY: 1, ADD: 2, OVERLAY: 3, SCREEN: 4, SUBTRACT: 5, DARKEN: 6, LIGHTEN: 7, DIFFERENCE: 8, SOFT_LIGHT: 9, LINEAR_LIGHT: 10, DIVIDE: 11 };
const MATH = {
  ADD: (x, y) => `${x}+${y}`, SUBTRACT: (x, y) => `${x}-${y}`, MULTIPLY: (x, y) => `${x}*${y}`,
  DIVIDE: (x, y) => `${x}/max(abs(${y}),1e-5)`, POWER: (x, y) => `pow(max(${x},0.),${y})`,
  FLOOR: (x) => `floor(${x})`, FRACT: (x) => `fract(${x})`, SQRT: (x) => `sqrt(max(${x},0.))`, COSINE: (x) => `cos(${x})`, ROUND: (x) => `floor(${x}+.5)`,
  SINE: (x) => `sin(${x})`, ABSOLUTE: (x) => `abs(${x})`, MINIMUM: (x, y) => `min(${x},${y})`,
  MAXIMUM: (x, y) => `max(${x},${y})`, GREATER_THAN: (x, y) => `step(${y},${x})`, LESS_THAN: (x, y) => `step(${x},${y})`,
};

const GLSL = `
float h31(vec3 p){p=fract(p*.1031);p+=dot(p,p.zyx+31.32);return fract((p.x+p.y)*p.z);}
float vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
            mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}
float nz(vec3 p,float d,float r,float l,float ds){
 if(ds>0.)p+=ds*(vec3(vn(p+7.1),vn(p+13.7),vn(p+3.3))*2.-1.);
 float s=0.,a=1.,t=0.;
 for(int i=0;i<16;i++){if(float(i)>d)break;s+=a*vn(p);t+=a;a*=r;p*=l;}
 return clamp((s/t-.5)*1.7+.5,0.,1.);}
vec3 vor(vec3 p,float rnd){vec3 i=floor(p),f=fract(p);float d1=8.,d2=8.,id=0.;
 for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){
  vec3 g=vec3(float(x),float(y),float(z));
  vec3 o=vec3(h31(i+g),h31(i+g+17.),h31(i+g+41.))*rnd+(1.-rnd)*.5;
  float d=length(g+o-f);
  if(d<d1){d2=d1;d1=d;id=h31(i+g+3.);}else if(d<d2)d2=d;}
 return vec3(d1,d2-d1,id);}
vec3 mixb(vec3 a,vec3 b,float f,int m){vec3 r=b;
 if(m==1)r=a*b;else if(m==2)r=a+b;else if(m==3)r=mix(2.*a*b,1.-2.*(1.-a)*(1.-b),step(.5,a));
 else if(m==4)r=1.-(1.-a)*(1.-b);else if(m==5)r=a-b;else if(m==6)r=min(a,b);else if(m==7)r=max(a,b);
 else if(m==8)r=abs(a-b);else if(m==9)r=2.*a*b+a*a*(1.-2.*b);else if(m==10)r=a+2.*b-1.;else if(m==11)r=a/max(b,vec3(.001));
 return mix(a,r,f);}
vec2 brickf(vec2 p,float bw,float rh,float ms){float row=floor(p.y/rh);float x=p.x+mod(row,2.)*.5*bw;float col=floor(x/bw);
 vec2 f=vec2(x-col*bw,p.y-row*rh);return vec2(1.-step(ms,f.x)*step(ms,f.y),h31(vec3(col,row,3.)));}
float mr(float x,float a,float b,float c,float d,float cl){float t=(x-a)/(abs(b-a)<1e-5?1e-5:(b-a));float r=c+t*(d-c);return cl>.5?clamp(r,min(c,d),max(c,d)):r;}
vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
 float d=q.x-min(q.w,q.y);float e=1e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
vec3 hsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(1.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}
vec3 hsvm(vec3 c,float h,float s,float v,float f){vec3 x=rgb2hsv(c);x.x=fract(x.x+h-.5);x.y=clamp(x.y*s,0.,1.);x.z*=v;return mix(c,hsv2rgb(x),f);}
`;

// Граф -> фрагментный шейдер. uMode: 0 base color, 1 roughness, 2 metallic, 3 height, 4 emission
export function compileGraph(g) {
  const byId = Object.fromEntries(g.nodes.map((n) => [n.id, n]));
  const link = {}, used = new Set();
  g.links.forEach((l) => { link[l.to] = l.from; used.add(l.from); });
  const vn = (id, k) => `v_${id}_${k.replace(/\W/g, '')}`;
  const lines = [], done = new Set();

  const inp = (n, k) => {
    const s = link[`${n.id}.${k}`];
    if (s) { const i = s.indexOf('.'); emit(byId[s.slice(0, i)]); return vn(s.slice(0, i), s.slice(i + 1)); }
    const d = n.inputs?.[k] ?? CATALOG[n.type].in.find((e) => e[0] === k)[1];
    return d == null ? 'P' : lit(d);
  };
  function emit(n) {
    if (done.has(n.id)) return; done.add(n.id);
    const I = (k) => inp(n, k), p = n.props || {}, o = (k) => vn(n.id, k);
    const def = (k, e) => lines.push(`vec3 ${o(k)} = ${e};`);
    const want = (k) => used.has(`${n.id}.${k}`);
    switch (n.type) {
      case 'TexCoord': def('Generated', 'P'); def('Object', 'P'); def('UV', 'vec3(vUv,0.)'); break;
      case 'Mapping': def('Vector', `${I('Vector')}*${I('Scale')}+${I('Location')}`); break;
      case 'NoiseTexture': {
        const v = I('Vector'), S = I('Scale') + '.x';
        const a = [I('Detail'), I('Roughness'), I('Lacunarity'), I('Distortion')].map((x) => x + '.x').join(',');
        const q = (s) => `nz(${v}*${S}${s},${a})`;
        def('Fac', `vec3(${q('')})`);
        if (want('Color')) def('Color', `vec3(${q('')},${q('+vec3(17.3)')},${q('+vec3(41.7)')})`);
        break;
      }
      case 'VoronoiTexture': {
        const c = `c_${n.id}`;
        lines.push(`vec3 ${c} = vor(${I('Vector')}*${I('Scale')}.x, ${I('Randomness')}.x);`);
        def('Distance', p.feature === 'EDGE' ? `vec3(clamp(${c}.y*2.,0.,1.))` : p.feature === 'F2' ? `vec3(${c}.x+${c}.y)` : `vec3(${c}.x)`);
        def('Color', `vec3(${c}.z,fract(${c}.z*7.3),fract(${c}.z*13.7))`);
        break;
      }
      case 'ColorRamp': {
        const t = I('Fac') + '.x', st = [...p.stops].sort((a, b) => a[0] - b[0]);
        let e = lit(st[0][1]);
        for (let i = 1; i < st.length; i++)
          e = `mix(${e},${lit(st[i][1])},clamp((${t}-(${f(st[i - 1][0])}))/${f(Math.max(st[i][0] - st[i - 1][0], 1e-4))},0.,1.))`;
        def('Color', e); def('Alpha', 'vec3(1.0)');
        break;
      }
      case 'Mix': def('Result', `mixb(${I('A')},${I('B')},clamp(${I('Factor')}.x,0.,1.),${MIX[p.blend] ?? 0})`); break;
      case 'Math': {
        const e = (MATH[p.op] || MATH.ADD)(I('Value') + '.x', I('Value_001') + '.x');
        def('Value', `vec3(${p.clamp ? `clamp(${e},0.,1.)` : e})`);
        break;
      }
      case 'WaveTexture': {
        const pp = `(${I('Vector')}*${I('Scale')}.x)`;
        const base = p.type === 'RINGS'
          ? (p.dir === 'SPHERICAL' ? `length(${pp})` : p.dir === 'X' ? `length(${pp}.yz)` : p.dir === 'Y' ? `length(${pp}.xz)` : `length(${pp}.xy)`)
          : (p.dir === 'Y' ? `${pp}.y` : p.dir === 'Z' ? `${pp}.z` : p.dir === 'DIAGONAL' ? `((${pp}.x+${pp}.y+${pp}.z)*.5)` : `${pp}.x`);
        const nn = `(${base}*20.+${I('Phase Offset')}.x+${I('Distortion')}.x*(nz(${pp}*${I('Detail Scale')}.x,${I('Detail')}.x,${I('Detail Roughness')}.x,2.,0.)*2.-1.))`;
        const prof = p.profile === 'SAW' ? `fract(${nn}/6.2831853)` : p.profile === 'TRI' ? `abs(fract(${nn}/6.2831853+.5)*2.-1.)` : `.5+.5*sin(${nn}-1.5707963)`;
        def('Fac', `vec3(${prof})`); def('Color', o('Fac')); break;
      }
      case 'GradientTexture': {
        const v = I('Vector');
        const e = { QUADRATIC: `pow(max(${v}.x,0.),2.)`, DIAGONAL: `(${v}.x+${v}.y)*.5`, SPHERICAL: `max(1.-length(${v}),0.)` }[p.type] || `${v}.x`;
        def('Fac', `vec3(clamp(${e},0.,1.))`); def('Color', o('Fac')); break;
      }
      case 'CheckerTexture': {
        const q = `floor(${I('Vector')}*${I('Scale')}.x)`;
        def('Fac', `vec3(mod(${q}.x+${q}.y+${q}.z,2.))`);
        def('Color', `mix(${I('Color2')},${I('Color1')},${o('Fac')}.x)`); break;
      }
      case 'BrickTexture': {
        const c = `b_${n.id}`;
        lines.push(`vec2 ${c} = brickf((${I('Vector')}*${I('Scale')}.x).xy, ${I('Brick Width')}.x, ${I('Row Height')}.x, ${I('Mortar Size')}.x);`);
        def('Fac', `vec3(${c}.x)`);
        def('Color', `mix(mix(${I('Color1')},${I('Color2')},${c}.y),${I('Mortar')},${c}.x)`); break;
      }
      case 'WhiteNoise': {
        const v = I('Vector');
        def('Value', `vec3(h31(${v}*517.3))`); def('Color', `vec3(h31(${v}*517.3),h31(${v}*313.7+5.),h31(${v}*731.1+9.))`); break;
      }
      case 'MapRange':
        def('Result', `vec3(mr(${I('Value')}.x,${I('From Min')}.x,${I('From Max')}.x,${I('To Min')}.x,${I('To Max')}.x,${p.clamp ? '1.' : '0.'}))`); break;
      case 'Clamp': {
        const a = I('Min') + '.x', b = I('Max') + '.x';
        def('Result', `vec3(clamp(${I('Value')}.x,min(${a},${b}),max(${a},${b})))`); break;
      }
      case 'HueSaturation': def('Color', `hsvm(${I('Color')},${I('Hue')}.x,${I('Saturation')}.x,${I('Value')}.x,clamp(${I('Fac')}.x,0.,1.))`); break;
      case 'BrightContrast': {
        const ct = I('Contrast') + '.x';
        def('Color', `max(${I('Color')}*(1.+${ct})+(${I('Bright')}.x-${ct}*.5),0.)`); break;
      }
      case 'Invert': { const c = I('Color'); def('Color', `mix(${c},1.-${c},clamp(${I('Fac')}.x,0.,1.))`); break; }
      case 'Bump': def('Normal', 'vec3(0.)'); break;
    }
  }

  const pr = g.nodes.find((n) => n.type === 'PrincipledBSDF');
  const base = inp(pr, 'Base Color'), ro = inp(pr, 'Roughness'), me = inp(pr, 'Metallic');
  const em = inp(pr, 'Emission Color'), es = inp(pr, 'Emission Strength');
  let hh = '0.5';
  const ns = link[`${pr.id}.Normal`];
  if (ns) { const b = byId[ns.split('.')[0]]; if (b?.type === 'Bump') hh = inp(b, 'Height') + '.x'; }

  const frag = `varying vec2 vUv; uniform int uMode;
${GLSL}
void main(){
 float a=vUv.x*6.2831853; vec3 P=vec3(cos(a),sin(a),0.)*0.159155+vec3(0.,0.,vUv.y);
 ${lines.join('\n ')}
 vec3 r = uMode==0?${base}:uMode==1?vec3(${ro}.x):uMode==2?vec3(${me}.x):uMode==3?vec3(clamp(${hh},0.,1.)):${em}*${es}.x;
 gl_FragColor=vec4(clamp(r,0.,1.),1.);
}`;
  return { frag };
}