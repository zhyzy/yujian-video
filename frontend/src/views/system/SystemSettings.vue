<template>
  <div class="settings-page">
    <header class="page-head">
      <div>
        <div class="eyebrow"><IconFont name="settings" :fallback="Setting" /> 系统配置中心</div>
        <h1>系统设置</h1>
        <p>统一维护页面字段、品牌展示、账户资料和常用偏好</p>
      </div>
      <div class="head-actions">
        <el-button @click="resetAll">
          <IconFont name="reset" :fallback="RefreshLeft" />
          恢复默认
        </el-button>
        <el-button type="primary" @click="saveAll">
          <IconFont name="save" :fallback="Check" />
          保存设置
        </el-button>
      </div>
    </header>

    <section class="preview-band">
      <div class="brand-preview">
        <img v-if="settings.brand.logoUrl" :src="settings.brand.logoUrl" alt="系统 Logo" class="preview-logo">
        <div v-else class="preview-logo text-logo">{{ settings.brand.name.slice(0, 1) || '遇' }}</div>
        <div>
          <strong>{{ settings.brand.name || '遇见运营中台' }}</strong>
          <span>{{ settings.brand.subtitle || 'Media Operations' }}</span>
        </div>
      </div>
      <div class="profile-preview">
        <img v-if="settings.profile.avatarUrl" :src="settings.profile.avatarUrl" alt="账户头像" class="preview-avatar">
        <div v-else class="preview-avatar text-avatar">{{ profileInitial }}</div>
        <div>
          <strong>{{ displayNamePreview }}</strong>
          <span>{{ roleLabelPreview }}</span>
        </div>
      </div>
    </section>

    <el-tabs v-model="activeTab" class="settings-tabs">
      <el-tab-pane label="存储桶" name="storage">
        <section class="panel-grid">
          <div class="panel">
            <div class="panel-head">
              <IconFont name="uploadFolder" :fallback="FolderOpened" />
              <div>
                <h2>COS 存储桶</h2>
                <p>用于素材上传、预览签名和文件删除</p>
              </div>
            </div>
            <div class="form-stack">
              <label><span>Bucket</span><el-input v-model="settings.storage.bucket" placeholder="example-1250000000" /></label>
              <label><span>Region</span><el-input v-model="settings.storage.region" placeholder="ap-shanghai" /></label>
              <label><span>SecretId</span><el-input v-model="settings.storage.secretId" placeholder="AKID..." /></label>
              <label>
                <span>SecretKey</span>
                <el-input v-model="settings.storage.secretKey" type="password" show-password :placeholder="settings.storage.hasSecretKey ? '已配置，留空则不修改' : '请输入 SecretKey'" />
              </label>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <IconFont name="settings" :fallback="Setting" />
              <div>
                <h2>访问与预览</h2>
                <p>设置 CDN、上传目录和视频预览有效期</p>
              </div>
            </div>
            <div class="form-stack">
              <label><span>CDN 域名</span><el-input v-model="settings.storage.cdnDomain" placeholder="可选，例如 cdn.example.com" clearable /></label>
              <label><span>默认域名</span><el-input v-model="settings.storage.domain" placeholder="可选" clearable /></label>
              <label><span>上传目录</span><el-input v-model="settings.storage.uploadPrefix" placeholder="materials/" /></label>
              <label><span>预览有效期（秒）</span><el-input-number v-model="settings.storage.previewExpires" :min="60" :max="86400" style="width: 100%" /></label>
              <el-button :loading="testingStorage" @click="testStorage">
                <IconFont name="link" :fallback="Link" />
                测试连接
              </el-button>
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="页面文案" name="copy">
        <section class="copy-grid">
          <div v-for="(group, groupKey) in settings.copy" :key="groupKey" class="panel">
            <div class="panel-head">
              <IconFont name="text" :fallback="EditPen" />
              <div>
                <h2>{{ copyGroupLabels[groupKey] || groupKey }}</h2>
                <p>修改该页面中固定展示的文字</p>
              </div>
            </div>
            <div class="form-stack">
              <label v-for="(_, key) in group" :key="key">
                <span>{{ copyFieldLabels[key] || key }}</span>
                <el-input v-model="settings.copy[groupKey][key]" />
              </label>
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="品牌展示" name="brand">
        <section class="panel-grid">
          <div class="panel">
            <div class="panel-head">
              <IconFont name="brand" :fallback="Monitor" />
              <div>
                <h2>系统 Logo</h2>
                <p>用于左侧栏品牌区域和登录后的主界面识别</p>
              </div>
            </div>
            <div class="logo-box">
              <img v-if="settings.brand.logoUrl" :src="settings.brand.logoUrl" alt="Logo 预览">
              <span v-else>{{ settings.brand.name.slice(0, 1) || '遇' }}</span>
            </div>
            <div class="form-stack">
              <label>
                <span>Logo 地址</span>
                <el-input v-model="settings.brand.logoUrl" placeholder="/logo.png 或 https://..." clearable />
              </label>
              <input ref="logoInput" class="hidden-file" type="file" accept="image/*" @change="pickImage($event, 'logo')">
              <el-button @click="logoInput?.click()">
                <IconFont name="upload" :fallback="Upload" />
                选择本地图片
              </el-button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <IconFont name="text" :fallback="EditPen" />
              <div>
                <h2>系统文案</h2>
                <p>控制左侧栏展示的系统名称与副标题</p>
              </div>
            </div>
            <div class="form-stack">
              <label>
                <span>系统名称</span>
                <el-input v-model="settings.brand.name" maxlength="18" show-word-limit />
              </label>
              <label>
                <span>副标题</span>
                <el-input v-model="settings.brand.subtitle" maxlength="28" show-word-limit />
              </label>
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="账户资料" name="profile">
        <section class="panel-grid">
          <div class="panel">
            <div class="panel-head">
              <IconFont name="user" :fallback="User" />
              <div>
                <h2>账户头像</h2>
                <p>用于右上角账户入口和当前登录身份展示</p>
              </div>
            </div>
            <div class="avatar-box">
              <img v-if="settings.profile.avatarUrl" :src="settings.profile.avatarUrl" alt="头像预览">
              <span v-else>{{ profileInitial }}</span>
            </div>
            <div class="form-stack">
              <label>
                <span>头像地址</span>
                <el-input v-model="settings.profile.avatarUrl" placeholder="https://..." clearable />
              </label>
              <input ref="avatarInput" class="hidden-file" type="file" accept="image/*" @change="pickImage($event, 'avatar')">
              <el-button @click="avatarInput?.click()">
                <IconFont name="upload" :fallback="Upload" />
                选择本地图片
              </el-button>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <IconFont name="account" :fallback="Tickets" />
              <div>
                <h2>账户信息</h2>
                <p>设置当前登录账户在系统中的显示名称和角色标签</p>
              </div>
            </div>
            <div class="form-stack">
              <label>
                <span>显示名称</span>
                <el-input v-model="settings.profile.displayName" placeholder="默认使用登录名" clearable />
              </label>
              <label>
                <span>角色标签</span>
                <el-input v-model="settings.profile.roleLabel" placeholder="如：运营负责人" clearable />
              </label>
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="展示字段" name="fields">
        <section class="field-layout">
          <aside class="field-side">
            <button
              v-for="page in pageEntries"
              :key="page.key"
              :class="{ active: activePage === page.key }"
              @click="activePage = page.key"
            >
              <span>{{ page.value.label }}</span>
              <b>{{ visibleCount(page.value.fields) }}/{{ page.value.fields.length }}</b>
            </button>
          </aside>
          <div class="panel field-panel">
            <div class="panel-head">
              <IconFont name="fields" :fallback="List" />
              <div>
                <h2>{{ currentPage?.label || '页面字段' }}</h2>
                <p>关闭后，该字段会从对应页面的展示配置中隐藏</p>
              </div>
            </div>
            <div class="field-list">
              <div v-for="field in currentPage?.fields" :key="field.key" class="field-row">
                <div>
                  <strong>{{ field.label }}</strong>
                  <span>{{ field.key }}</span>
                </div>
                <el-switch v-model="field.visible" active-text="显示" inactive-text="隐藏" />
              </div>
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="外观设置" name="appearance">
        <section class="panel-grid">
          <div class="panel">
            <div class="panel-head">
              <IconFont name="palette" :fallback="Brush" />
              <div>
                <h2>工作台背景</h2>
                <p>设置工作台月度完成度卡片的背景样式</p>
              </div>
            </div>
            <div class="bg-preview">
              <div class="preview-card" :style="previewBgStyle">
                <span>月度完成度</span>
                <strong>85%</strong>
                <div class="preview-bar"><i style="width: 85%"></i></div>
              </div>
            </div>
            <div class="form-stack">
              <label>
                <span>预设样式</span>
                <el-select v-model="settings.appearance.dashboardBgPreset" placeholder="选择预设样式">
                  <el-option label="渐变紫" value="gradient1" />
                  <el-option label="清新蓝紫" value="gradient2" />
                  <el-option label="简约灰" value="gradient3" />
                  <el-option label="自定义图片" value="custom" />
                </el-select>
              </label>
              <label v-if="settings.appearance.dashboardBgPreset === 'custom'">
                <span>背景图片地址</span>
                <el-input v-model="settings.appearance.dashboardBgUrl" placeholder="https://..." clearable />
              </label>
              <input v-if="settings.appearance.dashboardBgPreset === 'custom'" ref="bgInput" class="hidden-file" type="file" accept="image/*" @change="pickImage($event, 'bg')">
              <el-button v-if="settings.appearance.dashboardBgPreset === 'custom'" @click="bgInput?.click()">
                <IconFont name="upload" :fallback="Upload" />
                选择本地图片
              </el-button>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head">
              <IconFont name="building" :fallback="OfficeBuilding" />
              <div>
                <h2>城市看板背景</h2>
                <p>设置城市看板接入城市卡片的背景样式</p>
              </div>
            </div>
            <div class="bg-preview">
              <div class="preview-card" :style="cityBoardPreviewBgStyle">
                <span>接入城市</span>
                <strong>3个</strong>
                <div class="preview-bar"><i style="width: 30%"></i></div>
              </div>
            </div>
            <div class="form-stack">
              <label>
                <span>预设样式</span>
                <el-select v-model="settings.appearance.cityBoardBgPreset" placeholder="选择预设样式">
                  <el-option label="渐变紫" value="gradient1" />
                  <el-option label="清新蓝紫" value="gradient2" />
                  <el-option label="简约灰" value="gradient3" />
                  <el-option label="自定义图片" value="custom" />
                </el-select>
              </label>
              <label v-if="settings.appearance.cityBoardBgPreset === 'custom'">
                <span>背景图片地址</span>
                <el-input v-model="settings.appearance.cityBoardBgUrl" placeholder="https://..." clearable />
              </label>
              <input v-if="settings.appearance.cityBoardBgPreset === 'custom'" ref="cityBgInput" class="hidden-file" type="file" accept="image/*" @change="pickImage($event, 'cityBg')">
              <el-button v-if="settings.appearance.cityBoardBgPreset === 'custom'" @click="cityBgInput?.click()">
                <IconFont name="upload" :fallback="Upload" />
                选择本地图片
              </el-button>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head">
              <IconFont name="barChart" :fallback="DataAnalysis" />
              <div>
                <h2>数据总览横幅背景</h2>
                <p>设置数据总览页面顶部横幅的背景样式</p>
              </div>
            </div>
            <div class="bg-preview">
              <div class="preview-card hero-preview" :style="dataOverviewHeroBgStyle">
                <span>数据总览</span>
                <strong>实时概览</strong>
              </div>
            </div>
            <div class="form-stack">
              <label>
                <span>预设样式</span>
                <el-select v-model="settings.appearance.dataOverviewHeroBgPreset" placeholder="选择预设样式">
                  <el-option label="渐变紫" value="gradient1" />
                  <el-option label="清新蓝紫" value="gradient2" />
                  <el-option label="简约灰" value="gradient3" />
                  <el-option label="自定义图片" value="custom" />
                </el-select>
              </label>
              <label v-if="settings.appearance.dataOverviewHeroBgPreset === 'custom'">
                <span>背景图片地址</span>
                <el-input v-model="settings.appearance.dataOverviewHeroBgUrl" placeholder="https://..." clearable />
              </label>
              <input v-if="settings.appearance.dataOverviewHeroBgPreset === 'custom'" ref="dataHeroBgInput" class="hidden-file" type="file" accept="image/*" @change="pickImage($event, 'dataHeroBg')">
              <el-button v-if="settings.appearance.dataOverviewHeroBgPreset === 'custom'" @click="dataHeroBgInput?.click()">
                <IconFont name="upload" :fallback="Upload" />
                选择本地图片
              </el-button>
            </div>
          </div>
          <div class="panel">
            <div class="panel-head">
              <IconFont name="pieChart" :fallback="TrendCharts" />
              <div>
                <h2>数据总览KPI卡片背景</h2>
                <p>设置数据总览页面总播放量卡片的背景样式</p>
              </div>
            </div>
            <div class="bg-preview">
              <div class="preview-card" :style="dataOverviewBgStyle">
                <span>总播放量</span>
                <strong>3,010</strong>
                <div class="preview-bar"><i style="width: 70%"></i></div>
              </div>
            </div>
            <div class="form-stack">
              <label>
                <span>预设样式</span>
                <el-select v-model="settings.appearance.dataOverviewBgPreset" placeholder="选择预设样式">
                  <el-option label="渐变紫" value="gradient1" />
                  <el-option label="清新蓝紫" value="gradient2" />
                  <el-option label="简约灰" value="gradient3" />
                  <el-option label="自定义图片" value="custom" />
                </el-select>
              </label>
              <label v-if="settings.appearance.dataOverviewBgPreset === 'custom'">
                <span>背景图片地址</span>
                <el-input v-model="settings.appearance.dataOverviewBgUrl" placeholder="https://..." clearable />
              </label>
              <input v-if="settings.appearance.dataOverviewBgPreset === 'custom'" ref="dataBgInput" class="hidden-file" type="file" accept="image/*" @change="pickImage($event, 'dataBg')">
              <el-button v-if="settings.appearance.dataOverviewBgPreset === 'custom'" @click="dataBgInput?.click()">
                <IconFont name="upload" :fallback="Upload" />
                选择本地图片
              </el-button>
            </div>
          </div>
        </section>
      </el-tab-pane>

      <el-tab-pane label="页面布局" name="layouts">
        <PageLayoutEditor :settings="settings" />
      </el-tab-pane>

      <el-tab-pane label="全局偏好" name="preferences">
        <section class="panel-grid">
          <div class="panel">
            <div class="panel-head">
              <IconFont name="settings" :fallback="Setting" />
              <div>
                <h2>界面偏好</h2>
                <p>控制全局搜索、通知、默认城市等通用行为</p>
              </div>
            </div>
            <div class="switch-list">
              <div class="switch-row">
                <div><strong>紧凑模式</strong><span>让列表和卡片间距更紧凑</span></div>
                <el-switch v-model="settings.preferences.compactMode" />
              </div>
              <div class="switch-row">
                <div><strong>全局搜索</strong><span>显示顶部搜索框</span></div>
                <el-switch v-model="settings.preferences.showGlobalSearch" />
              </div>
              <div class="switch-row">
                <div><strong>系统通知</strong><span>显示右上角通知入口</span></div>
                <el-switch v-model="settings.preferences.enableNotifications" />
              </div>
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <IconFont name="calendar" :fallback="Calendar" />
              <div>
                <h2>默认下发</h2>
                <p>用于城市下发弹窗中的默认选择</p>
              </div>
            </div>
            <div class="form-stack">
              <label>
                <span>默认城市</span>
                <el-select v-model="settings.preferences.defaultCity" clearable filterable placeholder="不设置默认城市">
                  <el-option v-for="city in cities" :key="city.id" :label="city.name" :value="city.id" />
                </el-select>
              </label>
              <label>
                <span>默认发布时间</span>
                <el-time-picker
                  v-model="settings.preferences.defaultPublishTime"
                  format="HH:mm"
                  value-format="HH:mm"
                  placeholder="选择时间"
                  style="width: 100%"
                />
              </label>
            </div>
          </div>
        </section>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Brush,
  OfficeBuilding,
  Calendar,
  Check,
  DataAnalysis,
  EditPen,
  FolderOpened,
  List,
  Link,
  Monitor,
  RefreshLeft,
  Setting,
  Tickets,
  TrendCharts,
  Upload,
  User
} from '@element-plus/icons-vue'
import IconFont from '@/components/IconFont.vue'
import { getCities, testStorageSettings } from '@/api'
import { loadSystemSettings, persistSystemSettingsToRemote, resetSystemSettings, saveSystemSettings, syncSystemSettingsFromRemote } from '@/utils/systemSettings'
import PageLayoutEditor from '@/layout-builder/PageLayoutEditor.vue'
import { buildDefaultLayouts, normalizeLayout } from '@/layout-builder/moduleCatalog'
import { clearPageLayoutBindings, layoutBindingState } from '@/layout-builder/layoutBindings'

