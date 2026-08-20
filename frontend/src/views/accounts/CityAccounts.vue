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
        <button v-if="selectedCity" class="btn-ghost" @click="addAccount(selectedCity)"><el-icon><Plus /></el-icon>新增账号</button>
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
      <div class="status-filter">
        <span class="filter-label">账号状态</span>
        <div class="chip-group compact">
          <button class="chip" :class="{active: filter.status === ''}" @click="filter.status = ''">全部</button>
          <button class="chip" :class="{active: filter.status === 'active'}" @click="filter.status = 'active'">活跃</button>
          <button class="chip" :class="{active: filter.status === 'pending'}" @click="filter.status = 'pending'">待完善</button>
          <button class="chip" :class="{active: filter.status === 'paused'}" @click="filter.status = 'paused'">已暂停</button>
        </div>
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
    <div class="table-panel">
      <div class="table-filter-row">
        <div class="city-filter-bar">
          <button class="chip" :class="{active: filter.cityId === ''}" @click="selectCity('')">
            全部
            <span class="chip-count">{{ totalAccounts }}</span>
          </button>
          <button
            v-for="city in cities"
            :key="city.id"
            class="chip"
            :class="{active: filter.cityId === city.id}"
            @click="selectCity(city.id)"
          >
            {{ city.name }}
            <span class="chip-count">{{ city.accounts?.length || 0 }}</span>
          </button>
        </div>
      </div>
      <div class="table-head">
        <div>
          <span class="table-kicker">{{ selectedCity ? selectedCity.name : '全部城市' }}</span>
          <strong>城市账号清单</strong>
        </div>
        <span class="table-count">共 {{ filteredAccounts.length }} 个账号</span>
      </div>
      <div class="table-scroll">
        <table class="city-account-table">
          <thead>
            <tr>
              <th>城市</th>
              <th>平台</th>
              <th>账号类型</th>
              <th>账号名称</th>
              <th>主页链接</th>
              <th>账号状态</th>
              <th>二维码</th>
              <th>状态说明 / 备注</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in filteredAccounts" :key="row.id" class="data-row">
              <td>
                <div class="city-cell">
                  <div class="city-avatar small" :style="{background: colorFromName(row.city_name)}">{{ firstChar(row.city_name) }}</div>
                  <div class="city-info compact">
                    <strong>{{ row.city_name }}</strong>
                    <span>{{ statusLabel(row.city_status) }}</span>
                  </div>
                </div>
              </td>
              <td>
                <span class="platform-chip" :class="'p-'+customPlatformColor(row.platform)">
                  <IconFont :platform="row.platform" />
                  {{ row.platform_label || platformLabel(row.platform) }}
                </span>
              </td>
              <td><span class="type-chip">{{ row.type_note || row.account_type || '未分类' }}</span></td>
              <td>
                <div class="account-name-cell">
                  <strong>{{ row.name }}</strong>
                  <span v-if="row.platform_account && row.platform_account !== row.url">{{ row.platform_account }}</span>
                </div>
              </td>
              <td>
                <a v-if="row.url" :href="row.url" target="_blank" rel="noopener" class="url-link">{{ row.url }}</a>
                <span v-else class="url-link placeholder">未填写</span>
              </td>
              <td>
                <span class="status-chip" :class="accountStatusClass(row.status)">
                  <i class="status-dot" :class="accountStatusClass(row.status)"></i>
                  {{ accountStatusLabel(row.status) }}
                </span>
              </td>
              <td>
                <button
                  v-if="hasQrcodeEntry(row)"
                  class="qrcode-icon-btn"
                  :class="{ generated: !qrcodeSrc(row.qrcode_url) }"
                  :title="qrcodeSrc(row.qrcode_url) ? '查看上传二维码' : '根据主页链接生成二维码'"
                  @click="openQrcode(row)"
                >
                  <el-icon><Picture /></el-icon>
                </button>
                <span v-else class="qrcode-icon-empty" title="未上传二维码，且未填写主页链接">
                  <el-icon><Picture /></el-icon>
                </span>
              </td>
              <td><span class="remark-cell">{{ row.remark || '-' }}</span></td>
              <td class="action-cell">
                <button class="mini-btn" @click="editAccount(row._city, row)"><el-icon><EditPen /></el-icon>编辑</button>
                <button class="mini-btn danger" @click="removeAccount(row._city, row)"><el-icon><Delete /></el-icon>删除</button>
              </td>
            </tr>
            <tr v-if="!filteredAccounts.length" class="empty-row">
              <td colspan="9">
                <div class="empty-inline">
                  <el-icon><LocationFilled /></el-icon>
                  <strong>{{ selectedCity ? '该城市暂无账号' : '暂无城市账号数据' }}</strong>
                  <span>{{ selectedCity ? '可以先为该城市新增一个平台账号' : '点击右上角「新增城市」开始添加' }}</span>
                  <button v-if="selectedCity" class="btn-primary" @click="addAccount(selectedCity)">
                    <el-icon><Plus /></el-icon>为该城市新增账号
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    </template>
    </ConfigurablePageRenderer>

    <div class="floating-actions">
      <div class="floating-action-row">
        <button v-if="selectedCity" class="float-secondary" @click="addAccount(selectedCity)">
          <el-icon><Plus /></el-icon>新增账号
        </button>
        <button class="float-main" @click="openCityDialog">
          <el-icon><Plus /></el-icon>新增城市
        </button>
      </div>
    </div>

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
            <h3>{{ editingAccount ? '编辑账号' : '为「'+ (accountCity?.name || selectedCity?.name || '') +'」新增账号' }}</h3>
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
          <div class="form-field">
            <label>账号二维码（可选）</label>
            <div class="qrcode-uploader">
              <div v-if="accountForm.qrcode_url" class="qrcode-preview">
                <img :src="qrcodeSrc(accountForm.qrcode_url)" alt="二维码" />
                <div class="qrcode-actions">
                  <button class="mini-btn" @click="removeQrcode"><el-icon><Close /></el-icon> 移除</button>
                </div>
              </div>
              <label v-else class="qrcode-upload-box" for="qrcode-upload">
                <el-icon><Upload /></el-icon>
                <span>点击上传二维码</span>
                <span class="hint">支持 png、jpg、webp，最大 5MB</span>
                <input id="qrcode-upload" type="file" accept="image/*" hidden @change="handleQrcodeUpload" />
              </label>
            </div>
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
          <div class="form-field">
            <label>{{ accountForm.status === 'active' ? '运营说明' : '状态说明 / 原因' }}<em v-if="accountForm.status !== 'active'">*</em></label>
            <textarea
              v-model="accountForm.remark"
              class="textarea-input"
              rows="3"
              :placeholder="accountForm.status === 'paused' ? '请填写暂停原因，如：账号作废、权限异常、平台限制等' : (accountForm.status === 'pending' ? '请填写待完善事项，如：缺少主页链接、二维码未上传等' : '可选，补充账号运营说明')"
            ></textarea>
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

    <!-- 二维码预览弹窗 -->
    <div class="dialog-overlay" v-if="showQrcodeDialog" @click.self="closeQrcodeDialog">
      <div class="dialog-card qrcode-card">
        <div class="dialog-head">
          <div>
            <h3>{{ qrcodeAccount?.name || '账号二维码' }}</h3>
            <p>扫码可直接访问账号</p>
          </div>
          <button class="icon-close" @click="closeQrcodeDialog"><el-icon><Close /></el-icon></button>
        </div>
        <div class="dialog-body">
          <div class="qrcode-dialog-img">
            <img
              v-if="qrcodeSrc(qrcodeAccount?.qrcode_url) && !qrcodeImageFailed"
              :src="qrcodeSrc(qrcodeAccount?.qrcode_url)"
              alt="账号二维码"
              @error="qrcodeImageFailed = true"
            />
            <ReQrcode
              v-else-if="qrcodeFallbackValue"
              :value="qrcodeFallbackValue"
              :size="240"
              class="qrcode-canvas"
            />
            <div v-else class="qrcode-missing">二维码图片已丢失，请重新上传</div>
          </div>
          <div class="qrcode-dialog-info">
            <div class="qrcode-info-row">
              <span class="qrcode-info-label">平台</span>
              <span class="qrcode-info-value">{{ qrcodeAccount?.platform_label || qrcodeAccount?.platform }}</span>
            </div>
            <div class="qrcode-info-row">
              <span class="qrcode-info-label">账号名称</span>
              <span class="qrcode-info-value">{{ qrcodeAccount?.name }}</span>
            </div>
            <div v-if="qrcodeAccount?.url" class="qrcode-info-row">
              <span class="qrcode-info-label">主页链接</span>
              <a :href="qrcodeAccount.url" target="_blank" class="qrcode-info-value link">{{ qrcodeAccount.url }}</a>
            </div>
          </div>
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
  Warning, Picture, Upload
} from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import ReQrcode from '@/components/base/ReQrcode.vue'
import { createAccount, updateAccount, deleteAccount, createCity, getCities, updateCity, deleteCity, uploadQrcode } from '@/api'
import ConfigurablePageRenderer from '@/layout-builder/ConfigurablePageRenderer.vue'
import { layoutModuleCatalog } from '@/layout-builder/moduleCatalog'
import { useLayoutBindings } from '@/layout-builder/layoutBindings'
import { usePageSearch } from '@/composables/usePageSearch'
import { resolveMediaUrl } from '@/utils/mediaUrl'

