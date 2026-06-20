<template>
  <div class="city-page">
    <header class="hero">
      <div>
        <div class="eyebrow"><IconFont name="dashboard" :fallback="HomeFilled" /> 城市工作台</div>
        <h1>{{ userName }}，今天要处理 {{ stats.pending }} 个任务</h1>
        <p>查看总部下发任务、发布进度和待读通知</p>
      </div>
      <el-button @click="loadData"><IconFont name="reset" :fallback="Refresh" />刷新</el-button>
    </header>

    <ConfigurablePageRenderer page-key="cityWorkbench" :modules="cityWorkbenchLayoutModules">
      <template #city-summary>
        <section class="summary-row">
          <div class="sum-card primary">
            <strong>{{ cityProgress.progress?.percentage || 0 }}%</strong>
            <span>本月完成 · {{ cityProgress.progress?.completed || 0 }}/{{ cityProgress.progress?.target || 0 }} 条</span>
          </div>
          <div class="sum-card"><strong>{{ stats.pending }}</strong><span>待发布</span></div>
          <div class="sum-card green"><strong>{{ stats.published }}</strong><span>已提交</span></div>
          <div class="sum-card amber"><strong>{{ stats.today }}</strong><span>今日任务</span></div>
          <div class="sum-card blue"><strong>{{ monthPublished }}</strong><span>本月发布数量合计</span></div>
        </section>
      </template>

      <template #city-tasks="{ module }">
        <div class="panel">
          <div class="panel-head">
            <h2>{{ module.title }}</h2>
            <router-link to="/city/tasks">查看全部</router-link>
          </div>
          <div v-if="todayTasks.length" class="task-list">
            <div v-for="task in todayTasks.slice(0, 6)" :key="task.id" class="task-row rich">
              <div>
                <strong>{{ task.publish_time || '09:00' }} · {{ task.account_name || '城市账号' }}</strong>
                <span>{{ task.publish_requirement || '暂无发布要求' }}</span>
                <em>素材：{{ task.video_url || task.material_url ? '已下发' : '暂无链接' }}</em>
              </div>
              <div class="row-actions">
                <el-button v-if="task.video_url || task.material_url" class="btn-download" size="small" @click="openLink(task.video_url || task.material_url)">
                  <el-icon><Download /></el-icon>
                  <span>下载</span>
                </el-button>
                <el-button class="btn-fill" size="small" type="primary" @click="$router.push({ path: '/city/publish-submit', query: { taskId: task.id } })">
                  <el-icon><Promotion /></el-icon>
                  <span>{{ task.status === 'published' ? '查看' : '填报' }}</span>
                </el-button>
              </div>
            </div>
          </div>
          <el-empty v-else description="今日暂无下发任务" />
        </div>
      </template>

      <template #city-notices="{ module }">
        <div class="panel">
          <div class="panel-head">
            <h2>{{ module.title }}</h2>
            <router-link to="/city/publish-submit">去处理</router-link>
          </div>
          <div class="notice-list">
            <div class="notice-row">
              <strong>待发布任务</strong>
              <span>当前还有 {{ stats.pending }} 条任务未发布，请优先处理今日任务。</span>
            </div>
            <div class="notice-row">
              <strong>待补数据</strong>
              <span>已发布后记得补充播放、点赞、成交和截图，方便总部统计。</span>
            </div>
          </div>
        </div>
      </template>

      <template #publish-schedule="{ module }">
        <div class="panel schedule-panel">
          <div class="panel-head">
            <h2>{{ module ? module.title : '今日发布排期' }}</h2>
            <router-link to="/city/tasks">查看全部任务</router-link>
          </div>
          <div v-if="scheduleDates.length" class="schedule-dates">
            <div v-for="date in scheduleDates" :key="date" class="schedule-day">
              <div class="schedule-day-head">
                <span class="day-label">{{ date }}</span>
                <span class="day-count">{{ scheduleByDate[date].length }} 条</span>
              </div>
              <div class="event-list">
                <div
                  v-for="item in scheduleByDate[date]"
                  :key="item.id"
                  class="event-card"
                  :class="{ published: item.status === 'published' }"
                >
                  <span class="event-time">{{ item.publish_time || '09:00' }}</span>
                  <span class="event-platform" :style="{ background: platformColor(item.publish_platform || item.platform) }"></span>
                  <div class="event-body">
                    <strong>{{ item.account_name || '城市账号' }}</strong>
                    <span>{{ item.publish_requirement || '暂无发布要求' }}</span>
                  </div>
                  <span class="event-tag" :class="item.status === 'published' ? 'done' : 'pending'">{{ item.status === 'published' ? '已发布' : '待发布' }}</span>
                </div>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无排期任务" />
        </div>
      </template>

      <template #city-list="{ module }">
        <div class="panel city-list-panel">
          <div class="panel-head">
            <h2>{{ module ? module.title : '账号状态' }}</h2>
            <router-link to="/city/tasks">查看全部</router-link>
          </div>
          <div v-if="accountStatsList.length" class="account-list">
            <div v-for="acc in accountStatsList" :key="acc.name" class="account-row">
              <div class="account-left">
                <strong>{{ acc.name }}</strong>
                <span>{{ acc.platformLabel }} · 本月 {{ acc.monthly }} 条</span>
              </div>
              <div class="account-right">
                <span class="mini-tag pending">{{ acc.pending }} 待发布</span>
                <span class="mini-tag done">{{ acc.published }} 已发布</span>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无账号数据" />
        </div>
      </template>

      <template #city-table="{ module }">
        <div class="panel city-list-panel">
          <div class="panel-head">
            <h2>{{ module ? module.title : '账号状态' }}</h2>
            <router-link to="/city/tasks">查看全部</router-link>
          </div>
          <div v-if="accountStatsList.length" class="account-list">
            <div v-for="acc in accountStatsList" :key="acc.name" class="account-row">
              <div class="account-left">
                <strong>{{ acc.name }}</strong>
                <span>{{ acc.platformLabel }} · 本月 {{ acc.monthly }} 条</span>
              </div>
              <div class="account-right">
                <span class="mini-tag pending">{{ acc.pending }} 待发布</span>
                <span class="mini-tag done">{{ acc.published }} 已发布</span>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无账号数据" />
        </div>
      </template>
    </ConfigurablePageRenderer>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { HomeFilled, Refresh, Download, Promotion } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { getCityDistributions, getNotifications, getTaskProgress } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const cityWorkbenchLayoutModules = layoutModuleCatalog.cityWorkbench
