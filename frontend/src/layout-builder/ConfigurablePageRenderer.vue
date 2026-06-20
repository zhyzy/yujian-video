<template>
  <div class="configurable-grid" :style="{ '--layout-columns': layout.columns || 12 }">
    <div v-if="activeBindingRows.length" class="layout-binding-status">
      <span>页面布局控制中</span>
      <b v-for="item in activeBindingRows" :key="item.field">
        {{ item.label }}：{{ item.valueText }}
        <button type="button" @click="clearBinding(item.field)">×</button>
      </b>
    </div>
    <template v-for="module in visibleModules" :key="module.key">
      <div class="configurable-module" :class="{ 'size-editing': sizeEditMode, 'has-fixed-height': hasFixedHeight(module) }" :style="moduleStyle(module)">
        <div class="module-scroll">
          <slot :name="slotName(module)" :module="module">
            <ModuleFallbackCard :module="module" :page-key="pageKey" />
          </slot>
        </div>
        <button
          v-if="sizeEditMode"
          class="runtime-resize-handle"
          type="button"
          title="拖动调整模块大小"
          @pointerdown.stop.prevent="startResize($event, module)"
        ></button>
      </div>
    </template>
  </div>

  <button
    v-if="canEditLayout"
    class="layout-toggle-btn"
    :class="{ expanded: panelExpanded }"
    type="button"
    @click.stop="panelExpanded = !panelExpanded"
    :title="panelExpanded ? '收起布局编辑面板' : '展开布局编辑面板'"
  >
    <span>{{ panelExpanded ? '›' : '‹' }}</span>
  </button>

  <div v-if="canEditLayout" class="layout-panel" :class="{ expanded: panelExpanded }">
    <div class="panel-header">
      <span>布局编辑</span>
    </div>
    <div class="panel-body">
      <div class="panel-tip">
        <span>拖动模块右下角调整大小</span>
      </div>
      <div class="panel-actions">
        <button
          v-if="!sizeEditMode"
          class="action-btn primary"
          type="button"
          @click.stop="startSizeEdit()"
        >
          开始编辑
        </button>
        <template v-else>
          <button class="action-btn ghost" type="button" @click.stop="cancelSizeEdit()">
            取消编辑
          </button>
          <button
            class="action-btn primary"
            type="button"
            :disabled="saving"
            @click.stop="saveSizeEdit()"
          >
            {{ saving ? '保存中...' : '保存布局' }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { addLayoutSnapshot, loadSystemSettings, persistSystemSettingsToRemote, syncSystemSettingsFromRemote } from '@/utils/systemSettings'
import { normalizeLayout } from './moduleCatalog'
import ModuleFallbackCard from './ModuleFallbackCard.vue'
import { getPageBindingFields } from './fieldBindingCatalog'
import { clearLayoutBindingValue, useLayoutBindings } from './layoutBindings'
import { isCityUser } from '@/utils/authRole'

const props = defineProps({
  pageKey: { type: String, required: true },
  modules: { type: Array, default: () => [] }
})

const settings = ref(loadSystemSettings())
const { bindings } = useLayoutBindings(props.pageKey)
const sizeEditMode = ref(false)
const saving = ref(false)
const resizeState = ref(null)
const editBackup = ref(null)
const panelExpanded = ref(false)
const readCurrentUser = () => {
  try { return JSON.parse(localStorage.getItem('auth_user') || '{}') }
  catch { return {} }
}
const canEditLayout = computed(() => !isCityUser(readCurrentUser()))

const refreshSettings = (event) => {
  settings.value = event?.detail || loadSystemSettings()
}

const layout = computed(() => {
  const saved = settings.value.layouts?.[props.pageKey] || {}
  const normalized = normalizeLayout(props.pageKey, saved)
  if (!props.modules.length) return normalized
  const pageModules = props.modules.map((module, index) => ({
    ...module,
    order: module.order ?? (index + 1) * 10
  }))
  const pageModuleMap = new Map(pageModules.flatMap((module) => {
    const keys = [module.key, module.componentKey].filter(Boolean)
    return keys.map((key) => [key, module])
  }))
  const validModules = normalized.modules
    .filter((module) => pageModuleMap.has(module.componentKey || module.key))
    .map((module) => ({
      ...(pageModuleMap.get(module.componentKey || module.key) || {}),
      ...module
    }))
  return {
    ...normalized,
    modules: validModules.length ? validModules : pageModules
  }
})

const visibleModules = computed(() => layout.value.modules.filter((module) => module.visible !== false))
const safeSpan = (span) => Math.min(12, Math.max(3, Number(span || 6)))
const safeHeight = (height) => {
  const value = Number(height || 0)
  return value > 0 ? Math.min(1200, Math.max(120, value)) : 0
}
const moduleStyle = (module) => {
  const height = safeHeight(module.height)
  return {
    gridColumn: `span ${safeSpan(module.span)}`,
    minHeight: height ? `${height}px` : undefined,
    height: height ? `${height}px` : undefined
  }
}
const hasFixedHeight = (module) => safeHeight(module.height) > 0
const slotName = (module) => module.componentKey || module.key
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
  const fields = getPageBindingFields(props.pageKey)
  const fieldMap = new Map(fields.map((field) => [field.field, field]))
  return Object.entries(bindings.value || {})
    .filter(([, value]) => hasBindingValue(value))
    .map(([field, value]) => ({
      field,
      label: fieldMap.get(field)?.label || field,
      valueText: formatBindingValue(value)
    }))
})
const clearBinding = (field) => {
  clearLayoutBindingValue(props.pageKey, field)
}
const ensureEditableLayout = () => {
  settings.value.layouts = settings.value.layouts || {}
  settings.value.layouts[props.pageKey] = normalizeLayout(props.pageKey, settings.value.layouts[props.pageKey])
  return settings.value.layouts[props.pageKey]
}
const findEditableModule = (module) => {
  const editableLayout = ensureEditableLayout()
  return editableLayout.modules.find((item) => item.key === module.key) || module
}
const startSizeEdit = () => {
  ensureEditableLayout()
  editBackup.value = JSON.parse(JSON.stringify(settings.value.layouts?.[props.pageKey] || {}))
  sizeEditMode.value = true
}
const cancelSizeEdit = () => {
  if (editBackup.value) {
    settings.value.layouts[props.pageKey] = editBackup.value
  }
  sizeEditMode.value = false
  editBackup.value = null
  stopResize()
  panelExpanded.value = false
}
const startResize = (event, module) => {
  const target = findEditableModule(module)
  const gridRect = event.currentTarget.closest('.configurable-grid')?.getBoundingClientRect()
  const moduleRect = event.currentTarget.closest('.configurable-module')?.getBoundingClientRect()
  if (!gridRect || !moduleRect) return
  resizeState.value = {
    module: target,
    startX: event.clientX,
    startY: event.clientY,
    startSpan: safeSpan(target.span),
    startHeight: safeHeight(target.height) || moduleRect.height,
    columnWidth: gridRect.width / Number(layout.value.columns || 12)
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
const saveSizeEdit = async () => {
  saving.value = true
  try {
    ensureEditableLayout()
    addLayoutSnapshot(settings.value, '业务页面调整布局大小')
    const next = await persistSystemSettingsToRemote(settings.value)
    settings.value = {
      ...settings.value,
      ...next,
      layoutHistory: Array.isArray(next?.layoutHistory) && next.layoutHistory.length
        ? next.layoutHistory
        : settings.value.layoutHistory
    }
    sizeEditMode.value = false
    editBackup.value = null
    panelExpanded.value = false
    ElMessage.success('布局大小已保存')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  window.addEventListener('system-settings-updated', refreshSettings)
  window.addEventListener('storage', refreshSettings)
  try {
    settings.value = await syncSystemSettingsFromRemote()
  } catch (error) {
    ElMessage.warning(`后台布局配置加载失败，已使用本地缓存：${error?.message || '未知错误'}`)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('system-settings-updated', refreshSettings)
  window.removeEventListener('storage', refreshSettings)
  stopResize()
})

watch(() => props.pageKey, () => {
  settings.value = loadSystemSettings()
})
</script>

<style scoped>
.configurable-grid {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(var(--layout-columns), minmax(0, 1fr));
  gap: 20px;
  align-items: stretch;
  justify-items: stretch;
}
.layout-binding-status {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 12px;
}
.layout-binding-status span {
  font-weight: 900;
  color: #1e3a8a;
}
.layout-binding-status b {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 999px;
  background: #fff;
  color: #334155;
  font-weight: 800;
}
.layout-binding-status button {
  width: 16px;
  height: 16px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: #e5e7eb;
  color: #475569;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
}
.layout-binding-status button:hover {
  background: #fee2e2;
  color: #dc2626;
}
.layout-toggle-btn {
  position: fixed;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  width: 28px;
  height: 60px;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-right: none;
  border-radius: 8px 0 0 8px;
  background: #fff;
  color: #64748b;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.25s ease;
  box-shadow: -2px 0 8px rgba(0,0,0,0.06);
}
.layout-toggle-btn:hover {
  background: #f1f5f9;
  color: #475569;
  box-shadow: -4px 0 12px rgba(0,0,0,0.1);
}
.layout-toggle-btn.expanded {
  right: 180px;
  background: #eef2ff;
  color: #6366f1;
}
.layout-panel {
  position: fixed;
  right: -180px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 999;
  width: 180px;
  border: 1px solid #e5e7eb;
  border-radius: 12px 0 0 12px;
  background: #fff;
  box-shadow: -4px 0 20px rgba(0,0,0,0.1);
  transition: right 0.25s ease;
}
.layout-panel.expanded {
  right: 0;
}
.layout-panel .panel-header {
  padding: 14px 16px;
  border-bottom: 1px solid #f1f5f9;
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
}
.layout-panel .panel-body {
  padding: 12px;
}
.layout-panel .panel-tip {
  margin-bottom: 12px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  font-size: 11px;
  color: #64748b;
}
.layout-panel .panel-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.layout-panel .action-btn {
  height: 32px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.layout-panel .action-btn:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}
.layout-panel .action-btn.primary {
  border-color: #6366f1;
  background: #6366f1;
  color: #fff;
}
.layout-panel .action-btn.primary:hover {
  background: #4f46e5;
  border-color: #4f46e5;
}
.layout-panel .action-btn.ghost {
  border-color: #e5e7eb;
  background: #f8fafc;
  color: #64748b;
}
.layout-panel .action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.configurable-module {
  position: relative;
  min-width: 0;
  width: 100%;
  display: flex;
  min-height: 0;
  overflow: hidden;
}
.module-scroll {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  overflow: visible;
  scrollbar-width: thin;
}
.configurable-module.has-fixed-height .module-scroll {
  overflow: auto;
  overscroll-behavior: auto;
}
.module-scroll > :deep(*) {
  min-height: 100%;
}
.module-scroll::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.module-scroll::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.55);
  background-clip: padding-box;
}
.module-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.configurable-module.size-editing {
  outline: 1px dashed #818cf8;
  outline-offset: 4px;
  border-radius: 12px;
}
.runtime-resize-handle {
  position: absolute;
  right: 6px;
  bottom: 6px;
  z-index: 20;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 1px solid #c7d2fe;
  border-radius: 7px;
  background:
    linear-gradient(135deg, transparent 0 48%, #4f46e5 50% 58%, transparent 60%),
    linear-gradient(135deg, transparent 0 66%, #4f46e5 68% 76%, transparent 78%),
    #eef2ff;
  cursor: nwse-resize;
  box-shadow: 0 8px 18px rgba(79, 70, 229, 0.18);
}
@media (max-width: 1200px) {
  .configurable-grid {
    gap: 16px;
  }
}
@media (max-width: 900px) {
  .configurable-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  .configurable-module {
    grid-column: span 12 !important;
    height: auto !important;
  }
}
</style>
