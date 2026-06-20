<template>
  <section class="layout-editor">
    <div class="layout-page-switch">
      <section v-for="group in pageGroups" :key="group.key" class="page-group">
        <strong>{{ group.label }}</strong>
        <div>
          <button
            v-for="page in group.pages"
            :key="page.key"
            :class="{ active: activePage === page.key }"
            @click="activePage = page.key"
          >
            {{ page.label }}
          </button>
        </div>
      </section>
    </div>

    <aside class="component-palette">
      <div class="palette-search">
        <input v-model.trim="keyword" placeholder="搜索组件" />
      </div>
      <div
        v-for="group in componentGroups"
        :key="group.key"
        class="palette-section"
        v-show="group.components.length"
      >
        <h3>{{ group.label }}</h3>
        <div class="palette-grid">
          <button
            v-for="component in group.components"
            :key="component.key"
            class="palette-item"
            draggable="true"
            @dragstart="dragComponent = component"
            @click="addComponent(component)"
          >
            <span class="palette-icon"><el-icon><component :is="componentIcon(component.key)" /></el-icon></span>
            <span>{{ component.title }}</span>
          </button>
        </div>
      </div>
    </aside>

    <div class="layout-workbench">
      <div class="layout-toolbar">
        <div>
          <h2>{{ currentPage?.label }}</h2>
          <p>画布采用和前台一致的 12 栅格，拖动卡片即可调整展示顺序。</p>
        </div>
        <div class="toolbar-actions">
          <span class="layout-scale">12 栅格画布</span>
          <button v-if="activeBindingRows.length" type="button" class="clear-bindings-btn" @click="clearCurrentPageBindings">
            清空本页绑定值
          </button>
        </div>
      </div>

      <div v-if="activeBindingRows.length" class="binding-overview">
        <strong>当前页面绑定值</strong>
        <span v-for="item in activeBindingRows" :key="item.field">
          {{ item.label }}：{{ item.valueText }}
        </span>
      </div>

      <div ref="previewRef" class="layout-preview" :style="{ '--layout-columns': currentLayout.columns || 12 }" @dragover.prevent @drop="dropOnCanvas">
        <div
          v-for="(module, index) in currentLayout.modules"
          :key="module.key"
          class="layout-module"
          :class="{ hidden: module.visible === false, active: selectedKey === module.key }"
          :style="moduleStyle(module)"
          draggable="true"
          @click="selectedKey = module.key"
          @dragstart="dragIndex = index"
          @dragend="dragIndex = -1"
          @dragover.prevent
          @drop="dropModule(index)"
        >
          <div class="module-actions">
            <span class="drag-handle">拖动</span>
            <el-switch :model-value="module.visible !== false" size="small" @click.stop @change="toggleModuleVisible(module, $event)" />
          </div>
          <div v-if="moduleBindingLabel(module)" class="module-binding-badge">
            绑定：{{ moduleBindingLabel(module) }}
          </div>

          <template v-if="isBuilderComponent(module)">
            <BuilderComponentPreview :module="module" :page-key="activePage" />
          </template>

          <template v-else-if="moduleKey(module) === 'month-progress'">
            <div class="preview-kpi primary">
              <div class="preview-kpi-head"><span>{{ module.title }}</span><b>+0 环比</b></div>
              <strong>11<em>%</em></strong>
              <small>已完成 11/100 条 · 剩余 13 天</small>
              <i class="preview-bar"><span style="width: 22%"></span></i>
            </div>
          </template>

          <template v-else-if="['today-published', 'today-pending', 'month-published'].includes(moduleKey(module))">
            <div class="preview-kpi">
              <div class="preview-kpi-head"><span>{{ module.title }}</span><b v-if="moduleKey(module) === 'month-published'">本月</b></div>
              <strong>{{ moduleKey(module) === 'month-published' ? 12 : 0 }}<em>条</em></strong>
              <small>{{ moduleKey(module) === 'today-pending' ? '涉及 0 个账号' : moduleKey(module) === 'today-published' ? '今日发布合计' : '发布计划 + 城市填报' }}</small>
              <div class="preview-pills"><span>总部 {{ moduleKey(module) === 'month-published' ? 8 : 0 }} 条</span><span>城市 {{ moduleKey(module) === 'month-published' ? 4 : 0 }} 条</span></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module) === 'ai-overview'">
            <div class="preview-panel ai">
              <header><div><h3>{{ module.title }}</h3><p>自动洞察 · 刚刚更新</p></div><b>AI</b></header>
              <div class="preview-message">今日已发布0条，待发布0条，本月累计发布12条。</div>
              <div class="preview-actions"><span></span><span></span></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module) === 'production-summary'">
            <div class="preview-panel table">
              <header><div><h3>{{ module.title }}</h3><p>拍摄 / 剪辑 / 上传 / 发布统计</p></div></header>
              <div class="table-lines"><i></i><i></i><i></i><i></i></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module) === 'publish-schedule'">
            <div class="preview-panel schedule">
              <header><div><h3>{{ module.title }} · 6月18日</h3><p>按排期时间自动推送至各平台账号。</p></div><b>全部 0</b></header>
              <div class="schedule-lines"><i></i><i></i></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module) === 'city-distribution'">
            <div class="preview-panel ring-card">
              <header><div><h3>{{ module.title }}</h3><p>3 个城市 · 实时状态</p></div></header>
              <div class="fake-ring"><strong>0/3</strong><span>已发布</span></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module) === 'overdue-tasks'">
            <div class="preview-panel list">
              <header><div><h3>{{ module.title }}</h3><p>超过排期时间的待处理任务。</p></div><b>全部 4 项</b></header>
              <div class="list-lines"><i></i><i></i><i></i></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module) === 'quick-links'">
            <div class="preview-panel quick">
              <header><div><h3>{{ module.title }}</h3><p>常用功能一键直达。</p></div></header>
              <div class="quick-dots"><i></i><i></i><i></i><i></i><i></i><i></i></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module) === 'city-summary'">
            <div class="preview-city-summary">
              <div class="sum primary"><strong>11%</strong><span>本月完成</span></div>
              <div class="sum"><strong>0</strong><span>待发布</span></div>
              <div class="sum"><strong>12</strong><span>本月发布</span></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module) === 'city-tasks' || moduleKey(module) === 'city-notices'">
            <div class="preview-panel list">
              <header><div><h3>{{ module.title }}</h3><p>{{ moduleKey(module) === 'city-tasks' ? '今日下发任务和填报入口' : '待发布、待补数据提醒' }}</p></div></header>
              <div class="list-lines"><i></i><i></i><i></i></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module) === 'page-head'">
            <div class="preview-panel page-preview-head">
              <div class="eyebrow-line"></div>
              <h3>{{ currentPage?.label || module.title }}</h3>
              <p>{{ currentPage?.description || '页面头部、标题说明和主要操作按钮。' }}</p>
              <div class="head-action-lines"><i></i><i></i></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module).includes('toolbar') || moduleKey(module).includes('filter') || moduleKey(module).includes('legend')">
            <div class="preview-panel toolbar-preview">
              <header><div><h3>{{ module.title }}</h3><p>筛选条件、平台切换、日期选择和批量操作。</p></div></header>
              <div class="chip-lines"><i></i><i></i><i></i><i></i></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module).includes('summary') || moduleKey(module).includes('metric')">
            <div class="preview-generic-summary">
              <div class="sum primary"><strong>11%</strong><span>{{ module.title }}</span></div>
              <div class="sum"><strong>0</strong><span>待处理</span></div>
              <div class="sum"><strong>12</strong><span>本月合计</span></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module).includes('calendar')">
            <div class="preview-panel calendar-preview">
              <header><div><h3>{{ module.title }}</h3><p>月度排期和日期格子视图。</p></div></header>
              <div class="calendar-grid-preview">
                <i v-for="n in 21" :key="n"></i>
              </div>
            </div>
          </template>

          <template v-else-if="moduleKey(module).includes('form') || moduleKey(module).includes('generate') || moduleKey(module).includes('config')">
            <div class="preview-panel form-preview">
              <header><div><h3>{{ module.title }}</h3><p>表单录入、字段配置和提交操作。</p></div></header>
              <div class="form-lines"><i></i><i></i><i></i><i class="wide"></i></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module).includes('table') || moduleKey(module).includes('list') || moduleKey(module).includes('groups') || moduleKey(module).includes('ledger') || moduleKey(module).includes('panel')">
            <div class="preview-panel table">
              <header><div><h3>{{ module.title }}</h3><p>列表内容、数据表格和行内操作。</p></div></header>
              <div class="table-lines"><i></i><i></i><i></i><i></i></div>
            </div>
          </template>

          <template v-else-if="moduleKey(module).includes('chart') || moduleKey(module).includes('rank')">
            <div class="preview-panel chart-preview">
              <header><div><h3>{{ module.title }}</h3><p>趋势图、排行和数据分析。</p></div></header>
              <div class="chart-bars"><i></i><i></i><i></i><i></i><i></i></div>
            </div>
          </template>

          <template v-else>
            <div class="preview-panel generic-preview">
              <header><div><h3>{{ module.title }}</h3><p>{{ moduleKey(module) }}</p></div></header>
              <div class="generic-blocks"><i></i><i></i><i></i></div>
            </div>
          </template>

          <div v-if="module.visible === false" class="hidden-mask">已隐藏</div>
          <button
            class="resize-handle"
            type="button"
            title="拖动调整模块大小"
            @click.stop
            @pointerdown.stop.prevent="startResize($event, module)"
          ></button>
        </div>
      </div>
    </div>

    <aside class="layout-config">
      <template v-if="selectedModule">
        <div class="config-head">
          <strong>模块设置</strong>
          <span>{{ selectedModule.key }}</span>
        </div>
        <label>
          <span>显示名称</span>
          <el-input v-model="selectedModule.title" />
        </label>
        <label>
          <span>模块宽度</span>
          <el-select v-model="selectedModule.span">
            <el-option label="整行 12/12" :value="12" />
            <el-option label="大卡片 8/12" :value="8" />
            <el-option label="半行 6/12" :value="6" />
            <el-option label="侧栏 4/12" :value="4" />
            <el-option label="指标 3/12" :value="3" />
          </el-select>
        </label>
        <label>
          <span>模块高度</span>
          <el-input-number
            v-model="selectedModule.height"
            :min="0"
            :max="1200"
            :step="20"
            controls-position="right"
            placeholder="自动"
            style="width: 100%"
          />
        </label>
        <div class="size-note">也可以拖动卡片右下角，宽度会按 12 栅格吸附，高度会按像素保存；高度为 0 时使用自动高度。</div>
        <template v-if="isBuilderComponent(selectedModule)">
          <div class="usage-note">
            <strong>怎么用到实际页面？</strong>
            <span>优先选择下方业务字段。选中后组件的值会保存到当前页面字段里，已接入的页面会自动用它控制筛选或表单默认值。</span>
          </div>
          <label v-if="bindingFields.length">
            <span>绑定业务字段</span>
            <el-select
              :model-value="selectedModule.config.fieldName"
              filterable
              clearable
              placeholder="选择这个组件要控制的页面字段"
              @change="applyBindingField"
            >
              <el-option
                v-for="field in bindingFields"
                :key="field.field"
                :label="`${field.label} · ${field.field}`"
                :value="field.field"
              >
                <div class="binding-option">
                  <strong>{{ field.label }}</strong>
                  <span>{{ field.field }} · {{ field.effect }}</span>
                </div>
              </el-option>
            </el-select>
          </label>
          <div v-if="selectedBinding" class="binding-field-info">
            <strong>{{ selectedBinding.label }}</strong>
            <span>{{ selectedBinding.effect }}</span>
            <em v-if="selectedBindingValueText">当前值：{{ selectedBindingValueText }}</em>
            <button v-if="selectedBindingValueText" type="button" @click="clearSelectedBindingValue">清空当前字段值</button>
          </div>
          <div v-if="bindingFields.length" class="field-cheatsheet">
            <strong>当前页面可绑定字段</strong>
            <button
              v-for="field in bindingFields"
              :key="field.field"
              type="button"
              :class="{ active: selectedModule.config.fieldName === field.field }"
              @click="applyBindingField(field.field)"
            >
              {{ field.label }}
              <small>{{ field.field }}</small>
            </button>
          </div>
          <label>
            <span>字段名称</span>
            <el-input v-model="selectedModule.config.fieldName" placeholder="例如 title、status" />
          </label>
          <label>
            <span>标签名称</span>
            <el-input v-model="selectedModule.config.label" placeholder="页面上显示的标签" />
          </label>
          <label v-if="needsPlaceholder(selectedModule)">
            <span>占位文字</span>
            <el-input v-model="selectedModule.config.placeholder" placeholder="请输入占位提示" />
          </label>
          <label v-if="needsDefaultValue(selectedModule)">
            <span>默认值</span>
            <el-input v-model="selectedModule.config.defaultValue" placeholder="请输入默认值" />
          </label>
          <label v-if="needsOptions(selectedModule)">
            <span>选项配置</span>
            <el-input v-model="selectedModule.config.options" type="textarea" :rows="4" placeholder="每行一个选项" />
          </label>
          <div v-if="needsNumberRange(selectedModule)" class="config-two">
            <label>
              <span>最小值</span>
              <el-input-number v-model="selectedModule.config.min" :min="-9999" style="width: 100%" />
            </label>
            <label>
              <span>最大值</span>
              <el-input-number v-model="selectedModule.config.max" :min="Number(selectedModule.config.min || 0)" style="width: 100%" />
            </label>
          </div>
          <label v-if="moduleKey(selectedModule) === 'layout-alert'">
            <span>提示类型</span>
            <el-select v-model="selectedModule.config.alertType">
              <el-option label="信息" value="info" />
              <el-option label="成功" value="success" />
              <el-option label="警告" value="warning" />
              <el-option label="错误" value="error" />
            </el-select>
          </label>
          <label v-if="moduleKey(selectedModule) === 'layout-grid'">
            <span>列数</span>
            <el-input-number v-model="selectedModule.config.columns" :min="2" :max="6" style="width: 100%" />
          </label>
          <label>
            <span>说明文字</span>
            <el-input v-model="selectedModule.config.helpText" type="textarea" :rows="3" placeholder="模块说明或帮助信息" />
          </label>
          <div class="switch-row compact">
            <div><strong>必填项</strong><span>用于表单类组件校验提示</span></div>
            <el-switch v-model="selectedModule.config.required" />
          </div>
        </template>
        <div class="switch-row compact">
          <div><strong>显示模块</strong><span>关闭后前台不渲染</span></div>
          <el-switch v-model="selectedModule.visible" />
        </div>
        <el-button class="delete-module-btn" type="danger" plain @click="removeSelectedModule">删除组件</el-button>
        <div class="save-note">调整后点击页面右上角“保存布局”生效。</div>
      </template>
      <el-empty v-else description="请选择一个模块" />
    </aside>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Aim,
  Bell,
  Calendar,
  Check,
  Clock,
  Collection,
  DataAnalysis,
  Document,
  EditPen,
  Files,
  Grid,
  Histogram,
  List,
  MagicStick,
  Menu,
  Notification,
  Operation,
  PieChart,
  PriceTag,
  Select,
  SetUp,
  Switch,
  Tickets,
  Timer,
  TrendCharts,
  Warning
} from '@element-plus/icons-vue'
import { buildDefaultLayouts, layoutModuleCatalog, layoutPages, normalizeLayout } from './moduleCatalog'
import BuilderComponentPreview from './BuilderComponentPreview.vue'
import { basicControls, clonePaletteModule, layoutControls } from './componentPalette'
import { applyBindingPresetToModule, getBindingField, getPageBindingFields } from './fieldBindingCatalog'
import { clearLayoutBindingValue, clearPageLayoutBindings, layoutBindingState } from './layoutBindings'