const activeTab = ref('storage')
const activePage = ref('dashboard')
const testingStorage = ref(false)
const logoInput = ref(null)
const avatarInput = ref(null)
const bgInput = ref(null)
const cityBgInput = ref(null)
const dataHeroBgInput = ref(null)
const dataBgInput = ref(null)
const cities = ref([])
const settings = reactive(loadSystemSettings())
if (!settings.storage) {
  settings.storage = {
    provider: 'cos',
    bucket: '',
    region: 'ap-shanghai',
    secretId: '',
    secretKey: '',
    cdnDomain: '',
    domain: '',
    uploadPrefix: 'materials/',
    previewExpires: 600,
    proxyPreview: true,
    hasSecretKey: false
  }
}
if (!settings.copy) settings.copy = {}
if (!settings.appearance) {
  settings.appearance = {
    dashboardBgUrl: '',
    dashboardBgPreset: 'gradient1'
  }
}
if (!settings.layouts) settings.layouts = buildDefaultLayouts()
Object.keys(buildDefaultLayouts()).forEach((pageKey) => {
  settings.layouts[pageKey] = normalizeLayout(pageKey, settings.layouts[pageKey])
})

const copyGroupLabels = {
  materialEntry: '素材录入',
  materialList: '素材列表',
  cityBoard: '城市看板',
  accounts: '账号管理'
}
const copyFieldLabels = {
  pageTitle: '页面标题',
  todayOverview: '今日工作概览',
  shootingStaff: '拍摄人员',
  completionStatus: '完成状态',
  shootingMaterial: '拍摄素材',
  todaySchedule: '今日安排',
  completionSummary: '完成情况',
  searchPlaceholder: '搜索占位文字',
  previewButton: '预览按钮',
  copyLinkButton: '复制链接按钮',
  distributeButton: '下发按钮',
  recentRecords: '最近记录',
  cityAccountStatus: '城市账号状态',
  createButton: '新增按钮',
  cityUserTitle: '城市登录账号'
}