const cityAccountsLayoutModules = layoutModuleCatalog.cityAccounts
const { bindings: layoutBindings } = useLayoutBindings('cityAccounts')
const list = ref([])
const filter = reactive({ status: '', platform: '', cityId: '' })
const { matchesPageSearch } = usePageSearch()

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

const statusLabel = (s) => ({ active: '活跃运营', pending: '待完善', paused: '已暂停' }[s] || '待完善')
const accountStatusLabel = (s) => ({ active: '正常运营', pending: '待完善', paused: '暂停运营' }[s] || '待完善')
const accountStatusClass = (s) => `account-${['active', 'pending', 'paused'].includes(s) ? s : 'pending'}`

// 统计
const cities = computed(() => list.value)
const totalAccounts = computed(() => list.value.reduce((n, c) => n + (c.accounts?.length || 0), 0))
const platformCount = computed(() => {
  const set = new Set()
  list.value.forEach(c => c.accounts?.forEach(a => set.add(a.platform)))
  return set.size
})
const needFix = computed(() => list.value.filter(c => c.status === 'pending' || !c.accounts?.length).length)
const selectedCity = computed(() => list.value.find(city => city.id === filter.cityId) || null)
const cityAccountRows = computed(() => list.value.flatMap(city => (city.accounts || []).map(account => ({
  ...account,
  url: account.url || account.platform_account || '',
  type_note: account.type_note || account.account_type || '',
  city_id: city.id,
  city_name: city.name,
  city_status: city.status,
  _city: city
}))))
const filteredAccounts = computed(() => cityAccountRows.value.filter(row => {
  if (filter.cityId && row.city_id !== filter.cityId) return false
  if (filter.status && row.status !== filter.status) return false
  if (filter.platform && row.platform !== filter.platform) return false
  return matchesPageSearch(
    row.city_name,
    statusLabel(row.city_status),
    row.name,
    row.platform,
    row.platform_label,
    row.url,
    row.type_note,
    row.remark
  )
}))

