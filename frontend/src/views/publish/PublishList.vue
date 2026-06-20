<template>
  <div class="plan-page">
    <ConfigurablePageRenderer page-key="publishList" :modules="publishListLayoutModules">
    <template #page-head>
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="dot"></span>发布管理 · 每日计划</div>
        <h1>发布计划</h1>
        <p>按账号查看每日待发布状态，点击日期格子进入发布台账更新执行情况。</p>
      </div>
      <div class="head-actions">
        <button class="ghost-btn" @click="moveRange(-1)"><el-icon><ArrowLeft /></el-icon>前一周</button>
        <div class="date-box">
          <el-icon><Calendar /></el-icon>
          <el-date-picker
            v-model="startDate"
            type="date"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            class="date-picker"
            @change="loadAll"
          />
        </div>
        <button class="ghost-btn" @click="moveRange(1)">后一周<el-icon><ArrowRight /></el-icon></button>
        <button class="ghost-btn" @click="resetToday">回到今天</button>
        <button class="primary-btn" @click="loadAll"><el-icon><Refresh /></el-icon>刷新</button>
        <button class="primary-btn" @click="openCreateAccount"><el-icon><Plus /></el-icon>新增账号</button>
      </div>
    </div>
    </template>

    <template #summary-row>
    <div class="summary-row">
      <div class="summary-card">
        <span>账号总数</span>
        <strong>{{ filteredAccounts.length }}</strong>
        <small>当前筛选范围</small>
      </div>
      <div class="summary-card good">
        <span>今日已发布</span>
        <strong>{{ todayStats.published }}</strong>
        <small>来自发布台账</small>
      </div>
      <div class="summary-card warn">
        <span>今日待发布</span>
        <strong>{{ todayStats.pending }}</strong>
        <small>需进入台账更新</small>
      </div>
      <div class="summary-card danger">
        <span>失败/待补录</span>
        <strong>{{ todayStats.failed + todayStats.missing }}</strong>
        <small>需要优先处理</small>
      </div>
    </div>
    </template>

    <template #toolbar>
    <section class="toolbar">
      <div class="filter-group">
        <span>平台</span>
        <button class="chip" :class="{ active: filters.platform === '' }" @click="filters.platform = ''">全部</button>
        <button
          v-for="platform in platforms"
          :key="platform.key"
          class="chip"
          :class="{ active: filters.platform === platform.key }"
          @click="filters.platform = platform.key"
        >
          <IconFont :platform="platform.key" /> {{ platform.label }}
        </button>
      </div>
      <div class="filter-group">
        <span>账号归属</span>
        <button class="chip" :class="{ active: filters.scope === '' }" @click="filters.scope = ''">全部</button>
        <button class="chip" :class="{ active: filters.scope === 'hq' }" @click="filters.scope = 'hq'">总部</button>
        <button class="chip" :class="{ active: filters.scope === 'city' }" @click="filters.scope = 'city'">城市</button>
      </div>
      <div v-if="filters.scope === 'city'" class="filter-group">
        <span>城市</span>
        <select v-model="filters.cityId" class="select-input">
          <option value="">全部城市</option>
          <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.name }}</option>
        </select>
      </div>
      <div class="filter-group">
        <span>负责人</span>
        <select v-model="filters.owner" class="select-input">
          <option value="">全部负责人</option>
          <option v-for="owner in owners" :key="owner" :value="owner">{{ owner }}</option>
        </select>
      </div>
      <button class="ledger-btn" @click="openLedgerForToday"><el-icon><Tickets /></el-icon>打开今日台账</button>
    </section>
    </template>

    <template #plan-panel>
    <section class="plan-panel">
      <div class="table-scroll">
        <table class="plan-table">
          <thead>
            <tr>
              <th class="col-platform sticky-col first">平台</th>
              <th class="col-type sticky-col second">账号类型</th>
              <th class="col-name sticky-col third">账号名称</th>
              <th class="col-freq">更新频率</th>
              <th class="col-priority">任务指数</th>
              <th class="col-owner">负责发布人</th>
              <th class="col-purpose">视频产出目的</th>
              <th class="col-remark">备注</th>
              <th class="col-editor">拍摄剪辑</th>
              <th class="col-action">操作</th>
              <th v-for="date in dateColumns" :key="date" class="col-date" :class="{ today: isToday(date) }">
                <span>{{ formatDateHead(date) }}</span>
                <small>{{ formatWeekday(date) }}</small>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="account in filteredAccounts" :key="account.id">
              <td class="sticky-col first">
                <span class="platform-pill" :style="{ '--platform-color': platformColor(account.platform) }">
                  <IconFont :platform="account.platform" :color="platformColor(account.platform)" /> {{ platformName(account.platform) }}
                </span>
              </td>
              <td class="sticky-col second"><span class="soft-pill">{{ accountTypeLabel(account) }}</span></td>
              <td class="sticky-col third">
                <div class="account-name">
                  <strong>{{ account.name }}</strong>
                  <small v-if="account.platform_account">{{ account.platform_account }}</small>
                </div>
              </td>
              <td>{{ account.frequency || '每日1条' }}</td>
              <td>
                <span class="priority-pill" :class="account.priority || 'medium'">{{ priorityLabel(account.priority) }}</span>
              </td>
              <td>{{ account.owner || '未填写' }}</td>
              <td><span class="single-line">{{ account.purpose || '未填写' }}</span></td>
              <td><span class="single-line">{{ account.remark || '进行中' }}</span></td>
              <td>{{ account.editor || '未填写' }}</td>
              <td class="action-cell">
                <button class="icon-mini" title="编辑账号" @click="openEditAccount(account)"><el-icon><EditPen /></el-icon></button>
                <button class="icon-mini danger" title="删除账号" @click="removeAccount(account)"><el-icon><Delete /></el-icon></button>
              </td>
              <td v-for="date in dateColumns" :key="date" class="status-cell">
                <button
                  class="status-btn"
                  :class="statusInfo(account, date).className"
                  :title="statusInfo(account, date).title"
                  @click="openLedger(account, date)"
                >
                  <el-icon v-if="statusInfo(account, date).status === 'published'"><CircleCheckFilled /></el-icon>
                  <el-icon v-else-if="statusInfo(account, date).status === 'failed'"><WarningFilled /></el-icon>
                  <el-icon v-else><Clock /></el-icon>
                  <span>{{ statusInfo(account, date).label }}</span>
                </button>
              </td>
            </tr>
            <tr v-if="!filteredAccounts.length">
              <td :colspan="10 + dateColumns.length">
                <div class="empty-state">
                  <el-icon><Tickets /></el-icon>
                  <strong>暂无账号</strong>
                  <span>点击右上角“新增账号”，发布计划会自动按账号生成每日待办。</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
    </template>

    <template #hint-panel>
    <section class="hint-panel">
      <div>
        <strong>使用方式</strong>
        <p>计划页负责看每天哪些账号该发；发布台账负责登记发了什么、是否已发布、发布链接和异常原因。</p>
      </div>
      <button class="primary-btn" @click="openLedgerForToday">更新今天发布情况</button>
    </section>
    </template>
    </ConfigurablePageRenderer>

    <div class="dialog-overlay" v-if="accountDialogVisible" @click.self="closeAccountDialog">
      <div class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>{{ editingAccount ? '编辑发布账号' : '新增发布账号' }}</h3>
            <p>这里维护的是发布计划里的账号矩阵，账号类型来自“类型管理”。</p>
          </div>
          <button class="icon-close" @click="closeAccountDialog"><el-icon><Close /></el-icon></button>
        </div>

        <div class="dialog-body">
          <div class="form-grid two">
            <label class="field">
              <span>账号归属</span>
              <select v-model="accountForm.type" class="input">
                <option value="hq">总部账号</option>
                <option value="city">城市账号</option>
              </select>
            </label>
            <label v-if="accountForm.type === 'city'" class="field">
              <span>所属城市</span>
              <select v-model="accountForm.city_id" class="input">
                <option value="">选择城市</option>
                <option v-for="city in cities" :key="city.id" :value="city.id">{{ city.name }}</option>
              </select>
            </label>
          </div>

          <div class="form-grid two">
            <label class="field">
              <span>平台</span>
              <select v-model="accountForm.platform" class="input">
                <option v-for="platform in platforms" :key="platform.key" :value="platform.key">{{ platform.label }}</option>
              </select>
            </label>
            <label class="field">
              <span>账号类型</span>
              <select v-model="accountForm.account_type" class="input">
                <option value="">选择类型</option>
                <option v-for="type in activeVideoTypes" :key="type.id" :value="type.name">
                  {{ type.icon || '' }} {{ type.name }}
                </option>
              </select>
            </label>
          </div>

          <div class="form-grid two">
            <label class="field">
              <span>账号名称</span>
              <input v-model="accountForm.name" class="input" placeholder="如：遇见招商号" />
            </label>
            <label class="field">
              <span>平台账号 / 主页</span>
              <input v-model="accountForm.platform_account" class="input" placeholder="账号 ID、主页链接或备注" />
            </label>
          </div>

          <div class="form-grid three">
            <label class="field">
              <span>更新频率</span>
              <input v-model="accountForm.frequency" class="input" placeholder="如：每日1条" />
            </label>
            <label class="field">
              <span>任务指数</span>
              <select v-model="accountForm.priority" class="input">
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
            <label class="field">
              <span>负责发布人</span>
              <input v-model="accountForm.owner" class="input" placeholder="如：张林" />
            </label>
          </div>

          <div class="form-grid two">
            <label class="field">
              <span>视频产出目的</span>
              <input v-model="accountForm.purpose" class="input" placeholder="如：招商加盟 / 做账号流量" />
            </label>
            <label class="field">
              <span>拍摄剪辑</span>
              <input v-model="accountForm.editor" class="input" placeholder="如：宝玉、桑乾" />
            </label>
          </div>

          <label class="field">
            <span>备注</span>
            <textarea v-model="accountForm.remark" class="textarea" rows="3" placeholder="如：进行中、策划内容中、认证信息等"></textarea>
          </label>
        </div>

        <div class="dialog-foot">
          <button class="ghost-btn" @click="closeAccountDialog">取消</button>
          <button class="primary-btn" :disabled="savingAccount" @click="saveAccount">{{ savingAccount ? '保存中...' : '保存账号' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Close,
  CircleCheckFilled,
  Clock,
  Delete,
  EditPen,
  Plus,
  Refresh,
  Tickets,
  WarningFilled
} from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import {
  createAccount,
  deleteAccount,
  getCityDistributions,
  getAccounts,
  getCities,
  getSchedules,
  getVideoTypes,
  updateAccount
} from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'

const publishListLayoutModules = layoutModuleCatalog.publishList
const { bindings: layoutBindings } = useLayoutBindings('publishList')
const router = useRouter()
const today = dayjs().format('YYYY-MM-DD')
const startDate = ref(dayjs().subtract(2, 'day').format('YYYY-MM-DD'))
const dayCount = 9
const accounts = ref([])
const schedules = ref([])
const videoTypes = ref([])
const cities = ref([])
const filters = reactive({ platform: '', owner: '', scope: '', cityId: '' })
const accountDialogVisible = ref(false)
const editingAccount = ref(false)
const savingAccount = ref(false)

const platforms = [
  { key: 'douyin', label: '抖音', color: '#ef4444' },
  { key: 'kuaishou', label: '快手', color: '#f97316' },
  { key: 'weixin', label: '视频号', color: '#10b981' },
  { key: 'xiaohongshu', label: '小红书', color: '#e11d48' },
  { key: 'other', label: '其他', color: '#64748b' }
]

const normalizeBoundDate = (value) => {
  if (!value) return ''
  const parsed = dayjs(value)
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : ''
}

const applyLayoutBindings = (bindings = {}) => {
  if ('platform' in bindings) filters.platform = bindings.platform || ''
  if ('scope' in bindings) filters.scope = bindings.scope || ''
  if ('cityId' in bindings) filters.cityId = bindings.cityId || ''
  if ('owner' in bindings) filters.owner = bindings.owner || ''
  if ('startDate' in bindings) {
    const nextDate = normalizeBoundDate(bindings.startDate)
    if (nextDate && nextDate !== startDate.value) {
      startDate.value = nextDate
      loadAll()
    }
  }
}

const dateColumns = computed(() => {
  return Array.from({ length: dayCount }, (_, index) => dayjs(startDate.value).add(index, 'day').format('YYYY-MM-DD'))
})

const endDate = computed(() => dateColumns.value[dateColumns.value.length - 1])

const owners = computed(() => {
  return [...new Set(accounts.value.map(item => item.owner).filter(Boolean))].sort()
})

const activeVideoTypes = computed(() => {
  return videoTypes.value.filter(item => item.status !== 'inactive' && item.status !== 'archived')
})

const filteredAccounts = computed(() => {
  return accounts.value.filter(account => {
    if (filters.platform && account.platform !== filters.platform) return false
    if (filters.owner && account.owner !== filters.owner) return false
    if (filters.scope && account.type !== filters.scope) return false
    if (filters.scope === 'city' && filters.cityId && account.city_id !== filters.cityId) return false
    return true
  })
})

const scheduleMap = computed(() => {
  const map = new Map()
  schedules.value.forEach(item => {
    const key = `${item.account_id || ''}_${item.date || ''}`
    const group = map.get(key) || []
    group.push(item)
    map.set(key, group)
  })
  return map
})

const todayStats = computed(() => {
  return filteredAccounts.value.reduce((acc, account) => {
    const info = statusInfo(account, today)
    acc[info.status] = (acc[info.status] || 0) + 1
    return acc
  }, { published: 0, pending: 0, publishing: 0, failed: 0, missing: 0 })
})

const normalizeAccounts = (res) => Array.isArray(res) ? res : (res?.list || [])
const platformName = (p) => platforms.find(item => item.key === p)?.label || p || '未知'
const platformColor = (p) => platforms.find(item => item.key === p)?.color || '#6366f1'
const priorityLabel = (priority) => ({ high: '高', medium: '中', low: '低' }[priority] || '中')
const accountTypeLabel = (account) => {
  const value = account.account_type || account.type_note || ''
  if (value && !['self', 'hq', 'city', 'other'].includes(value)) return value
  return '未分类'
}
const isToday = (date) => date === today
const formatDateHead = (date) => dayjs(date).format('M月D号')
const formatWeekday = (date) => ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(date).day()]