const authUser = computed(() => {
  try {
    return JSON.parse(localStorage.getItem('auth_user') || '{}')
  } catch {
    return {}
  }
})

const displayNamePreview = computed(() => settings.profile.displayName || authUser.value.name || authUser.value.username || '用户')
const roleLabelPreview = computed(() => settings.profile.roleLabel || (authUser.value.role === 'admin' ? '超级管理员' : authUser.value.role === 'viewer' ? '只读账号' : '运营账号'))
const profileInitial = computed(() => (displayNamePreview.value || '用').slice(0, 1).toUpperCase())
const pageEntries = computed(() => Object.entries(settings.pages).map(([key, value]) => ({ key, value })))
const currentPage = computed(() => settings.pages[activePage.value])

const visibleCount = (fields) => fields.filter((field) => field.visible).length

const bgPresets = {
  gradient1: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  gradient2: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 30%, #ddd6fe 60%, #e0e7ff 100%)',
  gradient3: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)'
}

const previewBgStyle = computed(() => {
  const preset = settings.appearance.dashboardBgPreset
  if (preset === 'custom' && settings.appearance.dashboardBgUrl) {
    return {
      backgroundImage: `url(${settings.appearance.dashboardBgUrl})`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center'
    }
  }
  return {
    background: bgPresets[preset] || bgPresets.gradient1
  }
})

