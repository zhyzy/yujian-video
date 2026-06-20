<template>
  <div class="login-shell">
    <AnimatedLoginPage
      brand-name="遇见自媒体运营"
      :brand-icon="CustomLogo"
      primary-color="#6366f1"
      title="欢迎回来"
      subtitle="请登录以继续您的运营管理工作"
      email-label="账号"
      email-placeholder="请输入账号"
      password-label="密码"
      password-placeholder="请输入密码"
      login-button-text="登 录"
      loading-text="登录中..."
      :show-social-login="false"
      :show-remember-me="false"
      :show-signup="false"
      :footer-links="[]"
      @login="handleLogin"
    />

    <div class="login-verify-card" :class="{ verified: sliderVerified }">
      <div class="verify-head">
        <strong>{{ sliderVerified ? '验证完成' : '安全验证' }}</strong>
        <span>{{ sliderVerified ? '可以登录系统' : '请拖动滑块到最右侧' }}</span>
      </div>
      <div ref="sliderTrack" class="slider-track" @pointerdown="startSlide">
        <div class="slider-fill" :style="{ width: `${sliderPercent}%` }"></div>
        <span class="slider-text">{{ sliderVerified ? '已通过验证' : '向右拖动完成验证' }}</span>
        <button
          class="slider-thumb"
          type="button"
          :style="{ transform: `translateX(${sliderOffset}px)` }"
          @pointerdown.stop.prevent="startSlide"
        >
          {{ sliderVerified ? '✓' : '›' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, h, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { AnimatedLoginPage } from 'vue-animated-login'
import 'vue-animated-login/style.css'
import { login } from '@/api'
import { isCityUser } from '@/utils/authRole'

const CustomLogo = {
  props: ['size'],
  setup(props) {
    return () => h('img', {
      src: '/logo2.png',
      alt: 'Logo',
      style: {
        width: `${props.size || 40}px`,
        height: `${props.size || 40}px`,
        objectFit: 'contain',
        borderRadius: '8px'
      }
    })
  }
}

const router = useRouter()
const route = useRoute()
const sliderTrack = ref(null)
const sliderOffset = ref(0)
const sliderVerified = ref(false)
const sliding = ref(false)
const sliderStartX = ref(0)
const sliderStartOffset = ref(0)

const maxSliderOffset = () => Math.max(0, (sliderTrack.value?.clientWidth || 0) - 46)
const sliderPercent = computed(() => {
  const max = maxSliderOffset()
  return max ? Math.min(100, Math.round((sliderOffset.value / max) * 100)) : 0
})

const resetSlider = () => {
  sliderOffset.value = 0
  sliderVerified.value = false
  sliding.value = false
}

const moveSlide = (event) => {
  if (!sliding.value || sliderVerified.value) return
  const max = maxSliderOffset()
  const next = Math.min(max, Math.max(0, sliderStartOffset.value + event.clientX - sliderStartX.value))
  sliderOffset.value = next
  if (max && next >= max - 6) {
    sliderOffset.value = max
    sliderVerified.value = true
    stopSlide()
  }
}

const stopSlide = () => {
  sliding.value = false
  window.removeEventListener('pointermove', moveSlide)
  window.removeEventListener('pointerup', stopSlide)
  if (!sliderVerified.value) sliderOffset.value = 0
}

const startSlide = (event) => {
  if (sliderVerified.value) return
  sliding.value = true
  sliderStartX.value = event.clientX
  sliderStartOffset.value = sliderOffset.value
  window.addEventListener('pointermove', moveSlide)
  window.addEventListener('pointerup', stopSlide)
}

const handleLogin = async ({ email, password }) => {
  if (!sliderVerified.value) {
    ElMessage.warning('请先完成滑块验证')
    return
  }
  try {
    const data = await login({ username: email, password })
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_user', JSON.stringify(data.user || {}))
    ElMessage.success('登录成功')
    router.replace(route.query.redirect || (isCityUser(data.user) ? '/city/workbench' : '/dashboard'))
  } catch (e) {
    resetSlider()
    ElMessage.error(e.message || '登录失败，请检查账号密码')
  }
}

onBeforeUnmount(() => {
  stopSlide()
})
</script>

<style scoped>
.login-shell {
  min-height: 100vh;
}

.login-verify-card {
  position: fixed;
  left: 50%;
  bottom: 42px;
  z-index: 20;
  width: min(420px, calc(100vw - 32px));
  padding: 16px;
  border: 1px solid rgba(99, 102, 241, 0.18);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(18px);
  transform: translateX(-50%);
}

.verify-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  color: #111827;
}

.verify-head strong {
  font-size: 14px;
}

.verify-head span {
  font-size: 12px;
  color: #6b7280;
}

.slider-track {
  position: relative;
  height: 42px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f8fafc;
  overflow: hidden;
  user-select: none;
  touch-action: none;
}

.slider-fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 12px;
  background: linear-gradient(135deg, #dbeafe, #ede9fe);
  transition: width 0.12s ease;
}

.slider-text {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
}

.slider-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 10px;
  background: #6366f1;
  color: #fff;
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  cursor: grab;
  box-shadow: 0 8px 18px rgba(99, 102, 241, 0.28);
}

.slider-thumb:active {
  cursor: grabbing;
}

.login-verify-card.verified {
  border-color: rgba(16, 185, 129, 0.28);
}

.login-verify-card.verified .slider-fill {
  background: linear-gradient(135deg, #bbf7d0, #dcfce7);
}

.login-verify-card.verified .slider-thumb {
  background: #10b981;
  box-shadow: 0 8px 18px rgba(16, 185, 129, 0.28);
}

@media (max-width: 640px) {
  .login-verify-card {
    bottom: 18px;
  }
}
</style>