const pickScheduleStatus = (items) => {
  if (!items.length) return ''
  if (items.some(item => item.status === 'published')) return 'published'
  if (items.some(item => item.status === 'failed')) return 'failed'
  if (items.some(item => item.status === 'publishing')) return 'publishing'
  return 'pending'
}

const statusInfo = (account, date) => {
  const items = scheduleMap.value.get(`${account.id}_${date}`) || []
  const status = pickScheduleStatus(items)
  if (status === 'published') {
    return { status, label: '已发布', className: 'published', title: '当天台账已有已发布记录' }
  }
  if (status === 'failed') {
    return { status, label: '发布失败', className: 'failed', title: '当天台账存在失败记录，点击处理' }
  }
  if (status === 'publishing') {
    return { status, label: '发布中', className: 'publishing', title: '当天台账标记为发布中' }
  }
  if (status === 'pending') {
    return { status, label: '待发布', className: 'pending', title: '当天已有待发布记录，点击更新' }
  }
  if (dayjs(date).isBefore(today, 'day')) {
    return { status: 'missing', label: '待补录', className: 'missing', title: '过去日期未登记，点击补录台账' }
  }
  if ((account.remark || '').includes('策划')) {
    return { status: 'planning', label: '策划内容中', className: 'planning', title: '账号备注包含策划状态' }
  }
  return { status: 'pending', label: '待发布', className: 'pending', title: '计划待发布，点击登记台账' }
}

