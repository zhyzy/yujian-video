<template>
  <Teleport to="body">
    <!-- 消息列表抽屉 -->
    <el-drawer
      v-model="drawerVisible"
      title="消息中心"
      direction="rtl"
      size="400px"
      :before-close="handleClose"
    >
      <div class="notification-container">
        <!-- 消息筛选 -->
        <div class="notification-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.value"
            :class="['tab-btn', { active: activeTab === tab.value }]"
            @click="activeTab = tab.value"
          >
            {{ tab.label }}
            <span v-if="tab.count > 0" class="tab-badge">{{ tab.count }}</span>
          </button>
        </div>

        <!-- 消息列表 -->
        <div class="notification-list" v-loading="loading">
          <template v-if="filteredMessages.length > 0">
            <div
              v-for="msg in filteredMessages"
              :key="msg.id"
              :class="['notification-item', { unread: !msg.read, [msg.type]: true }]"
              @click="handleRead(msg)"
            >
              <div class="item-icon">
                <span v-if="msg.type === 'system'">⚙️</span>
                <span v-else-if="msg.type === 'task'">📋</span>
                <span v-else-if="msg.type === 'announcement'">📢</span>
                <span v-else>📨</span>
              </div>
              <div class="item-content">
                <div class="item-header">
                  <strong>{{ msg.title }}</strong>
                  <span class="item-time">{{ formatTime(msg.created_at) }}</span>
                </div>
                <p class="item-message">{{ msg.content }}</p>
                <div class="item-actions" v-if="msg.action">
                  <button
                    v-for="action in msg.action"
                    :key="action.label"
                    class="action-btn"
                    @click.stop="handleAction(msg, action)"
                  >
                    {{ action.label }}
                  </button>
                </div>
              </div>
              <button
                v-if="!msg.read"
                class="mark-read-btn"
                @click.stop="markAsRead(msg)"
                title="标记已读"
              >
                ✓
              </button>
            </div>
          </template>
          <div v-else class="empty-state">
            <span class="empty-icon">📭</span>
            <p>暂无{{ activeTab === 'all' ? '' : activeTabLabel }}消息</p>
          </div>
        </div>

        <!-- 全部标为已读 -->
        <div class="notification-footer" v-if="unreadCount > 0">
          <button class="mark-all-btn" @click="markAllAsRead">
            全部标为已读
          </button>
        </div>
      </div>
    </el-drawer>

    <!-- 未读消息气泡（当抽屉关闭时显示） -->
    <Transition name="bubble">
      <div
        v-if="showBubble && unreadCount > 0"
        class="notification-bubble"
        :style="{ top: bubblePosition.top + 'px', right: bubblePosition.right + 'px' }"
        @click="openDrawer"
      >
        <div class="bubble-content">
          <span class="bubble-count">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          <span class="bubble-text">条新消息</span>
        </div>
        <button class="bubble-close" @click.stop="dismissBubble">×</button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { ElMessageBox } from 'element-plus'
import { notifyNewMessage, speak } from '@/utils/notification'

