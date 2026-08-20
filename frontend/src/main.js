import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import './assets/iconfont.css'
import './assets/compact-page-actions.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import App from './App.vue'
import router from './router'
import { initSpeech } from '@/utils/notification'

const app = createApp(App)
const pinia = createPinia()

const isIgnorableRuntimeError = (error) => {
  const message = error?.message || String(error || '')
  return /ResizeObserver loop completed with undelivered notifications|ResizeObserver loop limit exceeded/i.test(message)
}

const reportAppError = (error) => {
  if (isIgnorableRuntimeError(error)) return
  const message = error?.message || String(error || '页面出现异常，请刷新后重试')
  window.dispatchEvent(new CustomEvent('app-runtime-error', { detail: { message } }))
}

app.config.errorHandler = (error) => {
  if (isIgnorableRuntimeError(error)) return
  console.error('[app-runtime-error]', error)
  reportAppError(error)
}

window.addEventListener('unhandledrejection', (event) => {
  if (isIgnorableRuntimeError(event.reason)) return
  console.error('[app-unhandledrejection]', event.reason)
  reportAppError(event.reason)
})

window.addEventListener('error', (event) => {
  if (isIgnorableRuntimeError(event.error || event.message)) return
  console.error('[app-window-error]', event.error || event.message)
  reportAppError(event.error || event.message)
})

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.use(pinia)
app.use(router)
app.use(ElementPlus, { locale: zhCn, size: 'default' })

// 初始化语音合成
initSpeech()

app.mount('#app')
