<template>
  <el-tooltip
    v-if="isEllipsis"
    :content="tooltipContent"
    placement="top"
    :show-after="200"
    :hide-after="0"
  >
    <span ref="textRef" :class="['yun-text', { 'yun-text--clamp': lineClamp }]" :style="textStyle">
      <slot />
    </span>
  </el-tooltip>
  <span
    v-else
    ref="textRef"
    :class="['yun-text', { 'yun-text--clamp': lineClamp }]"
    :style="textStyle"
  >
    <slot />
  </span>
</template>

<script setup>
/**
 * ReText - 文本省略组件
 * 当文本溢出时自动显示 Tooltip
 * 用法：<ReText :line-clamp="2">长文本内容</ReText>
 */
import { ref, computed, onMounted, nextTick, watch } from 'vue'

const props = defineProps({
  lineClamp: [String, Number]
})

const textRef = ref(null)
const isEllipsis = ref(false)
const tooltipContent = ref('')

const textStyle = computed(() => {
  if (props.lineClamp) {
    return {
      display: '-webkit-box',
      WebkitLineClamp: props.lineClamp,
      WebkitBoxOrient: 'vertical',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }
  return {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'inline-block',
    maxWidth: '100%'
  }
})

function checkEllipsis() {
  const el = textRef.value
  if (!el) return
  if (!props.lineClamp) {
    isEllipsis.value = el.scrollWidth > el.clientWidth
  } else {
    // 多行省略判断：比较 scrollHeight 和 clientHeight
    const style = window.getComputedStyle(el)
    const lineHeight = parseFloat(style.lineHeight) || 20
    const maxHeight = lineHeight * Number(props.lineClamp)
    isEllipsis.value = el.scrollHeight > maxHeight + 1
  }
  if (isEllipsis.value) {
    tooltipContent.value = el.textContent?.trim() || ''
  }
}

onMounted(() => {
  nextTick(checkEllipsis)
})

watch(() => textRef.value?.textContent, () => {
  nextTick(checkEllipsis)
})
</script>

<style scoped>
.yun-text {
  word-break: break-all;
}
.yun-text--clamp {
  word-break: break-all;
}
</style>
