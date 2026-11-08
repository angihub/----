<script setup>
import { computed } from 'vue'
import { CATALOG, socketsOf, layoutGraph, HEAD, ROW } from '../services/nodeCatalog'

const props = defineProps({ graphData: { type: Object, default: null } })
const lay = computed(() => (props.graphData ? layoutGraph(props.graphData) : null))
const linked = computed(() => new Set((props.graphData?.links || []).map((l) => l.to)))
const sock = (n) => socketsOf(n.type)
const label = (n) => CATALOG[n.type].label

// координаты реального пина (вход слева, выход справа) для кривых связей
const pin = (ref, side) => {
  const i = ref.indexOf('.'), id = ref.slice(0, i), name = ref.slice(i + 1)
  const n = props.graphData.nodes.find((x) => x.id === id), p = lay.value.pos[id], s = sock(n)
  const row = side === 'out' ? s.outs.indexOf(name) : s.outs.length + s.ins.indexOf(name)
  return { x: p.x + (side === 'out' ? lay.value.W : 0), y: p.y + HEAD + row * ROW + ROW / 2 }
}
const paths = computed(() => (props.graphData?.links || []).map((l) => {
  const a = pin(l.from, 'out'), b = pin(l.to, 'in'), d = Math.max(40, (b.x - a.x) / 2)
  return `M${a.x},${a.y} C${a.x + d},${a.y} ${b.x - d},${b.y} ${b.x},${b.y}`
}))

const value = (n, k) => n.inputs?.[k] ?? CATALOG[n.type].in.find((e) => e[0] === k)[1]
const isHex = (v) => typeof v === 'string'
const fmt = (v) => (v == null ? '' : Array.isArray(v) ? v.join(', ') : typeof v === 'number' ? +v.toFixed(3) : v)
const propText = (n) => {
  const p = n.props || {}
  if (n.type === 'ColorRamp') return p.stops.map((s) => s[0]).join(' / ')
  return Object.entries(p).map(([k, v]) => (v === true ? k : v)).filter((v) => v !== false).join(' · ')
}
</script>

<template>
  <div class="graph-editor-wrapper">
    <div class="editor-header">
      <h3>Граф нод (формат Blender Shader Editor)</h3>
      <span class="status-badge" v-if="graphData">{{ graphData.source === 'ai' ? 'ИИ' : 'Локальный пресет (ИИ не ответил)' }} · {{ graphData.nodes.length }} нод · {{ graphData.links.length }} связей</span>
    </div>
    <div v-if="!graphData" class="empty-graph"><p>Нажмите «Сгенерировать материал», чтобы построить граф нод</p></div>
    <div v-else class="canvas">
      <div class="board" :style="{ width: lay.w + 'px', height: lay.h + 'px' }">
        <svg class="wires" :width="lay.w" :height="lay.h"><path v-for="(d, i) in paths" :key="i" :d="d" /></svg>
        <div v-for="n in graphData.nodes" :key="n.id" class="node"
             :style="{ left: lay.pos[n.id].x + 'px', top: lay.pos[n.id].y + 'px', width: lay.W + 'px' }">
          <div class="title">{{ label(n) }}</div>
          <div v-for="o in sock(n).outs" :key="'o' + o" class="row out"><span>{{ o }}</span><i class="pin out-pin" /></div>
          <div v-for="k in sock(n).ins" :key="'i' + k" class="row in">
            <i class="pin" :class="{ on: linked.has(n.id + '.' + k) }" />
            <span>{{ k }}</span>
            <template v-if="!linked.has(n.id + '.' + k)">
              <b v-if="isHex(value(n, k))" class="sw" :style="{ background: value(n, k) }" />
              <em v-else>{{ fmt(value(n, k)) }}</em>
            </template>
          </div>
          <div v-if="propText(n)" class="row prop">{{ propText(n) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.graph-editor-wrapper { background:#0b0f19; border:1px solid #1f2937; border-radius:16px; width:100%; height:100%; display:flex; flex-direction:column; overflow:hidden; }
.editor-header { padding:8px 16px; background:#111827; border-bottom:1px solid #1f2937; display:flex; justify-content:space-between; align-items:center; }
.editor-header h3 { font-size:.85rem; color:#d1d5db; }
.status-badge { font-size:.65rem; background:#065f46; color:#34d399; padding:2px 8px; border-radius:10px; font-weight:600; }
.empty-graph { flex:1; display:flex; align-items:center; justify-content:center; color:#6b7280; font-size:.8rem; }
.canvas { flex:1; overflow:auto; background-image:radial-gradient(#374151 1px, transparent 1px); background-size:20px 20px; }
.board { position:relative; }
.wires { position:absolute; inset:0; pointer-events:none; }
.wires path { fill:none; stroke:#a5b4fc; stroke-width:1.6; opacity:.85; }
.node { position:absolute; background:#1f2937; border:1px solid #4b5563; border-radius:8px; box-shadow:0 8px 14px rgba(0,0,0,.5); font-size:.68rem; }
.node:hover { border-color:#6366f1; }
.title { height:26px; line-height:26px; padding:0 10px; background:#374151; border-radius:7px 7px 0 0; font-weight:600; color:#fff; }
.row { position:relative; height:20px; display:flex; align-items:center; gap:6px; padding:0 10px; color:#cbd5e1; }
.row.out { justify-content:flex-end; }
.row.in em { margin-left:auto; color:#34d399; font-style:normal; font-family:monospace; }
.row.prop { color:#fbbf24; font-family:monospace; }
.sw { margin-left:auto; width:26px; height:11px; border-radius:3px; border:1px solid #0006; }
.pin { position:absolute; top:50%; left:-5px; width:10px; height:10px; margin-top:-5px; border-radius:50%; background:#6b7280; border:2px solid #1f2937; }
.pin.on { background:#a5b4fc; }
.pin.out-pin { left:auto; right:-5px; background:#fbbf24; }
</style>