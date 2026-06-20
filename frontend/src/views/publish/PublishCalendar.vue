<template>
  <div class="calendar-page">
    <ConfigurablePageRenderer page-key="publishCalendar" :modules="publishCalendarLayoutModules">

    <!-- Page head -->
    <template #page-head>
      <div class="page-head">
      <div class="head-left">
        <div class="eyebrow">
          <span class="dot"></span>{{ isCityUser ? '城市任务 · 按月查看' : '发布排期 · 按月规划' }}
        </div>
        <h1 class="head-title">
          {{ isCityUser ? '任务日历' : '发布日历' }}
          <span class="head-sub">{{ currentMonth.format('YYYY') }} 年 {{ currentMonth.format('M') }} 月 · 共 {{ monthTotal }} 条{{ isCityUser ? '任务' : '排期' }}</span>
        </h1>
      </div>
      <div class="head-right">
        <div class="month-picker">
          <button class="icon-btn" @click="changeMonth(-1)">
            <el-icon><ArrowLeft /></el-icon>
          </button>
          <div class="month-label">
            <strong>{{ currentMonth.format('M月') }}</strong>
            <span>{{ currentMonth.format('YYYY') }}</span>
          </div>
          <button class="icon-btn" @click="changeMonth(1)">
            <el-icon><ArrowRight /></el-icon>
          </button>
          <button class="today-btn" @click="goToday">今天</button>
        </div>
        <button v-if="!isCityUser" class="primary-btn" @click="$router.push('/publish/list')">
          <el-icon><Plus /></el-icon>
          新增排期
        </button>
      </div>
      </div>
    </template>

    <!-- Legend / stat strip -->
    <template #legend-strip>
      <div class="legend-strip">
      <div class="legend-left">
        <div v-for="p in platforms" :key="p.key" class="legend-item">
      <span class="legend-dot" :style="{ background: p.color }"></span>
      <span class="legend-label"><IconFont :platform="p.key" :color="p.color" /> {{ p.label }}</span>
          <span class="legend-count">{{ countByPlatform(p.key) }}</span>
        </div>
      </div>
      <div class="legend-right">
        <div class="legend-summary">
          <strong>{{ publishedCount }}</strong><span>已发布</span>
          <i></i>
          <strong>{{ pendingCount }}</strong><span>待发布</span>
          <i></i>
          <strong>{{ monthTotal }}</strong><span>本月合计</span>
        </div>
      </div>
      </div>
    </template>

    <!-- Calendar grid -->
    <template #calendar-wrap>
      <div class="calendar-wrap">
      <!-- Week header -->
      <div class="week-row">
        <div v-for="(w, i) in weekLabels" :key="i" class="week-cell">
          <span :class="{ today: isTodayWeekday(i) }">{{ w }}</span>
        </div>
      </div>

      <!-- Day cells -->
      <div class="day-grid">
        <div
          v-for="(day, idx) in days"
          :key="idx"
          class="day-cell"
          :class="{ muted: !day.inMonth, today: day.isToday, active: selectedDate === day.date }"
          @click="selectDate(day.date)"
        >
          <div class="day-head">
            <span class="day-num">{{ day.label }}</span>
            <span v-if="day.isToday" class="today-tag">今天</span>
            <span v-if="day.events.length" class="day-count">{{ day.events.length }} 条</span>
          </div>

          <div class="day-events">
            <div
              v-for="(ev, i) in day.events"
              :key="i"
              class="event"
              :style="{ borderLeftColor: platformColor(ev.platform) }"
              @click.stop="openEvent(ev)"
            >
              <span class="event-time">{{ ev.time }}</span>
              <span class="event-title">{{ ev.title }}</span>
            </div>
            <div v-if="!day.events.length && day.inMonth" class="empty-hint">无排期</div>
          </div>
        </div>
      </div>
      </div>
    </template>

    <!-- Day detail panel -->
    <template #detail-panel>
      <div class="detail-panel" v-if="selectedDate">
      <div class="detail-head">
        <div>
          <div class="detail-title">{{ selectedMonthDay }} 的{{ isCityUser ? '任务' : '排期' }}</div>
          <div class="detail-sub">共 {{ selectedEvents.length }} 条</div>
        </div>
        <button class="ghost-btn small" @click="selectedDate = ''">
          <el-icon><Close /></el-icon>
          关闭
        </button>
      </div>

      <div v-if="!selectedEvents.length" class="empty-state">
        <div class="empty-icon">
          <el-icon><Calendar /></el-icon>
        </div>
        <div class="empty-title">{{ isCityUser ? '该日无任务' : '该日无排期' }}</div>
        <div class="empty-sub">{{ isCityUser ? '请返回“我的任务”查看更多下发任务' : '点击右上角「新增排期」来创建一条发布计划' }}</div>
      </div>

      <div class="detail-list" v-else>
        <div
          v-for="(ev, i) in selectedEvents"
          :key="i"
          class="detail-item"
          @click="openEvent(ev)"
        >
          <div class="detail-time">
            <strong>{{ ev.time }}</strong>
            <span>{{ selectedDate.slice(5).replace('-', '/') }}</span>
          </div>
          <div class="detail-line" :style="{ background: platformColor(ev.platform) }"></div>
          <div class="detail-body">
            <div class="detail-row">
              <span class="platform-pill" :style="{ color: platformColor(ev.platform) }">
                <IconFont :platform="ev.platform" :color="platformColor(ev.platform)" /> {{ platformLabel(ev.platform) }}
              </span>
              <span class="status-pill">
                {{ ev.status === 'published' ? '已发布' : ev.status === 'pending' ? '待发布' : '待确认' }}
              </span>
            </div>
            <strong class="detail-account">{{ ev.account_name }}</strong>
            <span class="detail-video">{{ ev.title }}</span>
          </div>
        </div>
      </div>
      </div>
    </template>

    </ConfigurablePageRenderer>

  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ArrowLeft, ArrowRight, Plus, Close, Calendar } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { getScheduleCalendar, getCityDistributions } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { isCityUser as isCityUserFn } from '@/utils/authRole'

