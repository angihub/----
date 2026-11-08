<script setup>
import { onMounted, ref, onBeforeUnmount } from 'vue'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { createMaterialMaps } from '../services/textureGenerator'

const canvasContainer = ref(null)
let renderer, scene, camera, sphere, animationFrameId, material, ro

onMounted(() => {
  scene = new THREE.Scene()
  camera = new THREE.PerspectiveCamera(
    45,
    canvasContainer.value.clientWidth / canvasContainer.value.clientHeight,
    0.1,
    1000
  )
  camera.position.z = 4.5

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  canvasContainer.value.appendChild(renderer.domElement)
  renderer.domElement.style.display = 'block'
  // окружение нужно, чтобы металлы и блики выглядели как в Blender, а не чёрными
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture

// Освещение (делаем ярче, чтобы материал был отлично виден)
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.15)
  scene.add(ambientLight)

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 2.5)
  dirLight1.position.set(5, 5, 5)
  scene.add(dirLight1)

  const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 1.0)
  dirLight2.position.set(-5, -5, -2)
  scene.add(dirLight2)

  // Базовая геометрия
  const geometry = new THREE.SphereGeometry(1.4, 64, 64)
  
  // Создаем базовый PBR материал
  material = new THREE.MeshStandardMaterial({
    color: 0x8b0000,
    roughness: 0.7,
    metalness: 0.3,
  })

  sphere = new THREE.Mesh(geometry, material)
  scene.add(sphere)

  const animate = () => {
    animationFrameId = requestAnimationFrame(animate)
    sphere.rotation.y += 0.005
    sphere.rotation.x += 0.002
    renderer.render(scene, camera)
  }
  animate()

  ro = new ResizeObserver(onWindowResize)
  ro.observe(canvasContainer.value)
})



// Граф реально считается на GPU -> карты base/roughness/metallic/height/emission
const applyNodeGraph = (graphData) => {
  if (!material || !graphData) return
  const t = createMaterialMaps(graphData, 1024)
  for (const k of ['map', 'roughnessMap', 'metalnessMap', 'bumpMap', 'emissiveMap']) material[k]?.dispose()
  material.color.set(0xffffff)
  material.map = t.albedo
  material.roughnessMap = t.roughness
  material.metalnessMap = t.metallic
  material.bumpMap = t.height
  material.emissiveMap = t.emission
  material.emissive.set(0xffffff)
  material.roughness = 1
  material.metalness = 1
  material.bumpScale = 2
  material.needsUpdate = true
}

// Экспортируем метод наружу, чтобы App.vue мог вызывать его
defineExpose({
  applyNodeGraph
})

const onWindowResize = () => {
  if (!canvasContainer.value) return
  camera.aspect = canvasContainer.value.clientWidth / canvasContainer.value.clientHeight
  camera.updateProjectionMatrix()
  renderer.setSize(canvasContainer.value.clientWidth, canvasContainer.value.clientHeight)
}

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrameId)
  ro?.disconnect()
  if (renderer && renderer.domElement) {
    renderer.domElement.remove()
  }
})
</script>

<template>
  <div class="viewer-container" ref="canvasContainer"></div>
</template>

<style scoped>
.viewer-container {
  width: 100%;
  height: 100%;
  min-height: 400px;
  background: radial-gradient(circle at center, #1f2937 0%, #0b0f19 100%);
  border-radius: 16px;
  overflow: hidden;
}
</style>