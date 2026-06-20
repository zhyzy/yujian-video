<template>
  <div class="yun-cropper">
    <div class="yun-cropper__preview" v-if="previewUrl">
      <img :src="previewUrl" alt="裁剪预览" />
    </div>
    <div class="yun-cropper__editor">
      <img ref="imgRef" :src="src" alt="裁剪源图" />
    </div>
    <div class="yun-cropper__toolbar">
      <button class="yun-btn ghost" @click="zoomIn">放大</button>
      <button class="yun-btn ghost" @click="zoomOut">缩小</button>
      <button class="yun-btn ghost" @click="rotateLeft">↺ 左转</button>
      <button class="yun-btn ghost" @click="rotateRight">↻ 右转</button>
      <button class="yun-btn ghost" @click="flipHorizontal">⇔ 水平翻转</button>
      <button class="yun-btn ghost" @click="flipVertical">⇕ 垂直翻转</button>
      <button class="yun-btn primary" @click="crop">确认裁剪</button>
    </div>
  </div>
</template>

<script setup>
/**
 * ReCropper - 图片裁剪组件
 * 依赖：npm install cropperjs
 * 用法：
 *   <ReCropper src="/test.jpg" @crop="onCrop" />
 * 函数式：useCropper({ src, ... })  // 通过 useDialog 打开
 */
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import Cropper from 'cropperjs'
/* cropperjs 样式已内联到 <style> 中，无需外部 CSS */

const props = defineProps({
  src: { type: String, required: true },
  aspectRatio: { type: Number, default: NaN }, // NaN = 自由比例
  autoCrop: { type: Boolean, default: true },
  viewMode: { type: Number, default: 1 },
  dragMode: { type: String, default: 'crop' },
  outputType: { type: String, default: 'image/png' },
  outputQuality: { type: Number, default: 0.9 }
})

const emit = defineEmits(['crop', 'ready'])

const imgRef = ref(null)
const previewUrl = ref('')
const scaleX = ref(1)
const scaleY = ref(1)
let cropper = null

function initCropper() {
  if (!imgRef.value) return
  cropper = new Cropper(imgRef.value, {
    aspectRatio: isNaN(props.aspectRatio) ? undefined : props.aspectRatio,
    viewMode: props.viewMode,
    dragMode: props.dragMode,
    autoCrop: props.autoCrop,
    crop: () => {
      getPreview()
    },
    ready: () => emit('ready')
  })
}

function getPreview() {
  if (!cropper) return
  previewUrl.value = cropper.getCroppedCanvas().toDataURL(props.outputType, props.outputQuality)
}

function crop() {
  if (!cropper) return
  const canvas = cropper.getCroppedCanvas()
  const url = canvas.toDataURL(props.outputType, props.outputQuality)
  const blob = canvas.toBlob(blob => {
    emit('crop', { url, blob, canvas })
  }, props.outputType, props.outputQuality)
}

function zoomIn() { cropper?.zoom(0.1) }
function zoomOut() { cropper?.zoom(-0.1) }
function rotateLeft() { cropper?.rotate(-90) }
function rotateRight() { cropper?.rotate(90) }
function flipHorizontal() {
  if (typeof cropper?.scaleX !== 'function') return
  scaleX.value = -scaleX.value
  cropper.scaleX(scaleX.value)
}
function flipVertical() {
  if (typeof cropper?.scaleY !== 'function') return
  scaleY.value = -scaleY.value
  cropper.scaleY(scaleY.value)
}

onMounted(() => nextTick(initCropper))
onBeforeUnmount(() => cropper?.destroy())

defineExpose({ crop, getPreview, zoomIn, zoomOut, rotateLeft, rotateRight })
</script>

<style scoped>
/* 裁剪器核心样式（替代 cropper.css） */
.yun-cropper { display: flex; flex-direction: column; gap: 12px; }
.yun-cropper__editor {
  width: 100%; height: 320px;
  background: #f5f5f5; border-radius: 8px; overflow: hidden;
}
.yun-cropper__editor img { max-width: 100%; max-height: 100%; display: block; }
.yun-cropper__preview img { width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(0,0,0,0.1); }
.yun-cropper__toolbar { display: flex; gap: 8px; flex-wrap: wrap; }

