<script setup>
import { ref } from 'vue'
import MaterialViewer from './components/MaterialViewer.vue'
import NodeGraphEditor from './components/NodeGraphEditor.vue'
import { generateNodesFromPrompt } from './services/aiService'
import { exportBlenderScript, exportGraphJson, downloadMaps } from './services/blenderExport'

const prompt = ref('')
const isGenerating = ref(false)
const viewerRef = ref(null)
const currentGraph = ref(null)

const handleGenerate = async () => {
  if (!prompt.value.trim()) return
  isGenerating.value = true
  
  try {
    const graphData = await generateNodesFromPrompt(prompt.value)
    currentGraph.value = graphData

    if (viewerRef.value) {
      viewerRef.value.applyNodeGraph(graphData)
    }
  } catch (error) {
    console.error('Ошибка генерации:', error)
  } finally {
    isGenerating.value = false
  }
}

const setPresetPrompt = (text) => {
  prompt.value = text
  handleGenerate()
}
const exporting = ref(false)
const exportMaps = async () => { exporting.value = true; try { await downloadMaps(currentGraph.value) } finally { exporting.value = false } }
</script>

<template>
  <div class="app-layout">
    <!-- Верхний блок: Панель управления + 3D Визуализатор -->
    <header class="top-section">
      <!-- Панель ввода -->
      <div class="sidebar">
        <div>
          <h1>AI NodeGen Studio</h1>
          <p class="subtitle">Процедурный синтез материалов</p>
        </div>

        <div class="control-group">
          <textarea 
            id="prompt" 
            v-model="prompt" 
            placeholder="Опишите любой материал (например: Вулканическая лава)..."
            rows="3"
          ></textarea>
        </div>

        <div class="presets">
          <span class="preset-label">Быстрые пресеты:</span>
          <div class="preset-tags">
            <button @click="setPresetPrompt('Ржавый металл')">Ржавчина</button>
            <button @click="setPresetPrompt('Полированное золото')">Золото</button>
            <button @click="setPresetPrompt('Белый мрамор')">Мрамор</button>
            <button @click="setPresetPrompt('Зеленый кристалл')">Кристалл</button>
          </div>
        </div>

        <button @click="handleGenerate" :disabled="isGenerating" class="generate-btn">
          <span v-if="isGenerating" class="spinner"></span>
          {{ isGenerating ? 'ИИ компилирует граф нод...' : 'Сгенерировать материал' }}
        </button>

        <div class="export-row">
          <button :disabled="!currentGraph" @click="exportBlenderScript(currentGraph)">Blender (.py)</button>
          <button :disabled="!currentGraph || exporting" @click="exportMaps">{{ exporting ? '...' : 'PBR-карты (PNG)' }}</button>
          <button :disabled="!currentGraph" @click="exportGraphJson(currentGraph)">JSON</button>
        </div>
      </div>

      <!-- 3D Предпросмотр -->
      <main class="viewport-panel">
        <MaterialViewer ref="viewerRef" />
      </main>
    </header>

    <!-- Нижний блок: Редактор нодового графа -->
    <section class="bottom-section">
      <NodeGraphEditor :graphData="currentGraph" />
    </section>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background-color: #030712;
  color: #f3f4f6;
  overflow: hidden;
}

.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  padding: 12px;
  gap: 12px;
}

.top-section {
  display: flex;
  flex: 1;
  gap: 12px;
  min-height: 0;
}

.sidebar {
  width: 340px;
  background: #111827;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid #1f2937;
  flex-shrink: 0;
}

.sidebar h1 {
  font-size: 1.15rem;
  color: #fff;
}

.subtitle {
  font-size: 0.7rem;
  color: #9ca3af;
}

.control-group {
  display: flex;
  flex-direction: column;
}

textarea {
  background: #1f2937;
  border: 1px solid #374151;
  border-radius: 8px;
  padding: 8px;
  color: #fff;
  font-family: inherit;
  resize: none;
  outline: none;
  font-size: 0.85rem;
}

textarea:focus {
  border-color: #6366f1;
}

.presets {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.preset-label {
  font-size: 0.75rem;
  color: #9ca3af;
}

.preset-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.preset-tags button {
  background: #1f2937;
  border: 1px solid #374151;
  color: #d1d5db;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-tags button:hover {
  background: #374151;
  color: #fff;
}

.generate-btn {
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 10px;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.85rem;
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: background 0.2s;
}

.generate-btn:hover:not(:disabled) {
  background: #4f46e5;
}

.generate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.viewport-panel {
  flex: 1;
  min-width: 0;
  height: 100%;
}

.export-row { display: flex; gap: 6px; }
.export-row button { flex: 1; background: #1f2937; border: 1px solid #374151; color: #e5e7eb; padding: 8px 4px; border-radius: 8px; font-size: .72rem; cursor: pointer; }
.export-row button:hover:not(:disabled) { background: #374151; }
.export-row button:disabled { opacity: .4; cursor: not-allowed; }

.bottom-section {
  height: 340px;
  flex-shrink: 0;
}
</style>