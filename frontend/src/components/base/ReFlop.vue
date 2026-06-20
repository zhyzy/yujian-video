<template>
  <div :class="['yun-flop', { 'is-playing': playing }]" @click="toggle">
    <div class="yun-flop__inner">
      <div class="yun-flop__front">
        <slot name="front">{{ frontText }}</slot>
      </div>
      <div class="yun-flop__back">
        <slot name="back">{{ backText }}</slot>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * ReFlop - 翻牌动画组件
 * 点击或调用 toggle() 触发翻转动画
 * 用法：<ReFlop front-text="正面" back-text="背面" />
 */
import { ref } from 'vue'

const props = defineProps({
  frontText: { type: String, default: '正面' },
  backText: { type: String, default: '背面' },
  trigger: { type: String, default: 'click' }, // click | hover | manual
  modelValue: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue', 'change'])

const playing = ref(props.modelValue)

function toggle() {
  playing.value = !playing.value
  emit('update:modelValue', playing.value)
  emit('change', playing.value)
}

defineExpose({ toggle })
</script>

<style scoped>
.yun-flop {
  perspective: 600px;
  display: inline-block;
  cursor: pointer;
  width: v-bind('$attrs.width || "120px"');
  height: v-bind('$attrs.height || "80px"');
}
.yun-flop__inner {
  position: relative;
  width: 100%;
  height: 100%;
  transition: transform 0.6s ease;
  transform-style: preserve-3d;
}
.yun-flop.is-playing .yun-flop__inner {
  transform: rotateY(180deg);
}
.yun-flop__front,
.yun-flop__back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 500;
  color: #fff;
}
.yun-flop__front {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.yun-flop__back {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  transform: rotateY(180deg);
}
</style>