const props = defineProps({
  settings: { type: Object, required: true }
})

const activePage = ref(layoutPages[0]?.key || 'dashboard')
const selectedKey = ref('')
const dragIndex = ref(-1)
const dragComponent = ref(null)
const keyword = ref('')
const previewRef = ref(null)
const resizeState = ref(null)

const ensureLayouts = () => {
  if (!props.settings.layouts) props.settings.layouts = {}
  const defaults = buildDefaultLayouts()
  layoutPages.forEach((page) => {
    props.settings.layouts[page.key] = normalizeLayout(page.key, props.settings.layouts[page.key] || defaults[page.key])
  })
}

ensureLayouts()

const currentPage = computed(() => layoutPages.find((page) => page.key === activePage.value))
const currentLayout = computed(() => props.settings.layouts[activePage.value])
const selectedModule = computed(() => currentLayout.value?.modules?.find((module) => module.key === selectedKey.value))
const bindingFields = computed(() => getPageBindingFields(activePage.value))
const selectedBinding = computed(() => getBindingField(activePage.value, selectedModule.value?.config?.fieldName))
const currentPageBindings = computed(() => layoutBindingState[activePage.value] || {})
const hasBindingValue = (value) => {
  if (Array.isArray(value)) return value.length > 0
  return value !== undefined && value !== null && value !== ''
}
const formatBindingValue = (value) => {
  if (Array.isArray(value)) return value.join(' 至 ')
  if (typeof value === 'boolean') return value ? '开启' : '关闭'
  return String(value)
}
const activeBindingRows = computed(() => {
  const fields = getPageBindingFields(activePage.value)
  const fieldMap = new Map(fields.map((field) => [field.field, field]))
  return Object.entries(currentPageBindings.value)
    .filter(([, value]) => hasBindingValue(value))
    .map(([field, value]) => ({
      field,
      label: fieldMap.get(field)?.label || field,
      valueText: formatBindingValue(value)
    }))
})
const selectedBindingValueText = computed(() => {
  const fieldName = selectedModule.value?.config?.fieldName
  if (!fieldName) return ''
  const value = currentPageBindings.value[fieldName]
  return hasBindingValue(value) ? formatBindingValue(value) : ''
})
const moduleBindingField = (module) => module?.config?.fieldName || ''
const moduleBindingLabel = (module) => {
  const fieldName = moduleBindingField(module)
  if (!fieldName) return ''
  return getBindingField(activePage.value, fieldName)?.label || fieldName
}
const pageGroups = computed(() => [
  { key: 'admin', label: '管理端页面', pages: layoutPages.filter((page) => page.scope !== 'city') },
  { key: 'city', label: '城市端页面', pages: layoutPages.filter((page) => page.scope === 'city') }
])
const allComponents = computed(() => {
  const seen = new Set()
  return Object.values(layoutModuleCatalog).flat()
    .filter((module) => {
      const key = moduleKey(module)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
})
const matchKeyword = (component) => {
  const text = keyword.value.toLowerCase()
  if (!text) return true
  return `${component.title}${moduleKey(component)}`.toLowerCase().includes(text)
}

const componentGroups = computed(() => [
  { key: 'basic', label: '基础控件', components: basicControls.filter(matchKeyword) },
  { key: 'layout', label: '布局控件', components: layoutControls.filter(matchKeyword) },
  { key: 'business', label: '业务组件', components: allComponents.value.filter(matchKeyword) }
])

const safeSpan = (span) => Math.min(12, Math.max(3, Number(span || 6)))
const safeHeight = (height) => {
  const value = Number(height || 0)
  return value > 0 ? Math.min(1200, Math.max(120, value)) : 0
}
const moduleStyle = (module) => {
  const height = safeHeight(module.height)
  return {
    gridColumn: `span ${safeSpan(module.span)}`,
    minHeight: `${height || 154}px`,
    height: height ? `${height}px` : undefined
  }
}
const moduleKey = (module) => module?.componentKey || module?.key || ''
const isBuilderComponent = (module) => {
  const key = moduleKey(module)
  return key.startsWith('control-') || key.startsWith('layout-')
}
const needsOptions = (module) => ['control-radio', 'control-select', 'control-multi-select', 'layout-tabs'].includes(moduleKey(module))
const needsPlaceholder = (module) => ['control-date', 'control-datetime', 'control-select', 'control-multi-select', 'control-input', 'control-textarea', 'control-time'].includes(moduleKey(module))
const needsDefaultValue = (module) => !['layout-alert', 'layout-tabs', 'layout-collapse', 'layout-grid', 'layout-table', 'layout-divider'].includes(moduleKey(module))
const needsNumberRange = (module) => ['control-counter', 'control-slider'].includes(moduleKey(module))
const recommendField = (component) => {
  const fields = bindingFields.value
  if (!fields.length) return null
  const key = moduleKey(component)
  const title = component?.title || ''
  const preferred = {
    'control-date': ['date', 'selectedDate', 'month', 'dateFrom', 'startDate'],
    'control-datetime': ['date', 'selectedDate', 'dateFrom', 'startDate'],
    'control-time': ['time'],
    'control-select': ['platform', 'status', 'type', 'range', 'readStatus', 'cityStatus', 'scope'],
    'control-radio': ['status', 'platform', 'type', 'range'],
    'control-multi-select': ['platform', 'cityId', 'scope'],
    'control-input': ['keyword', 'search', 'owner', 'videoTitle', 'staffName', 'netdiskPath'],
    'control-textarea': ['remark'],
    'control-switch': ['showHistory'],
    'control-counter': ['views', 'likes', 'comments', 'deals', 'revenue', 'shootCount', 'editCount'],
    'control-slider': ['range']
  }[key] || []
  const preferredField = preferred.map((name) => fields.find((field) => field.field === name)).find(Boolean)
  if (preferredField) return preferredField
  if (title.includes('日期') || title.includes('时间')) return fields.find((field) => field.type === 'date')
  if (title.includes('选择') || title.includes('单选')) return fields.find((field) => field.type === 'select')
  if (title.includes('开关')) return fields.find((field) => field.type === 'switch')
  if (title.includes('文本')) return fields.find((field) => ['input', 'textarea'].includes(field.type))
  return fields[0] || null
}
const applyBindingField = (fieldName) => {
  if (!selectedModule.value?.config) return
  if (!fieldName) {
    selectedModule.value.config.fieldName = ''
    return
  }
  const field = getBindingField(activePage.value, fieldName)
  applyBindingPresetToModule(selectedModule.value, field)
}
const clearSelectedBindingValue = () => {
  const fieldName = selectedModule.value?.config?.fieldName
  if (!fieldName) return
  clearLayoutBindingValue(activePage.value, fieldName)
  ElMessage.success('当前字段值已清空')
}
const clearCurrentPageBindings = async () => {
  await ElMessageBox.confirm('清空后，当前页面所有布局组件写入的筛选值都会恢复为空，是否继续？', '清空本页绑定值', {
    type: 'warning',
    confirmButtonText: '清空',
    cancelButtonText: '取消'
  })
  clearPageLayoutBindings(activePage.value)
  ElMessage.success('当前页面绑定值已清空')
}
const clearModuleBindingValue = (module) => {
  const fieldName = moduleBindingField(module)
  if (!fieldName) return false
  clearLayoutBindingValue(activePage.value, fieldName)
  return true
}
const toggleModuleVisible = (module, visible) => {
  module.visible = visible
  if (visible === false && clearModuleBindingValue(module)) {
    ElMessage.info('组件已隐藏，并清空对应字段值')
  }
}
const controlIcons = {
  'control-checkbox': Check,
  'control-color': MagicStick,
  'control-date': Calendar,
  'control-datetime': Timer,
  'control-counter': SetUp,
  'control-radio': Aim,
  'control-select': Select,
  'control-multi-select': List,
  'control-slider': Operation,
  'control-switch': Switch,
  'control-input': EditPen,
  'control-textarea': Document,
  'control-time': Clock,
  'control-rich-text': Collection,
  'control-json': Tickets,
  'layout-divider': Menu,
  'layout-alert': Warning,
  'layout-tabs': PriceTag,
  'layout-collapse': Files,
  'layout-grid': Grid,
  'layout-table': List
}
const componentIcon = (key) => {
  if (controlIcons[key]) return controlIcons[key]
  if (key.includes('head')) return Document
  if (key.includes('filter') || key.includes('toolbar')) return Operation
  if (key.includes('table') || key.includes('list') || key.includes('ledger')) return List
  if (key.includes('chart') || key.includes('summary') || key.includes('metric')) return TrendCharts
  if (key.includes('form')) return EditPen
  if (key.includes('calendar') || key.includes('schedule')) return Calendar
  if (key.includes('ai')) return MagicStick
  if (key.includes('city') || key.includes('distribution')) return PieChart
  if (key.includes('notice') || key.includes('notification')) return Bell
  if (key.includes('report')) return DataAnalysis
  return Histogram
}

const resequence = () => {
  currentLayout.value.modules.forEach((module, index) => {
    module.order = (index + 1) * 10
  })
}

const startResize = (event, module) => {
  selectedKey.value = module.key
  const rect = previewRef.value?.getBoundingClientRect()
  if (!rect) return
  const columns = Number(currentLayout.value.columns || 12)
  resizeState.value = {
    module,
    startX: event.clientX,
    startY: event.clientY,
    startSpan: safeSpan(module.span),
    startHeight: safeHeight(module.height) || event.currentTarget.closest('.layout-module')?.offsetHeight || 154,
    columnWidth: rect.width / columns
  }
  window.addEventListener('pointermove', resizeModule)
  window.addEventListener('pointerup', stopResize, { once: true })
}

const resizeModule = (event) => {
  const state = resizeState.value
  if (!state?.module) return
  const spanDelta = Math.round((event.clientX - state.startX) / Math.max(1, state.columnWidth))
  state.module.span = Math.min(12, Math.max(3, state.startSpan + spanDelta))
  state.module.height = Math.min(1200, Math.max(120, Math.round((state.startHeight + event.clientY - state.startY) / 10) * 10))
}

const stopResize = () => {
  window.removeEventListener('pointermove', resizeModule)
  resizeState.value = null
}

const dropModule = (targetIndex) => {
  if (dragComponent.value) {
    addComponent(dragComponent.value, targetIndex)
    dragComponent.value = null
    return
  }
  if (dragIndex.value < 0 || dragIndex.value === targetIndex) return
  const modules = currentLayout.value.modules
  const [moved] = modules.splice(dragIndex.value, 1)
  modules.splice(targetIndex, 0, moved)
  resequence()
  selectedKey.value = moved.key
  dragIndex.value = -1
}

const addComponent = (component, targetIndex = currentLayout.value.modules.length) => {
  const baseKey = moduleKey(component)
  const isBuilder = baseKey.startsWith('control-') || baseKey.startsWith('layout-')
  if (!isBuilder && currentLayout.value.modules.some((module) => moduleKey(module) === baseKey)) {
    selectedKey.value = currentLayout.value.modules.find((module) => moduleKey(module) === baseKey)?.key || ''
    ElMessage.info('当前页面已包含该组件')
    return
  }
  currentLayout.value.removedKeys = (currentLayout.value.removedKeys || []).filter((key) => key !== baseKey)
  const uniqueKey = currentLayout.value.modules.some((module) => module.key === baseKey) || isBuilder
    ? `${baseKey}-${Date.now()}`
    : baseKey
  const next = {
    ...clonePaletteModule(component),
    key: uniqueKey,
    componentKey: baseKey,
    title: component.title,
    span: component.span || 12,
    height: Number(component.height || 0),
    visible: true,
    order: (targetIndex + 1) * 10
  }
  if (isBuilder && !next.config?.fieldName) {
    const field = recommendField(component)
    if (field) applyBindingPresetToModule(next, field)
  }
  currentLayout.value.modules.splice(targetIndex, 0, next)
  resequence()
  selectedKey.value = next.key
  if (isBuilder && next.config?.fieldName) ElMessage.success(`已推荐绑定字段：${next.config.fieldName}`)
}

const removeSelectedModule = () => {
  const modules = currentLayout.value.modules
  const index = modules.findIndex((module) => module.key === selectedKey.value)
  if (index < 0) return
  const [removed] = modules.splice(index, 1)
  clearModuleBindingValue(removed)
  const baseKey = moduleKey(removed)
  const isDefaultModule = buildDefaultLayouts()[activePage.value]?.modules?.some((module) => module.key === baseKey)
  if (isDefaultModule) {
    const removedKeys = new Set(currentLayout.value.removedKeys || [])
    removedKeys.add(baseKey)
    currentLayout.value.removedKeys = [...removedKeys]
  }
  resequence()
  selectedKey.value = modules[Math.min(index, modules.length - 1)]?.key || ''
  ElMessage.success('组件已删除，保存后生效')
}

const dropOnCanvas = () => {
  if (!dragComponent.value) return
  addComponent(dragComponent.value)
  dragComponent.value = null
}

const resetCurrentLayout = () => {
  props.settings.layouts[activePage.value] = normalizeLayout(activePage.value, buildDefaultLayouts()[activePage.value])
  clearPageLayoutBindings(activePage.value)
  selectedKey.value = props.settings.layouts[activePage.value].modules[0]?.key || ''
  ElMessage.success('已恢复当前页面默认布局，并清空本页绑定值')
}

watch(activePage, () => {
  ensureLayouts()
  selectedKey.value = currentLayout.value?.modules?.[0]?.key || ''
}, { immediate: true })

watch(selectedModule, (module) => {
  if (module && isBuilderComponent(module) && !module.config) module.config = {}
}, { immediate: true })

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', resizeModule)
})
</script>

