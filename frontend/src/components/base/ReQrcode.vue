<template>
  <canvas
    ref="canvasRef"
    :width="size"
    :height="size"
    :style="{ width: size + 'px', height: size + 'px', ...$attrs.style }"
  />
</template>

<script setup>
/**
 * ReQrcode - 二维码生成组件
 * 依赖：npm install qrcode
 * 用法：<ReQrcode :value="'https://example.com'" :size="200" />
 */
import { ref, onMounted, watch } from 'vue'
import QRCode from 'qrcode'

const props = defineProps({
  value: { type: String, required: true },
  size: { type: Number, default: 200 },
  margin: { type: Number, default: 2 },
  color: { type: String, default: '#000000' },
  bgColor: { type: String, default: '#ffffff' },
  errorCorrectionLevel: { type: String, default: 'M' } // L M Q H
})

const canvasRef = ref(null)

function draw() {
  const canvas = canvasRef.value
  if (!canvas) return
  QRCode.toCanvas(canvas, props.value, {
    width: props.size,
    margin: props.margin,
    color: { dark: props.color, light: props.bgColor },
    errorCorrectionLevel: props.errorCorrectionLevel
  }, (err) => {
    if (err) console.warn('[ReQrcode]', err.message)
  })
}

onMounted(draw)
watch(() => [props.value, props.size, props.color, props.bgColor], draw)
</script>

<script>
export default { name: 'ReQrcode' }
</script>
