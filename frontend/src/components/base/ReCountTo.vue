<template>
  <span :class="['yun-count-to', { 'yun-count-to--animated': animated }]">
    {{ prefix }}{{ displayValue }}{{ suffix }}
  </span>
</template>

<script setup>
/**
 * ReCountTo - 数字滚动动画组件
 * 参考 vue-pure-admin ReCountTo，纯 JS 实现
 * 用法：<ReCountTo :start="0" :end="12345" :duration="2000" />
 */
import { ref, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  start: { type: Number, default: 0 },
  end: { type: Number, default: 0 },
  duration: { type: Number, default: 2000 },
  decimals: { type: Number, default: 0 },
  prefix: { type: String, default: '' },
  suffix: { type: String, default: '' },
  separator: { type: String, default: ',' },
  animated: { type: Boolean, default: true }
})

const displayValue = ref('')
let animationFrame = null
let startTime = null
let startVal = 0
let endVal = 0

function formatNumber(num) {
  const fixed = Number(num).toFixed(props.decimals)
  if (props.separator) {
    const [intPart, decPart] = fixed.split('.')
    const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, props.separator)
    return decPart ? `${formatted}.${decPart}` : formatted
  }
  return fixed
}

function easeOutExpo(t) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
}

function animate(timestamp) {
  if (!startTime) startTime = timestamp
  const elapsed = timestamp - startTime
  const progress = Math.min(elapsed / props.duration, 1)
  const eased = easeOutExpo(progress)
  const current = startVal + (endVal - startVal) * eased
  displayValue.value = formatNumber(current)
  if (progress < 1) {
    animationFrame = requestAnimationFrame(animate)
  }
}

function startAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame)
  startTime = null
  startVal = props.start
  endVal = props.end
  displayValue.value = formatNumber(props.start)
  if (props.animated && props.start !== props.end) {
    animationFrame = requestAnimationFrame(animate)
  } else {
    displayValue.value = formatNumber(props.end)
  }
}

startAnimation()

watch(() => props.end, () => startAnimation())
watch(() => props.start, () => startAnimation())

onBeforeUnmount(() => {
  if (animationFrame) cancelAnimationFrame(animationFrame)
})
</script>

<script>
export default { name: 'ReCountTo' }
</script>
