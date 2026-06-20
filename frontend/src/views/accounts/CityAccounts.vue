<template>
  <div class="page-wrap">
    <ConfigurablePageRenderer page-key="cityAccounts" :modules="cityAccountsLayoutModules">

    <template #page-head>
    <!-- Hero -->
    <div class="hero">
      <div class="hero-left">
        <div class="eyebrow"><span class="dot"></span>城市分发 · 账号矩阵</div>
        <h1 class="title">城市账号</h1>
        <p class="subtitle">按城市管理各平台分发账号，支持自定义平台与增删改查</p>
      </div>
      <div class="hero-right">
        <div class="chip-group">
          <button class="chip" :class="{active: filter.status === ''}" @click="filter.status = ''">全部</button>
          <button class="chip" :class="{active: filter.status === 'active'}" @click="filter.status = 'active'">活跃</button>
          <button class="chip" :class="{active: filter.status === 'pending'}" @click="filter.status = 'pending'">待完善</button>
          <button class="chip" :class="{active: filter.status === 'paused'}" @click="filter.status = 'paused'">已暂停</button>
        </div>
        <button class="btn-primary" @click="openCityDialog"><el-icon><Plus /></el-icon>新增城市</button>
      </div>
    </div>
    </template>

    <template #toolbar>
    <!-- Summary -->
    <div class="summary-row">
      <div class="sum-card">
        <div class="sum-ic ic-indigo"><el-icon><LocationFilled /></el-icon></div>
        <div class="sum-main"><span class="sum-label">接入城市</span><strong class="sum-value">{{ cities.length }}</strong></div>
      </div>
      <div class="sum-card">
        <div class="sum-ic ic-green"><el-icon><UserFilled /></el-icon></div>
        <div class="sum-main"><span class="sum-label">总账号数</span><strong class="sum-value">{{ totalAccounts }}</strong></div>
      </div>
      <div class="sum-card">
        <div class="sum-ic ic-amber"><el-icon><DataAnalysis /></el-icon></div>
        <div class="sum-main"><span class="sum-label">平台覆盖</span><strong class="sum-value">{{ platformCount }}</strong></div>
      </div>
      <div class="sum-card">
        <div class="sum-ic ic-pink"><el-icon><Warning /></el-icon></div>
        <div class="sum-main"><span class="sum-label">待完善</span><strong class="sum-value">{{ needFix }}</strong></div>
      </div>
      <div class="platforms-inline">
        <span>常用平台：</span>
        <span v-for="p in platformOptions" :key="p.key" class="p-chip" :class="'p-'+p.key">
          <IconFont :platform="p.key" /> {{ p.label }}
        </span>
        <span class="p-chip custom" @click="openPlatformDialog"><el-icon><Plus /></el-icon>自定义</span>
      </div>
    </div>
    </template>

    <template #account-table>
    <!-- City cards -->
    <div v-if="filteredCities.length" class="city-grid">
      <div v-for="city in filteredCities" :key="city.id" class="city-card">
        <div class="city-head">
          <div class="city-hero">
            <div class="city-avatar" :style="{background: colorFromName(city.name)}">{{ (city.name || '?').slice(0,1) }}</div>
            <div class="city-info">
              <h3 class="city-name">{{ city.name }}</h3>
              <div class="city-meta">
                <span v-if="city.contact" class="meta-item"><el-icon><UserFilled /></el-icon>{{ city.contact }}</span>
                <span v-if="city.phone" class="meta-item"><el-icon><Phone /></el-icon>{{ city.phone }}</span>
                <span v-if="city.remark" class="meta-item muted">{{ city.remark }}</span>
              </div>
            </div>
          </div>
          <div class="city-status">
            <span class="status-pill" :class="'st-'+city.status">{{ statusLabel(city.status) }}</span>
            <div class="actions">
              <button class="icon-btn" @click="editCity(city)"><el-icon><EditPen /></el-icon></button>
              <button class="icon-btn" @click="removeCity(city)"><el-icon><Delete /></el-icon></button>
            </div>
          </div>
        </div>

        <div class="accounts">
          <div class="account-row" v-for="acc in city.accounts" :key="acc.id">
            <div class="account-main">
              <div class="account-platform" :class="'p-'+(customPlatformColor(acc.platform))">
                <IconFont :platform="acc.platform" />
                <span>{{ acc.platform_label || acc.platform }}</span>
              </div>
              <div class="account-info">
                <strong class="account-name">{{ acc.name }}</strong>
                <a v-if="acc.url" class="account-link" :href="acc.url" target="_blank" rel="noopener">{{ acc.url }}</a>
                <span class="account-link placeholder" v-else>未填写账号链接</span>
              </div>
            </div>
            <div class="account-right">
              <span class="status-dot" :class="acc.status === 'active' ? 'on' : 'off'"></span>
              <button class="mini-btn" @click="editAccount(city, acc)"><el-icon><EditPen /></el-icon></button>
              <button class="mini-btn danger" @click="removeAccount(city, acc)"><el-icon><Delete /></el-icon></button>
            </div>
          </div>
          <div class="empty-account" v-if="!city.accounts.length">
            <span>暂未绑定账号</span>
            <button class="link-btn" @click="addAccount(city)">+ 立即添加</button>
          </div>
          <button class="add-account-row" @click="addAccount(city)">
            <el-icon><Plus /></el-icon>为该城市新增账号
          </button>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <div class="empty-ic"><el-icon><LocationFilled /></el-icon></div>
      <div class="empty-txt">
        <strong>暂无城市数据</strong>
        <span>点击右上角「新增城市」开始添加</span>
      </div>
    </div>
    </template>
    </ConfigurablePageRenderer>

    <!-- 新增/编辑 城市 -->
    <div class="dialog-overlay" v-if="showCityDialog" @click.self="closeCityDialog">
      <div class="dialog-card">
        <div class="dialog-head">
          <div>
            <h3>{{ editingCity ? '编辑城市' : '新增城市' }}</h3>
            <p>添加一个要下发内容的城市，之后可以绑定各平台账号</p>
          </div>
          <button class="icon-close" @click="closeCityDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>城市名称<em>*</em></label>
            <input v-model="cityForm.name" class="text-input" placeholder="如：西安" />
          </div>
          <div class="form-row two">
            <div class="form-field">
              <label>对接人</label>
              <input v-model="cityForm.contact" class="text-input" placeholder="姓名" />
            </div>
            <div class="form-field">
              <label>联系电话/微信</label>
              <input v-model="cityForm.phone" class="text-input" placeholder="手机号或微信号" />
            </div>
          </div>
          <div class="form-field">
            <label>状态</label>
            <select v-model="cityForm.status" class="select-input">
              <option value="active">活跃运营</option>
              <option value="pending">待完善</option>
              <option value="paused">暂停运营</option>
            </select>
          </div>
          <div class="form-field">
            <label>备注</label>
            <input v-model="cityForm.remark" class="text-input" placeholder="可选，运营说明" />
          </div>
        </div>
        <div class="dialog-foot">
          <button class="btn-ghost" @click="closeCityDialog">取消</button>
          <button class="btn-primary" :disabled="!cityForm.name" @click="saveCity">保存</button>
        </div>
      </div>
    </div>

    <!-- 新增/编辑 账号 -->
    <div class="dialog-overlay" v-if="showAccountDialog" @click.self="closeAccountDialog">
      <div class="dialog-card wide">
        <div class="dialog-head">
          <div>
            <h3>{{ editingAccount ? '编辑账号' : '为「'+ (accountCity?.name || '') +'」新增账号' }}</h3>
            <p>为该城市绑定一个具体的平台账号</p>
          </div>
          <button class="icon-close" @click="closeAccountDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="form-row two">
            <div class="form-field">
              <label>平台<em>*</em></label>
              <select v-model="accountForm.platform" class="select-input" @change="onPlatformChange">
                <option v-for="p in allPlatforms" :key="p.key" :value="p.key">{{ p.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>平台显示名称</label>
              <input v-model="accountForm.platform_label" class="text-input" :placeholder="accountForm.platform === 'other' ? '如：B站' : '平台显示名'" />
            </div>
          </div>
          <div class="form-field">
            <label>账号名称<em>*</em></label>
            <input v-model="accountForm.name" class="text-input" placeholder="如：遇见西安快手号" />
          </div>
          <div class="form-field">
            <label>账号链接 / 主页地址（可选）</label>
            <input v-model="accountForm.url" class="text-input" placeholder="https://..." />
          </div>
          <div class="form-row two">
            <div class="form-field">
              <label>状态</label>
              <select v-model="accountForm.status" class="select-input">
                <option value="active">活跃</option>
                <option value="pending">待完善</option>
                <option value="paused">暂停</option>
              </select>
            </div>
            <div class="form-field">
              <label>账号类型/说明（可选）</label>
              <input v-model="accountForm.type_note" class="text-input" placeholder="如：剧情号/美女号/官方号" />
            </div>
          </div>
        </div>
        <div class="dialog-foot">
          <button class="btn-ghost" @click="closeAccountDialog">取消</button>
          <button class="btn-primary" :disabled="!accountForm.name || !accountForm.platform" @click="saveAccount">保存账号</button>
        </div>
      </div>
    </div>

    <!-- 新增自定义平台 -->
    <div class="dialog-overlay" v-if="showPlatformDialog" @click.self="closePlatformDialog">
      <div class="dialog-card small">
        <div class="dialog-head">
          <div>
            <h3>新增自定义平台</h3>
            <p>扩展可用的平台选项，之后可在任意账号中选择</p>
          </div>
          <button class="icon-close" @click="closePlatformDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="form-field">
            <label>平台名称<em>*</em></label>
            <input v-model="customPlatformForm.label" class="text-input" placeholder="如：B站 / 微博 / 小红书" />
          </div>
          <div class="form-field">
            <label>平台标识<em>*</em>（英文/小写）</label>
            <input v-model="customPlatformForm.key" class="text-input" placeholder="如：bilibili / weibo" />
          </div>
          <div class="form-field">
            <label>主题色</label>
            <div class="color-row">
              <span v-for="c in palette" :key="c" class="color-dot" :class="{active: customPlatformForm.color === c}" :style="{background: c}" @click="customPlatformForm.color = c"></span>
            </div>
          </div>
        </div>
        <div class="dialog-foot">
          <button class="btn-ghost" @click="closePlatformDialog">取消</button>
          <button class="btn-primary" :disabled="!customPlatformForm.label || !customPlatformForm.key" @click="saveCustomPlatform">添加平台</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, EditPen, Close, Delete, LocationFilled, UserFilled, DataAnalysis,
  Warning, Phone, Collection
} from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { createAccount, updateAccount, deleteAccount, createCity, getCities, updateCity, deleteCity } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'

const cityAccountsLayoutModules = layoutModuleCatalog.cityAccounts
const { bindings: layoutBindings } = useLayoutBindings('cityAccounts')
const list = ref([])
const filter = reactive({ status: '', platform: '' })

// 预定义平台
const builtInPlatforms = [
  { key: 'kuaishou', label: '快手', color: '#f97316' },
  { key: 'weixin', label: '视频号', color: '#10b981' },
  { key: 'douyin', label: '抖音', color: '#ec4899' },
  { key: 'xiaohongshu', label: '小红书', color: '#ef4444' }
]
const customPlatforms = ref([])
const platformOptions = computed(() => [...builtInPlatforms, ...customPlatforms.value])
const allPlatforms = computed(() => [...platformOptions.value, { key: 'other', label: '其它（自行填写）', color: '#6366f1' }])
const palette = ['#6366f1','#8b5cf6','#ec4899','#f97316','#10b981','#0ea5e9','#f59e0b','#ef4444','#14b8a6','#84cc16']

const statusLabel = (s) => ({ active: '活跃运营', pending: '待完善', paused: '已暂停' }[s] || s)

// 统计
const cities = computed(() => list.value)
const totalAccounts = computed(() => list.value.reduce((n, c) => n + (c.accounts?.length || 0), 0))
const platformCount = computed(() => {
  const set = new Set()
  list.value.forEach(c => c.accounts?.forEach(a => set.add(a.platform)))
  return set.size
})
const needFix = computed(() => list.value.filter(c => c.status === 'pending' || !c.accounts?.length).length)

const filteredCities = computed(() => list.value
  .filter(city => filter.status ? city.status === filter.status : true)
  .map(city => {
    if (!filter.platform) return city
    return {
      ...city,
      accounts: (city.accounts || []).filter(account => account.platform === filter.platform)
    }
  })
  .filter(city => !filter.platform || city.accounts.length)
)

const normalizeStatus = (value) => ({ inactive: 'paused', all: '' }[value] || value || '')
const applyLayoutBindings = (bindings = {}) => {
  if ('status' in bindings) filter.status = normalizeStatus(bindings.status)
  if ('platform' in bindings) filter.platform = bindings.platform === '全部' ? '' : (bindings.platform || '')
}

// 工具
const colorFromName = (name) => {
  const n = (name || '').charCodeAt(0) || 1
  return palette[n % palette.length]
}
const iconForPlatform = (p) => ({ kuaihshou: VideoCamera, kuaishou: VideoCamera, weixin: ChatDotRound, douyin: MagicStick, xiaohongshu: Collection }[p] || UserFilled)
const customPlatformColor = (p) => {
  const found = platformOptions.value.find(x => x.key === p)
  if (found) return p
  return 'custom'
}
const defaultPlatformLabel = computed(() => {
  const found = platformOptions.value.find(x => x.key === accountForm.platform)
  return found ? found.label : ''
})

// 模拟：初始两个城市 + 每城快手2 + 视频号2
const bootstrap = () => {
  const base = []
  const initialCities = ['西安', '成都', '武汉']
  initialCities.forEach((name, idx) => {
    const city = {
      id: 'city_' + Date.now() + '_' + idx,
      name,
      contact: ['王磊', '陈静', '刘洋'][idx],
      phone: ['138****2210', '139****8811', '135****0099'][idx],
      status: 'active',
      remark: idx === 2 ? '待开通官方视频号' : '',
      accounts: [
        { id: 'a'+idx+'_1', platform: 'kuaishou', platform_label: '快手', name: '遇见'+name+'快手号', url: 'https://www.kuaishou.com/', status: 'active', type_note: '剧情号' },
        { id: 'a'+idx+'_2', platform: 'kuaishou', platform_label: '快手', name: '遇见'+name+'快手号2', url: 'https://www.kuaishou.com/', status: 'active', type_note: '美女号' },
        { id: 'a'+idx+'_3', platform: 'weixin', platform_label: '视频号', name: '遇见'+name+'视频号', url: '', status: 'pending', type_note: '剧情号' },
        { id: 'a'+idx+'_4', platform: 'weixin', platform_label: '视频号', name: '遇见'+name+'视频号2', url: '', status: 'pending', type_note: '官方号' }
      ]
    }
    base.push(city)
  })
  return base
}

const loadData = async () => {
  try {
    const data = await getCities()
    if (Array.isArray(data) && data.length) {
      list.value = data.map(c => ({ ...c, accounts: Array.isArray(c.accounts) ? c.accounts : [] }))
    } else {
      list.value = bootstrap()
    }
  } catch {
    list.value = bootstrap()
  }
}

// === 城市对话框 ===
const showCityDialog = ref(false)
const editingCity = ref(null)
const cityForm = reactive({ id: '', name: '', contact: '', phone: '', status: 'active', remark: '' })

const emptyCityForm = () => ({ id: '', name: '', contact: '', phone: '', status: 'active', remark: '' })

const openCityDialog = () => {
  editingCity.value = null
  Object.assign(cityForm, emptyCityForm())
  showCityDialog.value = true
}
const editCity = (city) => {
  editingCity.value = city
  Object.assign(cityForm, emptyCityForm(), city)
  showCityDialog.value = true
}
const closeCityDialog = () => { showCityDialog.value = false }

const saveCity = async () => {
  if (!cityForm.name) return ElMessage.warning('请填写城市名称')
  try {
    if (editingCity.value) {
      await updateCity(editingCity.value.id, cityForm)
      Object.assign(editingCity.value, cityForm)
      ElMessage.success('已更新城市信息')
    } else {
      const payload = { ...cityForm, accounts: [] }
      try {
        const created = await createCity(payload)
        payload.id = created?.id || 'city_' + Date.now()
      } catch {
        payload.id = 'city_' + Date.now()
      }
      list.value.push(payload)
      ElMessage.success('城市已添加')
    }
    closeCityDialog()
  } catch {
    // fallback (API unavailable)
    if (editingCity.value) {
      Object.assign(editingCity.value, cityForm)
      ElMessage.success('已更新城市信息')
    } else {
      const payload = { ...cityForm, id: 'city_' + Date.now(), accounts: [] }
      list.value.push(payload)
      ElMessage.success('城市已添加')
    }
    closeCityDialog()
  }
}

const removeCity = (city) => {
  ElMessageBox.confirm(`确认删除城市「${city.name}」及其所有账号？`, '提示', { type: 'warning' })
    .then(async () => {
      try { await deleteCity(city.id) } catch {}
      list.value = list.value.filter(c => c.id !== city.id)
      ElMessage.success('已删除')
    }).catch(() => {})
}

// === 账号对话框 ===
const showAccountDialog = ref(false)
const accountCity = ref(null)
const editingAccount = ref(null)
const accountForm = reactive({ id: '', platform: 'kuaishou', platform_label: '', name: '', url: '', status: 'active', type_note: '' })

const emptyAccountForm = () => ({ id: '', platform: 'kuaishou', platform_label: '', name: '', url: '', status: 'active', type_note: '' })

const addAccount = (city) => {
  accountCity.value = city
  editingAccount.value = null
  Object.assign(accountForm, emptyAccountForm())
  showAccountDialog.value = true
}
const editAccount = (city, acc) => {
  accountCity.value = city
  editingAccount.value = acc
  Object.assign(accountForm, emptyAccountForm(), acc)
  // 若无平台显示名，自动填充
  if (!accountForm.platform_label) {
    const found = platformOptions.value.find(p => p.key === acc.platform)
    if (found) accountForm.platform_label = found.label
  }
  showAccountDialog.value = true
}
const closeAccountDialog = () => { showAccountDialog.value = false }

const onPlatformChange = () => {
  const found = platformOptions.value.find(p => p.key === accountForm.platform)
  if (found) accountForm.platform_label = found.label
}

const saveAccount = async () => {
  if (!accountCity.value) return
  if (!accountForm.name || !accountForm.platform) return ElMessage.warning('请完整填写账号信息')
  // 若平台显示名为空，自动填充
  if (!accountForm.platform_label) {
    const found = platformOptions.value.find(p => p.key === accountForm.platform)
    if (found) accountForm.platform_label = found.label
  }
  try {
    if (editingAccount.value) {
      const payload = { ...accountForm, type: 'city', city_id: accountCity.value.id }
      await updateAccount(editingAccount.value.id, payload)
      Object.assign(editingAccount.value, payload)
      ElMessage.success('账号已更新')
    } else {
      const payload = { ...accountForm, type: 'city', city_id: accountCity.value.id }
      try {
        const created = await createAccount(payload)
        payload.id = created?.id || 'acc_' + Date.now()
      } catch {
        payload.id = 'acc_' + Date.now()
      }
      if (!accountCity.value.accounts) accountCity.value.accounts = []
      accountCity.value.accounts.push(payload)
      ElMessage.success('账号已添加')
    }
    closeAccountDialog()
  } catch {
    // fallback
    if (editingAccount.value) {
      Object.assign(editingAccount.value, { ...accountForm, type: 'city', city_id: accountCity.value.id })
      ElMessage.success('账号已更新')
    } else {
      const payload = { ...accountForm, type: 'city', city_id: accountCity.value.id, id: 'acc_' + Date.now() }
      if (!accountCity.value.accounts) accountCity.value.accounts = []
      accountCity.value.accounts.push(payload)
      ElMessage.success('账号已添加')
    }
    closeAccountDialog()
  }
}

const removeAccount = (city, acc) => {
  ElMessageBox.confirm(`确认删除账号「${acc.name}」？`, '提示', { type: 'warning' })
    .then(async () => {
      try { await deleteAccount(acc.id) } catch {}
      city.accounts = city.accounts.filter(a => a.id !== acc.id)
      ElMessage.success('已删除')
    }).catch(() => {})
}

// === 自定义平台 ===
const showPlatformDialog = ref(false)
const customPlatformForm = reactive({ key: '', label: '', color: palette[1] })
const openPlatformDialog = () => {
  customPlatformForm.key = ''
  customPlatformForm.label = ''
  customPlatformForm.color = palette[1]
  showPlatformDialog.value = true
}
const closePlatformDialog = () => { showPlatformDialog.value = false }

const saveCustomPlatform = () => {
  const key = (customPlatformForm.key || '').toLowerCase().trim().replace(/\s+/g, '_')
  const label = customPlatformForm.label.trim()
  if (!key || !label) return ElMessage.warning('请完整填写平台标识与名称')
  if ([...platformOptions.value].some(p => p.key === key)) return ElMessage.warning('该平台标识已存在')
  customPlatforms.value.push({ key, label, color: customPlatformForm.color })
  ElMessage.success(`已添加平台「${label}」，可在账号表单中选择`)
  closePlatformDialog()
}

onMounted(loadData)
watch(layoutBindings, (value) => applyLayoutBindings(value), { deep: true, immediate: true })
</script>

<style scoped>
.page-wrap { padding: 20px 24px 40px; background: linear-gradient(180deg, #fafbff 0%, #f1f5f9 100%); min-height: calc(100vh - 60px); animation: fadeInUp 0.4s ease; }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.eyebrow { display: inline-flex; align-items: center; gap: 8px; font-size: 12px; color: #6b7280; font-weight: 500; }
.eyebrow .dot { width: 6px; height: 6px; border-radius: 999px; background: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.15); }

.hero { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; padding: 22px 24px; background: #fff; border-radius: 16px; border: 1px solid #eceff5; margin-bottom: 16px; }
.hero-left { display: flex; flex-direction: column; gap: 6px; }
.title { font-size: 26px; font-weight: 700; color: #0f172a; margin: 0; }
.subtitle { font-size: 13px; color: #6b7280; margin: 0; }
.hero-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

.chip-group { display: flex; gap: 6px; padding: 4px; background: #f8fafc; border-radius: 10px; }
.chip { display: inline-flex; align-items: center; height: 32px; padding: 0 12px; border-radius: 8px; border: 0; background: transparent; color: #475569; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.18s; font-family: inherit; }
.chip:hover { color: #4338ca; }
.chip.active { background: #fff; color: #4338ca; font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }

.btn-primary { height: 40px; padding: 0 16px; border-radius: 10px; border: 0; cursor: pointer; font-size: 13.5px; font-weight: 600; color: #fff; display: inline-flex; align-items: center; gap: 6px; background: linear-gradient(135deg, #6366f1, #8b5cf6); box-shadow: 0 4px 14px rgba(99,102,241,0.3); transition: all 0.18s; font-family: inherit; }
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(99,102,241,0.4); }
.btn-ghost { height: 40px; padding: 0 14px; border-radius: 10px; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 13.5px; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; transition: all 0.15s; font-family: inherit; }
.btn-ghost:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }

/* summary */
.summary-row { display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: #fff; border: 1px solid #eceff5; border-radius: 14px; margin-bottom: 18px; flex-wrap: wrap; }
.sum-card { display: flex; align-items: center; gap: 10px; padding: 8px 14px 8px 10px; border-radius: 10px; background: linear-gradient(135deg, #f5f3ff, #fff); border: 1px solid #ede9fe; }
.sum-ic { width: 36px; height: 36px; border-radius: 10px; display: grid; place-items: center; color: #fff; }
.sum-ic .el-icon { font-size: 16px; }
.ic-indigo { background: linear-gradient(135deg, #6366f1, #8b5cf6); }
.ic-green { background: linear-gradient(135deg, #10b981, #34d399); }
.ic-amber { background: linear-gradient(135deg, #f59e0b, #fbbf24); }
.ic-pink { background: linear-gradient(135deg, #ef4444, #f87171); }
.sum-main { display: flex; flex-direction: column; gap: 2px; }
.sum-label { font-size: 11px; color: #6b7280; font-weight: 500; }
.sum-value { font-size: 20px; font-weight: 700; color: #0f172a; }

.platforms-inline { margin-left: auto; display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #6b7280; flex-wrap: wrap; }
.p-chip { padding: 4px 10px; border-radius: 0; font-size: 12px; font-weight: 600; background: transparent; color: #334155; display: inline-flex; align-items: center; gap: 4px; }
.p-chip.p-kuaishou { background: transparent; color: #c2410c; }
.p-chip.p-weixin { background: transparent; color: #047857; }
.p-chip.p-douyin { background: transparent; color: #be185d; }
.p-chip.p-xiaohongshu { background: #fef2f2; color: #b91c1c; }
.p-chip.custom { cursor: pointer; background: #eef2ff; color: #4338ca; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s; }
.p-chip.custom:hover { background: #6366f1; color: #fff; }

/* city grid */
.city-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 16px; }

.city-card { background: #fff; border: 1px solid #eceff5; border-radius: 16px; padding: 20px; transition: all 0.2s; display: flex; flex-direction: column; }
.city-card:hover { border-color: #c7d2fe; box-shadow: 0 12px 28px rgba(99,102,241,0.08); transform: translateY(-2px); }

.city-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
.city-hero { display: flex; align-items: center; gap: 12px; min-width: 0; }
.city-avatar { width: 44px; height: 44px; border-radius: 12px; color: #fff; display: grid; place-items: center; font-size: 16px; font-weight: 700; flex-shrink: 0; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
.city-info { min-width: 0; }
.city-name { font-size: 17px; font-weight: 700; color: #0f172a; margin: 0; }
.city-meta { display: flex; flex-direction: column; gap: 4px; margin-top: 4px; font-size: 12px; color: #6b7280; }
.meta-item { display: inline-flex; align-items: center; gap: 4px; }
.meta-item.muted { color: #94a3b8; }

.city-status { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.status-pill { font-size: 11px; padding: 4px 10px; border-radius: 99px; font-weight: 600; }
.status-pill.st-active { background: #ecfdf5; color: #047857; }
.status-pill.st-pending { background: #fef3c7; color: #b45309; }
.status-pill.st-paused { background: #e2e8f0; color: #475569; }
.actions { display: flex; gap: 6px; }
.icon-btn { width: 28px; height: 28px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #6b7280; cursor: pointer; display: grid; place-items: center; transition: all 0.15s; font-size: 13px; }
.icon-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.icon-btn:nth-child(2):hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

/* accounts */
.accounts { margin-top: 4px; display: flex; flex-direction: column; gap: 8px; }
.account-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 12px; background: #fafbff; border: 1px solid #eceff5; transition: all 0.15s; }
.account-row:hover { background: #f5f3ff; border-color: #e0e7ff; }
.account-main { display: flex; align-items: center; gap: 12px; min-width: 0; flex: 1; }
.account-platform { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 0; font-size: 12px; font-weight: 600; background: transparent; color: #4338ca; flex-shrink: 0; }
.account-platform.p-kuaishou { background: transparent; color: #c2410c; }
.account-platform.p-weixin { background: transparent; color: #047857; }
.account-platform.p-douyin { background: transparent; color: #be185d; }
.account-platform.p-xiaohongshu { background: #fef2f2; color: #b91c1c; }
.account-platform.p-custom { background: #eef2ff; color: #4338ca; }
.account-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.account-name { font-size: 13.5px; font-weight: 600; color: #111827; }
.account-link { font-size: 11.5px; color: #6366f1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.account-link.placeholder { color: #94a3b8; font-style: italic; }
.account-right { display: flex; align-items: center; gap: 6px; }
.status-dot { width: 8px; height: 8px; border-radius: 999px; background: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.18); }
.status-dot.off { background: #94a3b8; box-shadow: 0 0 0 3px rgba(148,163,184,0.18); }

.mini-btn { height: 28px; padding: 0 10px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s; font-family: inherit; }
.mini-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.mini-btn.danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

.empty-account { padding: 14px; text-align: center; border: 1px dashed #e5e7eb; border-radius: 12px; font-size: 12.5px; color: #94a3b8; display: flex; flex-direction: column; gap: 6px; }
.link-btn { border: 0; background: transparent; color: #6366f1; font-size: 12.5px; font-weight: 600; cursor: pointer; font-family: inherit; }
.link-btn:hover { color: #4338ca; }

.add-account-row { padding: 10px 14px; border-radius: 10px; border: 1.5px dashed #c7d2fe; background: #faf5ff; color: #6366f1; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: all 0.18s; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-family: inherit; margin-top: 6px; }
.add-account-row:hover { background: #6366f1; color: #fff; border-color: #6366f1; }

/* empty state */
.empty-state { padding: 50px 20px; display: flex; flex-direction: column; align-items: center; gap: 12px; background: #fff; border: 1px dashed #e5e7eb; border-radius: 16px; }
.empty-ic { width: 64px; height: 64px; border-radius: 16px; background: #eef2ff; color: #6366f1; display: grid; place-items: center; font-size: 28px; }
.empty-txt strong { font-size: 14.5px; color: #0f172a; font-weight: 600; display: block; margin-bottom: 4px; }
.empty-txt span { font-size: 12.5px; color: #94a3b8; }

/* dialog */
.dialog-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); display: grid; place-items: center; z-index: 2000; animation: fadeIn 0.2s; }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.dialog-card { background: #fff; border-radius: 18px; width: 560px; max-width: calc(100vw - 40px); max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 80px rgba(15,23,42,0.25); animation: slideUp 0.25s; }
.dialog-card.wide { width: 640px; }
.dialog-card.small { width: 440px; }
@keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
.dialog-head { padding: 20px 24px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #f1f5f9; }
.dialog-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: #0f172a; }
.dialog-head p { margin: 4px 0 0; font-size: 12.5px; color: #6b7280; }
.icon-close { width: 34px; height: 34px; border-radius: 9px; border: 0; cursor: pointer; background: #f3f4f6; color: #6b7280; display: grid; place-items: center; transition: all 0.15s; }
.icon-close:hover { background: #eef2ff; color: #6366f1; }

.dialog-body { padding: 22px 24px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.form-field { display: flex; flex-direction: column; gap: 8px; }
.form-field label { font-size: 12.5px; color: #334155; font-weight: 600; display: flex; align-items: center; gap: 3px; }
.form-field label em { color: #ef4444; font-style: normal; font-size: 13px; }
.form-row.two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

.text-input, .select-input { height: 42px; padding: 0 14px; border-radius: 10px; border: 1.5px solid #e5e7eb; background: #fafbfc; color: #0f172a; font-size: 13.5px; outline: 0; transition: all 0.15s; font-family: inherit; }
.select-input { cursor: pointer; }
.text-input:focus, .select-input:focus { background: #fff; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }

.color-row { display: flex; flex-wrap: wrap; gap: 10px; padding: 6px; background: #f8fafc; border-radius: 10px; }
.color-dot { width: 28px; height: 28px; border-radius: 999px; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
.color-dot:hover { transform: scale(1.1); }
.color-dot.active { border-color: #0f172a; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #0f172a; }

.dialog-foot { padding: 14px 24px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #f1f5f9; background: #fafbfc; }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

@media (max-width: 900px) {
  .hero { flex-direction: column; align-items: flex-start; gap: 14px; }
  .platforms-inline { margin-left: 0; width: 100%; }
  .form-row.two { grid-template-columns: 1fr; }
  .city-grid { grid-template-columns: 1fr; }
}
</style>
