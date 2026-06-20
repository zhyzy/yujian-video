<template>
  <div class="ledger-page">
    <ConfigurablePageRenderer page-key="publishLedger" :modules="publishLedgerLayoutModules">
    <template #page-head>
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="dot"></span>{{ isCityUser ? '我的发布 · 每日记录' : '发布管理 · 每日台账' }}</div>
        <h1>{{ isCityUser ? '发布记录' : '发布台账' }}</h1>
        <p>{{ isCityUser ? '记录每天你的账号发布情况、发布链接和异常原因。' : '记录每天每个账号发了什么内容、是否发布、发布链接和异常原因。' }}</p>
      </div>
      <div class="head-actions">
        <div class="date-box">
          <el-icon><Calendar /></el-icon>
          <el-date-picker
            v-model="selectedDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            class="date-picker"
            @change="loadAll"
          />
        </div>
        <button class="ghost-btn" @click="loadAll"><el-icon><Refresh /></el-icon>刷新</button>
        <button class="primary-btn" @click="openCreate"><el-icon><Plus /></el-icon>{{ isCityUser ? '登记发布' : '登记发布' }}</button>
      </div>
    </div>
    </template>

    <template #summary-row>
    <div class="stat-row">
      <div class="stat-card">
        <span>今日记录</span>
        <strong>{{ list.length }}</strong>
      </div>
      <div class="stat-card good">
        <span>已发布</span>
        <strong>{{ countByStatus('published') }}</strong>
      </div>
      <div class="stat-card warn">
        <span>待发布</span>
        <strong>{{ ledgerPendingCount }}</strong>
      </div>
      <div class="stat-card danger">
        <span>失败/阻塞</span>
        <strong>{{ countByStatus('failed') }}</strong>
      </div>
    </div>
    </template>

    <template #toolbar>
    <section class="panel">
      <div class="panel-head">
        <div>
          <h2>{{ selectedDate }} 发布记录</h2>
          <p>{{ isCityUser ? '按你的账号核对当天发布情况。' : '按账号和平台核对当天发布情况。' }}</p>
        </div>
        <div class="filters">
          <button class="chip" :class="{ active: statusFilter === '' }" @click="statusFilter = ''">全部</button>
          <button class="chip" :class="{ active: statusFilter === 'published' }" @click="statusFilter = 'published'">已发布</button>
          <button class="chip" :class="{ active: statusFilter === 'pending' }" @click="statusFilter = 'pending'">待发布</button>
          <button class="chip" :class="{ active: statusFilter === 'failed' }" @click="statusFilter = 'failed'">失败</button>
          <template v-if="!isCityUser">
            <span class="filter-divider"></span>
            <button class="chip" :class="{ active: sourceFilter === '' }" @click="sourceFilter = ''">全部账号</button>
            <button class="chip" :class="{ active: sourceFilter === 'hq' }" @click="sourceFilter = 'hq'">总部</button>
            <button class="chip" :class="{ active: sourceFilter === 'city' }" @click="sourceFilter = 'city'">城市</button>
            <select v-if="sourceFilter === 'city'" v-model="cityFilter" class="filter-select">
              <option value="">全部城市</option>
              <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.name }}</option>
            </select>
          </template>
        </div>
      </div>
    </section>
    </template>

    <template #ledger-table>
    <section class="panel">
      <div v-if="filteredList.length" class="ledger-table">
        <div class="table-head">
          <span>账号</span>
          <span v-if="!isCityUser">归属</span>
          <span>账号类型</span>
          <span>素材标题</span>
          <span>状态</span>
          <span>发布时间</span>
          <span>对应视频链接</span>
          <span v-if="!isCityUser">统计</span>
          <span>操作</span>
        </div>
        <div v-for="row in filteredList" :key="row.id" class="table-row">
          <div class="account-cell">
            <strong>{{ row.account_name || accountMap[String(row.account_id)]?.name || '未绑定账号' }}</strong>
            <span><IconFont :platform="row.platform || accountMap[String(row.account_id)]?.platform" class="ledger-platform-icon" /> {{ platformName(row.platform || accountMap[String(row.account_id)]?.platform) }}</span>
          </div>
          <div v-if="!isCityUser">
            <span class="source-pill" :class="row.source === 'city' ? 'city' : 'hq'">
              {{ row.source === 'city' ? (row.city_name || '城市') : '总部' }}
            </span>
          </div>
          <div>
            <span class="type-pill">{{ accountTypeLabel(row) }}</span>
          </div>
          <div class="content-cell">
            <strong>{{ row.material_file_name || row.video_title || '未填写视频名称' }}</strong>
            <span v-if="row.video_title && row.material_file_name && row.video_title !== row.material_file_name">{{ row.video_title }}</span>
            <span v-else>视频名称</span>
          </div>
          <div>
            <span class="status-pill" :class="row.status">{{ statusLabel(row.status) }}</span>
          </div>
          <div class="muted">{{ row.published_at ? formatTime(row.published_at) : row.time || '--:--' }}</div>
          <div class="link-cell">
            <a v-if="row.published_url" :href="row.published_url" target="_blank" rel="noopener">查看发布</a>
            <span v-else class="muted">未填写</span>
          </div>
          <div v-if="!isCityUser">
            <button class="mini-btn" @click="openStats(row)">查看统计</button>
          </div>
          <div class="actions">
            <button class="mini-btn" @click="openEdit(row)">编辑</button>
            <button v-if="row.status !== 'published'" class="mini-btn success" @click="quickPublished(row)">已发布</button>
            <button class="mini-btn danger" @click="removeRow(row)">删除</button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <el-icon><Tickets /></el-icon>
        <strong>{{ isCityUser ? '当天暂无发布记录' : '当天暂无发布记录' }}</strong>
        <span>{{ isCityUser ? '点击右上角“登记发布”，把你当天的发布情况记下来。' : '点击右上角“登记发布”，把今天每个账号的发布情况记下来。' }}</span>
      </div>
    </section>
    </template>
    </ConfigurablePageRenderer>

    <div class="dialog-overlay" v-if="dialogVisible" @click.self="closeDialog">
      <div class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>{{ editing ? '编辑发布记录' : '登记发布记录' }}</h3>
            <p>一条记录对应“某天某账号发布某个视频”。</p>
          </div>
          <button class="icon-close" @click="closeDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="form-grid two">
            <label class="field">
              <span>发布日期</span>
              <el-date-picker v-model="form.date" value-format="YYYY-MM-DD" class="full-picker" />
            </label>
            <label class="field">
              <span>发布时间</span>
              <el-time-picker v-model="form.time" value-format="HH:mm" format="HH:mm" class="full-picker" />
            </label>
          </div>

          <label class="field">
            <span>发布账号</span>
            <select v-model="form.account_id" class="input">
              <option value="">选择账号</option>
              <option v-for="a in visibleAccounts" :key="a.id" :value="a.id">{{ platformName(a.platform) }} · {{ accountTypeLabel(a) }} · {{ a.name }}</option>
            </select>
          </label>

          <label class="field">
            <span>选择素材</span>
            <select v-model="form.material_file_id" class="input" @change="syncMaterial">
              <option value="">不绑定素材</option>
              <option v-for="m in materialFiles" :key="m.id" :value="m.id">{{ m.type_name || '未分类' }} · {{ m.name }}</option>
            </select>
          </label>

          <label class="field">
            <span>发布标题</span>
            <input v-model="form.video_title" class="input" placeholder="例如：遇见约到家 · 今日服务记录" />
          </label>

          <div class="form-grid two">
            <label class="field">
              <span>状态</span>
              <select v-model="form.status" class="input">
                <option value="pending">待发布</option>
                <option value="publishing">发布中</option>
                <option value="published">已发布</option>
                <option value="failed">发布失败</option>
              </select>
            </label>
            <label class="field">
              <span>话题标签</span>
              <input v-model="form.tags" class="input" placeholder="#同城服务 #遇见" />
            </label>
          </div>

          <label class="field">
            <span>发布链接</span>
            <input v-model="form.published_url" class="input" placeholder="填写抖音/快手/视频号发布后的链接" />
          </label>

          <label class="field">
            <span>失败原因 / 备注</span>
            <textarea v-model="form.fail_reason" class="textarea" rows="3" placeholder="如：账号异常、素材需重剪、待负责人确认"></textarea>
          </label>
        </div>
        <div class="dialog-foot">
          <button class="ghost-btn" @click="closeDialog">取消</button>
          <button class="primary-btn" :disabled="saving" @click="saveForm">{{ saving ? '保存中...' : '保存记录' }}</button>
        </div>
      </div>
    </div>

    <div class="dialog-overlay" v-if="statsVisible" @click.self="closeStats">
      <div class="dialog-card stats-card">
        <div class="dialog-head">
          <div>
            <h3>{{ statsAccount?.account_name || statsAccount?.name || '账号' }} 发布统计</h3>
            <p>统计这个账号所有已登记发布的视频记录。</p>
          </div>
          <button class="icon-close" @click="closeStats"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="stats-grid">
            <div class="stat-mini">
              <span>总记录</span>
              <strong>{{ accountStats.total }}</strong>
            </div>
            <div class="stat-mini good">
              <span>已发布</span>
              <strong>{{ accountStats.published }}</strong>
            </div>
            <div class="stat-mini warn">
              <span>待发布</span>
              <strong>{{ accountStats.pending }}</strong>
            </div>
            <div class="stat-mini danger">
              <span>失败</span>
              <strong>{{ accountStats.failed }}</strong>
            </div>
          </div>

          <div v-if="statsList.length" class="stats-list">
            <div v-for="item in statsList" :key="item.id" class="stats-row">
              <div>
                <strong>{{ item.material_file_name || item.video_title || '未填写视频名称' }}</strong>
                <span>{{ formatStatsTime(item) }}</span>
              </div>
              <span class="status-pill" :class="item.status">{{ statusLabel(item.status) }}</span>
              <div class="stats-actions">
                <a v-if="item.published_url" :href="item.published_url" target="_blank" rel="noopener">查看链接</a>
                <span v-else class="muted">未填写链接</span>
                <a v-if="item.publish_screenshot" :href="mediaUrl(item.publish_screenshot)" target="_blank" rel="noopener">查看截图</a>
              </div>
            </div>
          </div>
          <div v-else class="empty-state small">
            <strong>暂无统计记录</strong>
            <span>这个账号还没有发布台账。</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Calendar, Close, Plus, Refresh, Tickets } from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import {
  createSchedule,
  createCityDistribution,
  deleteCityDistribution,
  deleteSchedule,
  getAccounts,
  getCityDistributions,
  getCities,
  getMaterialFiles,
  getSchedules,
  updateCityDistribution,
  updateSchedule
} from '@/api'
import { resolveMediaUrl } from '@/utils/mediaUrl'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { isCityUser as isCityUserFn } from '@/utils/authRole'