const normalizeStatus = (value) => ({ inactive: 'paused', all: '' }[value] || value || '')
const applyLayoutBindings = (bindings = {}) => {
  if ('status' in bindings) filter.status = normalizeStatus(bindings.status)
  if ('platform' in bindings) filter.platform = bindings.platform === '全部' ? '' : (bindings.platform || '')
  if ('cityId' in bindings) filter.cityId = bindings.cityId || ''
}

// 工具
const selectCity = (cityId) => {
  filter.cityId = cityId
}
const colorFromName = (name) => {
  const n = (name || '').charCodeAt(0) || 1
  return palette[n % palette.length]
}
const firstChar = (value) => (value || '?').slice(0, 1)
const qrcodeSrc = (value) => resolveMediaUrl(value)
const hasQrcodeEntry = (row) => Boolean(qrcodeSrc(row?.qrcode_url) || row?.url || row?.platform_account)
const customPlatformColor = (p) => {
  const found = platformOptions.value.find(x => x.key === p)
  if (found) return p
  return 'custom'
}
const platformLabel = (key) => platformOptions.value.find(item => item.key === key)?.label || key || '-'

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
    if (filter.cityId && !list.value.some(city => city.id === filter.cityId)) filter.cityId = ''
  } catch {
    list.value = bootstrap()
    if (filter.cityId && !list.value.some(city => city.id === filter.cityId)) filter.cityId = ''
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
      if (filter.cityId === city.id) filter.cityId = ''
      ElMessage.success('已删除')
    }).catch(() => {})
}