const readCurrentUser = () => {
  try { return JSON.parse(localStorage.getItem('auth_user') || '{}') }
  catch { return {} }
}
const isCityUser = isCityUserFn(readCurrentUser())

const publishCalendarLayoutModules = layoutModuleCatalog.publishCalendar
const { bindings: layoutBindings } = useLayoutBindings('publishCalendar')
const currentMonth = ref(dayjs())
const schedules = ref([])
const selectedDate = ref('')
const platformFilter = ref('')

const weekLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const platforms = [
  { key: 'douyin', label: '抖音', color: '#EF4444' },
  { key: 'kuaishou', label: '快手', color: '#F59E0B' },
  { key: 'weixin', label: '视频号', color: '#10B981' },
  { key: 'xiaohongshu', label: '小红书', color: '#EC4899' },
  { key: 'other', label: '其他', color: '#6366F1' }
]

const days = computed(() => {
  const start = currentMonth.value.startOf('month').startOf('week')
  const total = 42
  const arr = []
  for (let i = 0; i < total; i++) {
    const d = start.add(i, 'day')
    const date = d.format('YYYY-MM-DD')
    arr.push({
      date,
      label: d.date(),
      inMonth: d.month() === currentMonth.value.month(),
      isToday: date === dayjs().format('YYYY-MM-DD'),
      events: visibleSchedules.value.filter(s => s.date === date)
    })
  }
  return arr
})

const visibleSchedules = computed(() => platformFilter.value ? schedules.value.filter(s => s.platform === platformFilter.value) : schedules.value)
const monthTotal = computed(() => visibleSchedules.value.length)
const publishedCount = computed(() => visibleSchedules.value.filter(s => s.status === 'published').length)
const pendingCount = computed(() => visibleSchedules.value.filter(s => s.status !== 'published').length)

const selectedMonthDay = computed(() => {
  if (!selectedDate.value) return ''
  return dayjs(selectedDate.value).format('M月D日')
})
const selectedEvents = computed(() =>
  visibleSchedules.value
    .filter(s => s.date === selectedDate.value)
    .sort((a, b) => a.time.localeCompare(b.time))
)

