import { ElNotification } from 'element-plus'

// 语音合成实例
let speechSynthesis = null
let currentUtterance = null

// 语音设置
const speechSettings = {
  enabled: true,
  volume: 1,
  rate: 1,
  pitch: 1,
  voice: null
}

// 初始化语音合成
export const initSpeech = () => {
  if (typeof window === 'undefined') return

  if ('speechSynthesis' in window) {
    speechSynthesis = window.speechSynthesis

    // 获取可用语音列表
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices()
      // 优先选择中文语音
      const chineseVoice = voices.find(v => v.lang.includes('zh'))
      const zhCNVoice = voices.find(v => v.lang.includes('zh-CN'))
      speechSettings.voice = zhCNVoice || chineseVoice || voices[0]
    }

    loadVoices()
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices
    }
  }
}

// 播放语音提示
export const speak = (text, options = {}) => {
  if (!speechSynthesis || !speechSettings.enabled) return

  const {
    volume = speechSettings.volume,
    rate = speechSettings.rate,
    pitch = speechSettings.pitch,
    voice = speechSettings.voice
  } = options

  // 停止之前的语音
  stopSpeech()

  // 创建新的语音实例
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.volume = volume
  utterance.rate = rate
  utterance.pitch = pitch
  if (voice) utterance.voice = voice

  currentUtterance = utterance
  speechSynthesis.speak(utterance)

  return new Promise((resolve, reject) => {
    utterance.onend = () => resolve()
    utterance.onerror = (e) => reject(e)
  })
}

// 停止语音
export const stopSpeech = () => {
  if (speechSynthesis) {
    speechSynthesis.cancel()
    currentUtterance = null
  }
}

// 设置语音是否启用
export const setSpeechEnabled = (enabled) => {
  speechSettings.enabled = enabled
  if (!enabled) {
    stopSpeech()
  }
}

// 获取语音设置
export const getSpeechSettings = () => ({ ...speechSettings })

// 获取可用语音列表
export const getAvailableVoices = () => {
  if (!speechSynthesis) return []
  return speechSynthesis.getVoices()
}

// 设置语音
export const setVoice = (voice) => {
  speechSettings.voice = voice
}

// 设置音量
export const setVolume = (volume) => {
  speechSettings.volume = Math.max(0, Math.min(1, volume))
}

// 设置语速
export const setRate = (rate) => {
  speechSettings.rate = Math.max(0.1, Math.min(10, rate))
}

// 播放提示音效
const playSound = (type) => {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    switch (type) {
      case 'success':
        oscillator.frequency.value = 800
        gainNode.gain.value = 0.1
        oscillator.start()
        setTimeout(() => {
          oscillator.frequency.value = 1000
          oscillator.start(audioContext.currentTime)
        }, 100)
        break
      case 'error':
        oscillator.frequency.value = 400
        gainNode.gain.value = 0.1
        break
      case 'warning':
        oscillator.frequency.value = 600
        gainNode.gain.value = 0.1
        break
      default:
        oscillator.frequency.value = 500
        gainNode.gain.value = 0.05
    }

    oscillator.start()
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.3)
    oscillator.stop(audioContext.currentTime + 0.3)
  } catch (e) {
    console.warn('播放音效失败:', e)
  }
}

// 增强的通知函数
export const notify = (options = {}) => {
  const {
    title = '',
    message = '',
    type = 'info', // success | warning | error | info
    duration = 4500,
    voice = true, // 是否语音播报
    voiceText = null, // 自定义语音文本，为空则使用 message
    sound = true, // 是否播放提示音
    position = 'top-right',
    showClose = true,
    ...rest
  } = options

  // 播放提示音
  if (sound) {
    playSound(type)
  }

  // 语音播报
  if (voice && message) {
    const textToSpeak = voiceText || message
    speak(textToSpeak).catch(() => {})
  }

  // 显示通知
  return ElNotification({
    title,
    message,
    type,
    duration,
    position,
    showClose,
    ...rest
  })
}

// 快捷通知方法
export const notifySuccess = (message, title = '成功') => {
  return notify({ message, title, type: 'success' })
}

export const notifyError = (message, title = '错误') => {
  return notify({ message, title, type: 'error', duration: 0 })
}

export const notifyWarning = (message, title = '警告') => {
  return notify({ message, title, type: 'warning' })
}

export const notifyInfo = (message, title = '提示') => {
  return notify({ message, title, type: 'info' })
}

// 新消息通知（带特殊提示）
export const notifyNewMessage = (message, options = {}) => {
  return notify({
    ...options,
    title: options.title || '📨 新消息',
    message,
    type: 'info',
    duration: options.duration || 6000,
    voice: options.voice !== false,
    sound: true
  })
}

// 任务提醒通知
export const notifyTaskReminder = (taskName, options = {}) => {
  const message = options.message || `您有新的任务: ${taskName}`
  return notify({
    ...options,
    title: '📋 任务提醒',
    message,
    type: 'warning',
    duration: options.duration || 8000,
    voice: true,
    sound: true
  })
}

// 系统公告通知
export const notifyAnnouncement = (content, options = {}) => {
  return notify({
    ...options,
    title: '📢 系统公告',
    message: content,
    type: 'info',
    duration: options.duration || 0, // 系统公告不自动关闭
    voice: true,
    sound: true
  })
}

export default {
  initSpeech,
  speak,
  stopSpeech,
  setSpeechEnabled,
  getSpeechSettings,
  getAvailableVoices,
  setVoice,
  setVolume,
  setRate,
  notify,
  notifySuccess,
  notifyError,
  notifyWarning,
  notifyInfo,
  notifyNewMessage,
  notifyTaskReminder,
  notifyAnnouncement
}