const { bindings: layoutBindings } = useLayoutBindings('cityWorkbench')
const tasks = ref([])
const notifications = ref([])
const unread = ref(0)
const taskDate = ref(dayjs().format('YYYY-MM-DD'))
const taskStatus = ref('')
const cityProgress = ref({ progress: { percentage: 0, completed: 0, target: 0 } })
const currentUser = computed(() => {
  try { return JSON.parse(localStorage.getItem('auth_user') || '{}') } catch { return {} }
})
const userName = computed(() => currentUser.value.name || currentUser.value.username || '城市伙伴')
const stats = computed(() => ({
  pending: tasks.value.filter(item => item.status !== 'published').length,
  published: tasks.value.filter(item => item.status === 'published').length,
  today: tasks.value.filter(item => item.date === dayjs().format('YYYY-MM-DD')).length
}))
const visibleTasks = computed(() => tasks.value.filter((item) => {
  const dateMatched = taskDate.value ? item.date === taskDate.value : true
  const statusMatched = taskStatus.value ? item.status === taskStatus.value : true
  return dateMatched && statusMatched
}))
const todayTasks = computed(() => visibleTasks.value)
const scheduleByDate = computed(() => {
  const map = {}
  for (const item of visibleTasks.value) {
    const key = item.date || ''
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return map
})
const scheduleDates = computed(() => {
  return Object.keys(scheduleByDate.value).sort((a, b) => a.localeCompare(b)).slice(0, 5)
})
const platformColor = (platform) => {
  const colors = { douyin: '#0f172a', kuaishou: '#ff6633', weixin: '#07c160', xiaohongshu: '#ff2442' }
  return colors[platform] || '#6366f1'
}
const platformLabelMap = (platform) => {
  const labels = { douyin: '抖音', kuaishou: '快手', weixin: '视频号', xiaohongshu: '小红书' }
  return labels[platform] || '其他平台'
}
const accountStatsList = computed(() => {
  const accMap = {}
  const monthPrefix = dayjs().format('YYYY-MM')
  for (const task of tasks.value) {
    const name = task.account_name || '未知账号'
    if (!accMap[name]) {
      accMap[name] = {
        name,
        platform: task.publish_platform || task.platform || 'other',
        pending: 0,
        published: 0,
        monthly: 0
      }
    }
    if (task.status === 'published') accMap[name].published++
    else accMap[name].pending++
    if ((task.date || '').startsWith(monthPrefix)) accMap[name].monthly++
  }
  return Object.values(accMap).map(a => ({
    ...a,
    platformLabel: platformLabelMap(a.platform)
  })).sort((a, b) => b.pending - a.pending)
})
const monthPublished = computed(() => cityProgress.value?.totals?.cityPublished || tasks.value.filter(item => item.status === 'published' && String(item.date || '').startsWith(dayjs().format('YYYY-MM'))).length)
const openLink = (url) => {
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}
const normalizeBoundDate = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) return value[0] || ''
  return String(value).slice(0, 10)
}
const normalizeStatus = (value) => {
  const map = { '全部': '', '待发布': 'pending', '已发布': 'published', '发布失败': 'failed' }
  return map[value] ?? value ?? ''
}
const applyLayoutBindings = (bindings = {}) => {
  const nextDate = normalizeBoundDate(bindings.date)
  if (nextDate) taskDate.value = nextDate
  if ('status' in bindings) taskStatus.value = normalizeStatus(bindings.status)
}