<style scoped>
.layout-editor {
  display: grid;
  grid-template-columns: 310px minmax(0, 1fr) 280px;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 16px;
  height: calc(100vh - 154px);
  min-height: 620px;
  overflow: hidden;
}
.layout-page-switch {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.page-group {
  padding: 12px 14px;
  border: 1px solid #eceff5;
  border-radius: 14px;
  background: #fff;
}
.page-group > strong {
  display: block;
  margin-bottom: 10px;
  color: #0f172a;
  font-size: 13px;
}
.page-group > div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.layout-config {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.page-group button {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #475569;
  cursor: pointer;
  font-size: 12.5px;
  font-weight: 700;
}
.page-group button.active {
  border-color: #c7d2fe;
  background: #eef2ff;
  color: #4338ca;
}
.config-head strong {
  display: block;
  color: #0f172a;
  font-size: 13.5px;
}
.config-head span {
  display: block;
  margin-top: 4px;
  color: #8a91a4;
  font-size: 12px;
  line-height: 1.5;
}
.component-palette {
  min-width: 0;
  min-height: 0;
  padding: 16px 14px 22px;
  border: 1px solid #eceff5;
  border-radius: 14px;
  background: #fff;
  overflow: auto;
}
.palette-search input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  outline: 0;
  color: #0f172a;
  font-size: 14px;
}
.palette-search input::placeholder {
  color: #a5acba;
}
.palette-section {
  margin-top: 26px;
}
.palette-section h3 {
  margin: 0 0 18px;
  color: #5f6673;
  font-size: 16px;
  font-weight: 800;
  text-align: center;
}
.palette-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  column-gap: 12px;
  row-gap: 20px;
}
.palette-item {
  width: 100%;
  min-height: 104px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  color: #111827;
  cursor: grab;
  text-align: center;
  font-weight: 700;
  line-height: 1.25;
}
.palette-item:hover {
  color: #4338ca;
}
.palette-icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  border: 1px solid #ddd7d5;
  border-radius: 8px;
  background: #fff;
  color: #111;
  font-size: 20px;
  font-weight: 900;
  flex-shrink: 0;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease;
}
.palette-item:hover .palette-icon {
  border-color: #9aa7ff;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
  color: #4338ca;
}
.palette-item > span:last-child {
  min-height: 34px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  font-size: 14px;
}
.layout-workbench,
.layout-config {
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: auto;
  padding: 16px;
  border: 1px solid #eceff5;
  border-radius: 14px;
  background: #fff;
}
.layout-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.toolbar-actions {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}
.layout-scale {
  align-self: flex-start;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 12px;
  font-weight: 800;
}
.clear-bindings-btn {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #fee2e2;
  border-radius: 999px;
  background: #fff;
  color: #dc2626;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.clear-bindings-btn:hover {
  background: #fef2f2;
}
.layout-toolbar h2 {
  margin: 0 0 4px;
  color: #0f172a;
  font-size: 16px;
}
.layout-toolbar p {
  margin: 0;
  color: #8a91a4;
  font-size: 12.5px;
}
.binding-overview {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #eff6ff;
  font-size: 12px;
}
.binding-overview strong {
  color: #1e3a8a;
}
.binding-overview span {
  padding: 4px 8px;
  border-radius: 999px;
  background: #fff;
  color: #334155;
  font-weight: 800;
}
.layout-preview {
  display: grid;
  grid-template-columns: repeat(var(--layout-columns), minmax(0, 1fr));
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  background: #f5f6fa;
}
.layout-module {
  position: relative;
  min-height: 154px;
  border: 1px solid transparent;
  border-radius: 14px;
  cursor: grab;
  transition: border-color 0.16s ease, box-shadow 0.16s ease, opacity 0.16s ease;
}
.layout-module.active {
  border-color: #818cf8;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18);
}
.layout-module.hidden {
  opacity: 0.42;
}
.module-actions {
  position: absolute;
  top: 12px;
  left: 14px;
  right: 14px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
}
.module-actions .el-switch {
  pointer-events: auto;
}
.drag-handle {
  transform: translateY(-50%);
  padding: 2px 7px;
  border-radius: 999px;
  background: #eef2ff;
  color: #4f46e5;
  font-size: 11px;
  font-weight: 700;
  pointer-events: none;
}
.module-binding-badge {
  position: absolute;
  right: 14px;
  bottom: 12px;
  z-index: 4;
  max-width: calc(100% - 28px);
  padding: 4px 8px;
  border: 1px solid #c7d2fe;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  color: #4338ca;
  font-size: 11px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}