const cityBoardPreviewBgStyle = computed(() => {
  const preset = settings.appearance.cityBoardBgPreset
  if (preset === 'custom' && settings.appearance.cityBoardBgUrl) {
    return {
      backgroundImage: `url(${settings.appearance.cityBoardBgUrl})`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center'
    }
  }
  return {
    background: bgPresets[preset] || bgPresets.gradient1
  }
})

const dataOverviewHeroBgStyle = computed(() => {
  const preset = settings.appearance.dataOverviewHeroBgPreset
  if (preset === 'custom' && settings.appearance.dataOverviewHeroBgUrl) {
    return {
      backgroundImage: `url(${settings.appearance.dataOverviewHeroBgUrl})`,
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
  const preset = settings.appearance.dataOverviewBgPreset
  if (preset === 'custom' && settings.appearance.dataOverviewBgUrl) {
    return {
      backgroundImage: `url(${settings.appearance.dataOverviewBgUrl})`,
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'center'
    }
  }
  return {
    background: bgPresets[preset] || bgPresets.gradient1
  }
})

const pickImage = (event, target) => {
  const file = event.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    if (target === 'logo') settings.brand.logoUrl = reader.result
    if (target === 'avatar') settings.profile.avatarUrl = reader.result
    if (target === 'bg') settings.appearance.dashboardBgUrl = reader.result
    if (target === 'cityBg') settings.appearance.cityBoardBgUrl = reader.result
    if (target === 'dataHeroBg') settings.appearance.dataOverviewHeroBgUrl = reader.result
    if (target === 'dataBg') settings.appearance.dataOverviewBgUrl = reader.result
  }
  reader.readAsDataURL(file)
  event.target.value = ''
}

const syncProfileToAuthUser = () => {
  const user = authUser.value
  if (!Object.keys(user).length) return
  const nextUser = { ...user }
  if (settings.profile.displayName) nextUser.name = settings.profile.displayName
  if (settings.profile.avatarUrl) nextUser.avatarUrl = settings.profile.avatarUrl
  localStorage.setItem('auth_user', JSON.stringify(nextUser))
}

const saveAll = async () => {
  syncProfileToAuthUser()
  settings.layoutBindings = JSON.parse(JSON.stringify(layoutBindingState || {}))
  const next = await persistSystemSettingsToRemote(settings)
  Object.assign(settings, next)
  ElMessage.success('系统设置已保存到后台')
}

const resetAll = async () => {
  await ElMessageBox.confirm('恢复默认后会清空当前系统设置，是否继续？', '恢复默认设置', {
    type: 'warning',
    confirmButtonText: '恢复默认',
    cancelButtonText: '取消'
  })
  Object.assign(settings, resetSystemSettings())
  Object.keys(buildDefaultLayouts()).forEach((pageKey) => clearPageLayoutBindings(pageKey))
  settings.layoutBindings = {}
  const next = await persistSystemSettingsToRemote(settings)
  Object.assign(settings, next)
  ElMessage.success('已恢复默认设置，并同步到后台')
}

const testStorage = async () => {
  testingStorage.value = true
  try {
    await testStorageSettings(settings.storage)
    ElMessage.success('存储桶连接成功')
  } finally {
    testingStorage.value = false
  }
}

onMounted(async () => {
  try {
    cities.value = await getCities()
  } catch {
    cities.value = []
  }
  try {
    const remote = await syncSystemSettingsFromRemote()
    Object.assign(settings, remote)
    if (!settings.layouts) settings.layouts = buildDefaultLayouts()
    Object.keys(buildDefaultLayouts()).forEach((pageKey) => {
      settings.layouts[pageKey] = normalizeLayout(pageKey, settings.layouts[pageKey])
    })
    saveSystemSettings(settings)
  } catch (error) {
    ElMessage.warning(`后台系统设置加载失败，已使用本地缓存：${error?.message || '未知错误'}`)
  }
})
</script>

<style scoped>
.settings-page { display: flex; flex-direction: column; gap: 16px; }
.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  padding: 22px 24px;
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 16px;
}
.eyebrow { display: inline-flex; align-items: center; gap: 8px; color: #6366f1; font-size: 12px; font-weight: 700; margin-bottom: 8px; }
.page-head h1 { margin: 0 0 6px; font-size: 24px; color: #0f172a; letter-spacing: 0; }
.page-head p { margin: 0; color: #7b8497; font-size: 13px; }
.head-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.head-actions .el-button { display: inline-flex; align-items: center; gap: 6px; }

.preview-band {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
}
.brand-preview,
.profile-preview {
  min-height: 86px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 20px;
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 14px;
}
.brand-preview strong,
.profile-preview strong { display: block; color: #0f172a; font-size: 15px; margin-bottom: 4px; }
.brand-preview span,
.profile-preview span { color: #8a91a4; font-size: 12.5px; }
.preview-logo,
.preview-avatar {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}
.text-logo,
.text-avatar {
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  background: linear-gradient(135deg, #6366f1, #14b8a6);
}
.preview-avatar { border-radius: 999px; }

.settings-tabs {
  padding: 18px 20px 22px;
  background: #fff;
  border: 1px solid #eceff5;
  border-radius: 16px;
}
.panel-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.copy-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.panel {
  border: 1px solid #eceff5;
  border-radius: 14px;
  background: #fff;
  padding: 18px;
}
.panel-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}
.panel-head > .app-icon {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #eef2ff;
  color: #4f46e5;
  flex-shrink: 0;
}
.panel-head h2 { margin: 0 0 4px; font-size: 16px; color: #0f172a; }
.panel-head p { margin: 0; color: #8a91a4; font-size: 12.5px; }
.form-stack { display: flex; flex-direction: column; gap: 14px; }
.form-stack label { display: flex; flex-direction: column; gap: 8px; color: #334155; font-size: 13px; font-weight: 700; }
.logo-box,
.avatar-box {
  width: 112px;
  height: 112px;
  display: grid;
  place-items: center;
  margin-bottom: 16px;
  border: 1px dashed #cbd5e1;
  border-radius: 14px;
  background: #f8fafc;
  overflow: hidden;
}

.bg-preview {
  margin-bottom: 16px;
}
.preview-card {
  border-radius: 14px;
  padding: 20px;
  color: #fff;
}
.preview-card span {
  font-size: 12.5px;
  opacity: 0.8;
}
.preview-card strong {
  display: block;
  font-size: 32px;
  font-weight: 700;
  margin: 8px 0;
}
.preview-bar {
  height: 6px;
  border-radius: 6px;
  background: rgba(255,255,255,0.2);
  overflow: hidden;
}
.preview-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: rgba(255,255,255,0.9);
}
.logo-box img,
.avatar-box img { width: 100%; height: 100%; object-fit: contain; }
.avatar-box { border-radius: 999px; }
.avatar-box img { object-fit: cover; }
.logo-box span,
.avatar-box span { color: #4f46e5; font-size: 34px; font-weight: 800; }
.hidden-file { display: none; }

.field-layout {
  display: grid;
  grid-template-columns: 230px 1fr;
  gap: 16px;
}
.field-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.field-side button {
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
}
.field-side button.active {
  color: #4338ca;
  border-color: #c7d2fe;
  background: #eef2ff;
}
.field-side b { font-size: 12px; color: #94a3b8; }
.field-panel { min-height: 360px; }
.field-list { display: flex; flex-direction: column; gap: 10px; }
.field-row,
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 13px 14px;
  border: 1px solid #eef0f6;
  border-radius: 10px;
  background: #fafbff;
}
.field-row strong,
.switch-row strong { display: block; color: #0f172a; font-size: 13.5px; margin-bottom: 3px; }
.field-row span,
.switch-row span { color: #8a91a4; font-size: 12px; }
.switch-list { display: flex; flex-direction: column; gap: 10px; }

@media (max-width: 980px) {
  .page-head,
  .preview-band,
  .panel-grid,
  .field-layout { grid-template-columns: 1fr; }
  .page-head { align-items: stretch; }
}
</style>