const loadData = async () => {
  const [taskData, noticeData, progressData] = await Promise.all([
    getCityDistributions({ pageSize: 100 }),
    getNotifications({ pageSize: 10 }),
    getTaskProgress()
  ])
  tasks.value = taskData.list || []
  notifications.value = noticeData.list || []
  unread.value = noticeData.unread || 0
  cityProgress.value = progressData || cityProgress.value
}

onMounted(loadData)
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>

<style scoped>
.city-page { display: flex; flex-direction: column; gap: 16px; }
.hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 22px 24px; background: #fff; border: 1px solid #eceff5; border-radius: 16px; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #0f766e; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.hero h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; }
.hero p { margin: 0; color: #7b8497; font-size: 13px; }
.summary-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
.sum-card { padding: 18px; border-radius: 14px; background: #fff; border: 1px solid #eceff5; }
.sum-card.primary { background: linear-gradient(135deg, #4f46e5, #8b5cf6); border: 0; color: #fff; }
.sum-card strong { display: block; font-size: 28px; color: #4f46e5; margin-bottom: 4px; }
.sum-card.primary strong { color: #fff; }
.sum-card.green strong { color: #059669; }
.sum-card.amber strong { color: #d97706; }
.sum-card.blue strong { color: #0284c7; }
.sum-card span { color: #7b8497; font-size: 13px; }
.sum-card.primary span { color: rgba(255,255,255,.82); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 24px; display: flex; flex-direction: column; }
.panel-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.panel-head h2 { margin: 0; font-size: 16px; color: #0f172a; }
.panel-head a { color: #4f46e5; font-size: 13px; text-decoration: none; }
.task-list, .notice-list { display: flex; flex-direction: column; gap: 10px; flex: 1; overflow-y: auto; }
.task-row, .notice-row { display: flex; justify-content: space-between; gap: 12px; padding: 12px; border: 1px solid #eef0f6; border-radius: 10px; background: #fafbff; }
.task-row div, .notice-row { min-width: 0; }
.task-row strong, .notice-row strong { display: block; color: #0f172a; font-size: 13.5px; margin-bottom: 4px; }
.task-row span, .notice-row span { color: #7b8497; font-size: 12.5px; }
.task-row.rich { align-items: center; }
.task-row em { display: block; margin-top: 5px; color: #94a3b8; font-size: 12px; font-style: normal; }
.row-actions { display: flex; gap: 6px; flex-shrink: 0; }

.btn-download {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  height: 28px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #1d4ed8;
}
.btn-download:hover {
  background: linear-gradient(135deg, #bfdbfe, #93c5fd);
  transform: translateY(-1px);
  box-shadow: 0 2px 6px rgba(59, 130, 246, 0.25);
}

.btn-fill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  height: 28px;
  font-size: 12px;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  transition: all 0.2s ease;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  background: linear-gradient(135deg, #4f46e5, #6366f1) !important;
  color: #ffffff !important;
}
.btn-fill:hover {
  background: linear-gradient(135deg, #4338ca, #4f46e5) !important;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(79, 70, 229, 0.35) !important;
}

/* 城市账号列表 */
.city-list-panel { min-height: 200px; }
.account-list { display: flex; flex-direction: column; gap: 10px; }
.account-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px; background: #fafbff; border: 1px solid #eef0f6; border-radius: 12px; transition: all 0.2s; }
.account-row:hover { background: #fff; border-color: #c7d2fe; }
.account-left { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.account-left strong { color: #0f172a; font-size: 14px; }
.account-left span { color: #64748b; font-size: 12px; }
.account-right { display: flex; gap: 8px; flex-shrink: 0; }
.mini-tag { padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; }
.mini-tag.pending { background: #fef3c7; color: #92400e; }
.mini-tag.done { background: #dcfce7; color: #166534; }

/* 排期模块 */
.schedule-panel { min-height: 200px; }
.schedule-dates { display: flex; flex-direction: column; gap: 16px; }
.schedule-day { background: #fafbff; border: 1px solid #eef0f6; border-radius: 12px; padding: 12px; }
.schedule-day-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.day-label { font-weight: 700; color: #0f172a; font-size: 14px; }
.day-count { font-size: 12px; color: #64748b; background: #fff; padding: 2px 8px; border-radius: 6px; }
.event-list { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.event-card { display: flex; align-items: center; gap: 8px; padding: 10px; background: #fff; border: 1px solid #eef0f6; border-radius: 10px; }
.event-card.published { background: linear-gradient(135deg, #f0fdf4, #fff); border-color: #bbf7d0; }
.event-time { font-weight: 700; color: #4f46e5; font-size: 13px; min-width: 42px; }
.event-platform { width: 4px; height: 24px; border-radius: 4px; flex-shrink: 0; }
.event-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.event-body strong { color: #0f172a; font-size: 13px; }
.event-body span { color: #64748b; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.event-tag { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; flex-shrink: 0; }
.event-tag.pending { background: #fef3c7; color: #92400e; }
.event-tag.done { background: #dcfce7; color: #166534; }

@media (max-width: 900px) { .summary-row, .grid { grid-template-columns: 1fr; } .hero { flex-direction: column; align-items: stretch; } .event-list { grid-template-columns: 1fr; } }
</style>