const emptyAccountForm = () => ({
  id: '',
  name: '',
  platform: 'douyin',
  platform_account: '',
  type: 'hq',
  city_id: '',
  account_type: '',
  frequency: '每日1条',
  priority: 'medium',
  owner: '',
  editor: '',
  purpose: '',
  remark: '',
  status: 'active'
})
const accountForm = reactive(emptyAccountForm())

const resetAccountForm = (data = {}) => {
  Object.assign(accountForm, emptyAccountForm(), data, {
    type: data.type === 'city' ? 'city' : 'hq',
    city_id: data.city_id || '',
    account_type: accountTypeLabel(data) === '未分类' ? '' : accountTypeLabel(data),
    platform: data.platform || 'douyin',
    frequency: data.frequency || '每日1条',
    priority: data.priority || 'medium'
  })
}

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
  const [accountRes, scheduleRes, cityTaskRes, typeRes] = await Promise.all([
    loadPublishAccounts(),
    getSchedules({ dateFrom: startDate.value, dateTo: endDate.value, pageSize: 5000 }),
    getCityDistributions({ dateFrom: startDate.value, dateTo: endDate.value, pageSize: 5000 }),
    getVideoTypes()
  ])
  accounts.value = accountRes
  const cityRows = (cityTaskRes.list || []).map(row => ({
    id: `city-${row.id}`,
    city_distribution_id: row.id,
    date: row.date,
    time: row.publish_time || row.time || '09:00',
    account_id: row.account_id,
    account_name: row.account_name || row.publish_account_name,
    platform: row.platform || row.publish_platform,
    account_type: row.account_type || row.type_note,
    video_title: row.video_title || '城市下发任务',
    status: row.status === 'published' ? 'published' : row.status === 'failed' ? 'failed' : 'pending',
    source: 'city',
    city_id: row.city_id,
    city_name: row.city_name
  }))
  schedules.value = [...(scheduleRes.list || []).map(row => ({ ...row, source: 'hq' })), ...cityRows]
  videoTypes.value = Array.isArray(typeRes) ? typeRes : []
}

