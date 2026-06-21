export const layoutPages = [
  { key: 'dashboard', scope: 'admin', label: '总部工作台', description: '管理员首页的指标、排期、AI 和快捷入口' },
  { key: 'materialEntry', scope: 'admin', label: '素材录入', description: '录入表单、上传区、今日概览和文件列表' },
  { key: 'materialList', scope: 'admin', label: '素材列表', description: '素材筛选、分组列表、空状态和批量操作' },
  { key: 'videoTypes', scope: 'admin', label: '类型管理', description: '素材类型配置和分类管理' },
  { key: 'publishCalendar', scope: 'admin', label: '发布日历', description: '月度排期、平台统计和日期详情' },
  { key: 'publishList', scope: 'admin', label: '发布计划', description: '发布指标、筛选条件、计划矩阵和提示区' },
  { key: 'publishLedger', scope: 'admin', label: '发布台账', description: '发布记录、统计筛选和执行登记' },
  { key: 'cityBoard', scope: 'admin', label: '城市看板', description: '城市分发、状态统计和下发记录' },
  { key: 'cityList', scope: 'admin', label: '城市管理', description: '城市列表、筛选和运营配置' },
  { key: 'dataOverview', scope: 'admin', label: '数据总览', description: '数据指标、趋势图和明细分析' },
  { key: 'aiReports', scope: 'admin', label: 'AI 日报', description: '日报生成、报告列表和内容预览' },
  { key: 'hqAccounts', scope: 'admin', label: '总部账号', description: '总部账号列表和配置项' },
  { key: 'cityAccounts', scope: 'admin', label: '城市账号', description: '城市账号列表和配置项' },
  { key: 'otherAccounts', scope: 'admin', label: '其他账号', description: '其他账号列表和配置项' },
  { key: 'accountManagement', scope: 'admin', label: '系统账号', description: '后台登录账号、角色和权限维护' },
  { key: 'cityWorkbench', scope: 'city', label: '城市工作台', description: '城市账号登录后的任务与提醒页面' },
  { key: 'cityTasks', scope: 'city', label: '我的任务', description: '城市账号任务列表和处理入口' },
  { key: 'cityPublishSubmit', scope: 'city', label: '发布填报', description: '城市账号发布结果填报页面' },
  { key: 'cityDataEntry', scope: 'city', label: '数据录入', description: '城市账号播放、点赞、成交数据录入' },
  { key: 'cityNotifications', scope: 'city', label: '通知中心', description: '城市账号通知和消息列表' }
]

