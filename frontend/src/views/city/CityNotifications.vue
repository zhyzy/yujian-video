<template>
  <div class="notice-page">
    <ConfigurablePageRenderer page-key="cityNotifications" :modules="cityNotificationsLayoutModules">
    <template #page-head>
    <header class="hero">
      <div>
        <div class="eyebrow"><IconFont name="notice" :fallback="Bell" /> 城市端 · 消息</div>
        <h1>通知中心</h1>
        <p>接收总部下发、催办和审核结果通知</p>
      </div>
      <div class="actions">
        <el-button @click="loadData"><IconFont name="reset" :fallback="Refresh" />刷新</el-button>
        <el-button type="primary" @click="readAll">全部已读</el-button>
      </div>
    </header>
    </template>

    <template #notification-list>
    <section class="panel">
      <div v-if="filteredNotifications.length" class="notice-list">
        <div v-for="notice in filteredNotifications" :key="notice.id" class="notice-card" :class="{ unread: !notice.is_read }">
          <div>
            <strong>{{ notice.title }}</strong>
            <p>{{ notice.content || '暂无内容' }}</p>
            <span>{{ notice.created_at }}</span>
          </div>
          <el-button v-if="!notice.is_read" link type="primary" @click="readOne(notice)">标记已读</el-button>
        </div>
      </div>
      <el-empty v-else description="暂无通知" />
    </section>
    </template>
    </ConfigurablePageRenderer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Bell, Refresh } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const cityNotificationsLayoutModules = layoutModuleCatalog.cityNotifications
const { bindings: layoutBindings } = useLayoutBindings('cityNotifications')
const notifications = ref([])
const readStatus = ref('')
const filteredNotifications = computed(() => notifications.value.filter((notice) => {
  if (readStatus.value === 'unread') return !notice.is_read
  if (readStatus.value === 'read') return !!notice.is_read
  return true
}))

const normalizeReadStatus = (value) => ({ '全部': '', all: '' }[value] ?? value ?? '')
const applyLayoutBindings = (bindings = {}) => {
  if ('readStatus' in bindings) readStatus.value = normalizeReadStatus(bindings.readStatus)
}

const loadData = async () => {
  const data = await getNotifications({ pageSize: 100 })
  notifications.value = data.list || []
}

const readOne = async (notice) => {
  await markNotificationRead(notice.id)
  notice.is_read = 1
  ElMessage.success('已标记为已读')
}

const readAll = async () => {
  await markAllNotificationsRead()
  notifications.value.forEach(item => { item.is_read = 1 })
  ElMessage.success('已全部标记为已读')
}

onMounted(loadData)
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>

<style scoped>
.notice-page { display: flex; flex-direction: column; gap: 16px; }
.hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 22px 24px; background: #fff; border: 1px solid #eceff5; border-radius: 16px; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #0f766e; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.hero h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; }
.hero p { margin: 0; color: #7b8497; font-size: 13px; }
.actions { display: flex; gap: 10px; flex-wrap: wrap; }
.panel { background: #fff; border: 1px solid #eceff5; border-radius: 16px; padding: 18px; }
.notice-list { display: flex; flex-direction: column; gap: 10px; }
.notice-card { display: flex; justify-content: space-between; gap: 16px; padding: 14px; border: 1px solid #eef0f6; border-radius: 12px; background: #fff; }
.notice-card.unread { border-color: #bfdbfe; background: #eff6ff; }
.notice-card strong { display: block; color: #0f172a; margin-bottom: 6px; }
.notice-card p { margin: 0 0 8px; color: #475569; font-size: 13px; }
.notice-card span { color: #94a3b8; font-size: 12px; }
@media (max-width: 800px) { .hero, .notice-card { flex-direction: column; align-items: stretch; } }
</style>