const readCurrentUser = () => {
  try { return JSON.parse(localStorage.getItem('auth_user') || '{}') }
  catch { return {} }
}
const isCityUser = isCityUserFn(readCurrentUser())

const route = useRoute()
const publishLedgerLayoutModules = layoutModuleCatalog.publishLedger
const { bindings: layoutBindings } = useLayoutBindings('publishLedger')
const selectedDate = ref(route.query.date || dayjs().format('YYYY-MM-DD'))
const statusFilter = ref('')
const sourceFilter = ref('')
const cityFilter = ref('')
const list = ref([])
const accounts = ref([])
const cities = ref([])
const materialFiles = ref([])
const dialogVisible = ref(false)
const editing = ref(false)
const saving = ref(false)
const autoOpened = ref(false)
const statsVisible = ref(false)
const statsLoading = ref(false)
const statsAccount = ref(null)
const statsList = ref([])

const normalizeBoundDate = (value) => {
  if (!value) return ''
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

const applyLayoutBindings = (bindings = {}) => {
  let shouldReload = false
  if ('date' in bindings || 'selectedDate' in bindings) {
    const nextDate = normalizeBoundDate(bindings.date ?? bindings.selectedDate)
    if (nextDate && nextDate !== selectedDate.value) {
      selectedDate.value = nextDate
      shouldReload = true
    }
  }
  if ('status' in bindings) statusFilter.value = bindings.status || ''
  if ('scope' in bindings || 'source' in bindings) sourceFilter.value = bindings.scope || bindings.source || ''
  if ('cityId' in bindings) cityFilter.value = bindings.cityId || ''
  if (shouldReload) loadAll()
}

const emptyForm = () => ({
  id: '',
  date: selectedDate.value,
  time: dayjs().format('HH:mm'),
  account_id: route.query.account_id || '',
  material_file_id: '',
  video_type_id: '',
  video_title: '',
  video_url: '',
  tags: '',
  status: 'published',
  published_url: '',
  fail_reason: ''
})

const form = reactive(emptyForm())

const filteredList = computed(() => {
  return list.value.filter(item => {
    if (statusFilter.value && item.status !== statusFilter.value) return false
    if (!isCityUser) {
      if (sourceFilter.value && item.source !== sourceFilter.value) return false
      if (sourceFilter.value === 'city' && cityFilter.value && item.city_id !== cityFilter.value) return false
    }
    return true
  })
})

const accountMap = computed(() => {
  return accounts.value.reduce((map, account) => {
    map[String(account.id)] = account
    return map
  }, {})
})

const visibleAccounts = computed(() => {
  if (isCityUser) return accounts.value.filter(a => a.type === 'city')
  return accounts.value
})

const scheduleMap = computed(() => {
  const map = new Map()
  list.value.forEach(item => {
    const key = `${item.account_id || ''}_${item.date || ''}`
    const group = map.get(key) || []
    group.push(item)
    map.set(key, group)
  })
  return map
})

const accountStats = computed(() => {
  return statsList.value.reduce((acc, item) => {
    acc.total += 1
    acc[item.status] = (acc[item.status] || 0) + 1
    return acc
  }, { total: 0, published: 0, pending: 0, publishing: 0, failed: 0 })
})

const platformName = (p) => ({
  douyin: '抖音',
  kuaishou: '快手',
  weixin: '视频号',
  xiaohongshu: '小红书',
  other: '其他'
}[p] || p || '未知平台')

const statusLabel = (s) => ({
  pending: '待发布',
  publishing: '发布中',
  published: '已发布',
  failed: '发布失败'
}[s] || s)

const formatTime = (v) => dayjs(v).isValid() ? dayjs(v).format('HH:mm') : v
const formatStatsTime = (item = {}) => {
  const full = item.actual_publish_time || item.published_at || item.created_at
  if (full && dayjs(full).isValid()) return dayjs(full).format('YYYY-MM-DD HH:mm')
  if (item.date && item.time) return `${item.date} ${item.time}`
  return `${item.date || '--'} --:--`
}
const mediaUrl = (url) => resolveMediaUrl(url)
const countByStatus = (status) => list.value.filter(item => item.status === status).length

const pickScheduleStatus = (items) => {
  if (!items.length) return ''
  if (items.some(item => item.status === 'published')) return 'published'
  if (items.some(item => item.status === 'failed')) return 'failed'
  if (items.some(item => item.status === 'publishing')) return 'publishing'
  return 'pending'
}

const planStatusForAccount = (account) => {
  const items = scheduleMap.value.get(`${account.id}_${selectedDate.value}`) || []
  const status = pickScheduleStatus(items)
  if (status) return status
  if (dayjs(selectedDate.value).isBefore(dayjs().format('YYYY-MM-DD'), 'day')) return 'missing'
  if ((account.remark || '').includes('策划')) return 'planning'
  return 'pending'
}

const ledgerPendingCount = computed(() => {
  return accounts.value.filter(account => planStatusForAccount(account) === 'pending').length
})

const accountTypeLabel = (row) => {
  const account = accountMap.value[String(row.account_id || row.id)] || {}
  const value = row.account_type || account.account_type || account.type_note || ''
  if (value && !['self', 'hq', 'city', 'other'].includes(value)) return value
  return '未分类'
}

const resetForm = (data = {}) => {
  Object.assign(form, emptyForm(), data)
}

const normalizeAccounts = (res) => Array.isArray(res) ? res : (res?.list || [])

const loadPublishAccounts = async () => {
  const [hqAccounts, otherAccounts, cityList] = await Promise.all([
    getAccounts({ type: 'hq', pageSize: 1000 }),
    getAccounts({ type: 'other', pageSize: 1000 }),
    getCities()
  ])
  cities.value = Array.isArray(cityList) ? cityList : []
  const cityAccounts = cities.value.flatMap(city => {
    return (city.accounts || []).map(account => ({
      ...account,
      type: 'city',
      city_name: city.name,
      account_type: account.account_type || account.type_note || '',
      platform_account: account.platform_account || account.url || ''
    }))
  })
  return [
    ...normalizeAccounts(hqAccounts),
    ...cityAccounts,
    ...normalizeAccounts(otherAccounts)
  ].filter(account => account.status !== 'archived')
}

const loadAll = async () => {
  const scheduleReq = isCityUser ? Promise.resolve({ list: [] }) : getSchedules({ dateFrom: selectedDate.value, dateTo: selectedDate.value, pageSize: 500 })
  const [scheduleRes, cityTaskRes, accountRes, fileRes] = await Promise.all([
    scheduleReq,
    getCityDistributions({ dateFrom: selectedDate.value, dateTo: selectedDate.value, pageSize: 1000 }),
    loadPublishAccounts(),
    getMaterialFiles({ date: selectedDate.value, pageSize: 500 })
  ])
  const hqRows = isCityUser ? [] : (scheduleRes.list || []).map(row => ({ ...row, source: 'hq' }))
  const cityRows = (cityTaskRes.list || []).map(row => ({
    ...row,
    id: `city-${row.id}`,
    raw_id: row.id,
    source: 'city',
    date: row.date,
    time: row.publish_time || row.time || '',
    account_name: row.account_name || row.publish_account_name,
    platform: row.platform || row.publish_platform,
    video_title: row.video_title || '城市下发任务',
    published_url: row.publish_url,
    published_at: row.actual_publish_time || row.published_at,
    fail_reason: row.failed_reason || row.city_remark || '',
    status: row.status === 'published' ? 'published' : row.status === 'failed' ? 'failed' : 'pending'
  }))
  list.value = isCityUser ? cityRows : [...hqRows, ...cityRows]
  accounts.value = accountRes
  materialFiles.value = fileRes.list || []
}

const openCreate = () => {
  editing.value = false
  resetForm()
  dialogVisible.value = true
}

const openEdit = (row) => {
  editing.value = true
  resetForm({
    ...row,
    id: row.raw_id || row.id,
    time: row.time || dayjs().format('HH:mm'),
    published_url: row.published_url || '',
    fail_reason: row.fail_reason || ''
  })
  dialogVisible.value = true
}

const closeDialog = () => {
  dialogVisible.value = false
}

const syncMaterial = () => {
  const file = materialFiles.value.find(item => String(item.id) === String(form.material_file_id))
  if (!file) return
  form.video_title = form.video_title || file.name
  form.video_url = file.url || ''
  form.video_type_id = file.video_type_id || ''
}

const saveForm = async () => {
  if (!form.date) return ElMessage.warning('请选择发布日期')
  if (!form.account_id) return ElMessage.warning('请选择发布账号')
  if (!form.video_title) return ElMessage.warning('请填写发布标题')
  saving.value = true
  try {
    const payload = { ...form }
    const account = accountMap.value[String(payload.account_id)] || {}
    if (account.type === 'city') {
      const cityPayload = {
        date: payload.date,
        city_id: account.city_id,
        account_id: payload.account_id,
        video_title: payload.video_title,
        material_url: payload.video_url,
        publish_time: payload.time,
        status: payload.status === 'published' ? 'published' : payload.status === 'failed' ? 'failed' : 'distributed',
        publish_url: payload.published_url,
        actual_publish_time: payload.status === 'published' ? `${payload.date} ${payload.time || dayjs().format('HH:mm')}:00` : '',
        failed_reason: payload.fail_reason
      }
      if (editing.value && String(payload.id || '').startsWith('city_')) {
        await updateCityDistribution(payload.id, cityPayload)
      } else if (editing.value && list.value.some(item => item.raw_id === payload.id && item.source === 'city')) {
        await updateCityDistribution(payload.id, cityPayload)
      } else {
        await createCityDistribution(cityPayload)
      }
    } else if (editing.value) {
      await updateSchedule(payload.id, payload)
    } else {
      await createSchedule(payload)
    }
    ElMessage.success('已保存发布记录')
    closeDialog()
    loadAll()
  } catch (e) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    saving.value = false
  }
}