/* ====== cropper.js 核心样式（非 scoped） ====== */
</style>
<style>
.cropper-container {
  direction: ltr; font-size: 0; line-height: 0; position: relative;
  touch-action: none; user-select: none;
}
.cropper-container img {
  border: none; display: block; image-orientation: 0deg;
  max-height: none !important; max-width: none !important;
  min-height: 0 !important; min-width: 0 !important; height: 100%;
  opacity: 0; width: 100%;
}
.cropper-wrap-box,
.cropper-canvas,
.cropper-drag-box,
.cropper-crop-box,
.cropper-modal { bottom: 0; left: 0; position: absolute; right: 0; top: 0; }
.cropper-wrap-box,
.cropper-canvas { overflow: hidden; }
.cropper-drag-box { background-color: #fff; opacity: 0; }
.cropper-modal { background-color: rgba(0,0,0,0.5); }
.cropper-view-box {
  display: block; height: 100%; outline: 1px solid #39f; outline-color: rgba(51,153,255,.75);
  overflow: hidden; width: 100%;
}
.cropper-dashed { border: 0 dashed #eee; display: block; opacity: .5; position: absolute; }
.cropper-dashed.dashed-h { border-bottom-width: 1px; border-top-width: 1px; height: calc(100% / 3); left: 0; top: calc(100% / 3); width: 100%; }
.cropper-dashed.dashed-v { border-left-width: 1px; border-right-width: 1px; height: 100%; left: calc(100% / 3); top: 0; width: calc(100% / 3); }
.cropper-center { display: block; height: 0; left: 50%; opacity: .75; position: absolute; top: 50%; width: 0; }
.cropper-center::before, .cropper-center::after {
  content: ' '; display: block; background-color: #eee;
  position: absolute;
}
.cropper-center::before { height: 1px; left: -3px; top: 0; width: 7px; }
.cropper-center::after { height: 7px; left: 0; top: -3px; width: 1px; }
.cropper-face,
.cropper-line,
.cropper-point { display: block; height: 100%; opacity: .1; position: absolute; width: 100%; }
.cropper-face { background-color: #fff; left: 0; top: 0; }
.cropper-line { background-color: #39f; }
.cropper-line.line-e { cursor: ew-resize; right: -3px; top: 0; width: 5px; }
.cropper-line.line-n { cursor: ns-resize; height: 5px; left: 0; top: -3px; }
.cropper-line.line-w { cursor: ew-resize; left: -3px; top: 0; width: 5px; }
.cropper-line.line-s { bottom: -3px; cursor: ns-resize; height: 5px; left: 0; }
.cropper-point {
  background-color: #39f; height: 7px; opacity: .75; width: 7px;
}
.cropper-point.point-e { cursor: ew-resize; margin-top: -3.5px; right: -3px; top: 50%; }
.cropper-point.point-n { cursor: ns-resize; left: 50%; margin-left: -3.5px; top: -3px; }
.cropper-point.point-w { cursor: ew-resize; left: -3px; margin-top: -3.5px; top: 50%; }
.cropper-point.point-s { bottom: -3px; cursor: ns-resize; left: 50%; margin-left: -3.5px; width: 1px; }
.cropper-point.point-ne { cursor: nesw-resize; margin-top: -3.5px; right: -3px; top: -3px; }
.cropper-point.point-nw { cursor: nwse-resize; left: -3px; margin-top: -3.5px; top: -3px; }
.cropper-point.point-sw { cursor: nesw-resize; bottom: -3px; left: -3px; }
.cropper-point.point-se { cursor: nwse-resize; height: 20px; opacity: 1; right: -3px; bottom: -3px; width: 20px; }
@media (min-width: 768px) {
  .cropper-point.point-se { height: 15px; width: 15px; }
}
@media (min-width: 992px) {
  .cropper-point.point-se { height: 10px; width: 10px; }
}
.cropper-point.point-se::before {
  background-color: #39f; bottom: 0; content: ' '; display: block; height: 2px; left: 0; position: absolute; width: 2px;
}
.cropper-invisible { opacity: 0; }
.cropper-bg { background-image: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAAA3NCSVQICAjb4U/gAAAABlBMVEXMzMz////TjRV2AAAACXBIWXMAAArrAAAK6wGCiw1aAAAAHHRFWHRTb2Z0d2FyZQBBZG9iZSBGaXJld29ya3MgQ1M26LyyjAAAABFJREFUCJlj+M/AgBVhF/0PAH6/D/HkDxOGAAAAAElFTkSuQmCC'); }
.cropper-hide { display: block; height: 0; position: absolute; width: 0; }
.cropper-hidden { display: none !important; }
.cropper-move { cursor: move; }
.cropper-crop { cursor: crosshair; }
.cropper-disabled .cropper-drag-box,
.cropper-disabled .cropper-face,
.cropper-disabled .cropper-line,
.cropper-disabled .cropper-point { cursor: not-allowed; }
</style>