export const layoutModuleCatalog = {
  dashboard: [
    { key: 'month-progress', title: '月度完成度', span: 3, visible: true, lockable: true },
    { key: 'today-published', title: '已发布数量', span: 3, visible: true },
    { key: 'today-pending', title: '待发布', span: 3, visible: true },
    { key: 'month-published', title: '本月合计发布', span: 3, visible: true },
    { key: 'production-summary', title: '今日产量汇总', span: 8, visible: true },
    { key: 'ai-overview', title: 'AI 今日速览', span: 4, visible: true },
    { key: 'publish-schedule', title: '今日发布排期', span: 8, visible: true },
    { key: 'city-distribution', title: '城市发布分布', span: 4, visible: true },
    { key: 'overdue-tasks', title: '超期处理', span: 8, visible: true },
    { key: 'quick-links', title: '快捷入口', span: 4, visible: true }
  ],
  cityWorkbench: [
    { key: 'city-summary', title: '城市数据概览', span: 12, visible: true, lockable: true },
    { key: 'city-tasks', title: '今日任务列表', span: 7, visible: true },
    { key: 'city-notices', title: '运营提醒', span: 5, visible: true },
    { key: 'publish-schedule', title: '今日发布排期', span: 12, visible: true }
  ],
  materialEntry: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'entry-form', title: '素材录入表单', span: 7, visible: true },
    { key: 'entry-side', title: '上传与今日概览', span: 5, visible: true }
  ],
  materialList: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'filter-panel', title: '筛选区', span: 12, visible: true },
    { key: 'file-groups', title: '素材文件列表', span: 12, visible: true }
  ],
  videoTypes: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'type-form', title: '统计概览', span: 12, visible: true },
    { key: 'type-list', title: '类型列表', span: 12, visible: true }
  ],
  publishCalendar: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'legend-strip', title: '平台统计', span: 12, visible: true },
    { key: 'calendar-wrap', title: '发布日历', span: 8, visible: true },
    { key: 'detail-panel', title: '日期详情', span: 4, visible: true }
  ],
  publishList: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'summary-row', title: '发布指标', span: 12, visible: true },
    { key: 'toolbar', title: '筛选工具栏', span: 12, visible: true },
    { key: 'plan-panel', title: '发布计划矩阵', span: 12, visible: true },
    { key: 'hint-panel', title: '使用提示', span: 12, visible: true }
  ],
  publishLedger: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'summary-row', title: '台账指标', span: 12, visible: true },
    { key: 'toolbar', title: '筛选工具栏', span: 12, visible: true },
    { key: 'ledger-table', title: '发布台账表格', span: 12, visible: true }
  ],
  cityBoard: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'summary-row', title: '城市指标', span: 12, visible: true },
    { key: 'board-table', title: '城市分发看板', span: 8, visible: true },
    { key: 'side-panel', title: '下发与记录', span: 4, visible: true }
  ],
  cityList: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'toolbar', title: '筛选工具栏', span: 12, visible: true },
    { key: 'city-table', title: '城市列表', span: 12, visible: true }
  ],
  dataOverview: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'summary-row', title: '数据指标', span: 12, visible: true },
    { key: 'chart-panel', title: '趋势图表', span: 7, visible: true },
    { key: 'account-overview-panel', title: '账号数据概览', span: 5, visible: true },
    { key: 'data-detail-panel', title: '数据明细', span: 12, visible: true }
  ],
  aiReports: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'generate-panel', title: '生成日报', span: 5, visible: true },
    { key: 'report-list', title: '日报列表', span: 5, visible: true },
    { key: 'report-content', title: '报告内容', span: 7, visible: true }
  ],
  hqAccounts: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'toolbar', title: '筛选工具栏', span: 12, visible: true },
    { key: 'account-table', title: '账号列表', span: 12, visible: true }
  ],
  cityAccounts: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'toolbar', title: '筛选工具栏', span: 12, visible: true },
    { key: 'account-table', title: '账号列表', span: 12, visible: true }
  ],
  otherAccounts: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'toolbar', title: '筛选工具栏', span: 12, visible: true },
    { key: 'account-table', title: '账号列表', span: 12, visible: true }
  ],
  accountManagement: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'toolbar', title: '账号操作区', span: 12, visible: true },
    { key: 'user-table', title: '系统账号列表', span: 12, visible: true }
  ],
  cityTasks: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'toolbar', title: '任务筛选', span: 12, visible: true },
    { key: 'task-list', title: '任务列表', span: 12, visible: true }
  ],
  cityPublishSubmit: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'summary-row', title: '发布统计', span: 12, visible: true },
    { key: 'record-grid', title: '发布记录', span: 12, visible: true }
  ],
  cityDataEntry: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'filter-panel', title: '筛选区', span: 12, visible: true },
    { key: 'record-list', title: '数据记录', span: 12, visible: true }
  ],
  cityNotifications: [
    { key: 'page-head', title: '页面头部', span: 12, visible: true },
    { key: 'notification-list', title: '通知列表', span: 12, visible: true }
  ]
}

export const buildDefaultLayouts = () => Object.fromEntries(
  Object.entries(layoutModuleCatalog).map(([pageKey, modules]) => [
    pageKey,
    {
      pageKey,
      columns: 12,
      modules: modules.map((module, index) => ({
        ...module,
        order: (index + 1) * 10,
        config: module.config || {}
      }))
    }
  ])
)

const deprecatedModuleKeys = {
  dataOverview: ['rank-panel']
}

export const normalizeLayout = (pageKey, savedLayout = {}) => {
  const defaults = buildDefaultLayouts()[pageKey] || { pageKey, columns: 12, modules: [] }
  const deprecatedKeys = new Set(deprecatedModuleKeys[pageKey] || [])
  const savedModules = Array.isArray(savedLayout.modules)
    ? savedLayout.modules.filter((module) => !deprecatedKeys.has(module.key))
    : []
  const removedKeys = Array.isArray(savedLayout.removedKeys)
    ? savedLayout.removedKeys.filter((key) => !deprecatedKeys.has(key))
    : []
  const removedSet = new Set(removedKeys)
  const savedMap = new Map(savedModules.map((module) => [module.key, module]))
  const merged = defaults.modules
    .filter((module) => !removedSet.has(module.key))
    .map((module, index) => ({
      ...module,
      ...(savedMap.get(module.key) || {}),
      order: Number(savedMap.get(module.key)?.order ?? module.order ?? (index + 1) * 10),
      span: Number(savedMap.get(module.key)?.span ?? module.span ?? 6),
      height: Number(savedMap.get(module.key)?.height ?? module.height ?? 0),
      visible: savedMap.get(module.key)?.visible ?? module.visible ?? true
    }))
  const extra = savedModules
    .filter((module) => !module.removed && !removedSet.has(module.key) && !defaults.modules.some((item) => item.key === module.key))
    .map((module) => ({
      ...module,
      span: Number(module.span ?? 6),
      height: Number(module.height ?? 0)
    }))
  return {
    ...defaults,
    ...savedLayout,
    removedKeys,
    modules: [...merged, ...extra].sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
  }
}