const quickPublished = async (row) => {
  if (row.source === 'city') {
    await updateCityDistribution(row.raw_id || row.id.replace(/^city-/, ''), {
      status: 'published',
      actual_publish_time: row.actual_publish_time || `${row.date} ${row.time || dayjs().format('HH:mm')}:00`
    })
  } else {
    await updateSchedule(row.id, { ...row, status: 'published' })
  }
  row.status = 'published'
  ElMessage.success('已标记发布')
}

const removeRow = async (row) => {
  try {
    await ElMessageBox.confirm(`删除“${row.video_title || row.account_name}”这条发布记录吗？`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch {
    return
  }
  if (row.source === 'city') {
    await deleteCityDistribution(row.raw_id || row.id.replace(/^city-/, ''))
  } else {
    await deleteSchedule(row.id)
  }
  list.value = list.value.filter(item => item.id !== row.id)
  ElMessage.success('已删除')
}

const openStats = async (row) => {
  if (!row.account_id) return ElMessage.warning('这条记录没有绑定账号')
  statsVisible.value = true
  statsLoading.value = true
  statsAccount.value = row
  try {
    if (row.source === 'city') {
      const res = await getCityDistributions({ cityId: row.city_id, pageSize: 5000 })
      statsList.value = (res.list || []).filter(item => String(item.account_id) === String(row.account_id)).map(item => ({
        ...item,
        source: 'city',
        material_file_name: item.video_title,
        published_url: item.publish_url,
        publish_screenshot: item.publish_screenshot,
        status: item.status === 'published' ? 'published' : item.status === 'failed' ? 'failed' : 'pending'
      }))
    } else {
      const res = await getSchedules({ accountId: row.account_id, pageSize: 5000 })
      statsList.value = res.list || []
    }
  } catch (e) {
    ElMessage.error('统计加载失败：' + e.message)
    statsList.value = []
  } finally {
    statsLoading.value = false
  }
}

const closeStats = () => {
  statsVisible.value = false
  statsAccount.value = null
  statsList.value = []
}

watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

onMounted(async () => {
  await loadAll()
  if (route.query.account_id && !autoOpened.value) {
    const existing = list.value.find(item => String(item.account_id) === String(route.query.account_id))
    if (existing) {
      openEdit(existing)
    } else {
      openCreate()
    }
    autoOpened.value = true
  }
})
</script>

<style scoped>
.ledger-page { display: flex; flex-direction: column; gap: 18px; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #64748b; font-size: 12px; font-weight: 600; }
.dot { width: 7px; height: 7px; border-radius: 99px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,.14); }
h1 { margin-top: 8px; font-size: 28px; color: #0f172a; }
.page-head p, .panel-head p, .dialog-head p { margin-top: 6px; color: #64748b; font-size: 13px; }
.head-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.date-box { height: 40px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 10px; background: #fff; border: 1px solid #e5e7eb; color: #64748b; }
:deep(.date-picker) { width: 134px; }
:deep(.date-picker .el-input__wrapper) { box-shadow: none; background: transparent; padding: 0; }
.ghost-btn, .primary-btn, .mini-btn, .chip, .icon-close { font-family: inherit; cursor: pointer; }
.ghost-btn, .primary-btn { height: 40px; border-radius: 10px; padding: 0 16px; display: inline-flex; align-items: center; gap: 6px; font-weight: 700; }
.ghost-btn { border: 1px solid #e5e7eb; background: #fff; color: #475569; }
.primary-btn { border: 0; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; box-shadow: 0 8px 18px rgba(99,102,241,.25); }
.primary-btn:disabled { opacity: .7; cursor: not-allowed; }
.stat-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.stat-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 8px; }
.stat-card span { color: #64748b; font-size: 13px; }
.stat-card strong { color: #0f172a; font-size: 28px; line-height: 1; }
.stat-card.good strong { color: #059669; }
.stat-card.warn strong { color: #d97706; }
.stat-card.danger strong { color: #dc2626; }
.panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; padding: 22px; }
.panel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
h2, h3 { color: #0f172a; }
.filters { display: flex; gap: 8px; flex-wrap: wrap; }
.chip { border: 1px solid #e5e7eb; background: #fff; color: #475569; border-radius: 8px; padding: 8px 14px; font-weight: 700; }
.chip.active { color: #4f46e5; border-color: #c7d2fe; background: #eef2ff; }
.filter-divider { width: 1px; min-height: 32px; background: #e5e7eb; margin: 0 2px; }
.filter-select { height: 36px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; color: #334155; padding: 0 10px; font: inherit; font-weight: 700; outline: 0; }
.ledger-table { overflow-x: auto; }
.ledger-platform-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border-radius: 50%;
  background: #f1f5f9;
  margin-right: 6px; flex-shrink: 0; overflow: hidden;
}
.ledger-platform-icon .iconfont { font-size: 14px !important; }
.table-head, .table-row { min-width: 1280px; display: grid; grid-template-columns: 1.35fr .8fr .9fr 1.6fr .9fr .9fr 1.35fr .9fr 1.2fr; align-items: center; column-gap: 16px; }
.table-head { padding: 14px 0; border-top: 1px solid #edf2f7; border-bottom: 1px solid #edf2f7; color: #94a3b8; font-size: 12px; font-weight: 700; }
.table-row { padding: 16px 0; border-bottom: 1px solid #f1f5f9; color: #0f172a; }
.account-cell, .content-cell, .stats-row > div { display: flex; flex-direction: column; gap: 6px; }
.account-cell span, .content-cell span, .muted, .stats-row span { color: #94a3b8; font-size: 12px; }
.type-pill, .status-pill { display: inline-flex; align-items: center; width: fit-content; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 700; }
.type-pill { color: #334155; background: #f8fafc; border: 1px solid #e5e7eb; }
.source-pill { display: inline-flex; align-items: center; width: fit-content; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 800; }
.source-pill.hq { color: #4338ca; background: #eef2ff; }
.source-pill.city { color: #047857; background: #ecfdf5; }
.status-pill.pending { color: #d97706; background: #fff7ed; }
.status-pill.publishing { color: #2563eb; background: #eff6ff; }
.status-pill.published { color: #059669; background: #ecfdf5; }
.status-pill.failed { color: #dc2626; background: #fef2f2; }
.link-cell a, .stats-row a { color: #4f46e5; font-weight: 700; text-decoration: none; }
.actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.mini-btn { min-height: 30px; border: 1px solid #e5e7eb; background: #fff; color: #475569; border-radius: 8px; padding: 0 10px; font-weight: 700; }
.mini-btn.success { color: #059669; border-color: #bbf7d0; }
.mini-btn.danger { color: #dc2626; border-color: #fecaca; }
.empty-state { min-height: 180px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: #64748b; }
.empty-state .el-icon { font-size: 30px; color: #cbd5e1; }
.empty-state strong { color: #0f172a; }
.empty-state.small { min-height: 90px; }
.dialog-overlay { position: fixed; inset: 0; z-index: 50; background: rgba(15,23,42,.42); display: flex; align-items: center; justify-content: center; padding: 20px; }
.dialog-card { width: min(720px, 96vw); max-height: 90vh; overflow: auto; background: #fff; border-radius: 14px; box-shadow: 0 24px 60px rgba(15,23,42,.22); }
.dialog-card.stats-card { width: min(760px, 96vw); }
.dialog-head, .dialog-foot { padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid #f1f5f9; }
.dialog-foot { border-top: 1px solid #f1f5f9; border-bottom: 0; justify-content: flex-end; }
.dialog-body { padding: 20px 22px; display: flex; flex-direction: column; gap: 14px; }
.icon-close { width: 34px; height: 34px; border-radius: 9px; border: 1px solid #e5e7eb; background: #fff; color: #64748b; }
.form-grid { display: grid; gap: 12px; }
.form-grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.field { display: flex; flex-direction: column; gap: 8px; color: #475569; font-size: 13px; font-weight: 700; }
.input, .textarea { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; background: #fff; color: #0f172a; font: inherit; padding: 10px 12px; outline: none; }
.input:focus, .textarea:focus { border-color: #a5b4fc; box-shadow: 0 0 0 3px rgba(99,102,241,.12); }
.textarea { resize: vertical; }
.full-picker { width: 100%; }
.stats-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.stat-mini { background: #f8fafc; border: 1px solid #edf2f7; border-radius: 10px; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
.stat-mini span { color: #64748b; font-size: 12px; }
.stat-mini strong { color: #0f172a; font-size: 22px; }
.stat-mini.good strong { color: #059669; }
.stat-mini.warn strong { color: #d97706; }
.stat-mini.danger strong { color: #dc2626; }
.stats-list { display: flex; flex-direction: column; border-top: 1px solid #f1f5f9; margin-top: 8px; }
.stats-row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid #f1f5f9; }
.stats-actions { display: flex; align-items: center; justify-content: flex-end; gap: 12px; flex-wrap: wrap; }

@media (max-width: 900px) {
  .page-head, .panel-head { flex-direction: column; align-items: stretch; }
  .stat-row, .stats-grid, .form-grid.two { grid-template-columns: 1fr; }
  .head-actions { justify-content: flex-start; }
}
</style>