const countByPlatform = (key) => schedules.value.filter(s => s.platform === key).length

const platformColor = (key) => {
  const p = platforms.find(x => x.key === key)
  return p?.color || '#6366F1'
}
const platformLabel = (key) => {
  const p = platforms.find(x => x.key === key)
  return p?.label || key
}

const changeMonth = (step) => {
  currentMonth.value = currentMonth.value.add(step, 'month')
  loadData()
}
const goToday = () => {
  currentMonth.value = dayjs()
  selectedDate.value = dayjs().format('YYYY-MM-DD')
  loadData()
}
const selectDate = (date) => { selectedDate.value = date }
const isTodayWeekday = (i) => dayjs().day() === i
const normalizeBoundDate = (value) => {
  if (!value) return ''
  if (Array.isArray(value)) return value[0] || ''
  return String(value).slice(0, 10)
}

const applyLayoutBindings = (bindings = {}) => {
  const monthDate = normalizeBoundDate(bindings.month || bindings.date)
  if (monthDate) {
    const nextMonth = dayjs(monthDate)
    if (nextMonth.isValid() && nextMonth.format('YYYY-MM') !== currentMonth.value.format('YYYY-MM')) {
      currentMonth.value = nextMonth
      loadData()
    }
    selectedDate.value = monthDate
  }
  if ('selectedDate' in bindings) selectedDate.value = normalizeBoundDate(bindings.selectedDate) || selectedDate.value
  if ('platform' in bindings) platformFilter.value = bindings.platform === '全部' ? '' : (bindings.platform || '')
}

const openEvent = (ev) => {
  console.log('open event', ev)
}

const loadData = async () => {
  const monthStart = currentMonth.value.startOf('month').format('YYYY-MM-DD')
  const monthEnd = currentMonth.value.endOf('month').format('YYYY-MM-DD')
  try {
    let rows = []
    if (isCityUser) {
      // 城市端：拉取城市下发任务
      const data = await getCityDistributions({
        dateFrom: monthStart,
        dateTo: monthEnd,
        pageSize: 2000
      }, { silentError: true })
      rows = (data?.list || []).map(s => ({
        ...s,
        title: s.video_title || '城市下发任务',
        account_name: s.publish_account_name || s.account_name || s.publisher_name || '本城市账号',
        platform: s.platform || s.publish_platform || 'other',
        time: s.publish_time || s.time || '09:00',
        status: s.status === 'published' ? 'published' : s.status === 'failed' ? 'failed' : 'pending'
      }))
    } else {
      // 管理端：拉取排期
      const data = await getScheduleCalendar({
        year: currentMonth.value.year(),
        month: currentMonth.value.format('MM')
      })
      rows = Array.isArray(data) ? data : (data?.list || [])
      rows = rows.map(s => ({
        ...s,
        title: s.video_title || s.title || '未命名视频'
      }))
    }
    schedules.value = rows
  } catch (e) {
    schedules.value = []
  }
}

onMounted(() => {
  selectedDate.value = dayjs().format('YYYY-MM-DD')
  loadData()
})
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>

<style scoped>
/* base */
.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; font-weight: 500; letter-spacing: 0.02em; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.head-left { display: flex; flex-direction: column; gap: 8px; }
.head-title { font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: -0.015em; line-height: 1.2; display: flex; flex-direction: column; gap: 6px; }
.head-sub { font-size: 13.5px; color: #6b7280; font-weight: 400; }
.head-right { display: flex; align-items: center; gap: 12px; }

.primary-btn {
  height: 38px; padding: 0 16px; border-radius: 10px; border: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
  font-size: 13.5px; font-weight: 600; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 4px 12px rgba(99,102,241,0.28); transition: all 0.18s ease;
}
.primary-btn:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99,102,241,0.35); }

.ghost-btn {
  height: 32px; padding: 0 12px; border-radius: 8px;
  border: 1px solid #e5e7eb; background: #fff; color: #374151;
  font-size: 12.5px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 5px; transition: all 0.15s;
}
.ghost-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.ghost-btn.small { height: 28px; padding: 0 10px; font-size: 12px; }

