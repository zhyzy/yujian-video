<template>
  <section class="builder-preview" :class="{ layout: isLayout }">
    <header v-if="!['layout-divider'].includes(key)">
      <div>
        <h3>{{ module.title }}</h3>
        <p>{{ config.helpText || description }}</p>
      </div>
      <b v-if="config.required">必填</b>
    </header>

    <div v-if="key === 'control-checkbox'" class="field-line">
      <el-checkbox v-model="checkboxValue">{{ config.label || module.title }}</el-checkbox>
    </div>

    <div v-else-if="key === 'control-color'" class="field-line color-line">
      <el-color-picker v-model="colorValue" show-alpha :predefine="predefineColors" />
      <span>{{ colorValue }}</span>
    </div>

    <div v-else-if="key === 'control-date'" class="field-line">
      <el-date-picker v-model="dateValue" type="date" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-datetime'" class="field-line">
      <el-date-picker v-model="dateTimeValue" type="datetime" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-counter'" class="field-line">
      <el-input-number v-model="numberValue" :min="Number(config.min ?? 0)" :max="Number(config.max ?? 999)" />
    </div>

    <div v-else-if="key === 'control-radio'" class="field-line">
      <el-radio-group v-model="singleValue">
        <el-radio v-for="option in options" :key="option" :value="option">{{ option }}</el-radio>
      </el-radio-group>
    </div>

    <div v-else-if="key === 'control-select'" class="field-line">
      <el-select v-model="singleValue" :placeholder="placeholder">
        <el-option v-for="option in options" :key="option" :label="option" :value="option" />
      </el-select>
    </div>

    <div v-else-if="key === 'control-multi-select'" class="field-line">
      <el-select v-model="multiValue" multiple :placeholder="placeholder">
        <el-option v-for="option in options" :key="option" :label="option" :value="option" />
      </el-select>
    </div>

    <div v-else-if="key === 'control-slider'" class="field-line slider-line">
      <el-slider v-model="numberValue" :min="Number(config.min ?? 0)" :max="Number(config.max ?? 100)" show-input />
    </div>

    <div v-else-if="key === 'control-switch'" class="field-line">
      <el-switch v-model="checkboxValue" active-text="开启" inactive-text="关闭" />
    </div>

    <div v-else-if="key === 'control-input'" class="field-line">
      <el-input v-model="textValue" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-textarea'" class="field-line">
      <el-input v-model="textValue" type="textarea" :rows="3" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-time'" class="field-line">
      <el-time-picker v-model="timeValue" :placeholder="placeholder" />
    </div>

    <div v-else-if="key === 'control-rich-text'" class="rich-text-box">
      <div class="rich-toolbar"><i>B</i><i>I</i><i>H1</i><i>链接</i><i>图片</i></div>
      <div class="rich-body" contenteditable="true">{{ textValue }}</div>
    </div>

    <div v-else-if="key === 'control-json'" class="json-box">
      <pre>{{ formattedJson }}</pre>
    </div>

    <div v-else-if="key === 'layout-divider'" class="divider-preview">
      <span>{{ config.label || module.title }}</span>
    </div>

    <el-alert
      v-else-if="key === 'layout-alert'"
      :title="config.label || module.title"
      :description="config.helpText || '用于在页面中展示重要提醒、操作说明或状态提示。'"
      :type="config.alertType || 'info'"
      show-icon
      :closable="false"
    />

    <el-tabs v-else-if="key === 'layout-tabs'" class="tabs-preview" model-value="tab1">
      <el-tab-pane v-for="option in options.slice(0, 4)" :key="option" :label="option" :name="option">
        <div class="tab-content">{{ option }}内容区，可继续承载业务模块。</div>
      </el-tab-pane>
    </el-tabs>

    <el-collapse v-else-if="key === 'layout-collapse'" model-value="panel1">
      <el-collapse-item title="基础信息" name="panel1">
        <div class="collapse-content">这里展示折叠面板内容。</div>
      </el-collapse-item>
      <el-collapse-item title="更多设置" name="panel2">
        <div class="collapse-content">支持把说明、表单或列表收纳起来。</div>
      </el-collapse-item>
    </el-collapse>

    <div v-else-if="key === 'layout-grid'" class="grid-preview" :style="{ gridTemplateColumns: `repeat(${Number(config.columns || 3)}, minmax(0, 1fr))` }">
      <i v-for="n in Number(config.columns || 3) * 2" :key="n"></i>
    </div>

    <div v-else-if="key === 'layout-table'" class="table-preview">
      <table>
        <thead><tr><th>字段</th><th>状态</th><th>操作</th></tr></thead>
        <tbody>
          <tr v-for="row in ['素材审核', '发布计划', '数据回填']" :key="row">
            <td>{{ row }}</td><td>正常</td><td>查看</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { getLayoutBindingKey, getLayoutBindingValue, setLayoutBindingValue } from './layoutBindings'

const props = defineProps({
  module: { type: Object, required: true },
  pageKey: { type: String, default: '' }
})

