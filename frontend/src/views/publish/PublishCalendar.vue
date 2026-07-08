<template>
  <div class="calendar-page">
    <ConfigurablePageRenderer page-key="publishCalendar" :modules="calendarLayoutModules">

    <!-- Page head -->
    <template #page-head>
      <div class="page-head">
      <div class="head-left">
        <div class="eyebrow">
          <span class="dot"></span>{{ isCityUser ? '城市任务 · 按月查看' : '发布排期 · 按月规划' }}
        </div>
        <h1 class="head-title">
          {{ isCityUser ? '任务日历' : '发布日历' }}
          <span class="head-sub" v-if="isCityUser">{{ currentMonth.format('YYYY') }} 年 {{ currentMonth.format('M') }} 月 · 共 {{ monthTotal }} 条任务</span>
          <span class="head-sub" v-else>城市发布情况与总部发布排期分开展示</span>
        </h1>
      </div>
      <div class="head-right">
        <button v-if="!isCityUser" class="primary-btn" @click="$router.push('/publish/list')">
          <el-icon><Plus /></el-icon>
          新增排期
        </button>
      </div>
      </div>
    </template>

    <template #city-board>
      <section v-if="!isCityUser" class="city-publish-board">
        <div class="section-head">
          <div>
            <span class="section-kicker">城市发布看板 · {{ citySelectedDayLabel }}</span>
            <h2>各城市视频发布情况</h2>
            <p>所选日期执行情况与 {{ cityMonthLabel }}累计数据分开统计</p>
          </div>
          <div class="city-board-tools">
            <el-date-picker v-model="citySelectedDate" type="date" value-format="YYYY-MM-DD" format="YYYY-MM-DD" :clearable="false" @change="onCityDateChange" />
            <div class="city-total-summary">
              <div><span>当日下发</span><strong>{{ cityTodaySummary.distributed }}</strong></div>
              <div><span>当日发布</span><strong>{{ cityTodaySummary.published }}</strong></div>
              <div><span>{{ cityMonthLabel }}下发</span><strong>{{ cityMonthTotal }}</strong></div>
              <div><span>{{ cityMonthLabel }}发布</span><strong>{{ cityMonthPublished }}</strong></div>
            </div>
          </div>
        </div>
        <div v-if="cityBoardRows.length" class="city-card-grid">
          <article v-for="city in cityBoardRows" :key="city.id" class="city-status-card">
            <div class="city-card-head">
              <div class="city-avatar">{{ city.name.slice(0, 1) }}</div>
              <div><strong>{{ city.name }}</strong><span>{{ city.accountCount }} 个发布账号</span></div>
              <span class="city-rate">{{ city.monthRate }}%</span>
            </div>
            <div class="today-metrics">
              <div><span>当日下发</span><strong>{{ city.todayDistributed }}</strong></div>
              <div><span>当日下载</span><strong class="download">{{ city.todayDownloaded }}</strong></div>
              <div><span>当日发布</span><strong class="success">{{ city.todayPublished }}</strong></div>
            </div>
            <div class="city-publish-status" :class="{ complete: city.allAccountsPublished }">
              <span>{{ city.publishSummary }}</span>
              <button type="button" @click="openCityDetail(city)">查看详情</button>
            </div>
            <div class="month-metrics">
              <span>{{ cityMonthLabel }}下发 <b>{{ city.monthDistributed }}</b></span>
              <span>{{ cityMonthLabel }}发布 <b>{{ city.monthPublished }}</b></span>
            </div>
            <div class="progress-track"><i :style="{ width: city.monthRate + '%' }"></i></div>
          </article>
        </div>
        <div v-else class="board-empty">当前月份暂无城市下发任务</div>
      </section>
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
          <strong>{{ monthTotal }}</strong><span>{{ currentMonth.format('M月') }}合计</span>
        </div>
      </div>
      </div>
    </template>

    <!-- Calendar grid -->
    <template #calendar-wrap>
      <section class="hq-calendar-board">
      <div class="section-head compact">
        <div>
          <span class="section-kicker">{{ isCityUser ? '本城市任务' : '总部发布' }}</span>
          <h2>{{ isCityUser ? '城市任务日历' : '总部发布日历' }}</h2>
          <p>{{ isCityUser ? '按日期查看总部下发给本城市的任务' : '只展示总部发布排期，不与城市下发任务混合' }}</p>
        </div>
        <div class="month-picker">
          <button class="icon-btn" @click="changeMonth(-1)"><el-icon><ArrowLeft /></el-icon></button>
          <div class="month-label"><strong>{{ currentMonth.format('M月') }}</strong><span>{{ currentMonth.format('YYYY') }}</span></div>
          <button class="icon-btn" @click="changeMonth(1)"><el-icon><ArrowRight /></el-icon></button>
          <button class="today-btn" @click="goToday">本月</button>
        </div>
      </div>
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
            <span v-if="day.events.length && !isCityUser" class="day-count">{{ day.events.length }} 条</span>
          </div>

          <div class="day-events">
            <template v-if="isCityUser">
              <div v-if="cityPublishedOn(day.date).length" class="city-day-publish-count">
                <span>发布数量</span>
                <strong>{{ cityPublishedOn(day.date).length }}</strong>
              </div>
              <button
                v-if="cityDayRecords(day.date).length"
                type="button"
                class="city-day-detail-btn"
                @click.stop="openCityDayDetail(day.date)"
              >查看详情</button>
              <div v-if="!cityDayRecords(day.date).length && day.inMonth" class="empty-hint">暂无记录</div>
            </template>
            <template v-else>
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
            </template>
          </div>
        </div>
      </div>
      </div>
      </section>
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

    <div v-if="cityDetailVisible" class="city-detail-overlay" @click.self="closeCityDetail">
      <div class="city-detail-dialog">
        <div class="city-detail-head">
          <div>
            <span>{{ citySelectedDayLabel }}</span>
            <h3>{{ detailCity?.name }}账号发布详情</h3>
          </div>
          <button type="button" @click="closeCityDetail"><el-icon><Close /></el-icon></button>
        </div>
        <div class="city-detail-summary">
          <span>账号总数 <b>{{ detailCity?.accountCount || 0 }}</b></span>
          <span>已发布账号 <b>{{ detailCity?.publishedAccountCount || 0 }}</b></span>
          <span>发布视频 <b>{{ detailCity?.todayPublished || 0 }}</b></span>
        </div>
        <div class="city-account-list">
          <div v-for="account in detailCity?.accountPublishRows || []" :key="account.id" class="city-account-row">
            <div class="account-main">
              <IconFont :platform="account.platform || 'other'" custom-class="account-platform-logo" />
              <div><strong>{{ account.name }}</strong><span>{{ platformLabel(account.platform) }}</span></div>
            </div>
            <div class="account-videos">
              <span v-for="video in account.items" :key="video.id">{{ video.video_title || '城市发布视频' }}</span>
              <em v-if="!account.items.length">所选日期暂无发布视频</em>
            </div>
            <span class="account-state" :class="{ done: account.items.length }">{{ account.items.length ? `已发布 ${account.items.length} 条` : '未发布' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="cityDayDetailVisible" class="city-detail-overlay" @click.self="closeCityDayDetail">
      <div class="city-day-detail-dialog">
        <div class="city-detail-head">
          <div>
            <span>{{ cityDayDetailLabel }}</span>
            <h3>当日发布情况</h3>
          </div>
          <button type="button" @click="closeCityDayDetail"><el-icon><Close /></el-icon></button>
        </div>
        <div class="city-day-summary">
          <div><span>下发数量</span><strong>{{ cityDayTaskRows.length }}</strong></div>
          <div><span>发布数量</span><strong>{{ cityDayPublishedRows.length }}</strong></div>
          <div><span>填报数量</span><strong>{{ cityDaySubmittedRows.length }}</strong></div>
        </div>
        <div v-if="cityDayDetailRows.length" class="city-day-table-wrap">
          <table class="city-day-table">
            <thead><tr><th>时间</th><th>平台</th><th>账号</th><th>视频</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="row in cityDayDetailRows" :key="row.id">
                <td>{{ cityRecordTime(row) }}</td>
                <td><span class="platform-pill" :style="{ color: platformColor(row.platform) }"><IconFont :platform="row.platform || 'other'" /> {{ platformLabel(row.platform) }}</span></td>
                <td>{{ row.account_name || row.publish_account_name || '城市账号' }}</td>
                <td>{{ row.video_title || '城市发布视频' }}</td>
                <td><span class="status-pill" :class="{ published: row.status === 'published' }">{{ row.status === 'published' ? '已发布' : '待填报' }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="city-day-empty">当天暂无下发、发布或填报记录</div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ArrowLeft, ArrowRight, Plus, Close, Calendar } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { getScheduleCalendar, getCityDistributions, getCities } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { isCityUser as isCityUserFn } from '@/utils/authRole'
import { usePageSearch } from '@/composables/usePageSearch'

const readCurrentUser = () => {
  try { return JSON.parse(localStorage.getItem('auth_user') || '{}') }
  catch { return {} }
}
const isCityUser = isCityUserFn(readCurrentUser())
const { matchesPageSearch } = usePageSearch()

const publishCalendarLayoutModules = layoutModuleCatalog.publishCalendar
const calendarLayoutModules = computed(() => isCityUser
  ? publishCalendarLayoutModules.filter(module => ['calendar-wrap', 'detail-panel'].includes(module.key))
  : publishCalendarLayoutModules
)
const { bindings: layoutBindings } = useLayoutBindings('publishCalendar')
const currentMonth = ref(dayjs())
const schedules = ref([])
const allCityRows = ref([])
const citySelectedDate = ref(dayjs().format('YYYY-MM-DD'))
const cities = ref([])
const selectedDate = ref('')
const platformFilter = ref('')
const cityDetailVisible = ref(false)
const detailCity = ref(null)
const cityDayDetailVisible = ref(false)
const cityDayDetailDate = ref('')

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

const visibleSchedules = computed(() => schedules.value.filter(item => {
  if (platformFilter.value && item.platform !== platformFilter.value) return false
  return matchesPageSearch(item.title, item.video_title, item.account_name, item.platform, item.date, item.status)
}))
const monthTotal = computed(() => visibleSchedules.value.length)
const publishedCount = computed(() => visibleSchedules.value.filter(s => s.status === 'published').length)
const pendingCount = computed(() => visibleSchedules.value.filter(s => s.status !== 'published').length)
const cityMonthStart = computed(() => dayjs(citySelectedDate.value).startOf('month').format('YYYY-MM-DD'))
const cityMonthEnd = computed(() => dayjs(citySelectedDate.value).endOf('month').format('YYYY-MM-DD'))
const cityMonthLabel = computed(() => dayjs(citySelectedDate.value).format('M月'))
const citySelectedDayLabel = computed(() => dayjs(citySelectedDate.value).format('YYYY年M月D日'))
const actualPublishDate = item => String(item.actual_publish_time || item.published_at || item.date || '').slice(0, 10)
const submittedDate = item => String(item.submitted_at || '').slice(0, 10)
const cityTaskRowsOn = date => visibleSchedules.value.filter(item => item.date === date)
const cityPublishedOn = date => visibleSchedules.value.filter(item => item.status === 'published' && actualPublishDate(item) === date)
const citySubmittedOn = date => visibleSchedules.value.filter(item => submittedDate(item) === date)
const mergeUniqueRows = (...groups) => [...new Map(groups.flat().map(item => [String(item.id), item])).values()]
const cityDayRecords = date => mergeUniqueRows(cityTaskRowsOn(date), cityPublishedOn(date), citySubmittedOn(date))
const cityDayTaskRows = computed(() => cityTaskRowsOn(cityDayDetailDate.value))
const cityDayPublishedRows = computed(() => cityPublishedOn(cityDayDetailDate.value))
const cityDaySubmittedRows = computed(() => citySubmittedOn(cityDayDetailDate.value))
const cityDayDetailRows = computed(() => cityDayRecords(cityDayDetailDate.value).sort((a, b) => cityRecordTime(a).localeCompare(cityRecordTime(b))))
const cityDayDetailLabel = computed(() => cityDayDetailDate.value ? dayjs(cityDayDetailDate.value).format('YYYY年M月D日') : '')
const cityMonthRows = computed(() => allCityRows.value.filter(item => item.date >= cityMonthStart.value && item.date <= cityMonthEnd.value))
const cityTodayRows = computed(() => allCityRows.value.filter(item => item.date === citySelectedDate.value))
const cityTodayDownloadedRows = computed(() => allCityRows.value.filter(item => String(item.downloaded_at || '').slice(0, 10) === citySelectedDate.value))
const cityMonthPublishedRows = computed(() => allCityRows.value.filter(item => item.status === 'published' && actualPublishDate(item) >= cityMonthStart.value && actualPublishDate(item) <= cityMonthEnd.value))
const cityTodayPublishedRows = computed(() => allCityRows.value.filter(item => item.status === 'published' && actualPublishDate(item) === citySelectedDate.value))
const cityMonthTotal = computed(() => cityMonthRows.value.length)
const cityMonthPublished = computed(() => cityMonthPublishedRows.value.length)
const cityTodaySummary = computed(() => ({
  distributed: cityTodayRows.value.length,
  published: cityTodayPublishedRows.value.length
}))
const cityBoardRows = computed(() => cities.value.map(city => {
  const monthRows = cityMonthRows.value.filter(item => String(item.city_id) === String(city.id))
  const todayRows = cityTodayRows.value.filter(item => String(item.city_id) === String(city.id))
  const todayDownloaded = cityTodayDownloadedRows.value.filter(item => String(item.city_id) === String(city.id)).length
  const monthPublished = cityMonthPublishedRows.value.filter(item => String(item.city_id) === String(city.id)).length
  const todayPublishedItems = cityTodayPublishedRows.value.filter(item => String(item.city_id) === String(city.id))
  const todayPublished = todayPublishedItems.length
  const accounts = Array.isArray(city.accounts) ? city.accounts : []
  const accountPublishRows = accounts.map(account => {
    const items = todayPublishedItems.filter(item => String(item.account_id) === String(account.id))
    return { ...account, items }
  })
  const publishedAccountCount = accountPublishRows.filter(account => account.items.length > 0).length
  const allAccountsPublished = accounts.length > 0 && publishedAccountCount >= accounts.length
  return {
    id: city.id,
    name: city.name || '未命名城市',
    accountCount: accounts.length,
    todayDistributed: todayRows.length,
    todayDownloaded,
    todayPublished,
    todayPublishedItems,
    accountPublishRows,
    publishedAccountCount,
    allAccountsPublished,
    publishSummary: allAccountsPublished ? '该城市账号均已发布' : (todayPublished ? '该城市账号部分视频已发' : '该城市账号当日尚未发布'),
    monthDistributed: monthRows.length,
    monthPublished,
    monthRate: monthRows.length ? Math.min(100, Math.round(monthPublished / monthRows.length * 100)) : (monthPublished ? 100 : 0)
  }
}).filter(city => (city.monthDistributed > 0 || city.todayDistributed > 0 || city.todayDownloaded > 0 || city.monthPublished > 0 || city.todayPublished > 0) && matchesPageSearch(
  city.name,
  ...city.accountPublishRows.flatMap(account => [account.name, account.platform, ...account.items.map(item => item.video_title)])
))
  .sort((a, b) => b.todayDistributed - a.todayDistributed || b.monthDistributed - a.monthDistributed))

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
const loadCityBoardData = async () => {
  if (isCityUser) return
  const [taskRows, publishedRows, downloadedRows] = await Promise.all([
    getCityDistributions({ dateFrom: cityMonthStart.value, dateTo: cityMonthEnd.value, pageSize: 5000 }, { silentError: true }),
    getCityDistributions({ actualDateFrom: cityMonthStart.value, actualDateTo: cityMonthEnd.value, status: 'published', pageSize: 5000 }, { silentError: true }),
    getCityDistributions({ downloadDateFrom: citySelectedDate.value, downloadDateTo: citySelectedDate.value, downloadStatus: 'downloaded', pageSize: 5000 }, { silentError: true })
  ])
  const merged = [...(taskRows?.list || []), ...(publishedRows?.list || []), ...(downloadedRows?.list || [])]
  allCityRows.value = [...new Map(merged.map(item => [item.id, item])).values()]
}
const onCityDateChange = () => loadCityBoardData()
const openCityDetail = (city) => {
  detailCity.value = city
  cityDetailVisible.value = true
}
const closeCityDetail = () => {
  cityDetailVisible.value = false
  detailCity.value = null
}
const openCityDayDetail = (date) => {
  selectedDate.value = date
  cityDayDetailDate.value = date
  cityDayDetailVisible.value = true
}
const closeCityDayDetail = () => {
  cityDayDetailVisible.value = false
}
const cityRecordTime = row => {
  const value = row.actual_publish_time || row.submitted_at || row.publish_time || row.time || ''
  if (!value) return '-'
  return String(value).includes(' ') ? String(value).slice(11, 16) : String(value).slice(0, 5)
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
      // 城市端：任务日期和实际发布日期分别查询，再按任务 ID 合并。
      const [taskData, publishedData, submittedData] = await Promise.all([
        getCityDistributions({ dateFrom: monthStart, dateTo: monthEnd, pageSize: 2000 }, { silentError: true }),
        getCityDistributions({ actualDateFrom: monthStart, actualDateTo: monthEnd, status: 'published', pageSize: 2000 }, { silentError: true }),
        getCityDistributions({ submittedDateFrom: monthStart, submittedDateTo: monthEnd, pageSize: 2000 }, { silentError: true })
      ])
      const mergedRows = mergeUniqueRows(taskData?.list || [], publishedData?.list || [], submittedData?.list || [])
      rows = mergedRows.map(s => ({
        ...s,
        title: s.video_title || '城市下发任务',
        account_name: s.publish_account_name || s.account_name || s.publisher_name || '本城市账号',
        platform: s.platform || s.publish_platform || 'other',
        time: s.publish_time || s.time || '09:00',
        status: s.status === 'published' ? 'published' : s.status === 'failed' ? 'failed' : 'pending'
      }))
    } else {
      // 管理端：总部排期与城市发布分开拉取、分开展示
      const [data, cityData] = await Promise.all([
        getScheduleCalendar({ year: currentMonth.value.year(), month: currentMonth.value.format('MM') }),
        getCities()
      ])
      rows = Array.isArray(data) ? data : (data?.list || [])
      rows = rows.map(s => ({
        ...s,
        title: s.video_title || s.title || '未命名视频'
      }))
      cities.value = Array.isArray(cityData) ? cityData : []
      await loadCityBoardData()
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

/* city / headquarters split */
.city-publish-board, .hq-calendar-board { width: 100%; }
.city-publish-board { padding: 22px; border: 1px solid #e0e7ff; border-radius: 18px; background: linear-gradient(145deg, #f8faff 0%, #f5f3ff 100%); }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; margin-bottom: 18px; }
.section-head.compact { margin-bottom: 14px; padding: 18px 20px; border: 1px solid #e5e7eb; border-radius: 14px; background: #fff; }
.section-head h2 { margin: 4px 0 5px; color: #0f172a; font-size: 20px; }
.section-head p { margin: 0; color: #64748b; font-size: 12.5px; }
.section-kicker { color: #6366f1; font-size: 11.5px; font-weight: 800; letter-spacing: .04em; }
.city-board-tools { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; }
.city-board-tools :deep(.el-date-editor) { width: 190px; }
.city-total-summary { display: grid; grid-template-columns: repeat(4, minmax(82px, 1fr)); gap: 10px; }
.city-total-summary > div { padding: 9px 12px; border: 1px solid #e0e7ff; border-radius: 11px; background: rgba(255,255,255,.88); }
.city-total-summary span { display: block; color: #64748b; font-size: 11px; }
.city-total-summary strong { display: block; margin-top: 3px; color: #312e81; font-size: 20px; }
.city-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(225px, 1fr)); gap: 10px; }
.city-status-card { padding: 13px; border: 1px solid #e2e8f0; border-radius: 13px; background: #fff; box-shadow: 0 4px 12px rgba(79,70,229,.05); }
.city-card-head { display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 9px; padding-bottom: 10px; border-bottom: 1px dashed #e2e8f0; }
.city-avatar { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 10px; color: #fff; background: linear-gradient(135deg,#6366f1,#8b5cf6); font-size: 15px; font-weight: 800; }
.city-card-head strong, .city-card-head span { display: block; }
.city-card-head strong { color: #0f172a; font-size: 14px; }
.city-card-head div > span { margin-top: 3px; color: #94a3b8; font-size: 11px; }
.city-rate { padding: 4px 7px; border-radius: 8px; color: #047857; background: #ecfdf5; font-size: 11px; font-weight: 800; }
.today-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-top: 9px; }
.today-metrics > div { padding: 8px 9px; border-radius: 9px; background: #f8fafc; }
.today-metrics span { display: block; color: #64748b; font-size: 11px; }
.today-metrics strong { display: block; margin-top: 2px; color: #4f46e5; font-size: 18px; }
.today-metrics strong.download { color: #0284c7; }
.today-metrics strong.success { color: #059669; }
.city-publish-status { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; padding: 7px 9px; border-radius: 9px; color: #b45309; background: #fffbeb; font-size: 10.5px; }
.city-publish-status.complete { color: #047857; background: #ecfdf5; }
.city-publish-status span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.city-publish-status button { flex: 0 0 auto; padding: 0; border: 0; background: transparent; color: #4f46e5; font-size: 10.5px; font-weight: 800; cursor: pointer; }
.month-metrics { display: flex; justify-content: space-between; gap: 8px; margin-top: 9px; color: #64748b; font-size: 10.5px; }
.month-metrics b { color: #1e293b; }
.progress-track { height: 5px; margin-top: 9px; overflow: hidden; border-radius: 99px; background: #eef2ff; }
.progress-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg,#6366f1,#10b981); }
.board-empty { padding: 32px; text-align: center; color: #94a3b8; border: 1px dashed #cbd5e1; border-radius: 14px; background: rgba(255,255,255,.7); }

.city-detail-overlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; background: rgba(15,23,42,.45); }
.city-detail-dialog { width: min(760px, 96vw); max-height: 86vh; overflow: auto; border-radius: 18px; background: #fff; box-shadow: 0 24px 64px rgba(15,23,42,.25); }
.city-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 20px 22px; border-bottom: 1px solid #eef2f7; }
.city-detail-head span { color: #6366f1; font-size: 11px; font-weight: 800; }
.city-detail-head h3 { margin: 4px 0 0; color: #0f172a; font-size: 19px; }
.city-detail-head > button { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid #e2e8f0; border-radius: 9px; background: #fff; color: #64748b; cursor: pointer; }
.city-detail-summary { display: flex; gap: 10px; padding: 14px 22px; background: #f8fafc; }
.city-detail-summary span { padding: 7px 10px; border-radius: 8px; color: #64748b; background: #fff; font-size: 11px; }
.city-detail-summary b { color: #312e81; }
.city-account-list { padding: 8px 22px 22px; }
.city-account-row { display: grid; grid-template-columns: 180px 1fr auto; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid #f1f5f9; }
.account-main { display: flex; align-items: center; gap: 9px; min-width: 0; }
.account-main > div { min-width: 0; }
.account-main > div > strong, .account-main > div > span { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.account-main > div > strong { color: #1e293b; font-size: 13px; }
.account-main > div > span { margin-top: 2px; color: #94a3b8; font-size: 10.5px; }
.account-main :deep(.account-platform-logo) { width: 24px; min-width: 24px; height: 24px; flex: 0 0 24px; overflow: visible; font-size: 18px; }
.account-main :deep(.account-platform-logo .iconfont) { display: inline-block; overflow: visible; font-size: 18px; }
.account-videos { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.account-videos span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: #475569; font-size: 11px; }
.account-videos em { color: #cbd5e1; font-size: 11px; font-style: normal; }
.account-state { padding: 5px 8px; border-radius: 8px; color: #b45309; background: #fffbeb; font-size: 10.5px; font-weight: 800; }
.account-state.done { color: #047857; background: #ecfdf5; }

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
.city-day-publish-count {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px; border-radius: 9px; color: #047857; background: #ecfdf5;
}
.city-day-publish-count span { font-size: 11px; font-weight: 600; }
.city-day-publish-count strong { font-size: 21px; line-height: 1; font-variant-numeric: tabular-nums; }
.city-day-detail-btn {
  width: 100%; min-height: 30px; border: 1px solid #c7d2fe; border-radius: 8px;
  color: #4f46e5; background: #fff; font-size: 11px; font-weight: 700; cursor: pointer;
}
.city-day-detail-btn:hover { border-color: #818cf8; background: #eef2ff; }
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

.city-day-detail-dialog { width: min(900px, 96vw); max-height: 86vh; overflow: hidden; border-radius: 18px; background: #fff; box-shadow: 0 24px 64px rgba(15,23,42,.25); }
.city-day-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 14px 22px; background: #f8fafc; }
.city-day-summary > div { padding: 12px 14px; border: 1px solid #e0e7ff; border-radius: 10px; background: #fff; }
.city-day-summary span { display: block; color: #64748b; font-size: 11px; }
.city-day-summary strong { display: block; margin-top: 4px; color: #312e81; font-size: 22px; }
.city-day-table-wrap { max-height: 58vh; overflow: auto; padding: 0 22px 22px; }
.city-day-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.city-day-table th, .city-day-table td { padding: 12px 10px; border-bottom: 1px solid #eef2f7; text-align: left; color: #334155; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.city-day-table th { position: sticky; top: 0; z-index: 1; color: #64748b; background: #fff; font-size: 11px; }
.city-day-table th:nth-child(1) { width: 80px; }
.city-day-table th:nth-child(2) { width: 105px; }
.city-day-table th:nth-child(3) { width: 170px; }
.city-day-table th:nth-child(5) { width: 90px; }
.city-day-table .status-pill.published { color: #047857; background: #ecfdf5; }
.city-day-empty { padding: 46px 22px; text-align: center; color: #94a3b8; }

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
  .section-head { flex-direction: column; }
  .city-board-tools { width: 100%; align-items: stretch; }
  .city-board-tools :deep(.el-date-editor) { width: 100%; }
  .city-total-summary { width: 100%; grid-template-columns: repeat(2, 1fr); }
  .city-card-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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

@media (max-width: 560px) {
  .city-card-grid { grid-template-columns: 1fr; }
  .city-account-row { grid-template-columns: 1fr; gap: 8px; }
  .city-detail-summary { flex-wrap: wrap; }
}
</style>