// === 账号对话框 ===
const showAccountDialog = ref(false)
const accountCity = ref(null)
const editingAccount = ref(null)
const accountForm = reactive({ id: '', platform: 'kuaishou', platform_label: '', name: '', url: '', status: 'active', type_note: '', qrcode_url: '', remark: '' })

const emptyAccountForm = () => ({ id: '', platform: 'kuaishou', platform_label: '', name: '', url: '', status: 'active', type_note: '', qrcode_url: '', remark: '' })
const assignAccountForm = (data = {}) => {
  Object.keys(accountForm).forEach(key => { delete accountForm[key] })
  Object.assign(accountForm, emptyAccountForm(), {
    id: data.id || '',
    platform: data.platform || 'kuaishou',
    platform_label: data.platform_label || '',
    name: data.name || '',
    url: data.url || data.platform_account || '',
    status: data.status || 'active',
    type_note: data.type_note || data.account_type || '',
    qrcode_url: data.qrcode_url || '',
    remark: data.remark || ''
  })
}

const addAccount = (city) => {
  accountCity.value = city
  editingAccount.value = null
  assignAccountForm()
  showAccountDialog.value = true
}
const editAccount = (city, acc) => {
  accountCity.value = city
  editingAccount.value = acc
  assignAccountForm(acc)
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
  if (accountForm.status !== 'active' && !String(accountForm.remark || '').trim()) {
    return ElMessage.warning(accountForm.status === 'paused' ? '请填写暂停原因' : '请填写待完善原因')
  }
  // 若平台显示名为空，自动填充
  if (!accountForm.platform_label) {
    const found = platformOptions.value.find(p => p.key === accountForm.platform)
    if (found) accountForm.platform_label = found.label
  }
  const payload = {
    id: accountForm.id,
    platform: accountForm.platform,
    platform_label: accountForm.platform_label,
    name: accountForm.name,
    url: accountForm.url,
    status: accountForm.status,
    type_note: accountForm.type_note,
    qrcode_url: accountForm.qrcode_url,
    platform_account: accountForm.url || '',
    account_type: accountForm.type_note || '',
    remark: accountForm.remark || '',
    type: 'city',
    city_id: accountCity.value.id
  }
  try {
    if (editingAccount.value) {
      await updateAccount(editingAccount.value.id, payload)
      await loadData()
      ElMessage.success('账号已更新')
    } else {
      await createAccount(payload)
      await loadData()
      ElMessage.success('账号已添加')
    }
    closeAccountDialog()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error?.message || '账号保存失败，请重试')
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

// === 二维码 ===
const showQrcodeDialog = ref(false)
const qrcodeAccount = ref(null)
const qrcodeImageFailed = ref(false)
const qrcodeFallbackValue = computed(() => qrcodeAccount.value?.url || qrcodeAccount.value?.platform_account || '')
const openQrcode = (acc) => {
  qrcodeAccount.value = acc
  qrcodeImageFailed.value = false
  showQrcodeDialog.value = true
}
const closeQrcodeDialog = () => {
  showQrcodeDialog.value = false
  qrcodeAccount.value = null
  qrcodeImageFailed.value = false
}

const handleQrcodeUpload = async (e) => {
  const file = e.target.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件')
    e.target.value = ''
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 5MB')
    e.target.value = ''
    return
  }
  try {
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await uploadQrcode({
          filename: file.name,
          mime: file.type,
          data: reader.result
        })
        accountForm.qrcode_url = res.url
        ElMessage.success('二维码上传成功')
      } catch {
        ElMessage.error('上传失败，请重试')
      }
    }
    reader.readAsDataURL(file)
  } catch {
    ElMessage.error('读取文件失败')
  }
  e.target.value = ''
}