.icon-btn {
  width: 32px; height: 32px; border-radius: 8px; border: 0;
  background: #f3f4f6; color: #374151; cursor: pointer;
  display: grid; place-items: center; transition: all 0.15s;
}
.icon-btn:hover { background: #e0e7ff; color: #6366f1; }

.month-picker {
  display: flex; align-items: center; gap: 8px;
  padding: 4px; border-radius: 10px; background: #fff; border: 1px solid #ececf1;
}
.month-label {
  padding: 0 8px; display: flex; flex-direction: column; align-items: center;
  line-height: 1.1; min-width: 48px;
}
.month-label strong { font-size: 14px; color: #0f172a; font-weight: 700; }
.month-label span { font-size: 11px; color: #9ca3af; }
.today-btn {
  height: 28px; padding: 0 10px; border-radius: 7px;
  border: 1px solid #e0e7ff; background: #eef2ff; color: #4338ca;
  font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s;
}
.today-btn:hover { background: #e0e7ff; }

/* legend */
.legend-strip {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
  padding: 14px 18px; background: #fff; border: 1px solid #ececf1;
  border-radius: 14px; margin-bottom: 16px;
}
.legend-left { display: flex; gap: 14px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 8px; }
.legend-dot { width: 8px; height: 8px; border-radius: 999px; }
.legend-label { font-size: 12.5px; color: #374151; font-weight: 500; }
.legend-count { font-size: 12px; color: #9ca3af; font-weight: 600; font-variant-numeric: tabular-nums; }

.legend-right { display: flex; align-items: center; }
.legend-summary {
  display: flex; align-items: center; gap: 10px;
  padding-left: 14px; border-left: 1px solid #ececf1;
}
.legend-summary strong { font-size: 16px; color: #0f172a; font-weight: 700; font-variant-numeric: tabular-nums; }
.legend-summary span { font-size: 12px; color: #6b7280; margin-right: 2px; }
.legend-summary i { width: 1px; height: 16px; background: #ececf1; display: inline-block; }

/* calendar wrap */
.calendar-wrap {
  background: #fff; border: 1px solid #ececf1; border-radius: 14px; overflow: hidden;
}

.week-row {
  display: grid; grid-template-columns: repeat(7, 1fr);
  background: #fafbfc; border-bottom: 1px solid #ececf1;
}
.week-cell {
  padding: 12px 16px; font-size: 12.5px; color: #6b7280;
  font-weight: 600; letter-spacing: 0.02em;
}
.week-cell span.today { color: #6366f1; }

.day-grid {
  display: grid; grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-auto-rows: minmax(140px, auto);
}
.day-cell {
  padding: 12px; border-right: 1px solid #ececf1; border-bottom: 1px solid #ececf1;
  display: flex; flex-direction: column; gap: 8px;
  transition: all 0.18s ease; cursor: pointer;
  min-height: 140px;
}
.day-cell:nth-child(7n) { border-right: none; }
.day-cell.muted { background: #fafbfc; }
.day-cell:hover:not(.muted) { background: #fafaff; }
.day-cell.today { background: #f5f3ff; }
.day-cell.today:hover { background: #ede9fe; }
.day-cell.active { box-shadow: inset 0 0 0 2px #6366f1; background: #eef2ff; }

.day-head {
  display: flex; align-items: center; gap: 8px;
}
.day-num {
  font-size: 13px; font-weight: 700; color: #111827;
  font-variant-numeric: tabular-nums; min-width: 20px;
}
.day-cell.muted .day-num { color: #9ca3af; }
.day-cell.today .day-num {
  color: #6366f1; font-size: 14px;
}
.today-tag {
  padding: 2px 6px; font-size: 10px; border-radius: 5px;
  background: #6366f1; color: #fff; font-weight: 600; letter-spacing: 0.02em;
}
.day-count {
  margin-left: auto; font-size: 10.5px; color: #6b7280; font-weight: 500;
  background: #f3f4f6; padding: 2px 6px; border-radius: 5px;
}
.day-cell.today .day-count { background: #e0e7ff; color: #4338ca; }

.day-events {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  max-height: 136px;
  overflow-y: auto;
  padding-right: 3px;
}
.day-events::-webkit-scrollbar { width: 4px; }
.day-events::-webkit-scrollbar-thumb { background: #c7d2fe; border-radius: 999px; }
.day-events::-webkit-scrollbar-track { background: transparent; }
.event {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px; background: #f9fafb; border-radius: 7px;
  font-size: 11.5px; color: #374151;
  border-left: 3px solid #6366f1;
  transition: all 0.15s;
  min-width: 0;
  flex-shrink: 0;
}
.event:hover { background: #fff; transform: translateX(2px); box-shadow: 0 2px 6px rgba(0,0,0,0.05); }
.event-time { color: #6b7280; font-weight: 600; font-variant-numeric: tabular-nums; flex-shrink: 0; }
.event-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }

.event-more {
  text-align: center; font-size: 11.5px; color: #6366f1; font-weight: 600;
  padding: 4px; background: #eef2ff; border-radius: 6px; cursor: pointer;
  transition: all 0.15s;
}
.event-more:hover { background: #e0e7ff; }

.empty-hint {
  flex: 1; display: grid; place-items: center;
  font-size: 11px; color: #d1d5db; font-style: italic;
}

/* detail panel */
.detail-panel {
  margin-top: 16px;
  background: #fff; border: 1px solid #ececf1; border-radius: 14px;
  padding: 20px 22px;
}
.detail-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px dashed #ececf1; }
.detail-title { font-size: 17px; color: #0f172a; font-weight: 700; letter-spacing: -0.01em; }
.detail-sub { font-size: 12.5px; color: #6b7280; margin-top: 3px; }

.empty-state {
  display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 40px 0;
}
.empty-icon {
  width: 60px; height: 60px; border-radius: 16px; background: #f3f4f6;
  display: grid; place-items: center; font-size: 24px; color: #9ca3af;
}
.empty-title { font-size: 15px; color: #111827; font-weight: 600; }
.empty-sub { font-size: 12.5px; color: #9ca3af; }

.detail-list { display: flex; flex-direction: column; gap: 10px; }
.detail-item {
  display: grid; grid-template-columns: 80px 3px 1fr; gap: 14px;
  padding: 14px 16px; border: 1px solid #ececf1; border-radius: 12px;
  background: #fafbfc; transition: all 0.18s; cursor: pointer;
}
.detail-item:hover { background: #fff; border-color: #e0e7ff; transform: translateX(4px); box-shadow: 0 6px 14px rgba(99,102,241,0.08); }

.detail-time {
  display: flex; flex-direction: column; gap: 4px; padding-top: 2px;
}
.detail-time strong { font-size: 16px; color: #0f172a; font-weight: 700; font-variant-numeric: tabular-nums; }
.detail-time span { font-size: 11.5px; color: #9ca3af; }

.detail-line {
  width: 3px; border-radius: 99px; margin: 4px 0;
}

.detail-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.detail-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.platform-pill { padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 700; letter-spacing: 0.02em; display: inline-flex; align-items: center; gap: 4px; }
.status-pill {
  padding: 3px 9px; border-radius: 99px; font-size: 11px; font-weight: 600;
  background: #ecfdf5; color: #059669;
}
.detail-account { font-size: 14px; color: #0f172a; font-weight: 700; }
.detail-video { font-size: 12.5px; color: #6b7280; }

@media (max-width: 900px) {
  .legend-strip { flex-direction: column; align-items: flex-start; }
  .legend-right { width: 100%; padding-top: 12px; border-top: 1px dashed #ececf1; }
  .legend-summary { border-left: 0; padding-left: 0; }
  .day-grid { grid-template-columns: repeat(7, 1fr); }
  .day-cell { min-height: 100px; padding: 8px 6px; }
  .day-events { max-height: 86px; }
  .event { font-size: 10px; padding: 4px 6px; gap: 4px; }
  .event-title { display: none; }
  .day-count { display: none; }
}
</style>