const key = computed(() => props.module.componentKey || props.module.key || '')
const config = computed(() => props.module.config || {})
const fieldName = computed(() => getLayoutBindingKey(props.module))
const isLayout = computed(() => key.value.startsWith('layout-'))
const placeholder = computed(() => config.value.placeholder || `请输入${props.module.title}`)
const options = computed(() => String(config.value.options || '选项一\n选项二\n选项三').split(/\n|,/).map((item) => item.trim()).filter(Boolean))
const description = computed(() => isLayout.value ? '页面结构与内容容器' : '可配置表单控件')

const initialValue = (fallback) => getLayoutBindingValue(props.pageKey, fieldName.value, fallback)
const checkboxValue = ref(Boolean(initialValue(config.value.defaultValue ?? true)))
const colorValue = ref(initialValue(config.value.defaultValue || '#6366f1'))
const dateValue = ref(initialValue(config.value.defaultValue || ''))
const dateTimeValue = ref(initialValue(config.value.defaultValue || ''))
const numberValue = ref(Number(initialValue(config.value.defaultValue ?? 30)))
const singleValue = ref(initialValue(config.value.defaultValue || options.value[0] || ''))
const multiValue = ref(initialValue(Array.isArray(config.value.defaultValue) ? config.value.defaultValue : options.value.slice(0, 2)))
const textValue = ref(initialValue(config.value.defaultValue || '这是一段可编辑内容'))
const timeValue = ref(initialValue(config.value.defaultValue || ''))

const predefineColors = ['#4f46e5', '#10b981', '#f97316', '#ef4444', '#111827', '#f8fafc']
const formattedJson = computed(() => {
  try {
    return JSON.stringify(JSON.parse(config.value.defaultValue || '{"status":200,"title":"页面组件","enabled":true}'), null, 2)
  } catch {
    return config.value.defaultValue || '{}'
  }
})

watch(config, () => {
  textValue.value = config.value.defaultValue || textValue.value
})

const bindValue = (source) => {
  watch(source, (value) => {
    setLayoutBindingValue(props.pageKey, fieldName.value, value)
  }, { deep: true })
}

;[
  checkboxValue,
  colorValue,
  dateValue,
  dateTimeValue,
  numberValue,
  singleValue,
  multiValue,
  textValue,
  timeValue
].forEach(bindValue)
</script>

<style scoped>
.builder-preview {
  height: 100%;
  min-height: 200px;
  padding: 24px;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  background: #fff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.builder-preview.layout {
  background: #f9fafb;
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
h3,
p {
  margin: 0;
}
h3 {
  color: #0f172a;
  font-size: 15px;
}
p {
  margin-top: 5px;
  color: #8a91a4;
  font-size: 13px;
}
header b {
  padding: 4px 8px;
  border-radius: 8px;
  background: #fee2e2;
  color: #dc2626;
  font-size: 12px;
}
.field-line {
  display: flex;
  align-items: center;
  gap: 12px;
}
.field-line :deep(.el-select),
.field-line :deep(.el-input),
.field-line :deep(.el-date-editor),
.field-line :deep(.el-input-number) {
  width: 100%;
}
.color-line span {
  color: #64748b;
  font-size: 13px;
}
.slider-line {
  display: block;
}
.rich-text-box,
.json-box {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}
.rich-toolbar {
  display: flex;
  gap: 6px;
  padding: 8px;
  border-bottom: 1px solid #eef0f6;
  background: #f8fafc;
}
.rich-toolbar i {
  padding: 4px 7px;
  border-radius: 6px;
  background: #fff;
  color: #334155;
  font-size: 12px;
  font-style: normal;
  font-weight: 800;
}
.rich-body {
  min-height: 72px;
  padding: 12px;
  color: #334155;
  outline: 0;
}
.json-box pre {
  max-height: 150px;
  margin: 0;
  padding: 14px;
  overflow: auto;
  color: #334155;
  font-size: 12px;
  line-height: 1.6;
}
.divider-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #0f172a;
  font-weight: 900;
}
.divider-preview::before,
.divider-preview::after {
  content: "";
  height: 1px;
  flex: 1;
  background: #dfe3ec;
}
.tabs-preview :deep(.el-tabs__content) {
  padding-top: 8px;
}
.tab-content,
.collapse-content {
  padding: 14px;
  border-radius: 10px;
  background: #f8fafc;
  color: #64748b;
  font-size: 13px;
}
.grid-preview {
  display: grid;
  gap: 10px;
}
.grid-preview i {
  min-height: 56px;
  border: 1px dashed #c7d2fe;
  border-radius: 10px;
  background: #f8faff;
}
.table-preview table {
  width: 100%;
  border-collapse: collapse;
  overflow: hidden;
  border-radius: 10px;
  font-size: 13px;
}
.table-preview th,
.table-preview td {
  padding: 10px;
  border-bottom: 1px solid #eef0f6;
  text-align: left;
}
.table-preview th {
  background: #f8fafc;
  color: #64748b;
}
</style>