.layout-config label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: #334155;
  font-size: 13px;
  font-weight: 700;
}
.config-two {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.usage-note {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #eff6ff;
  color: #1d4ed8;
  line-height: 1.6;
}
.usage-note strong {
  color: #1e3a8a;
  font-size: 13px;
}
.usage-note span {
  font-size: 12px;
}
.binding-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.35;
}
.binding-option strong {
  color: #0f172a;
  font-size: 13px;
}
.binding-option span {
  color: #8a91a4;
  font-size: 12px;
}
.binding-field-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #eff6ff;
}
.binding-field-info strong {
  color: #1d4ed8;
  font-size: 13px;
}
.binding-field-info span {
  color: #64748b;
  font-size: 12px;
  line-height: 1.5;
}
.binding-field-info em {
  color: #4338ca;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}
.binding-field-info button {
  align-self: flex-start;
  height: 26px;
  padding: 0 10px;
  border: 1px solid #bfdbfe;
  border-radius: 999px;
  background: #fff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.field-cheatsheet {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 12px;
  border: 1px solid #eef0f6;
  border-radius: 12px;
  background: #fff;
}
.field-cheatsheet strong {
  flex-basis: 100%;
  color: #0f172a;
  font-size: 13px;
}
.field-cheatsheet button {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  max-width: 100%;
  padding: 7px 9px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
}
.field-cheatsheet button.active {
  border-color: #818cf8;
  background: #eef2ff;
  color: #4338ca;
}
.field-cheatsheet small {
  color: #94a3b8;
  font-size: 10px;
  font-weight: 700;
}
.field-cheatsheet button.active small {
  color: #6366f1;
}
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
.switch-row strong {
  display: block;
  color: #0f172a;
  font-size: 13.5px;
  margin-bottom: 3px;
}
.switch-row span {
  color: #8a91a4;
  font-size: 12px;
}
.switch-row.compact {
  padding: 12px;
}
.save-note {
  padding: 14px;
  border-radius: 10px;
  background: #f5f6fa;
  color: #8a91a4;
  font-size: 13px;
  line-height: 1.7;
}
.size-note {
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  line-height: 1.6;
}
.delete-module-btn {
  width: 100%;
}
.resize-handle {
  position: absolute;
  right: 8px;
  bottom: 8px;
  z-index: 5;
  width: 18px;
  height: 18px;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background:
    linear-gradient(135deg, transparent 0 48%, rgba(79, 70, 229, 0.78) 50% 58%, transparent 60%),
    linear-gradient(135deg, transparent 0 66%, rgba(79, 70, 229, 0.95) 68% 76%, transparent 78%);
  cursor: nwse-resize;
  opacity: 0;
  transition: opacity 0.16s ease, background-color 0.16s ease;
}
.layout-module:hover .resize-handle,
.layout-module.active .resize-handle {
  opacity: 1;
  background-color: rgba(238, 242, 255, 0.92);
}
.hidden-mask {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: rgba(248, 250, 252, 0.7);
  color: #64748b;
  font-weight: 800;
}
.preview-kpi,
.preview-panel,
.preview-city-summary {
  height: 100%;
  min-height: 154px;
}
.preview-kpi,
.preview-panel {
  padding: 24px 22px 20px;
  border: 1px solid #ececf1;
  border-radius: 14px;
  background: #fff;
  overflow: hidden;
}
.preview-kpi.primary {
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #fff;
  border: 0;
}
.preview-kpi-head,
.preview-panel header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-top: 20px;
}
.preview-kpi-head span,
.preview-panel h3 {
  color: inherit;
  font-size: 14px;
  font-weight: 800;
}
.preview-kpi-head b,
.preview-panel header b {
  padding: 4px 9px;
  border-radius: 8px;
  background: #ecfdf5;
  color: #059669;
  font-size: 12px;
}
.preview-kpi.primary .preview-kpi-head b {
  background: rgba(255,255,255,0.18);
  color: #fff;
}
.preview-kpi strong {
  display: block;
  margin: 20px 0 8px;
  color: #0f172a;
  font-size: 38px;
  line-height: 1;
}
.preview-kpi.primary strong {
  color: #fff;
}
.preview-kpi em {
  margin-left: 4px;
  color: #9ca3af;
  font-size: 14px;
  font-style: normal;
}
.preview-kpi.primary em,
.preview-kpi.primary small {
  color: rgba(255,255,255,0.76);
}
.preview-kpi small,
.preview-panel p {
  color: #8a91a4;
  font-size: 13px;
}
.preview-bar {
  display: block;
  height: 6px;
  margin-top: 20px;
  border-radius: 999px;
  background: rgba(255,255,255,0.22);
  overflow: hidden;
}
.preview-bar span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #fff;
}
.preview-pills {
  display: flex;
  gap: 8px;
  margin-top: 20px;
  flex-wrap: wrap;
}
.preview-pills span {
  padding: 6px 10px;
  border-radius: 999px;
  background: #f8fafc;
  color: #64748b;
  font-size: 12px;
  font-weight: 700;
}
.preview-panel header {
  margin-top: 18px;
  margin-bottom: 18px;
}
.preview-panel h3,
.preview-panel p {
  margin: 0 0 5px;
}
.preview-panel.ai {
  background: linear-gradient(135deg, #faf5ff, #eef2ff);
  border-color: #e9d5ff;
}
.preview-message {
  padding: 16px;
  border: 1px solid #ede9fe;
  border-radius: 10px;
  background: #fff;
  color: #1f2937;
  font-size: 13px;
}
.preview-actions {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 10px;
  margin-top: 14px;
}
.preview-actions span {
  height: 34px;
  border-radius: 9px;
  background: #6d5df6;
}
.preview-actions span + span {
  background: #fff;
  border: 1px solid #e5e7eb;
}
.table-lines,
.schedule-lines,
.list-lines {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.table-lines i,
.schedule-lines i,
.list-lines i {
  height: 34px;
  border-radius: 10px;
  background: #f8fafc;
}
.schedule-lines i {
  height: 46px;
}
.list-lines i {
  height: 42px;
  border: 1px solid #eef2f7;
  background: #fff;
}
.fake-ring {
  width: 128px;
  height: 128px;
  display: grid;
  place-items: center;
  margin: 8px auto 0;
  border: 14px solid #f3f4f6;
  border-top-color: #10b981;
  border-right-color: #f97316;
  border-radius: 999px;
  text-align: center;
}
.fake-ring strong {
  display: block;
  color: #0f172a;
  font-size: 22px;
}
.fake-ring span {
  display: block;
  color: #8a91a4;
  font-size: 12px;
}
.quick-dots {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
.quick-dots i {
  height: 58px;
  border-radius: 12px;
  background: #f8fafc;
}
.preview-city-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.preview-generic-summary {
  height: 100%;
  min-height: 154px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.sum {
  padding: 22px;
  border: 1px solid #eceff5;
  border-radius: 14px;
  background: #fff;
}
.sum.primary {
  background: linear-gradient(135deg, #4f46e5, #8b5cf6);
  color: #fff;
  border: 0;
}
.sum strong {
  display: block;
  margin-bottom: 6px;
  color: #4f46e5;
  font-size: 30px;
}
.sum.primary strong {
  color: #fff;
}
.sum span {
  color: #8a91a4;
  font-size: 13px;
}
.sum.primary span {
  color: rgba(255,255,255,0.82);
}
.page-preview-head {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.page-preview-head .eyebrow-line {
  width: 118px;
  height: 12px;
  margin-bottom: 14px;
  border-radius: 999px;
  background: #e0e7ff;
}
.page-preview-head h3 {
  margin: 0 0 8px;
  color: #0f172a;
  font-size: 24px;
}
.page-preview-head p {
  margin: 0;
  color: #8a91a4;
}
.head-action-lines {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.head-action-lines i {
  width: 92px;
  height: 34px;
  border-radius: 9px;
  background: #eef2ff;
}
.head-action-lines i + i {
  background: #6d5df6;
}
.chip-lines {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.chip-lines i {
  width: 86px;
  height: 32px;
  border-radius: 999px;
  background: #eef2ff;
}
.calendar-grid-preview {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}
.calendar-grid-preview i {
  height: 42px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}
.form-lines {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.form-lines i {
  height: 38px;
  border-radius: 9px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}
.form-lines .wide {
  grid-column: span 2;
  height: 66px;
}
.chart-bars {
  display: flex;
  align-items: end;
  gap: 12px;
  height: 110px;
}
.chart-bars i {
  flex: 1;
  border-radius: 10px 10px 4px 4px;
  background: linear-gradient(180deg, #818cf8, #c7d2fe);
}
.chart-bars i:nth-child(1) { height: 48%; }
.chart-bars i:nth-child(2) { height: 72%; }
.chart-bars i:nth-child(3) { height: 58%; }
.chart-bars i:nth-child(4) { height: 88%; }
.chart-bars i:nth-child(5) { height: 64%; }
.generic-blocks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.generic-blocks i {
  height: 72px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}
@media (max-width: 1180px) {
  .layout-editor {
    grid-template-columns: 1fr;
  }
  .layout-editor-head,
  .layout-page-switch {
    grid-column: auto;
  }
  .layout-module {
    grid-column: span 12 !important;
  }
}
</style>