const removeQrcode = () => {
  accountForm.qrcode_url = ''
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
.hero-right { display: flex; align-items: center; justify-content: flex-end; gap: 14px; flex-wrap: wrap; min-width: 0; flex: 1; }

.city-filter-bar { display: flex; gap: 6px; width: 100%; overflow-x: auto; padding: 4px; background: #f8fafc; border-radius: 10px; scrollbar-width: thin; }
.city-filter-bar::-webkit-scrollbar { height: 6px; }
.city-filter-bar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
.chip-group { display: flex; gap: 6px; padding: 4px; background: #f8fafc; border-radius: 10px; }
.chip-group.compact .chip { height: 30px; }
.chip { display: inline-flex; align-items: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 8px; border: 0; background: transparent; color: #475569; font-size: 12.5px; font-weight: 500; cursor: pointer; transition: all 0.18s; font-family: inherit; white-space: nowrap; }
.chip:hover { color: #4338ca; }
.chip.active { background: #fff; color: #4338ca; font-weight: 600; box-shadow: 0 2px 6px rgba(0,0,0,0.06); }
.chip-count { display: inline-flex; align-items: center; justify-content: center; min-width: 18px; height: 18px; padding: 0 6px; border-radius: 999px; background: #eef2ff; color: #4338ca; font-size: 11px; font-weight: 700; }

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

.status-filter { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.filter-label { color: #64748b; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
.platforms-inline { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: #6b7280; flex-wrap: wrap; }
.p-chip { padding: 4px 10px; border-radius: 0; font-size: 12px; font-weight: 600; background: transparent; color: #334155; display: inline-flex; align-items: center; gap: 4px; }
.p-chip.p-kuaishou { background: transparent; color: #c2410c; }
.p-chip.p-weixin { background: transparent; color: #047857; }
.p-chip.p-douyin { background: transparent; color: #be185d; }
.p-chip.p-xiaohongshu { background: #fef2f2; color: #b91c1c; }
.p-chip.custom { cursor: pointer; background: #eef2ff; color: #4338ca; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s; }
.p-chip.custom:hover { background: #6366f1; color: #fff; }

/* table */
.table-panel { background: #fff; border: 1px solid #eceff5; border-radius: 16px; overflow: hidden; }
.table-filter-row { padding: 14px 18px 10px; border-bottom: 1px solid #eef2f7; background: #fff; }
.table-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid #eef2f7; background: #fff; }
.table-head > div { display: flex; flex-direction: column; gap: 4px; }
.table-head strong { color: #0f172a; font-size: 15px; }
.table-kicker { color: #6366f1; font-size: 12px; font-weight: 700; }
.table-count { color: #64748b; font-size: 12px; white-space: nowrap; }
.table-scroll { overflow-x: auto; }
.city-account-table { width: 100%; min-width: 1180px; border-collapse: separate; border-spacing: 0; font-size: 13px; }
.city-account-table th { text-align: left; padding: 14px; font-size: 11px; color: #64748b; font-weight: 600; letter-spacing: 0.05em; background: linear-gradient(180deg, #fafbff, #f5f6fa); border-bottom: 1px solid #e2e8f0; white-space: nowrap; }
.city-account-table td { padding: 14px; border-bottom: 1px solid #f1f5f9; color: #1e293b; vertical-align: middle; }
.data-row:hover { background: #fafbff; }
.city-cell { display: flex; align-items: center; gap: 10px; min-width: 150px; }
.city-avatar.small { width: 34px; height: 34px; border-radius: 10px; font-size: 13px; box-shadow: none; }
.city-info.compact { display: flex; flex-direction: column; gap: 2px; }
.city-info.compact strong { color: #0f172a; font-size: 13.5px; white-space: nowrap; }
.city-info.compact span { color: #94a3b8; font-size: 11px; white-space: nowrap; }
.platform-chip, .type-chip, .status-chip { display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.platform-chip { background: transparent; color: #334155; }
.platform-chip.p-kuaishou { color: #c2410c; }
.platform-chip.p-weixin { color: #047857; }
.platform-chip.p-douyin { color: #be185d; }
.platform-chip.p-xiaohongshu { background: #fef2f2; color: #b91c1c; }
.platform-chip.p-custom { background: #eef2ff; color: #4338ca; }
.type-chip { background: #eef2ff; color: #4338ca; }
.status-chip.account-active { background: #ecfdf5; color: #047857; }
.status-chip.account-pending { background: #f8fafc; color: #475569; }
.status-chip.account-paused { background: #fef2f2; color: #b91c1c; }
.account-name-cell { display: flex; flex-direction: column; gap: 3px; min-width: 180px; }
.account-name-cell strong { color: #0f172a; font-size: 13.5px; font-weight: 700; }
.account-name-cell span { color: #94a3b8; font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 240px; }
.url-link { display: inline-block; max-width: 240px; color: #6366f1; font-size: 12px; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.url-link:hover { text-decoration: underline; }
.url-link.placeholder, .muted-text { color: #94a3b8; font-size: 12px; }
.remark-cell { display: inline-block; max-width: 260px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.action-cell { white-space: nowrap; }
.mini-btn.icon-only { width: 30px; padding: 0; }
.qrcode-icon-btn,
.qrcode-icon-empty {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}
.qrcode-icon-btn {
  border: 1px solid #dbe4f0;
  background: #fff;
  color: #475569;
  cursor: pointer;
  transition: all 0.16s;
}
.qrcode-icon-btn:hover {
  border-color: #6366f1;
  background: #eef2ff;
  color: #4f46e5;
}
.qrcode-icon-btn.generated {
  border-color: #c7d2fe;
  background: #f5f3ff;
  color: #6366f1;
}
.qrcode-icon-empty {
  border: 1px dashed #dbe4f0;
  background: #f8fafc;
  color: #cbd5e1;
}
.empty-row td { padding: 42px 20px !important; }
.empty-inline { display: flex; flex-direction: column; align-items: center; gap: 8px; color: #94a3b8; font-size: 13px; }
.empty-inline strong { color: #0f172a; font-size: 14px; }

.city-avatar { width: 44px; height: 44px; border-radius: 12px; color: #fff; display: grid; place-items: center; font-size: 16px; font-weight: 700; flex-shrink: 0; box-shadow: 0 4px 14px rgba(0,0,0,0.08); }
.status-dot { width: 8px; height: 8px; border-radius: 999px; flex: 0 0 auto; }
.status-dot.account-active { background: #10b981; box-shadow: 0 0 0 4px rgba(16,185,129,0.18); }
.status-dot.account-pending { background: #94a3b8; box-shadow: 0 0 0 4px rgba(148,163,184,0.2); }
.status-dot.account-paused { background: #ef4444; box-shadow: 0 0 0 4px rgba(239,68,68,0.18); }

.mini-btn { height: 28px; padding: 0 10px; border-radius: 8px; border: 1px solid #e5e7eb; background: #fff; color: #374151; font-size: 12px; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; transition: all 0.15s; font-family: inherit; }
.mini-btn:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
.mini-btn.danger:hover { border-color: #ef4444; color: #ef4444; background: #fef2f2; }

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

.text-input, .select-input, .textarea-input { padding: 0 14px; border-radius: 10px; border: 1.5px solid #e5e7eb; background: #fafbfc; color: #0f172a; font-size: 13.5px; outline: 0; transition: all 0.15s; font-family: inherit; }
.text-input, .select-input { height: 42px; }
.select-input { cursor: pointer; }
.textarea-input { min-height: 80px; padding-top: 10px; padding-bottom: 10px; resize: vertical; line-height: 1.5; }
.text-input:focus, .select-input:focus, .textarea-input:focus { background: #fff; border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.12); }

.color-row { display: flex; flex-wrap: wrap; gap: 10px; padding: 6px; background: #f8fafc; border-radius: 10px; }
.color-dot { width: 28px; height: 28px; border-radius: 999px; cursor: pointer; transition: all 0.15s; border: 2px solid transparent; }
.color-dot:hover { transform: scale(1.1); }
.color-dot.active { border-color: #0f172a; box-shadow: 0 0 0 2px #fff, 0 0 0 4px #0f172a; }

.dialog-foot { padding: 14px 24px; display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid #f1f5f9; background: #fafbfc; }
.btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }

/* 二维码上传 */
.qrcode-uploader { width: 100%; }
.qrcode-upload-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 28px 20px;
  border: 2px dashed #c7d2fe;
  border-radius: 12px;
  background: #faf5ff;
  cursor: pointer;
  transition: all 0.18s;
  color: #6366f1;
}
.qrcode-upload-box:hover {
  border-color: #6366f1;
  background: #f5f3ff;
  transform: translateY(-1px);
}
.qrcode-upload-box .el-icon { font-size: 28px; }
.qrcode-upload-box span { font-size: 13px; font-weight: 600; }
.qrcode-upload-box .hint { font-size: 11.5px; color: #94a3b8; font-weight: 400; }
.qrcode-preview {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e0e7ff;
  border-radius: 12px;
  background: #fafbff;
}
.qrcode-preview img {
  width: 96px;
  height: 96px;
  object-fit: contain;
  border-radius: 8px;
  background: #fff;
  border: 1px solid #e5e7eb;
}
.qrcode-actions { display: flex; flex-direction: column; gap: 8px; }

/* 二维码预览弹窗 */
.qrcode-card { width: 360px; }
.qrcode-dialog-img {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}
.qrcode-dialog-img img {
  width: 240px;
  height: 240px;
  object-fit: contain;
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}
.qrcode-canvas {
  border-radius: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
}
.qrcode-missing {
  width: 240px;
  height: 240px;
  display: grid;
  place-items: center;
  padding: 20px;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
  text-align: center;
}
.qrcode-dialog-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: #f8fafc;
  border-radius: 10px;
}
.qrcode-info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.qrcode-info-label { color: #6b7280; font-weight: 500; }
.qrcode-info-value { color: #0f172a; font-weight: 600; text-align: right; word-break: break-all; }
.qrcode-info-value.link { color: #6366f1; text-decoration: none; }
.qrcode-info-value.link:hover { color: #4338ca; text-decoration: underline; }

@media (max-width: 900px) {
  .hero { flex-direction: column; align-items: flex-start; gap: 14px; }
  .hero-right { width: 100%; justify-content: flex-start; }
  .status-filter { margin-left: 0; width: 100%; align-items: flex-start; flex-direction: column; }
  .platforms-inline { margin-left: 0; width: 100%; }
  .form-row.two { grid-template-columns: 1fr; }
}
</style>
