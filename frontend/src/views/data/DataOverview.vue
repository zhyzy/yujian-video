<template>
  <div class="data-overview">
    <ConfigurablePageRenderer page-key="dataOverview" :modules="dataOverviewLayoutModules">

    <template #page-head>
    <!-- Hero bar -->
    <div class="hero-bar" :class="{ 'light-bg': !isDataHeroDarkBg }">
      <div class="hero-bg" :style="dataOverviewHeroBgStyle"></div>
      <div class="hero-grid">
        <div class="hero-left">
          <div class="eyebrow">
            <span class="dot"></span>
            数据中心 · 实时概览
          </div>
          <h1 class="hero-title">数据总览</h1>
          <p class="hero-sub">{{ currentPeriod }} · 基于 {{ tracks.length }} 条上报数据综合分析</p>
          <div class="hero-pills">
            <span class="pill pill-1"><el-icon><TrendCharts /></el-icon>趋势监控</span>
            <span class="pill pill-2"><el-icon><DataAnalysis /></el-icon>转化洞察</span>
            <span class="pill pill-3"><el-icon><Coin /></el-icon>营收追踪</span>
          </div>
        </div>
        <div class="hero-right">
          <div class="range-group">
            <button
              v-for="r in ranges"
              :key="r.value"
              class="range-btn"
              :class="{ active: range === r.value }"
              @click="switchRange(r.value)"
            >{{ r.label }}</button>
          </div>
          <div class="action-group">
            <button class="ghost-btn" @click="refreshData">
              <el-icon><Refresh /></el-icon>刷新
            </button>
            <button class="ghost-btn" @click="openGoalDialog">
              <el-icon><TrendCharts /></el-icon>本月目标
            </button>
            <button class="primary-btn" @click="showEntry = true">
              <el-icon><EditPen /></el-icon>录入数据
            </button>
          </div>
        </div>
      </div>
    </div>
    </template>

    <template #summary-row>
    <!-- Main KPI row -->
    <div class="kpi-grid">
      <!-- Spotlight: 总播放量 -->
      <div class="kpi-card hero-card" :class="{ 'light-bg': !isDataOverviewDarkBg }" :style="dataOverviewBgStyle">
        <div class="hero-shine"></div>
        <div class="kpi-top">
          <div class="kpi-label"><span class="label-dot"></span>总播放量</div>
          <div class="kpi-trend up"><el-icon><Top /></el-icon>+{{ mainStats.viewsTrend }}%</div>
        </div>
        <div class="kpi-big">{{ formatNum(mainStats.views) }}</div>
        <div class="kpi-caption">较上周期上升 {{ mainStats.viewsTrend }}% · 日均 {{ formatNum(Math.round(mainStats.views / rangeDays)) }}</div>
        <div class="kpi-sparkline">
          <svg viewBox="0 0 200 60" preserveAspectRatio="none">
            <defs>
              <linearGradient :id="isDataOverviewDarkBg ? 'sparkGrad1' : 'sparkGradLight'" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" :stop-color="isDataOverviewDarkBg ? '#fff' : '#6366f1'" :stop-opacity="isDataOverviewDarkBg ? 0.35 : 0.3" />
                <stop offset="100%" :stop-color="isDataOverviewDarkBg ? '#fff' : '#6366f1'" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path :d="sparkArea(mainStats.viewsSeries, 60)" :fill="`url(#${isDataOverviewDarkBg ? 'sparkGrad1' : 'sparkGradLight'})`" />
            <path :d="sparkLine(mainStats.viewsSeries, 60)" fill="none" :stroke="isDataOverviewDarkBg ? '#fff' : '#6366f1'" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </div>

      <div class="kpi-card" v-for="k in secondaryKPIs" :key="k.key">
        <div class="kpi-top">
          <div class="kpi-icon" :class="'ic-' + k.key">
            <el-icon><component :is="k.icon" /></el-icon>
          </div>
          <div class="kpi-trend" :class="k.trend >= 0 ? 'up' : 'down'">
            <el-icon><component :is="k.trend >= 0 ? 'Top' : 'Bottom'" /></el-icon>{{ Math.abs(k.trend) }}%
          </div>
        </div>
        <div class="kpi-label-sm">{{ k.label }}</div>
        <div class="kpi-value" :class="k.accent && 'text-' + k.accent">{{ k.prefix || '' }}{{ formatNum(k.value) }}{{ k.suffix || '' }}</div>
        <div class="kpi-caption-sm">
          <span class="dot-sm" :class="'bg-' + (k.accent || 'indigo')"></span>
          {{ k.hint }}
        </div>
      </div>
    </div>
    </template>

    <template #chart-panel>
    <!-- Charts row -->
    <div class="charts-grid">
      <!-- Trend line chart -->
      <section class="panel trend-panel">
        <header class="panel-head">
          <div>
            <h3>播放趋势分析</h3>
            <p>按日聚合播放量走势 · 最近 {{ rangeDays }} 天</p>
          </div>
          <div class="legend-group">
            <span class="legend-chip"><i class="lg lg-indigo"></i>播放量</span>
            <span class="legend-chip"><i class="lg lg-pink"></i>点赞</span>
            <span class="legend-chip"><i class="lg lg-amber"></i>评论</span>
          </div>
        </header>
        <div class="chart-wrap">
          <div ref="trendChartRef" style="width:100%;height:280px;"></div>
        </div>
      </section>

      <!-- Platform distribution donut -->
      <section class="panel donut-panel">
        <header class="panel-head">
          <div>
            <h3>平台占比</h3>
            <p>按平台统计播放量份额</p>
          </div>
        </header>
        <div class="donut-wrap">
          <div class="donut-area">
            <div ref="donutChartRef" style="width:220px;height:220px;"></div>
            <div class="donut-center">
              <strong>{{ formatNum(mainStats.views) }}</strong>
              <span>总播放</span>
            </div>
          </div>
          <div class="donut-list" v-if="platformBreakdown.length">
            <div v-for="p in platformBreakdown" :key="p.name" class="donut-item">
              <span class="donut-dot" :style="{ background: p.color }"></span>
              <span class="donut-name">{{ p.name }}</span>
              <span class="donut-val">{{ formatNum(p.value) }}</span>
              <span class="donut-pct">{{ p.pct }}%</span>
            </div>
          </div>
          <div v-else class="donut-empty">暂无数据 · 点击右上角录入数据</div>
        </div>
      </section>
    </div>
    </template>

    <template #rank-panel>
    <!-- 账号维度统计 -->
    <section class="panel account-stats-panel">
      <header class="panel-head">
        <div>
          <h3>账号数据概览</h3>
          <p>各账号流量表现 · 当前周期内</p>
        </div>
        <div class="tabs">
          <button class="tab" :class="{ active: accountFilter === 'all' && !selectedAccountId }" @click="accountFilter = 'all'; selectedAccountId = ''">全部</button>
          <button
            v-for="group in accountGroups"
            :key="group.platform"
            class="tab"
            :class="{ active: accountFilter === group.platform && !selectedAccountId }"
            @click="accountFilter = group.platform; selectedAccountId = ''"
          >
            <IconFont :platform="group.platform" /> {{ group.platformName }}
          </button>
        </div>
      </header>

      <!-- 账号统计卡片 -->
      <div class="account-cards">
        <div
          v-for="stat in filteredAccountStats"
          :key="stat.account_id"
          class="account-card"
          :class="{ selected: selectedAccountId === stat.account_id }"
          @click="selectedAccountId = selectedAccountId === stat.account_id ? '' : stat.account_id"
        >
          <div class="account-card-header">
            <div class="account-platform">
              <IconFont :platform="stat.platform || 'douyin'" />
            </div>
            <div class="account-info">
              <strong>{{ stat.account_name || '未知账号' }}</strong>
              <span v-if="stat.city_name" class="city-tag">{{ stat.city_name }}</span>
            </div>
          </div>
          <div class="account-stats-grid">
            <div class="account-stat">
              <span class="stat-label">播放</span>
              <span class="stat-value">{{ formatNum(stat.total_views) }}</span>
            </div>
            <div class="account-stat">
              <span class="stat-label">点赞</span>
              <span class="stat-value">{{ formatNum(stat.total_likes) }}</span>
            </div>
            <div class="account-stat">
              <span class="stat-label">评论</span>
              <span class="stat-value">{{ formatNum(stat.total_comments) }}</span>
            </div>
            <div class="account-stat">
              <span class="stat-label">成交</span>
              <span class="stat-value">{{ formatNum(stat.total_deals) }}</span>
            </div>
          </div>
        </div>
        <div v-if="!filteredAccountStats.length" class="account-empty">
          <p>暂无账号统计数据</p>
        </div>
      </div>
    </section>

    <!-- Data detail table -->
    <section class="panel">
      <header class="panel-head">
        <div>
          <h3>数据明细</h3>
          <p>最近上报数据 · 按日期倒序 · 共 {{ filteredTracks.length }} 条</p>
        </div>
        <div class="tabs">
          <button class="tab" :class="{ active: trackFilter === 'all' }" @click="trackFilter = 'all'">全部</button>
          <button class="tab" :class="{ active: trackFilter === 'douyin' }" @click="trackFilter = 'douyin'"><IconFont platform="douyin" />抖音</button>
          <button class="tab" :class="{ active: trackFilter === 'kuaishou' }" @click="trackFilter = 'kuaishou'"><IconFont platform="kuaishou" />快手</button>
          <button class="tab" :class="{ active: trackFilter === 'weixin' }" @click="trackFilter = 'weixin'"><IconFont platform="weixin" />视频号</button>
          <button class="tab" :class="{ active: trackFilter === 'xiaohongshu' }" @click="trackFilter = 'xiaohongshu'"><IconFont platform="xiaohongshu" />小红书</button>
        </div>
      </header>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:120px">日期</th>
              <th>视频 / 账号</th>
              <th class="num-right">播放</th>
              <th class="num-right">点赞</th>
              <th class="num-right">评论</th>
              <th class="num-right">成交</th>
              <th class="num-right">金额</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in filteredTracks" :key="t.id">
              <td>
                <div class="date-cell">
                  <strong>{{ dayjs(t.date).format('MM-DD') }}</strong>
                  <span>{{ dayjs(t.date).format('YYYY') }}</span>
                </div>
              </td>
              <td>
                <div class="title-cell">
                  <div class="title-main">{{ t.video_title }}</div>
                  <div class="title-sub">
                    <span class="platform-chip" :class="'p-' + (t.platform || 'douyin')"><IconFont :platform="t.platform || 'douyin'" /> {{ platformLabel(t.platform) }}</span>
                    <span>{{ t.account_name || '-' }}</span>
                    <span v-if="t.source === 'city'" class="source-chip">城市端 · {{ t.city_name || '城市' }}</span>
                    <span v-else class="source-chip manual">手动录入</span>
                  </div>
                </div>
              </td>
              <td class="num-right">
                <span class="num-indigo">{{ formatNum(t.views || 0) }}</span>
              </td>
              <td class="num-right">
                <span class="num-pink">{{ formatNum(t.likes || 0) }}</span>
              </td>
              <td class="num-right">
                <span class="num-amber">{{ formatNum(t.comments || 0) }}</span>
              </td>
              <td class="num-right">
                <span class="num-green">{{ formatNum(t.deals || 0) }}</span>
              </td>
              <td class="num-right">
                <span class="num-money">¥{{ formatMoney(t.revenue || 0) }}</span>
              </td>
            </tr>
            <tr v-if="!filteredTracks.length" class="empty-row">
              <td colspan="7">
                <div class="empty-inline">暂无数据 · 点击右上角 "录入数据" 添加</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    </template>
    </ConfigurablePageRenderer>

    <!-- Goal dialog -->
    <div v-if="showGoal" class="dialog-overlay" @click.self="showGoal = false">
      <div class="dialog-card goal-card">
        <div class="dialog-head">
          <div>
            <h3>本月目标任务</h3>
            <p>设置后，工作台和侧边栏会按发布完成情况实时计算进度。</p>
          </div>
          <button class="dialog-close" @click="showGoal = false"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="field-row">
            <label>目标月份</label>
            <input v-model="goalForm.month" class="text-input" placeholder="2026-06" />
          </div>
          <div class="numbers-grid">
            <div class="field-row">
              <label>发布目标</label>
              <input v-model.number="goalForm.publish_target" type="number" class="text-input" placeholder="本月需要发布多少条" />
            </div>
            <div class="field-row">
              <label>拍摄目标</label>
              <input v-model.number="goalForm.shoot_target" type="number" class="text-input" placeholder="0" />
            </div>
            <div class="field-row">
              <label>剪辑目标</label>
              <input v-model.number="goalForm.edit_target" type="number" class="text-input" placeholder="0" />
            </div>
            <div class="field-row">
              <label>播放目标</label>
              <input v-model.number="goalForm.play_target" type="number" class="text-input" placeholder="0" />
            </div>
          </div>
        </div>
        <div class="dialog-foot">
          <button class="ghost-btn" @click="showGoal = false">取消</button>
          <button class="primary-btn" :disabled="savingGoal || !goalForm.month" @click="saveGoal">
            <el-icon v-if="savingGoal"><Loading /></el-icon>
            {{ savingGoal ? '保存中…' : '保存目标' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Entry dialog -->
    <div v-if="showEntry" class="dialog-overlay" @click.self="showEntry = false">
      <div class="dialog-card entry-dialog">
        <div class="dialog-head">
          <div>
            <h3>录入数据</h3>
            <p>支持单日录入或按时间区间汇总录入。</p>
          </div>
          <button class="dialog-close" @click="showEntry = false"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <!-- 时间模式切换 -->
          <div class="entry-mode-tabs">
            <button
              class="mode-tab"
              :class="{ active: entryMode === 'single' }"
              @click="entryMode = 'single'"
            >
              <el-icon><Calendar /></el-icon>
              单日录入
            </button>
            <button
              class="mode-tab"
              :class="{ active: entryMode === 'range' }"
              @click="entryMode = 'range'"
            >
              <el-icon><DataLine /></el-icon>
              区间汇总录入
            </button>
          </div>

          <!-- 快捷区间选择 -->
          <div v-if="entryMode === 'range'" class="quick-range">
            <span class="quick-label">快捷选择：</span>
            <button
              v-for="q in quickRanges"
              :key="q.label"
              class="quick-btn"
              :class="{ active: isQuickRangeActive(q) }"
              @click="applyQuickRange(q)"
            >
              {{ q.label }}
            </button>
          </div>

          <!-- 日期选择 -->
          <div class="field-row">
            <label>{{ entryMode === 'single' ? '日期' : '时间区间' }}</label>
            <div v-if="entryMode === 'single'" class="field-inline">
              <el-icon class="field-icon"><Calendar /></el-icon>
              <el-date-picker
                v-model="entryForm.date"
                type="date"
                value-format="YYYY-MM-DD"
                class="inline-picker"
                placeholder="选择日期"
              />
            </div>
            <div v-else class="field-inline range-inline">
              <el-icon class="field-icon"><DateRange /></el-icon>
              <el-date-picker
                v-model="entryForm.dateRange"
                type="daterange"
                value-format="YYYY-MM-DD"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                class="inline-picker"
                @change="onDateRangeChange"
              />
            </div>
          </div>

          <!-- 账号选择 -->
          <div class="field-row">
            <label>发布账号</label>
            <select v-model="entryForm.account_id" class="select-input">
              <option value="">请选择账号</option>
              <optgroup v-for="group in accountGroups" :key="group.platform" :label="platformLabel(group.platform) + ' · ' + group.platformName">
                <option v-for="a in group.accounts" :key="a.id" :value="a.id">
                  {{ a.name }}
                  <template v-if="a.city_name"> · {{ a.city_name }}</template>
                </option>
              </optgroup>
            </select>
          </div>

          <!-- 视频标题（单日模式显示） -->
          <div v-if="entryMode === 'single'" class="field-row">
            <label>视频标题</label>
            <input v-model="entryForm.video_title" class="text-input" placeholder="如：遇见上门按摩 · 专业服务让生活更美好" />
          </div>

          <!-- 区间说明 -->
          <div v-if="entryMode === 'range' && entryForm.dateRange" class="range-summary">
            <el-icon><InfoFilled /></el-icon>
            <span>
              已选择 {{ entryForm.dateRange[0] }} 至 {{ entryForm.dateRange[1] }}，
              共 {{ dateRangeDays }} 天
            </span>
          </div>

          <!-- 数据指标 -->
          <div class="numbers-grid">
            <div class="field-row">
              <label>播放量</label>
              <input v-model.number="entryForm.views" type="number" class="text-input" placeholder="区间总播放量" />
            </div>
            <div class="field-row">
              <label>点赞</label>
              <input v-model.number="entryForm.likes" type="number" class="text-input" placeholder="区间总点赞" />
            </div>
            <div class="field-row">
              <label>评论</label>
              <input v-model.number="entryForm.comments" type="number" class="text-input" placeholder="区间总评论" />
            </div>
            <div class="field-row">
              <label>收藏</label>
              <input v-model.number="entryForm.favorites" type="number" class="text-input" placeholder="区间总收藏" />
            </div>
            <div class="field-row">
              <label>转发</label>
              <input v-model.number="entryForm.shares" type="number" class="text-input" placeholder="区间总转发" />
            </div>
            <div class="field-row">
              <label>成交单数</label>
              <input v-model.number="entryForm.deals" type="number" class="text-input" placeholder="区间总成交" />
            </div>
            <div class="field-row wide">
              <label>成交金额（元）</label>
              <input v-model.number="entryForm.revenue" type="number" class="text-input" placeholder="区间总金额" />
            </div>
          </div>

          <!-- 均值提示（区间模式） -->
          <div v-if="entryMode === 'range' && entryForm.dateRange && (entryForm.views || entryForm.likes)" class="avg-hint">
            <span>区间均值：日均播放 {{ formatNum(avgViews) }}，日均点赞 {{ formatNum(avgLikes) }}</span>
          </div>
        </div>
        <div class="dialog-foot">
          <button class="ghost-btn" @click="showEntry = false">取消</button>
          <button class="primary-btn" :disabled="!canSubmit || saving" @click="submitEntry">
            <el-icon v-if="saving"><Loading /></el-icon>
            <span v-else><el-icon><CircleCheckFilled /></el-icon></span>
            {{ saving ? '保存中…' : (entryMode === 'range' ? '批量提交' : '提交数据') }}
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, reactive, ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import dayjs from 'dayjs'
import {
  Calendar, Close, EditPen, Refresh, CircleCheckFilled, Loading,
  DataAnalysis, Coin, UserFilled, TrendCharts, ShoppingCart, DataLine, InfoFilled
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import IconFont from '@/components/IconFont.vue'
import * as echarts from 'echarts'
import { getDataStats, getDataTracks, createDataTrack, getAccounts, getMonthlyGoals, createMonthlyGoal, updateMonthlyGoal } from '@/api'
import { applySystemSettings, loadSystemSettings } from '@/utils/systemSettings'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'

const dataOverviewLayoutModules = layoutModuleCatalog.dataOverview
const { bindings: layoutBindings } = useLayoutBindings('dataOverview')
const settings = reactive(loadSystemSettings())
const refreshSystemSettings = (event) => {
  applySystemSettings(settings, event?.detail || loadSystemSettings())
  nextTick(() => renderCharts())
}

const bgPresets = {
  gradient1: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  gradient2: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 30%, #ddd6fe 60%, #e0e7ff 100%)',
  gradient3: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
}

const dataOverviewHeroBgStyle = computed(() => {
  const appearance = settings.appearance || {}
  const preset = appearance.dataOverviewHeroBgPreset || 'gradient1'
  if (preset === 'custom' && appearance.dataOverviewHeroBgUrl) {
    return {
      backgroundImage: `url(${appearance.dataOverviewHeroBgUrl})`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center'
    }
  }
  return {
    background: bgPresets[preset] || bgPresets.gradient1
  }
})

const dataOverviewBgStyle = computed(() => {
  const appearance = settings.appearance || {}
  const preset = appearance.dataOverviewBgPreset || 'gradient1'
  if (preset === 'custom' && appearance.dataOverviewBgUrl) {
    return {
      backgroundImage: `url(${appearance.dataOverviewBgUrl})`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center'
    }
  }
  return {
    background: bgPresets[preset] || bgPresets.gradient1
  }
})

const isDataOverviewDarkBg = computed(() => {
  const preset = (settings.appearance || {}).dataOverviewBgPreset || 'gradient1'
  return preset === 'gradient1'
})

const isDataHeroDarkBg = computed(() => {
  const preset = (settings.appearance || {}).dataOverviewHeroBgPreset || 'gradient1'
  return preset === 'gradient1'
})

const trendChartRef = ref(null)
const donutChartRef = ref(null)
let trendChart = null
let donutChart = null

const showEntry = ref(false)
const showGoal = ref(false)
const saving = ref(false)
const savingGoal = ref(false)
const range = ref('30d')
const trackFilter = ref('all')
const accountFilter = ref('all') // 账号平台筛选
const selectedAccountId = ref('') // 选中的账号ID

const ranges = [
  { label: '7 天', value: '7d' },
  { label: '30 天', value: '30d' },
  { label: '90 天', value: '90d' },
  { label: '本年', value: 'year' }
]

const tracks = ref([])
const accounts = ref([])
const currentStats = ref({ summary: {}, platformStats: [], trend: [], accountStats: [] })
const prevStats = ref({ summary: {}, platformStats: [], trend: [], accountStats: [] })

// 录入模式
const entryMode = ref('single') // 'single' | 'range'

// 快捷区间选项
const quickRanges = [
  { label: '本周', start: () => dayjs().startOf('week').format('YYYY-MM-DD'), end: () => dayjs().endOf('week').format('YYYY-MM-DD') },
  { label: '上周', start: () => dayjs().subtract(1, 'week').startOf('week').format('YYYY-MM-DD'), end: () => dayjs().subtract(1, 'week').endOf('week').format('YYYY-MM-DD') },
  { label: '本月', start: () => dayjs().startOf('month').format('YYYY-MM-DD'), end: () => dayjs().endOf('month').format('YYYY-MM-DD') },
  { label: '上月', start: () => dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'), end: () => dayjs().subtract(1, 'month').endOf('month').format('YYYY-MM-DD') },
  { label: '本季度', start: () => dayjs().startOf('quarter').format('YYYY-MM-DD'), end: () => dayjs().endOf('quarter').format('YYYY-MM-DD') },
]

const entryForm = reactive({
  date: dayjs().format('YYYY-MM-DD'),
  dateRange: null, // [startDate, endDate]
  account_id: '', video_title: '',
  views: 0, likes: 0, comments: 0, deals: 0, revenue: 0,
  favorites: 0, shares: 0,
  platform: 'douyin'
})
const goalForm = reactive({
  month: dayjs().format('YYYY-MM'),
  shoot_target: 0,
  edit_target: 0,
  publish_target: 0,
  play_target: 0
})

// 计算日期区间的天数
const dateRangeDays = computed(() => {
  if (!entryForm.dateRange || entryForm.dateRange.length !== 2) return 0
  return dayjs(entryForm.dateRange[1]).diff(dayjs(entryForm.dateRange[0]), 'day') + 1
})

// 计算区间日均值
const avgViews = computed(() => {
  if (!dateRangeDays.value) return 0
  return Math.round(entryForm.views / dateRangeDays.value)
})
const avgLikes = computed(() => {
  if (!dateRangeDays.value) return 0
  return Math.round(entryForm.likes / dateRangeDays.value)
})

// 按平台分组账号
const accountGroups = computed(() => {
  const groups = {}
  for (const a of accounts.value) {
    const p = a.platform || 'other'
    if (!groups[p]) {
      groups[p] = { platform: p, platformName: platformLabel(p), accounts: [] }
    }
    groups[p].accounts.push(a)
  }
  return Object.values(groups)
})

// 判断快捷区间是否选中
const isQuickRangeActive = (q) => {
  if (!entryForm.dateRange || entryForm.dateRange.length !== 2) return false
  return entryForm.dateRange[0] === q.start() && entryForm.dateRange[1] === q.end()
}

// 应用快捷区间
const applyQuickRange = (q) => {
  entryForm.dateRange = [q.start(), q.end()]
}

// 日期范围变化
const onDateRangeChange = (val) => {
  // 可选：自动选中对应的快捷区间
}

const normalizeBoundDate = (value) => {
  if (!value) return ''
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

const applyLayoutBindings = (bindings = {}) => {
  let shouldReload = false
  const allowedRanges = new Set(ranges.map(item => item.value))
  if ('range' in bindings && allowedRanges.has(bindings.range) && bindings.range !== range.value) {
    range.value = bindings.range
    shouldReload = true
  }
  if ('platform' in bindings) trackFilter.value = bindings.platform || 'all'
  if ('date' in bindings) {
    const nextDate = normalizeBoundDate(bindings.date)
    if (nextDate) entryForm.date = nextDate
  }
  if ('accountId' in bindings || 'account_id' in bindings) entryForm.account_id = bindings.accountId || bindings.account_id || ''
  if ('videoTitle' in bindings || 'video_title' in bindings) entryForm.video_title = bindings.videoTitle || bindings.video_title || ''
  if ('views' in bindings) entryForm.views = Number(bindings.views || 0)
  if ('likes' in bindings) entryForm.likes = Number(bindings.likes || 0)
  if ('comments' in bindings) entryForm.comments = Number(bindings.comments || 0)
  if ('deals' in bindings) entryForm.deals = Number(bindings.deals || 0)
  if ('revenue' in bindings) entryForm.revenue = Number(bindings.revenue || 0)
  if (shouldReload) loadData()
}

const platformLabel = (p) => ({ douyin: '抖音', kuaishou: '快手', weixin: '视频号', xiaohongshu: '小红书' }[p] || (p || '-'))
const normalizeTrack = (track = {}) => ({
  ...track,
  views: Number(track.views ?? track.play_count ?? 0),
  likes: Number(track.likes ?? track.like_count ?? 0),
  comments: Number(track.comments ?? track.comment_count ?? 0),
  deals: Number(track.deals ?? track.deal_count ?? 0),
  revenue: Number(track.revenue ?? track.deal_amount ?? 0)
})

const rangeDays = computed(() => ({ '7d': 7, '30d': 30, '90d': 90, year: 365 }[range.value] || 30))
const currentPeriod = computed(() => {
  const end = dayjs()
  const start = end.subtract(rangeDays.value - 1, 'day')
  return `${start.format('YYYY/M/D')} - ${end.format('YYYY/M/D')}`
})

// -------- compute main KPI aggregates --------
const mainStats = computed(() => {
  const s = currentStats.value.summary
  const ps = prevStats.value.summary
  const views = Number(s.total_plays || 0)
  const likes = Number(s.total_likes || 0)
  const comments = Number(s.total_comments || 0)
  const deals = Number(s.total_deals || 0)
  const revenue = Number(s.total_amount || 0)
  const videos = Number(s.total_videos || 0)
  const prevViews = Number(ps.total_plays || 0)
  const prevLikes = Number(ps.total_likes || 0)
  const prevComments = Number(ps.total_comments || 0)
  const prevDeals = Number(ps.total_deals || 0)
  const prevRevenue = Number(ps.total_amount || 0)
  const prevVideos = Number(ps.total_videos || 0)
  const calcTrend = (curr, prev) => prev ? Math.round((curr - prev) / prev * 100) : 0
  return {
    views, likes, comments, deals, revenue, videos,
    viewsTrend: calcTrend(views, prevViews),
    likesTrend: calcTrend(likes, prevLikes),
    commentsTrend: calcTrend(comments, prevComments),
    dealsTrend: calcTrend(deals, prevDeals),
    revenueTrend: calcTrend(revenue, prevRevenue),
    videosTrend: calcTrend(videos, prevVideos),
    viewsSeries: viewsSeries.value,
  }
})

const secondaryKPIs = computed(() => [
  { key: 'likes', label: '总点赞', value: mainStats.value.likes, trend: mainStats.value.likesTrend, icon: 'UserFilled', accent: 'pink', hint: mainStats.value.likes > 0 ? '互动表现良好' : '暂无数据', prefix: '', suffix: '' },
  { key: 'comments', label: '总评论', value: mainStats.value.comments, trend: mainStats.value.commentsTrend, icon: 'ChatDotRound', accent: 'amber', hint: mainStats.value.comments > 0 ? '话题热度上升' : '暂无数据', prefix: '', suffix: '' },
  { key: 'deals', label: '成交单数', value: mainStats.value.deals, trend: mainStats.value.dealsTrend, icon: 'ShoppingCart', accent: 'green', hint: mainStats.value.deals > 0 ? '转化提升明显' : '暂无数据', prefix: '', suffix: '' },
  { key: 'revenue', label: '成交金额', value: mainStats.value.revenue, trend: mainStats.value.revenueTrend, icon: 'Coin', accent: 'indigo', hint: mainStats.value.revenue > 0 ? '表现超预期' : '暂无数据', prefix: '¥', suffix: '' },
  { key: 'videos', label: '视频总数', value: mainStats.value.videos, trend: mainStats.value.videosTrend, icon: 'VideoCamera', accent: 'cyan', hint: '本周期新增', prefix: '', suffix: ' 条' }
])

// 模拟 spark 序列
const viewsSeries = computed(() => {
  const trend = currentStats.value.trend || []
  const dailyMap = {}
  for (const t of trend) dailyMap[t.date] = (dailyMap[t.date] || 0) + (Number(t.plays ?? t.views ?? 0) || 0)
  const days = rangeDays.value
  const series = []
  for (let i = days - 1; i >= 0; i--) {
    const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
    series.push(dailyMap[d] || 0)
  }
  return series
})
const sparkLine = (series, h) => {
  if (!series || !series.length) return `M 0,${h} L 200,${h}`
  const max = Math.max(...series) || 1
  const step = 200 / (series.length - 1)
  return series.map((v, i) => {
    const x = i * step
    const y = h - (v / max) * (h - 6) - 3
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
const sparkArea = (series, h) => {
  const line = sparkLine(series, h)
  return `${line} L 200,${h} L 0,${h} Z`
}

// views series computed from tracks by day
const platformBreakdown = computed(() => {
  const map = {}
  const palette = {
    douyin: '#6366f1',
    kuaishou: '#f97316',
    weixin: '#10b981',
    xiaohongshu: '#ec4899',
    other: '#06b6d4'
  }
  for (const t of tracks.value) {
    const p = t.platform || 'other'
    map[p] = (map[p] || 0) + (t.views || 0)
  }
  const total = Object.values(map).reduce((a, b) => a + b, 0) || 1
  return Object.entries(map)
    .map(([k, v]) => ({ name: platformLabel(k), value: v, color: palette[k] || palette.other, pct: Math.round((v / total) * 100) }))
    .sort((a, b) => b.value - a.value)
})

const filteredTracks = computed(() => {
  let list = [...tracks.value].sort((a, b) => (b.date || '').localeCompare(a.date || ''))

  // 按平台筛选
  if (trackFilter.value !== 'all') {
    list = list.filter(t => t.platform === trackFilter.value)
  }

  // 按账号筛选
  if (selectedAccountId.value) {
    list = list.filter(t => String(t.account_id) === String(selectedAccountId.value))
  }

  return list.slice(0, 50)
})

// 账号统计数据计算
const accountStats = computed(() => {
  const map = {}
  const days = rangeDays.value
  const end = dayjs().format('YYYY-MM-DD')
  const start = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD')

  for (const t of tracks.value) {
    // 只统计当前周期内的数据
    if (t.date < start || t.date > end) continue

    const aid = t.account_id || 'unknown'
    if (!map[aid]) {
      map[aid] = {
        account_id: aid,
        account_name: t.account_name || '未知账号',
        platform: t.platform || 'douyin',
        city_name: t.city_name || '',
        total_views: 0,
        total_likes: 0,
        total_comments: 0,
        total_deals: 0,
        total_revenue: 0,
        video_count: 0
      }
    }
    map[aid].total_views += Number(t.views || 0)
    map[aid].total_likes += Number(t.likes || 0)
    map[aid].total_comments += Number(t.comments || 0)
    map[aid].total_deals += Number(t.deals || 0)
    map[aid].total_revenue += Number(t.revenue || 0)
    map[aid].video_count += 1
  }

  return Object.values(map).sort((a, b) => b.total_views - a.total_views)
})

// 按平台筛选账号统计
const filteredAccountStats = computed(() => {
  let list = accountStats.value
  // 按平台筛选
  if (accountFilter.value !== 'all') {
    list = list.filter(s => s.platform === accountFilter.value)
  }
  // 按账号ID筛选
  if (selectedAccountId.value) {
    list = list.filter(s => String(s.account_id) === String(selectedAccountId.value))
  }
  return list
})

const formatNum = (n) => {
  const v = Number(n || 0)
  if (v >= 10000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + ' 万'
  if (v >= 1000) return v.toLocaleString('zh-CN')
  return Math.round(v).toString()
}
const formatMoney = (n) => {
  const v = Number(n || 0)
  if (v >= 10000) return (v / 10000).toFixed(1).replace(/\.0$/, '') + '万'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

const canSubmit = computed(() => {
  const hasMetric = entryForm.views || entryForm.likes || entryForm.comments || entryForm.favorites || entryForm.shares || entryForm.deals || entryForm.revenue
  if (entryMode.value === 'single') {
    return entryForm.date && entryForm.video_title && hasMetric
  } else {
    return entryForm.dateRange && entryForm.dateRange.length === 2 && entryForm.account_id && hasMetric
  }
})

const switchRange = (r) => {
  range.value = r
  nextTick(() => { renderCharts() })
}

const refreshData = () => { loadData() }

const loadGoal = async () => {
  try {
    const rows = await getMonthlyGoals({ month: goalForm.month })
    const goal = Array.isArray(rows) ? rows[0] : rows
    if (goal) {
      Object.assign(goalForm, {
        month: goal.month || goalForm.month,
        shoot_target: Number(goal.shoot_target || 0),
        edit_target: Number(goal.edit_target || 0),
        publish_target: Number(goal.publish_target || 0),
        play_target: Number(goal.play_target || 0)
      })
    }
  } catch {}
}

const openGoalDialog = async () => {
  showGoal.value = true
  await loadGoal()
}

const saveGoal = async () => {
  savingGoal.value = true
  try {
    const payload = {
      month: goalForm.month,
      shoot_target: Number(goalForm.shoot_target || 0),
      edit_target: Number(goalForm.edit_target || 0),
      publish_target: Number(goalForm.publish_target || 0),
      play_target: Number(goalForm.play_target || 0)
    }
    const rows = await getMonthlyGoals({ month: goalForm.month })
    if (Array.isArray(rows) && rows.length) await updateMonthlyGoal(goalForm.month, payload)
    else await createMonthlyGoal(payload)
    ElMessage.success('本月目标已保存')
    showGoal.value = false
    window.dispatchEvent(new CustomEvent('task-progress-updated'))
    loadData()
  } finally {
    savingGoal.value = false
  }
}

const submitEntry = async () => {
  if (!canSubmit.value) return
  saving.value = true
  try {
    const account = accounts.value.find(a => String(a.id) === String(entryForm.account_id)) || {}

    // 构建 payload
    const basePayload = {
      play_count: Number(entryForm.views || 0),
      like_count: Number(entryForm.likes || 0),
      comment_count: Number(entryForm.comments || 0),
      deal_count: Number(entryForm.deals || 0),
      deal_amount: Number(entryForm.revenue || 0),
      platform: account.platform || entryForm.platform || 'douyin',
      account_id: entryForm.account_id,
      account_name: account.name || entryForm.account_id,
      source: 'manual',
      video_title: entryForm.video_title || (entryMode.value === 'range' ? `区间汇总数据` : ''),
      favorites: Number(entryForm.favorites || 0),
      shares: Number(entryForm.shares || 0),
    }

    // 如果是区间模式，按天拆分成多条记录
    if (entryMode.value === 'range' && entryForm.dateRange) {
      const [startDate, endDate] = entryForm.dateRange
      const days = dayjs(endDate).diff(dayjs(startDate), 'day') + 1
      const avgViews = Math.round(entryForm.views / days)
      const avgLikes = Math.round(entryForm.likes / days)
      const avgComments = Math.round(entryForm.comments / days)
      const avgDeals = Math.round(entryForm.deals / days)
      const avgRevenue = entryForm.revenue / days

      // 按天创建记录
      for (let i = 0; i < days; i++) {
        const date = dayjs(startDate).add(i, 'day').format('YYYY-MM-DD')
        const payload = {
          ...basePayload,
          date,
          play_count: avgViews,
          like_count: avgLikes,
          comment_count: avgComments,
          deal_count: avgDeals,
          deal_amount: Math.round(avgRevenue * 100) / 100,
          video_title: `区间汇总 - ${startDate} 至 ${endDate}`
        }

        await createDataTrack(payload)
      }

      ElMessage.success(`已成功录入 ${days} 天的区间汇总数据`)
    } else {
      // 单日模式
      const payload = {
        ...basePayload,
        date: entryForm.date,
        video_title: entryForm.video_title
      }

      await createDataTrack(payload)

      ElMessage.success('数据已保存')
    }

    // 重置表单
    Object.assign(entryForm, {
      date: dayjs().format('YYYY-MM-DD'),
      dateRange: null,
      account_id: '', video_title: '',
      views: 0, likes: 0, comments: 0, deals: 0, revenue: 0,
      favorites: 0, shares: 0
    })
    entryMode.value = 'single'
    showEntry.value = false
    await loadData()
    nextTick(() => renderCharts())
  } catch (e) {
    const message = e?.response?.data?.message || e?.message || '请检查账号、日期和后端服务'
    ElMessage.error(`保存失败：${message}`)
  } finally {
    saving.value = false
  }
}

// ------- ECharts rendering -------
const renderCharts = () => {
  const days = rangeDays.value
  const labels = []
  const byDayViews = []
  const byDayLikes = []
  const byDayComments = []
  const trendRows = currentStats.value.trend || []
  const trendMap = {}
  for (const item of trendRows) {
    const date = item.date
    if (!date) continue
    if (!trendMap[date]) trendMap[date] = { views: 0, likes: 0, comments: 0 }
    trendMap[date].views += Number(item.plays ?? item.views ?? 0)
    trendMap[date].likes += Number(item.likes ?? item.like_count ?? 0)
    trendMap[date].comments += Number(item.comments ?? item.comment_count ?? 0)
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = dayjs().subtract(i, 'day').format('YYYY-MM-DD')
    labels.push(dayjs(d).format('M/D'))
    if (trendMap[d]) {
      byDayViews.push(trendMap[d].views)
      byDayLikes.push(trendMap[d].likes)
      byDayComments.push(trendMap[d].comments)
    } else {
      const rows = tracks.value.filter(t => t.date === d)
      byDayViews.push(rows.reduce((n, t) => n + (t.views || 0), 0))
      byDayLikes.push(rows.reduce((n, t) => n + (t.likes || 0), 0))
      byDayComments.push(rows.reduce((n, t) => n + (t.comments || 0), 0))
    }
  }

  if (trendChartRef.value) {
    if (trendChart) trendChart.dispose()
    trendChart = echarts.init(trendChartRef.value)
    trendChart.setOption({
      grid: { left: 48, right: 48, top: 24, bottom: 36 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(99,102,241,0.4)',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 12 },
        axisPointer: { type: 'line', lineStyle: { color: '#6366f1', width: 1, type: 'dashed' } }
      },
      legend: { show: false },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: labels,
        axisLine: { lineStyle: { color: '#e2e8f0' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 },
        axisTick: { show: false }
      },
      yAxis: [
        {
          type: 'value',
          splitLine: { lineStyle: { color: 'rgba(226,232,240,0.6)' } },
          axisLabel: {
            color: '#94a3b8', fontSize: 11,
            formatter: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
          }
        },
        {
          type: 'value',
          splitLine: { show: false },
          axisLabel: { color: '#94a3b8', fontSize: 11 }
        }
      ],
      series: [
        {
          name: '播放量',
          type: 'line',
          smooth: true,
          symbol: 'none',
          data: byDayViews,
          lineStyle: { color: '#6366f1', width: 2.5 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(99,102,241,0.32)' },
              { offset: 1, color: 'rgba(99,102,241,0)' }
            ])
          }
        },
        {
          name: '点赞',
          type: 'line',
          smooth: true,
          symbol: 'none',
          yAxisIndex: 1,
          data: byDayLikes,
          lineStyle: { color: '#ec4899', width: 2 }
        },
        {
          name: '评论',
          type: 'line',
          smooth: true,
          symbol: 'none',
          yAxisIndex: 1,
          data: byDayComments,
          lineStyle: { color: '#f59e0b', width: 2 }
        }
      ]
    })
  }

  if (donutChartRef.value) {
    if (donutChart) donutChart.dispose()
    donutChart = echarts.init(donutChartRef.value)
    const data = platformBreakdown.value.length
      ? platformBreakdown.value
      : []
    donutChart.setOption({
      tooltip: {
        trigger: 'item',
        backgroundColor: '#0f172a',
        borderColor: 'rgba(99,102,241,0.4)',
        borderWidth: 1,
        textStyle: { color: '#e2e8f0', fontSize: 12 }
      },
      series: [{
        type: 'pie',
        radius: ['68%', '92%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        itemStyle: { borderColor: '#fff', borderWidth: 3 },
        emphasis: { scale: true, scaleSize: 6 },
        data: data.map(d => ({ name: d.name, value: d.value, itemStyle: { color: d.color } }))
      }]
    })
  }
}

const loadData = async () => {
  const days = rangeDays.value
  const end = dayjs().format('YYYY-MM-DD')
  const start = dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD')
  const prevEnd = dayjs(start).subtract(1, 'day').format('YYYY-MM-DD')
  const prevStart = dayjs(start).subtract(days, 'day').format('YYYY-MM-DD')

  // 获取当前周期统计数据
  try {
    const stats = await getDataStats({ dateFrom: start, dateTo: end, range: range.value })
    if (stats) {
      currentStats.value = {
        summary: stats.summary || {},
        platformStats: stats.platformStats || [],
        trend: stats.trend || []
      }
    }
  } catch {}

  // 获取上期统计数据（用于趋势对比）
  try {
    const stats = await getDataStats({ dateFrom: prevStart, dateTo: prevEnd })
    if (stats) {
      prevStats.value = {
        summary: stats.summary || {},
        platformStats: stats.platformStats || [],
        trend: stats.trend || []
      }
    }
  } catch {}

  // 获取明细数据
  try {
    const t = await getDataTracks({ range: range.value, pageSize: 500 })
    if (Array.isArray(t)) tracks.value = t.map(normalizeTrack)
    else if (t && Array.isArray(t.list)) tracks.value = t.list.map(normalizeTrack)
  } catch {}

  // 获取账号列表
  try {
    const accs = await getAccounts()
    accounts.value = Array.isArray(accs) ? accs : (accs?.list || [])
  } catch {}

  nextTick(() => renderCharts())
}

watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

onMounted(() => {
  window.addEventListener('system-settings-updated', refreshSystemSettings)
  loadData()
})
onBeforeUnmount(() => {
  if (trendChart) trendChart.dispose()
  if (donutChart) donutChart.dispose()
  window.removeEventListener('resize', handleResize)
  window.removeEventListener('system-settings-updated', refreshSystemSettings)
})
const handleResize = () => {
  trendChart && trendChart.resize()
  donutChart && donutChart.resize()
}
if (typeof window !== 'undefined') window.addEventListener('resize', handleResize)
</script>

<style scoped>
.data-overview {
  display: flex; flex-direction: column; gap: 20px;
  animation: fadeInUp 0.5s ease;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Hero bar */
.hero-bar {
  position: relative;
  border-radius: 18px;
  overflow: hidden;
  padding: 28px 32px;
  color: #fff;
}
.hero-bg {
  position: absolute; inset: 0;
  background:
    radial-gradient(circle at 12% 20%, rgba(236, 72, 153, 0.35), transparent 45%),
    radial-gradient(circle at 88% 80%, rgba(6, 182, 212, 0.25), transparent 45%),
    linear-gradient(135deg, #4338ca 0%, #6366f1 45%, #8b5cf6 100%);
  z-index: 0;
}
.hero-bg::after {
  content: ''; position: absolute; inset: 0;
  background-image:
    radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px);
  background-size: 22px 22px;
  opacity: 0.55;
}
.hero-grid { position: relative; z-index: 1; display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; align-items: center; }

.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.8); font-weight: 500; letter-spacing: 0.03em; margin-bottom: 10px; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 4px rgba(255,255,255,0.18); }
.hero-title { font-size: 32px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; margin: 0 0 8px; }
.hero-sub { font-size: 14px; color: rgba(255,255,255,0.78); margin: 0 0 18px; font-weight: 400; }

.hero-pills { display: flex; gap: 10px; flex-wrap: wrap; }
.pill {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 7px 14px; border-radius: 99px;
  background: rgba(255,255,255,0.12); color: #fff;
  font-size: 12.5px; font-weight: 500; border: 1px solid rgba(255,255,255,0.18);
  backdrop-filter: blur(6px);
}
.pill .el-icon { font-size: 13px; }

.hero-right { display: flex; flex-direction: column; gap: 12px; align-items: flex-end; }
.range-group { display: flex; background: rgba(255,255,255,0.12); border-radius: 10px; padding: 4px; border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(6px); }
.range-btn {
  height: 32px; padding: 0 14px; border: 0; background: transparent;
  color: rgba(255,255,255,0.8); font-size: 12.5px; font-weight: 500;
  border-radius: 8px; cursor: pointer; transition: all 0.15s;
}
.range-btn:hover { color: #fff; }
.range-btn.active { background: #fff; color: #4338ca; font-weight: 700; box-shadow: 0 4px 10px rgba(0,0,0,0.12); }

.action-group { display: flex; gap: 10px; }

.ghost-btn {
  height: 38px; padding: 0 16px; border-radius: 10px;
  background: rgba(255,255,255,0.12); color: #fff;
  border: 1px solid rgba(255,255,255,0.18);
  font-size: 13.5px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: all 0.15s; backdrop-filter: blur(6px);
}
.ghost-btn:hover { background: rgba(255,255,255,0.22); }

.primary-btn {
  height: 38px; padding: 0 16px; border-radius: 10px; border: 0;
  background: #fff; color: #4338ca;
  font-size: 13.5px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 8px 20px rgba(0,0,0,0.15);
  transition: all 0.18s;
}
.primary-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 24px rgba(0,0,0,0.2); }
.primary-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

/* KPI grid */
.kpi-grid {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr 1fr 1fr 1fr;
  gap: 14px;
}

.kpi-card {
  position: relative;
  background: #fff; border: 1px solid #ececf1;
  border-radius: 16px; padding: 20px;
  transition: all 0.2s ease; overflow: hidden;
}
.kpi-card:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(15,23,42,0.08); border-color: #c7d2fe; }

.kpi-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
.kpi-label { font-size: 12.5px; color: #64748b; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; }
.label-dot { width: 6px; height: 6px; border-radius: 999px; background: #6366f1; }
.kpi-label-sm { font-size: 12px; color: #94a3b8; font-weight: 500; margin-bottom: 4px; }
.kpi-value { font-size: 26px; font-weight: 700; color: #0f172a; letter-spacing: -0.015em; line-height: 1.2; }
.kpi-caption-sm { margin-top: 8px; font-size: 11.5px; color: #64748b; display: flex; align-items: center; gap: 6px; }
.dot-sm { width: 6px; height: 6px; border-radius: 999px; }
.bg-indigo { background: #6366f1; }
.bg-pink { background: #ec4899; }
.bg-amber { background: #f59e0b; }
.bg-green { background: #10b981; }
.bg-cyan { background: #06b6d4; }

.text-indigo { color: #4338ca; }
.text-pink { color: #db2777; }
.text-amber { color: #b45309; }
.text-green { color: #047857; }

.kpi-trend {
  display: inline-flex; align-items: center; gap: 3px;
  padding: 4px 10px; border-radius: 99px; font-size: 11.5px; font-weight: 700;
}
.kpi-trend .el-icon { font-size: 11px; }
.kpi-trend.up { background: #ecfdf5; color: #059669; }
.kpi-trend.down { background: #fef2f2; color: #dc2626; }

.kpi-icon {
  width: 36px; height: 36px; border-radius: 10px;
  display: grid; place-items: center; color: #fff;
  box-shadow: 0 4px 10px rgba(0,0,0,0.08);
}
.kpi-icon .el-icon { font-size: 16px; }
.ic-likes { background: linear-gradient(135deg, #ec4899, #f472b6); }
.ic-comments { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
.ic-deals { background: linear-gradient(135deg, #10b981, #34d399); }
.ic-revenue { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.ic-videos { background: linear-gradient(135deg, #06b6d4, #22d3ee); }

/* Hero card */
.kpi-card.hero-card {
  background: linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #8b5cf6 100%);
  color: #fff; border: 0; padding: 24px;
  box-shadow: 0 12px 30px rgba(99,102,241,0.25);
}
.kpi-card.hero-card.light-bg {
  color: #0f172a;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 12px rgba(15,23,42,0.06);
}
.kpi-card.hero-card.light-bg .hero-shine {
  background: radial-gradient(circle, rgba(99,102,241,0.15), transparent 60%);
}
.kpi-card.hero-card.light-bg .kpi-label { color: #6b7280; }
.kpi-card.hero-card.light-bg .label-dot { background: #6366f1; }
.kpi-card.hero-card.light-bg .kpi-trend.up { background: #ecfdf5; color: #059669; }
.kpi-card.hero-card.light-bg .kpi-big { color: #0f172a; }
.kpi-card.hero-card.light-bg .kpi-caption { color: #6b7280; }
.hero-shine {
  position: absolute; top: -50%; right: -20%;
  width: 300px; height: 300px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,255,255,0.25), transparent 60%);
  pointer-events: none;
}
.kpi-card.hero-card .kpi-label { color: rgba(255,255,255,0.82); }
.kpi-card.hero-card .label-dot { background: #fff; }
.kpi-card.hero-card .kpi-trend.up { background: rgba(255,255,255,0.22); color: #fff; }
.kpi-big {
  font-size: 48px; font-weight: 800; letter-spacing: -0.03em;
  line-height: 1.1; margin: 6px 0 8px;
  font-variant-numeric: tabular-nums;
}
.kpi-caption { font-size: 12.5px; color: rgba(255,255,255,0.8); margin-bottom: 10px; }
.kpi-sparkline {
  margin-top: 6px; height: 52px;
}
.kpi-sparkline svg { width: 100%; height: 100%; }

/* Hero bar light bg */
.hero-bar.light-bg {
  color: #0f172a;
}
.hero-bar.light-bg .dot { background: #6366f1; }
.hero-bar.light-bg .hero-title { color: #0f172a; }
.hero-bar.light-bg .hero-sub { color: #6b7280; }
.hero-bar.light-bg .pill {
  background: rgba(99,102,241,0.1);
  color: #4f46e5;
}
.hero-bar.light-bg .range-btn {
  color: #475569;
}
.hero-bar.light-bg .range-btn.active {
  background: #e0e7ff;
  color: #4f46e5;
}
.hero-bar.light-bg .ghost-btn {
  background: rgba(15,23,42,0.06);
  color: #475569;
}
.hero-bar.light-bg .primary-btn {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
}

/* Charts */
.charts-grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: 16px; }
.panel { background: #fff; border: 1px solid #ececf1; border-radius: 16px; padding: 22px; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 18px; gap: 12px; }
.panel-head h3 { font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
.panel-head p { font-size: 12.5px; color: #64748b; margin: 0; }

.legend-group { display: flex; gap: 6px; flex-wrap: wrap; }
.legend-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; color: #475569; padding: 4px 10px; background: #f8fafc; border-radius: 6px; font-weight: 500; }
.lg { width: 8px; height: 8px; border-radius: 999px; display: inline-block; }
.lg-indigo { background: #6366f1; }
.lg-pink { background: #ec4899; }
.lg-amber { background: #f59e0b; }

.chart-wrap { position: relative; height: 280px; }

/* Donut */
.donut-wrap { display: grid; grid-template-columns: 220px 1fr; gap: 16px; align-items: center; min-height: 280px; }
.donut-area { position: relative; width: 220px; height: 220px; }
.donut-center {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; pointer-events: none;
}
.donut-center strong { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em; }
.donut-center span { font-size: 11.5px; color: #94a3b8; font-weight: 500; }

.donut-list { display: flex; flex-direction: column; gap: 10px; }
.donut-item {
  display: grid; grid-template-columns: 10px 1fr auto auto; gap: 10px; align-items: center;
  padding: 8px 10px; border-radius: 8px; background: #fafbff;
  font-size: 12.5px;
}
.donut-dot { width: 8px; height: 8px; border-radius: 999px; }
.donut-name { color: #334155; font-weight: 500; }
.donut-val { color: #0f172a; font-weight: 700; font-variant-numeric: tabular-nums; }
.donut-pct { color: #6366f1; font-weight: 700; font-variant-numeric: tabular-nums; }

.donut-empty {
  display: flex; align-items: center; justify-content: center;
  height: 100%; color: #94a3b8; font-size: 13px;
}

.tabs { display: flex; gap: 4px; flex-wrap: wrap; }
.tab { height: 28px; padding: 0 11px; border-radius: 8px; border: 0; background: transparent; font-size: 12.5px; color: #64748b; font-weight: 500; cursor: pointer; transition: all 0.15s; display: inline-flex; align-items: center; gap: 4px; }
.tab:hover { background: #f1f5f9; color: #0f172a; }
.tab.active { background: #eef2ff; color: #4338ca; font-weight: 600; }

/* Data table */
.table-wrap {
  border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;
  background: #fff;
}

/* 账号统计卡片 */
.account-stats-panel {
  background: linear-gradient(180deg, #fff 0%, #fafbff 100%);
}

.account-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  margin-top: 8px;
}

.account-card {
  padding: 16px;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
}

.account-card:hover {
  border-color: #c7d2fe;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.1);
}

.account-card.selected {
  border-color: #6366f1;
  background: linear-gradient(135deg, #fafbff, #eef2ff);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
}

.account-card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e5e7eb;
}

.account-platform {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #eef2ff, #e0e7ff);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.account-info strong {
  font-size: 14px;
  color: #0f172a;
  font-weight: 600;
}

.city-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  background: #ecfeff;
  color: #0f766e;
  font-size: 11px;
  font-weight: 600;
  width: fit-content;
}

.account-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.account-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
  border-radius: 8px;
  background: #f8fafc;
}

.account-stat .stat-label {
  font-size: 11px;
  color: #64748b;
  font-weight: 500;
}

.account-stat .stat-value {
  font-size: 15px;
  color: #0f172a;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.account-empty {
  padding: 40px 20px;
  text-align: center;
  color: #94a3b8;
  grid-column: 1 / -1;
}

.account-empty p {
  margin: 0;
  font-size: 14px;
}

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table thead th {
  text-align: left;
  padding: 12px 14px;
  font-size: 11.5px;
  color: #64748b;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}
.data-table th.num-right, .data-table td.num-right { text-align: right; font-variant-numeric: tabular-nums; }
.data-table tbody td {
  padding: 14px;
  border-bottom: 1px solid #f1f5f9;
  color: #0f172a;
}
.data-table tbody tr { transition: background 0.12s; }
.data-table tbody tr:hover { background: #fafbff; }
.data-table tbody tr:last-child td { border-bottom: 0; }

.date-cell { display: flex; flex-direction: column; line-height: 1.2; }
.date-cell strong { font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em; }
.date-cell span { font-size: 11px; color: #94a3b8; margin-top: 2px; }

.title-cell { display: flex; flex-direction: column; gap: 6px; }
.title-main { font-size: 13.5px; font-weight: 600; color: #0f172a; }
.title-sub { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #64748b; flex-wrap: wrap; }
.platform-chip { padding: 2px 8px; border-radius: 0; font-size: 12px; font-weight: 600; letter-spacing: 0.02em; display: inline-flex; align-items: center; gap: 4px; }
.source-chip { padding: 2px 8px; border-radius: 999px; background: #ecfeff; color: #0f766e; font-size: 11px; font-weight: 700; }
.source-chip.manual { background: #eef2ff; color: #4f46e5; }
.p-douyin { background: transparent; color: #4338ca; }
.p-kuaishou { background: transparent; color: #c2410c; }
.p-weixin { background: transparent; color: #047857; }

.num-indigo { color: #4338ca; font-weight: 700; }
.num-pink { color: #db2777; font-weight: 700; }
.num-amber { color: #b45309; font-weight: 700; }
.num-green { color: #059669; font-weight: 700; }
.num-money { color: #0f172a; font-weight: 700; }

.empty-row td { padding: 30px !important; text-align: center; }
.empty-inline { color: #94a3b8; font-size: 13px; }

/* Dialog */
.dialog-overlay {
  position: fixed; inset: 0; background: rgba(15, 23, 42, 0.55);
  display: grid; place-items: center; z-index: 100;
  backdrop-filter: blur(6px);
  animation: fadeIn 0.2s ease;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.dialog-card {
  background: #fff; border-radius: 16px; width: 560px; max-width: 92vw;
  max-height: 88vh; overflow: hidden;
  display: flex; flex-direction: column;
  box-shadow: 0 30px 60px rgba(15,23,42,0.25);
  animation: slideUp 0.25s ease;
}

.dialog-card.entry-dialog {
  width: 640px;
}

@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.dialog-head {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
  padding: 22px 24px 14px;
  border-bottom: 1px solid #f1f5f9;
  background: linear-gradient(135deg, #fafbff, #fff);
}
.dialog-head h3 { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
.dialog-head p { font-size: 12.5px; color: #64748b; margin: 0; }
.dialog-close {
  width: 32px; height: 32px; border-radius: 8px; border: 0;
  background: #f1f5f9; color: #475569; cursor: pointer;
  display: grid; place-items: center; transition: all 0.15s;
}
.dialog-close:hover { background: #e2e8f0; color: #0f172a; }

.dialog-body {
  padding: 18px 24px; overflow-y: auto;
  display: flex; flex-direction: column; gap: 14px;
}

/* 录入模式切换 */
.entry-mode-tabs {
  display: flex;
  gap: 8px;
  padding: 4px;
  background: #f8fafc;
  border-radius: 10px;
}

.mode-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mode-tab:hover {
  background: #fff;
  color: #0f172a;
}

.mode-tab.active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  color: #fff;
  font-weight: 600;
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.25);
}

/* 快捷区间 */
.quick-range {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.quick-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.quick-btn {
  padding: 5px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.quick-btn:hover {
  border-color: #6366f1;
  color: #6366f1;
}

.quick-btn.active {
  border-color: #6366f1;
  background: #eef2ff;
  color: #4338ca;
  font-weight: 600;
}

/* 区间摘要 */
.range-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: linear-gradient(135deg, #eef2ff, #f0fdf4);
  border: 1px solid #c7d2fe;
  border-radius: 8px;
  font-size: 12.5px;
  color: #4338ca;
}

.range-summary .el-icon {
  font-size: 14px;
  color: #6366f1;
}

/* 均值提示 */
.avg-hint {
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 12px;
  color: #64748b;
  text-align: center;
}

.field-row { display: flex; flex-direction: column; gap: 6px; }
.field-row label { font-size: 12.5px; color: #334155; font-weight: 600; }

.field-inline {
  display: flex; align-items: center;
  height: 38px; padding: 0 12px;
  border: 1px solid #e2e8f0; border-radius: 8px;
  background: #fff; transition: all 0.15s;
}
.field-inline.range-inline {
  flex: 1;
}
.field-inline:focus-within { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
.field-icon { color: #94a3b8; font-size: 14px; margin-right: 8px; }
.inline-picker { border: 0; outline: none; background: transparent; font-size: 13px; width: 100%; }

.text-input, .select-input {
  height: 38px; padding: 0 12px;
  border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 13px; background: #fff; outline: none;
  transition: all 0.15s; font-family: inherit; color: #0f172a;
}
.text-input:focus, .select-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }

.numbers-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.numbers-grid .wide { grid-column: span 3; }

.dialog-foot {
  padding: 14px 24px; border-top: 1px solid #f1f5f9;
  display: flex; justify-content: flex-end; gap: 10px;
  background: #fafbff;
}
.dialog-foot .ghost-btn {
  height: 38px; padding: 0 16px; border-radius: 10px;
  border: 1px solid #e2e8f0; background: #fff; color: #334155;
  font-size: 13px; font-weight: 500; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  transition: all 0.15s;
}
.dialog-foot .ghost-btn:hover { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }

.dialog-foot .primary-btn {
  height: 38px; padding: 0 16px; border-radius: 10px; border: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
  font-size: 13px; font-weight: 700; cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  box-shadow: 0 4px 12px rgba(99,102,241,0.3);
  transition: all 0.18s;
}
.dialog-foot .primary-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 16px rgba(99,102,241,0.35); }

/* Responsive */
@media (max-width: 1280px) {
  .kpi-grid { grid-template-columns: 1.4fr 1fr 1fr; }
  .charts-grid { grid-template-columns: 1fr; }
  .donut-wrap { grid-template-columns: 1fr; }
  .donut-area { margin: 0 auto; }
}
@media (max-width: 768px) {
  .hero-grid { grid-template-columns: 1fr; }
  .hero-right { align-items: flex-start; }
  .kpi-grid { grid-template-columns: 1fr 1fr; }
  .kpi-card.hero-card { grid-column: span 2; }
  .numbers-grid { grid-template-columns: 1fr 1fr; }
  .numbers-grid .wide { grid-column: span 2; }
}

@media (max-width: 640px) {
  .data-overview {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }
  .hero-bar {
    border-radius: 16px;
    padding: 18px;
    overflow: hidden;
  }
  .hero-title {
    font-size: 28px;
  }
  .hero-sub {
    line-height: 1.55;
  }
  .hero-pills,
  .range-group,
  .action-group,
  .tabs,
  .legend-group {
    width: 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
  }
  .hero-pills > *,
  .range-group > *,
  .action-group > *,
  .tabs > *,
  .legend-group > * {
    flex: 0 0 auto;
  }
  .kpi-grid {
    grid-template-columns: 1fr;
  }
  .kpi-card.hero-card {
    grid-column: auto;
  }
  .charts-grid {
    grid-template-columns: 1fr;
  }
  .panel {
    padding: 16px;
    overflow: hidden;
  }
  .panel-head {
    gap: 12px;
  }
  .chart-wrap {
    height: 240px;
  }
  .donut-wrap {
    grid-template-columns: 1fr;
  }
  .table-wrap {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .data-table {
    min-width: 760px;
  }
  .title-main {
    white-space: nowrap;
  }
  .dialog-card {
    width: 100vw;
    max-width: 100vw;
    border-radius: 18px 18px 0 0;
  }
}
</style>