const props = defineProps({
  messages: {
    type: Array,
    default: () => []
  },
  loading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update', 'read', 'action'])

const drawerVisible = ref(false)
const activeTab = ref('all')
const showBubble = ref(false)
const bubblePosition = ref({ top: 100, right: 20 })

/* 读取字段判断兼容 is_read 和 read 的函数 */
const isMsg = (m) => Boolean(m?.is_read || m?.read) ? true : false

const tabs = computed(() => [
  { label: '全部', value: 'all', count: props.messages.length },
  { label: '未读', value: 'unread', count: unreadCount.value },
  { label: '系统', value: 'system', count: props.messages.filter(m => m.type === 'system' && !isMsg(m)).length },
  { label: '任务', value: 'task', count: props.messages.filter(m => m.type === 'task' && !isMsg(m)).length }
])

const unreadCount = computed(() => props.messages.filter(m => !isMsg(m)).length)

const activeTabLabel = computed(() => {
  const tab = tabs.value.find(t => t.value === activeTab.value)
  return tab?.label || ''
})

const filteredMessages = computed(() => {
  if (activeTab.value === 'all') return props.messages
  if (activeTab.value === 'unread') return props.messages.filter(m => !m.read)
  return props.messages.filter(m => m.type === activeTab.value)
})

// 监听新消息，播放语音
watch(
  () => props.messages.length,
  (newLen, oldLen) => {
    if (newLen > oldLen) {
      const newMessages = props.messages.slice(0, newLen - oldLen)
      newMessages.forEach(msg => {
        if (!msg.read) {
          // 语音播报
          speak(msg.content || msg.title)
          // 气泡提示
          showBubble.value = true
        }
      })
    }
  }
)

const formatTime = (time) => {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return date.toLocaleDateString()
}

const handleRead = (msg) => {
  if (!msg.read) {
    emit('read', msg.id)
  }
  // 可选：显示详情弹窗
}

const markAsRead = (msg) => {
  emit('read', msg.id)
}

const markAllAsRead = () => {
  ElMessageBox.confirm('确定要将所有消息标为已读吗？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning'
  }).then(() => {
    emit('update', { action: 'markAllRead' })
  }).catch(() => {})
}

const handleAction = (msg, action) => {
  emit('action', { message: msg, action })
}

const openDrawer = () => {
  drawerVisible.value = true
  showBubble.value = false
}

const handleClose = () => {
  drawerVisible.value = false
}

const dismissBubble = () => {
  showBubble.value = false
}

// 初始化气泡位置
const initBubblePosition = () => {
  const notificationBtn = document.querySelector('.notification-trigger')
  if (notificationBtn) {
    const rect = notificationBtn.getBoundingClientRect()
    bubblePosition.value = {
      top: rect.bottom + 10,
      right: window.innerWidth - rect.right
    }
  }
}

onMounted(() => {
  initBubblePosition()
  window.addEventListener('resize', initBubblePosition)
})

onUnmounted(() => {
  window.removeEventListener('resize', initBubblePosition)
})

// 暴露方法
defineExpose({
  openDrawer,
  close: handleClose
})
</script>

<style scoped>
.notification-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.notification-tabs {
  display: flex;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-primary);
  margin-bottom: 16px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--border-primary);
  border-radius: 20px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.tab-btn.active {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.3);
  font-size: 11px;
  font-weight: 600;
}

.tab-btn:not(.active) .tab-badge {
  background: var(--accent-primary);
  color: #fff;
}

.notification-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;
}

.notification-item {
  display: flex;
  gap: 12px;
  padding: 14px;
  border-radius: 12px;
  background: var(--bg-tertiary);
  margin-bottom: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.notification-item:hover {
  background: var(--bg-hover);
}

.notification-item.unread {
  background: var(--bg-active);
  border-left: 3px solid var(--accent-primary);
}

.notification-item.unread .item-content strong {
  color: var(--accent-primary);
}

.item-icon {
  font-size: 24px;
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  min-width: 0;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.item-header strong {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 600;
}

.item-time {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}

.item-message {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.action-btn {
  padding: 5px 12px;
  border: 1px solid var(--border-primary);
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: var(--bg-hover);
}

.mark-read-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 22px;
  height: 22px;
  border: 1px solid var(--border-primary);
  border-radius: 50%;
  background: var(--bg-secondary);
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
}

.notification-item:hover .mark-read-btn {
  opacity: 1;
}

.mark-read-btn:hover {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
  color: #fff;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--text-muted);
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state p {
  font-size: 14px;
  margin: 0;
}

.notification-footer {
  padding-top: 16px;
  border-top: 1px solid var(--border-primary);
  margin-top: 16px;
}

.mark-all-btn {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mark-all-btn:hover {
  border-color: var(--accent-primary);
  color: var(--accent-primary);
  background: var(--bg-hover);
}

/* 气泡样式 */
.notification-bubble {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 12px;
  background: var(--bg-secondary);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-primary);
  cursor: pointer;
  z-index: 2000;
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.bubble-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.bubble-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 12px;
  background: var(--color-danger);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
}

.bubble-text {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.bubble-close {
  width: 20px;
  height: 20px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bubble-close:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.bubble-enter-active,
.bubble-leave-active {
  transition: all 0.3s ease;
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
