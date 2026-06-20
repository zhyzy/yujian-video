export const basicControls = [
  { key: 'control-checkbox', title: '复选框', span: 4, visible: true, config: { label: '是否启用', defaultValue: true, helpText: '用于单项勾选或确认状态' } },
  { key: 'control-color', title: '颜色选择', span: 4, visible: true, config: { defaultValue: '#6366f1', helpText: '支持透明度和预设色板' } },
  { key: 'control-date', title: '日期选择', span: 4, visible: true, config: { placeholder: '请选择日期', helpText: '选择单个日期' } },
  { key: 'control-datetime', title: '日期时间选择', span: 4, visible: true, config: { placeholder: '请选择日期时间', helpText: '选择日期和精确时间' } },
  { key: 'control-counter', title: '计数器', span: 4, visible: true, config: { defaultValue: 10, min: 0, max: 100, helpText: '通过步进器调整数字' } },
  { key: 'control-radio', title: '单选框', span: 4, visible: true, config: { options: '抖音\n快手\n视频号', defaultValue: '抖音', helpText: '从多个选项中选择一个' } },
  { key: 'control-select', title: '选择器', span: 4, visible: true, config: { options: '全部\n待发布\n已发布', placeholder: '请选择状态', helpText: '下拉选择单个选项' } },
  { key: 'control-multi-select', title: '选择器多选', span: 4, visible: true, config: { options: '总部\n城市\n其他', placeholder: '请选择范围', helpText: '下拉选择多个选项' } },
  { key: 'control-slider', title: '滑块', span: 4, visible: true, config: { defaultValue: 40, min: 0, max: 100, helpText: '拖动调整数值区间' } },
  { key: 'control-switch', title: '开关', span: 4, visible: true, config: { defaultValue: true, helpText: '用于开启或关闭状态' } },
  { key: 'control-input', title: '文本框', span: 4, visible: true, config: { placeholder: '请输入内容', defaultValue: '运营标题', helpText: '单行文本输入' } },
  { key: 'control-textarea', title: '文本域', span: 4, visible: true, config: { placeholder: '请输入备注', defaultValue: '这里填写多行说明内容', helpText: '多行文本输入' } },
  { key: 'control-time', title: '时间选择', span: 4, visible: true, config: { placeholder: '请选择时间', helpText: '选择具体时间点' } },
  { key: 'control-rich-text', title: '富文本', span: 6, visible: true, config: { defaultValue: '支持标题、加粗、链接和图片等编辑能力。', helpText: '用于编辑图文内容' } },
  { key: 'control-json', title: 'JSON编辑', span: 6, visible: true, config: { defaultValue: '{"status":200,"enabled":true}', helpText: '用于展示和编辑结构化配置' } }
]

export const layoutControls = [
  { key: 'layout-divider', title: '分割标题', span: 12, visible: true, config: { label: '分组标题' } },
  { key: 'layout-alert', title: '提示', span: 12, visible: true, config: { label: '操作提醒', alertType: 'info', helpText: '请确认素材已上传后再提交发布。' } },
  { key: 'layout-tabs', title: '标签页', span: 12, visible: true, config: { options: '全部\n待处理\n已完成' } },
  { key: 'layout-collapse', title: '折叠面板', span: 12, visible: true, config: { helpText: '收纳次要信息，减少页面纵向占用' } },
  { key: 'layout-grid', title: '栅格布局', span: 12, visible: true, config: { columns: 3, helpText: '用于组织多列内容区域' } },
  { key: 'layout-table', title: '表格布局', span: 12, visible: true, config: { helpText: '用于展示结构化表格内容' } }
]

export const clonePaletteModule = (module) => ({
  ...module,
  config: JSON.parse(JSON.stringify(module.config || {}))
})