const moveRange = (step) => {
  startDate.value = dayjs(startDate.value).add(step * dayCount, 'day').format('YYYY-MM-DD')
  loadAll()
}

const resetToday = () => {
  startDate.value = dayjs().subtract(2, 'day').format('YYYY-MM-DD')
  loadAll()
}

const openLedger = (account, date) => {
  router.push({
    path: '/publish/ledger',
    query: { date, account_id: account.id }
  })
}

const openLedgerForToday = () => {
  router.push({ path: '/publish/ledger', query: { date: today } })
}

const openCreateAccount = () => {
  editingAccount.value = false
  resetAccountForm()
  accountDialogVisible.value = true
}

const openEditAccount = (account) => {
  editingAccount.value = true
  resetAccountForm(account)
  accountDialogVisible.value = true
}

const closeAccountDialog = () => {
  accountDialogVisible.value = false
}

const saveAccount = async () => {
  if (!accountForm.name.trim()) return ElMessage.warning('请填写账号名称')
  if (!accountForm.account_type) return ElMessage.warning('请选择账号类型')
  if (accountForm.type === 'city' && !accountForm.city_id) return ElMessage.warning('请选择所属城市')
  savingAccount.value = true
  try {
    const payload = { ...accountForm, type: accountForm.type || 'self' }
    if (editingAccount.value) {
      await updateAccount(payload.id, payload)
      ElMessage.success('账号已更新')
    } else {
      await createAccount(payload)
      ElMessage.success('账号已新增')
    }
    closeAccountDialog()
    await loadAll()
  } catch (e) {
    ElMessage.error('保存失败：' + e.message)
  } finally {
    savingAccount.value = false
  }
}

const removeAccount = async (account) => {
  try {
    await ElMessageBox.confirm(`删除账号「${account.name}」吗？已存在的发布台账不会被删除。`, '删除确认', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    })
  } catch { return }
  await deleteAccount(account.id)
  ElMessage.success('账号已删除')
  await loadAll()
}

watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })

onMounted(loadAll)
</script>

<style>
.plan-page { display: flex; flex-direction: column; gap: 18px; }
.plan-page .page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
.plan-page .eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #64748b; font-size: 12px; font-weight: 700; }
.plan-page .dot { width: 7px; height: 7px; border-radius: 99px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,.14); }
.plan-page h1 { margin-top: 8px; color: #0f172a; font-size: 30px; letter-spacing: 0; }
.plan-page .page-head p, .plan-page .hint-panel p { margin-top: 6px; color: #64748b; font-size: 13px; }
.plan-page .head-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.plan-page .ghost-btn, .plan-page .primary-btn, .plan-page .ledger-btn, .plan-page .chip, .plan-page .status-btn { font-family: inherit; cursor: pointer; }
.plan-page .ghost-btn, .plan-page .primary-btn, .plan-page .ledger-btn { height: 40px; border-radius: 10px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-weight: 800; }
.plan-page .ghost-btn { border: 1px solid #e5e7eb; background: #fff; color: #475569; }
.plan-page .primary-btn { border: 0; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: #fff; box-shadow: 0 8px 18px rgba(99,102,241,.24); }
.plan-page .ledger-btn { border: 1px solid #c7d2fe; background: #eef2ff; color: #4338ca; }
.plan-page .date-box { height: 40px; display: inline-flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 10px; background: #fff; border: 1px solid #e5e7eb; color: #64748b; }
.plan-page .date-picker { width: 132px; }
.plan-page .date-picker .el-input__wrapper { box-shadow: none; background: transparent; padding: 0; }
.plan-page .summary-row { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 12px; }
.plan-page .summary-card { background: #fff; border: 1px solid #ececf1; border-radius: 14px; padding: 16px; }
.plan-page .summary-card span { color: #64748b; font-size: 12px; font-weight: 700; }
.plan-page .summary-card strong { display: block; margin-top: 8px; color: #0f172a; font-size: 30px; }
.plan-page .summary-card small { color: #94a3b8; }
.plan-page .summary-card.good strong { color: #059669; }
.plan-page .summary-card.warn strong { color: #d97706; }
.plan-page .summary-card.danger strong { color: #dc2626; }
.plan-page .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; background: #fff; border: 1px solid #ececf1; border-radius: 14px; padding: 14px 16px; }
.plan-page .filter-group { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.plan-page .filter-group > span { color: #64748b; font-size: 13px; font-weight: 800; }
.plan-page .chip { height: 32px; padding: 0 12px; border: 1px solid #e5e7eb; background: #fff; color: #475569; border-radius: 8px; font-weight: 700; }
.plan-page .chip.active { background: #eef2ff; border-color: #c7d2fe; color: #4338ca; }
.plan-page .select-input { height: 34px; min-width: 132px; border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; color: #334155; padding: 0 10px; font: inherit; font-weight: 700; outline: 0; }
.plan-page .plan-panel { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; overflow: hidden; }
.plan-page .table-scroll { overflow-x: auto; max-width: 100%; }
.plan-page .plan-table { width: max-content; min-width: 100%; border-collapse: separate; border-spacing: 0; table-layout: fixed; }
.plan-page .plan-table th, .plan-page .plan-table td { height: 58px; padding: 10px 12px; border-right: 1px solid #eef0f5; border-bottom: 1px solid #eef0f5; text-align: center; vertical-align: middle; color: #0f172a; font-size: 13px; background: #fff; }
.plan-page .plan-table th { height: 54px; color: #64748b; font-size: 12px; font-weight: 900; background: #f8fafc; }
.plan-page .plan-table th.col-date { color: #0f172a; }
.plan-page .plan-table th.col-date.today { background: #eef2ff; color: #4338ca; }
.plan-page .plan-table th.col-date span, .plan-page .plan-table th.col-date small { display: block; line-height: 1.2; }
.plan-page .plan-table th.col-date small { margin-top: 4px; color: #94a3b8; }
.plan-page .sticky-col { position: sticky; z-index: 2; }
.plan-page th.sticky-col { z-index: 3; }
.plan-page .first { left: 0; }
.plan-page .second { left: 88px; }
.plan-page .third { left: 192px; box-shadow: 8px 0 14px rgba(15,23,42,.05); }
.plan-page .col-platform { width: 88px; }
.plan-page .col-type { width: 104px; }
.plan-page .col-name { width: 154px; }
.plan-page .col-freq { width: 100px; }
.plan-page .col-priority { width: 86px; }
.plan-page .col-owner { width: 112px; }
.plan-page .col-purpose { width: 150px; }
.plan-page .col-remark { width: 210px; }
.plan-page .col-editor { width: 112px; }
.plan-page .col-action { width: 92px; }
.plan-page .col-date { width: 106px; }
.plan-page .platform-pill, .plan-page .soft-pill, .plan-page .priority-pill { display: inline-flex; align-items: center; justify-content: center; min-height: 26px; padding: 0 9px; border-radius: 8px; font-size: 12px; font-weight: 800; white-space: nowrap; gap: 4px; }
.plan-page .platform-pill { color: var(--platform-color); background: transparent; border: none; }
.plan-page .soft-pill { background: #f8fafc; color: #475569; border: 1px solid #edf2f7; }
.plan-page .priority-pill.high { background: #fef2f2; color: #dc2626; }
.plan-page .priority-pill.medium, .plan-page .priority-pill:not(.high):not(.low) { background: #fff7ed; color: #c2410c; }
.plan-page .priority-pill.low { background: #ecfdf5; color: #047857; }
.plan-page .account-name { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; min-width: 0; }
.plan-page .account-name strong, .plan-page .account-name small, .plan-page .single-line { display: block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.plan-page .account-name strong { color: #0f172a; font-size: 13px; }
.plan-page .account-name small { color: #94a3b8; font-size: 11px; }
.plan-page .status-cell { padding: 8px; }
.plan-page .action-cell { white-space: nowrap; }
.plan-page .icon-mini { width: 32px; height: 32px; display: inline-grid; place-items: center; margin: 0 3px; border: 1px solid #e5e7eb; border-radius: 9px; background: #fff; color: #64748b; cursor: pointer; }
.plan-page .icon-mini:hover { color: #4338ca; border-color: #c7d2fe; background: #eef2ff; }
.plan-page .icon-mini.danger:hover { color: #dc2626; border-color: #fecaca; background: #fef2f2; }
.plan-page .status-btn { width: 86px; min-height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; border-radius: 10px; border: 1px solid transparent; font-size: 12px; font-weight: 900; white-space: nowrap; transition: transform .15s ease, box-shadow .15s ease; }
.plan-page .status-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 16px rgba(15,23,42,.08); }
.plan-page .status-btn.published { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
.plan-page .status-btn.pending { background: #fff7ed; color: #c2410c; border-color: #fed7aa; }
.plan-page .status-btn.publishing { background: #eef2ff; color: #4338ca; border-color: #c7d2fe; }
.plan-page .status-btn.failed { background: #fef2f2; color: #dc2626; border-color: #fecaca; }
.plan-page .status-btn.missing { background: #f8fafc; color: #64748b; border-color: #e2e8f0; }
.plan-page .status-btn.planning { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
.plan-page .empty-state { min-height: 220px; display: grid; place-items: center; align-content: center; gap: 8px; color: #94a3b8; }
.plan-page .empty-state .el-icon { font-size: 34px; color: #c7d2fe; }
.plan-page .empty-state strong { color: #0f172a; }
.plan-page .hint-panel { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border: 1px solid #dbeafe; background: #eff6ff; border-radius: 14px; }
.plan-page .hint-panel strong { color: #1e3a8a; }
.plan-page .dialog-overlay { position: fixed; inset: 0; z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 24px; background: rgba(15,23,42,.52); }
.plan-page .dialog-card { width: min(760px,100%); max-height: calc(100vh - 48px); overflow: auto; background: #fff; border-radius: 16px; box-shadow: 0 24px 70px rgba(15,23,42,.22); }
.plan-page .dialog-head, .plan-page .dialog-foot { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 22px; border-bottom: 1px solid #f1f5f9; }
.plan-page .dialog-head h3 { color: #0f172a; font-size: 18px; }
.plan-page .dialog-head p { margin-top: 5px; color: #64748b; font-size: 13px; }
.plan-page .dialog-foot { justify-content: flex-end; border-top: 1px solid #f1f5f9; border-bottom: 0; }
.plan-page .icon-close { width: 34px; height: 34px; border: 0; border-radius: 10px; background: #f3f4f6; color: #64748b; cursor: pointer; }
.plan-page .dialog-body { display: flex; flex-direction: column; gap: 14px; padding: 20px 22px; }
.plan-page .form-grid { display: grid; gap: 12px; }
.plan-page .form-grid.two { grid-template-columns: repeat(2,minmax(0,1fr)); }
.plan-page .form-grid.three { grid-template-columns: repeat(3,minmax(0,1fr)); }
.plan-page .field { display: flex; flex-direction: column; gap: 8px; color: #334155; font-size: 13px; font-weight: 800; }
.plan-page .input, .plan-page .textarea { width: 100%; border: 1px solid #e5e7eb; border-radius: 10px; background: #f8fafc; color: #0f172a; font: inherit; font-weight: 600; outline: 0; }
.plan-page .input { height: 42px; padding: 0 12px; }
.plan-page .textarea { padding: 12px; resize: vertical; }
.plan-page .input:focus, .plan-page .textarea:focus { border-color: #6366f1; background: #fff; box-shadow: 0 0 0 4px rgba(99,102,241,.1); }
@media (max-width: 1100px) {
  .plan-page .page-head { align-items: stretch; flex-direction: column; }
  .plan-page .head-actions { justify-content: flex-start; }
  .plan-page .summary-row { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .plan-page .hint-panel { flex-direction: column; align-items: flex-start; }
  .plan-page .form-grid.two, .plan-page .form-grid.three { grid-template-columns: 1fr; }
}

@media (max-width: 900px) {
  .plan-page {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
    gap: 14px;
  }
  .plan-page .page-head {
    gap: 14px;
  }
  .plan-page .head-actions {
    width: 100%;
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
  }
  .plan-page .head-actions > * {
    flex: 0 0 auto;
  }
  .plan-page .summary-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .plan-page .toolbar {
    align-items: stretch;
  }
  .plan-page .filter-group {
    width: 100%;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    -webkit-overflow-scrolling: touch;
  }
  .plan-page .filter-group > span,
  .plan-page .chip,
  .plan-page .select-input {
    flex: 0 0 auto;
  }
  .plan-page .plan-panel {
    width: 100%;
    max-width: 100%;
    overflow: hidden;
  }
  .plan-page .table-scroll {
    width: 100%;
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .plan-page .plan-table {
    min-width: 1280px;
  }
  .plan-page .sticky-col,
  .plan-page th.sticky-col {
    position: static;
    left: auto;
    z-index: auto;
  }
  .plan-page .third {
    box-shadow: none;
  }
}

@media (max-width: 640px) {
  .plan-page .summary-card {
    padding: 14px;
  }
  .plan-page .summary-card strong {
    font-size: 24px;
  }
  .plan-page .dialog-overlay {
    align-items: flex-end;
    padding: 0;
  }
  .plan-page .dialog-card {
    width: 100vw;
    max-height: calc(100vh - 58px);
    border-radius: 18px 18px 0 0;
  }
}
.el-option-with-icon { display: inline-flex; align-items: center; gap: 6px; }
</style>
