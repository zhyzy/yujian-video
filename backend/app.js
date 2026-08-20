const express = require('express');
require('./env');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');
const dayjs = require('dayjs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const COS = require('cos-nodejs-sdk-v5');
const fs = require('fs');
const path = require('path');
const { publishShotUploadsDir, uploadsDir } = require('./config/paths');
const logger = require('./lib/logger');
const { success, error } = require('./lib/response');
const { sanitizeBody, validateRequired } = require('./lib/validation');
const cityDistributionWorkflow = require('./lib/cityDistributionWorkflow');
const {
  clearLoginAttempt,
  getLoginAttempt,
  loginAttemptKey,
  registerLoginFailure
} = require('./lib/loginAttempts');
const { createAuth, isCityRole } = require('./lib/auth');
const createRequestLogger = require('./middleware/requestLogger');
const createAuthRoutes = require('./routes/auth');
const createSystemSettingsRoutes = require('./routes/systemSettings');
const createDataEaseOpenApiRoutes = require('./routes/dataEaseOpenApi');
const createSystemUsersRoutes = require('./routes/systemUsers');
const createCommonRoutes = require('./routes/common');
const createSystemMaintenanceRoutes = require('./routes/systemMaintenance');
const createH5VideoTaskRoutes = require('./routes/h5VideoTasks');
const createCosStorage = require('./lib/cosStorage');
const createUpyunStorage = require('./lib/upyunStorage');
const {
  createProtectedMediaRoutes,
  createPublicMediaRoutes
} = require('./routes/media');

const app = express();
app.locals.logger = logger;
app.use(createRequestLogger(logger));

const aiService = require('./services/ai');
const systemSettingsService = require('./services/systemSettings').createSystemSettingsService(db);
const {
  getCosClient,
  getCosPreviewUrl,
  getStorageConfig,
  normalizeCosKey,
  validatePreviewUrl
} = createCosStorage({ COS, systemSettingsService, validateRequired });
const upyunStorage = createUpyunStorage({ systemSettingsService, validateRequired });
const {
  deleteObject: deleteUpyunObject,
  signFormPolicy
} = upyunStorage;
app.use(cors());
app.use(bodyParser.json({ limit: '120mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '120mb' }));
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '30d',
  immutable: true
}));
app.use('/api/uploads', express.static(uploadsDir, {
  maxAge: '30d',
  immutable: true
}));

const distPath = path.join(__dirname, '../frontend/dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get(/^\/(?!api\/|uploads\/).*/, (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const generateId = () => crypto.randomUUID();
const h5VideoTaskRoutes = createH5VideoTaskRoutes({
  crypto,
  dayjs,
  db,
  error,
  generateId,
  publishShotUploadsDir,
  success
});
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const {
  adminRequired,
  authRequired,
  requireAdminOrSelf,
  signUserToken
} = createAuth({ db, jwtSecret: JWT_SECRET, tokenExpiresIn: TOKEN_EXPIRES_IN });

const clampPercent = (completed, target) => {
  const c = Number(completed || 0);
  const t = Number(target || 0);
  if (!t) return 0;
  return Math.max(0, Math.min(100, Math.round((c / t) * 100)));
};

const buildTaskProgress = ({ user = {}, month, cityId } = {}) => {
  const selectedMonth = month || dayjs().format('YYYY-MM');
  const start = dayjs(`${selectedMonth}-01`).startOf('month');
  const end = start.endOf('month');
  const monthStart = start.format('YYYY-MM-DD');
  const monthEnd = end.format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');
  const isCity = isCityRole(user.role);
  const scopedCityId = isCity ? user.city_id : cityId;

  const monthGoal = db.prepare('SELECT * FROM monthly_goals WHERE month = ? ORDER BY created_at DESC LIMIT 1').get(selectedMonth);
  const cityWhere = scopedCityId ? 'AND cd.city_id = ?' : '';
  const cityParams = scopedCityId ? [monthStart, monthEnd, scopedCityId] : [monthStart, monthEnd];
  const cityTaskStats = db.prepare(`
    SELECT
      COUNT(*) as assigned,
      SUM(CASE WHEN cd.status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN cd.status != 'published' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN cd.status != 'published' AND cd.date < ? THEN 1 ELSE 0 END) as overdue,
      SUM(CASE WHEN cd.status = 'published' AND (COALESCE(cd.publish_url, '') != '' OR COALESCE(cd.actual_publish_time, '') != '') THEN 1 ELSE 0 END) as reported
    FROM city_distributions cd
    WHERE cd.date >= ? AND cd.date <= ? ${cityWhere}
  `).get(today, ...cityParams);

  const hqStats = isCity || scopedCityId ? { planned: 0, published: 0, pending: 0 } : db.prepare(`
    SELECT
      COUNT(*) as planned,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN status != 'published' THEN 1 ELSE 0 END) as pending
    FROM schedules
    WHERE date >= ? AND date <= ?
  `).get(monthStart, monthEnd);

  const dataStats = db.prepare(`
    WITH all_tracks AS (
      SELECT
        dt.date,
        COALESCE(dt.report_batch_id, dt.id) as record_key,
        dt.account_id,
        NULL as city_id,
        COALESCE(dt.play_count, 0) as play_count,
        COALESCE(dt.deal_count, 0) as deal_count,
        COALESCE(dt.deal_amount, 0) as deal_amount
      FROM data_tracks dt
      UNION ALL
      SELECT
        COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) as date,
        cd.id as record_key,
        cd.account_id,
        cd.city_id,
        COALESCE(cd.play_count, 0) as play_count,
        COALESCE(cd.deal_count, 0) as deal_count,
        COALESCE(cd.deal_amount, 0) as deal_amount
      FROM city_distributions cd
      WHERE cd.status = 'published'
    )
    SELECT
      COUNT(*) as reported_videos,
      COALESCE(SUM(play_count), 0) as plays,
      COALESCE(SUM(deal_count), 0) as deals,
      COALESCE(SUM(deal_amount), 0) as amount
    FROM all_tracks
    WHERE date >= ? AND date <= ?
      ${scopedCityId ? 'AND city_id = ?' : ''}
  `).get(...(scopedCityId ? [monthStart, monthEnd, scopedCityId] : [monthStart, monthEnd]));

  const accountRows = db.prepare(`
    SELECT
      cd.account_id,
      COALESCE(a.name, NULLIF(cd.publish_account_name, ''), '未绑定账号') as account_name,
      COALESCE(a.platform, NULLIF(cd.publish_platform, ''), 'other') as platform,
      c.id as city_id,
      c.name as city_name,
      COUNT(*) as assigned,
      SUM(CASE WHEN cd.status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN cd.status != 'published' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN cd.status != 'published' AND cd.date < ? THEN 1 ELSE 0 END) as overdue
    FROM city_distributions cd
    LEFT JOIN accounts a ON cd.account_id = a.id
    LEFT JOIN cities c ON cd.city_id = c.id
    WHERE cd.date >= ? AND cd.date <= ? ${cityWhere}
    GROUP BY cd.city_id, cd.account_id
    ORDER BY overdue DESC, pending DESC, published DESC, city_name, account_name
    LIMIT 80
  `).all(today, ...cityParams);

  const cityRows = db.prepare(`
    SELECT
      c.id,
      c.name,
      COUNT(cd.id) as assigned,
      SUM(CASE WHEN cd.status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN cd.status != 'published' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN cd.status != 'published' AND cd.date < ? THEN 1 ELSE 0 END) as overdue
    FROM cities c
    LEFT JOIN city_distributions cd
      ON cd.city_id = c.id AND cd.date >= ? AND cd.date <= ?
    WHERE c.status != 'archived' ${scopedCityId ? 'AND c.id = ?' : ''}
    GROUP BY c.id
    ORDER BY overdue DESC, pending DESC, published DESC, c.name
  `).all(...(scopedCityId ? [today, monthStart, monthEnd, scopedCityId] : [today, monthStart, monthEnd]));

  const planned = Number(hqStats.planned || 0) + Number(cityTaskStats.assigned || 0);
  const completed = Number(hqStats.published || 0) + Number(cityTaskStats.published || 0);
  const target = isCity || scopedCityId
    ? Number(cityTaskStats.assigned || 0)
    : Number(monthGoal?.publish_target || planned || 100);

  return {
    month: selectedMonth,
    scope: isCity || scopedCityId ? 'city' : 'admin',
    cityId: scopedCityId || null,
    dateRange: { start: monthStart, end: monthEnd },
    goal: {
      publishTarget: Number(monthGoal?.publish_target || 0),
      shootTarget: Number(monthGoal?.shoot_target || 0),
      editTarget: Number(monthGoal?.edit_target || 0),
      playTarget: Number(monthGoal?.play_target || 0)
    },
    progress: {
      completed,
      target,
      percentage: clampPercent(completed, target),
      daysLeft: Math.max(0, end.diff(dayjs(), 'day') + 1),
      status: target && completed >= target ? '目标达成' : '进行中'
    },
    totals: {
      planned,
      completed,
      pending: Number(hqStats.pending || 0) + Number(cityTaskStats.pending || 0),
      overdue: Number(cityTaskStats.overdue || 0),
      hqPlanned: Number(hqStats.planned || 0),
      hqPublished: Number(hqStats.published || 0),
      cityAssigned: Number(cityTaskStats.assigned || 0),
      cityPublished: Number(cityTaskStats.published || 0),
      cityReported: Number(cityTaskStats.reported || 0),
      reportedVideos: Number(dataStats.reported_videos || 0),
      plays: Number(dataStats.plays || 0),
      deals: Number(dataStats.deals || 0),
      amount: Number(dataStats.amount || 0)
    },
    cities: cityRows.map(row => ({
      ...row,
      assigned: Number(row.assigned || 0),
      published: Number(row.published || 0),
      pending: Number(row.pending || 0),
      overdue: Number(row.overdue || 0),
      percentage: clampPercent(row.published, row.assigned)
    })),
    accounts: accountRows.map(row => ({
      ...row,
      assigned: Number(row.assigned || 0),
      published: Number(row.published || 0),
      pending: Number(row.pending || 0),
      overdue: Number(row.overdue || 0),
      percentage: clampPercent(row.published, row.assigned)
    }))
  };
};

const roleGuard = (req, res, next) => {
  if (req.user?.role === 'viewer' && MUTATING_METHODS.has(req.method)) {
    return res.status(403).json(error('当前账号没有写入权限', 403));
  }
  next();
};

const operationLogger = (req, res, next) => {
  if (!MUTATING_METHODS.has(req.method)) return next();
  res.on('finish', () => {
    try {
      const meta = req.operationLog || {};
      const serialize = (value) => value == null ? null : JSON.stringify(value).slice(0, 50000);
      db.prepare(`
        INSERT INTO operation_logs (
          id, user_id, username, action, method, path, resource, resource_id,
          status_code, request_body, ip, user_agent, action_label, summary, before_data, after_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(),
        req.user?.id || null,
        req.user?.username || null,
        meta.action || `${req.method} ${req.path}`,
        req.method,
        req.path,
        meta.resource || req.path.split('/').filter(Boolean)[1] || '',
        meta.resourceId || req.params?.id || req.body?.id || null,
        res.statusCode,
        sanitizeBody(req.body),
        req.ip,
        req.headers['user-agent'] || '',
        meta.actionLabel || null,
        meta.summary || null,
        serialize(meta.before),
        serialize(meta.after)
      );
    } catch (e) {
      logger.warn('[operation-log] 写入失败:', e.message);
    }
  });
  next();
};

const setOperationLog = (req, meta = {}) => {
  req.operationLog = { ...(req.operationLog || {}), ...meta };
};

const writeDataAudit = ({ action, targetType, targetId, accountId, cityId, periodStart, periodEnd, before, after, user }) => {
  const serialize = (value) => value == null ? null : JSON.stringify(value).slice(0, 50000);
  db.prepare(`
    INSERT INTO data_report_audit_logs (
      id, action, target_type, target_id, account_id, city_id, period_start, period_end,
      before_data, after_data, operator_id, operator_name, operator_role
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    generateId(), action, targetType, targetId || null, accountId || null, cityId || null,
    periodStart || null, periodEnd || null, serialize(before), serialize(after),
    user?.id || null, user?.name || user?.username || null, user?.role || null
  );
};

const parseRangeToDates = (query = {}) => {
  if (query.dateFrom || query.dateTo) {
    return {
      start: query.dateFrom || dayjs().subtract(30, 'day').format('YYYY-MM-DD'),
      end: query.dateTo || dayjs().format('YYYY-MM-DD')
    };
  }
  const rangeDays = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    year: 365
  };
  const days = rangeDays[query.range] || 30;
  return {
    start: dayjs().subtract(days - 1, 'day').format('YYYY-MM-DD'),
    end: dayjs().format('YYYY-MM-DD')
  };
};

const platformLabelMap = {
  douyin: '抖音',
  kuaishou: '快手',
  weixin: '视频号',
  xiaohongshu: '小红书',
  weibo: '微博',
  bilibili: 'B站'
};

const normalizeAccountPayload = (body = {}) => {
  const knownScopes = new Set(['self', 'hq', 'city', 'other']);
  const requestedType = body.type || '';
  const scope = knownScopes.has(requestedType)
    ? requestedType
    : (body.city_id ? 'city' : (body.platform === 'other' ? 'other' : 'self'));
  const platform = body.platform || 'other';
  const platformLabel = body.platform_label || platformLabelMap[platform] || '';
  return {
    name: body.name,
    platform,
    platform_account: body.platform_account || body.url || '',
    type: scope,
    city_id: body.city_id || null,
    status: body.status || 'active',
    browser_profile: body.browser_profile || '',
    account_type: body.account_type || body.type_note || (knownScopes.has(requestedType) ? '' : requestedType),
    platform_label: platformLabel,
    cert: body.cert || '',
    frequency: body.frequency || '',
    priority: body.priority || 'medium',
    owner: body.owner || '',
    editor: body.editor || '',
    purpose: body.purpose || '',
    remark: body.remark || '',
    avatar: body.avatar || '',
    owner_avatar: body.owner_avatar || '',
    qrcode_url: body.qrcode_url || ''
  };
};

const validateHqAccountType = (account) => {
  if (account.type !== 'hq') return;
  if (!account.account_type) {
    return;
  }
  const exists = db.prepare('SELECT 1 FROM video_types WHERE status = ? AND name = ?').get('active', account.account_type);
  if (!exists) {
    const err = new Error('账号类型必须来自类型管理');
    err.statusCode = 400;
    throw err;
  }
};

const attachPublishStatus = (accounts) => {
  if (!accounts.length) return accounts;
  const placeholders = accounts.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT account_id, date, status
    FROM account_publish_status
    WHERE account_id IN (${placeholders})
  `).all(...accounts.map(account => account.id));
  const statusMap = rows.reduce((map, row) => {
    if (!map[row.account_id]) map[row.account_id] = {};
    map[row.account_id][row.date] = row.status;
    return map;
  }, {});
  return accounts.map(account => ({
    ...account,
    url: account.platform_account,
    publish_status: statusMap[account.id] || {}
  }));
};

const savePublishStatus = (accountId, publishStatus = {}) => {
  if (!publishStatus || typeof publishStatus !== 'object') return;
  const upsert = db.prepare(`
    INSERT INTO account_publish_status (id, account_id, date, status)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(account_id, date) DO UPDATE SET
      status = excluded.status,
      updated_at = CURRENT_TIMESTAMP
  `);
  Object.entries(publishStatus).forEach(([date, status]) => {
    if (date && status) upsert.run(generateId(), accountId, date, status);
  });
};

const createNotification = ({ userId, type = 'info', title, content = '', level = 'info', relatedType = '', relatedId = '' }) => {
  if (!userId || !title) return;
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, content, level, related_type, related_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), userId, type, title, content, level, relatedType, relatedId);
};

const notifyCityUsers = (cityId, payload) => {
  const users = db.prepare("SELECT id FROM users WHERE city_id = ? AND role = 'city' AND status = 'active'").all(cityId);
  users.forEach(user => createNotification({ userId: user.id, ...payload }));
};

const CITY_DISTRIBUTION_STATUS_LABELS = cityDistributionWorkflow.STATUS_LABELS;
const normalizeCityDistributionStatus = cityDistributionWorkflow.normalizeStatus;

const getCityDistributionDisplayStatus = (task, today = dayjs().format('YYYY-MM-DD')) => {
  return cityDistributionWorkflow.displayStatus(task, today);
};

const cityDistributionLogSnapshot = (row = {}) => row ? {
  id: row.id,
  date: row.date,
  city_id: row.city_id,
  city_name: row.city_name,
  account_id: row.account_id,
  account_name: row.account_name,
  video_title: row.video_title,
  status: normalizeCityDistributionStatus(row.status),
  status_label: CITY_DISTRIBUTION_STATUS_LABELS[normalizeCityDistributionStatus(row.status)] || row.status,
  publish_time: row.publish_time,
  downloaded_at: row.downloaded_at,
  actual_publish_time: row.actual_publish_time,
  publish_url: row.publish_url,
  failed_reason: row.failed_reason || row.exception_reason
} : null;

const loadCityDistributionForLog = (id) => db.prepare(`
  SELECT cd.*, c.name AS city_name, a.name AS account_name
  FROM city_distributions cd
  LEFT JOIN cities c ON c.id = cd.city_id
  LEFT JOIN accounts a ON a.id = cd.account_id
  WHERE cd.id = ?
`).get(id);

const cityDistributionLogTitle = (row = {}) => `${row.city_name || '城市'} · ${row.account_name || row.publish_account_name || '账号'} · ${row.video_title || '下发任务'}`;

const REUSE_PLATFORMS = ['kuaishou', 'weixin', 'douyin', 'xiaohongshu'];

const normalizeDistributionUrl = (value = '') => String(value || '').trim().replace(/[，,。.;；]+$/g, '');

const buildCityDistributionMaterialKey = (row = {}) => {
  const materialFileId = String(row.material_file_id || row.materialFileId || '').trim();
  if (materialFileId) return `file:${materialFileId}`;
  const url = normalizeDistributionUrl(row.material_url || row.materialUrl || row.video_url || row.videoUrl);
  if (!url) return '';
  return `url:${crypto.createHash('sha256').update(url).digest('hex').slice(0, 32)}`;
};

const resolveDistributionPlatform = (payload = {}, account = {}) => {
  return String(payload.publish_platform || payload.publishPlatform || account.platform || payload.platform || 'other').trim() || 'other';
};

const cityDistributionPublishedSql = (alias = 'cd') => cityDistributionWorkflow.statusSql(alias).published;

const ensureCityDistributionMaterialKeys = () => {
  const rows = db.prepare(`
    SELECT id, material_file_id, material_url, video_url
    FROM city_distributions
    WHERE COALESCE(material_key, '') = ''
      AND (COALESCE(material_file_id, '') != '' OR COALESCE(material_url, '') != '' OR COALESCE(video_url, '') != '')
    LIMIT 1000
  `).all();
  if (!rows.length) return;
  const update = db.prepare('UPDATE city_distributions SET material_key = ? WHERE id = ?');
  const trx = db.transaction((items) => {
    items.forEach(row => {
      const key = buildCityDistributionMaterialKey(row);
      if (key) update.run(key, row.id);
    });
  });
  trx(rows);
};

const findCityVideoPlatformDuplicate = ({ cityId, materialKey, platform, excludeId = '' }) => {
  if (!cityId || !materialKey || !platform || platform === 'other') return null;
  return db.prepare(`
    SELECT cd.id, cd.date, cd.video_title, cd.publish_time, cd.publish_platform,
      c.name AS city_name,
      COALESCE(a.name, cd.publish_account_name, '未绑定账号') AS account_name,
      COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') AS platform
    FROM city_distributions cd
    LEFT JOIN cities c ON c.id = cd.city_id
    LEFT JOIN accounts a ON a.id = cd.account_id
    WHERE cd.city_id = ?
      AND cd.material_key = ?
      AND COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') = ?
      AND cd.id != ?
      AND ${cityDistributionPublishedSql('cd')}
      AND COALESCE(cd.status, '') != 'deleted'
    ORDER BY cd.date DESC, cd.created_at DESC
    LIMIT 1
  `).get(cityId, materialKey, platform, excludeId || '');
};

const assertCityVideoPlatformAvailable = ({ cityId, materialKey, platform, excludeId = '' }) => {
  const duplicate = findCityVideoPlatformDuplicate({ cityId, materialKey, platform, excludeId });
  if (!duplicate) return null;
  const err = new Error(`该视频已发布过${platformLabelMap[platform] || platform}，同平台不能重复发布`);
  err.statusCode = 409;
  err.duplicate = duplicate;
  throw err;
};

const getCityReuseScope = (req, requestedCityId = '') => {
  if (isCityRole(req.user.role)) return req.user.city_id || '__none__';
  return requestedCityId || '';
};

const defaultSystemSettings = {
  brand: {
    logoUrl: '/logo.png',
    name: '遇见运营中台',
    subtitle: 'Media Operations'
  },
  storage: {
    provider: 'cos',
    bucket: process.env.COS_BUCKET || '',
    region: process.env.COS_REGION || 'ap-shanghai',
    secretId: process.env.COS_SECRET_ID || '',
    secretKey: '',
    cdnDomain: process.env.COS_CDN_DOMAIN || '',
    domain: process.env.COS_DOMAIN || '',
    uploadPrefix: 'materials/',
    previewExpires: 600,
    proxyPreview: true,
    hasSecretKey: Boolean(process.env.COS_SECRET_KEY)
  },
  profile: {
    displayName: '',
    roleLabel: '',
    avatarUrl: ''
  },
  preferences: {
    compactMode: false,
    showGlobalSearch: true,
    enableNotifications: true,
    defaultCity: '',
    defaultPublishTime: '09:00'
  },
  copy: {
    materialEntry: {
      pageTitle: '素材录入',
      todayOverview: '今日工作概览',
      shootingStaff: '拍摄人员',
      completionStatus: '完成状态',
      shootingMaterial: '拍摄素材',
      todaySchedule: '今日安排',
      completionSummary: '完成情况'
    },
    materialList: {
      pageTitle: '素材列表',
      searchPlaceholder: '搜索素材文件、账号、城市...',
      previewButton: '预览',
      copyLinkButton: '复制链接'
    },
    cityBoard: {
      pageTitle: '城市发布看板',
      distributeButton: '下发视频',
      recentRecords: '最近下发记录',
      cityAccountStatus: '城市账号分发状态'
    },
    accounts: {
      pageTitle: '账号管理',
      createButton: '新增账号',
      cityUserTitle: '城市登录账号'
    }
  },
  pages: {
    dashboard: { label: '工作台', fields: [] },
    materialEntry: { label: '素材录入', fields: [] },
    materialList: { label: '素材列表', fields: [] },
    publish: { label: '发布管理', fields: [] },
    cityBoard: { label: '城市看板', fields: [] },
    cityManage: { label: '城市管理', fields: [] },
    accounts: { label: '账号页面', fields: [] }
  }
};

const mergeDeep = (base, saved) => {
  if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if (!base || typeof base !== 'object') return saved ?? base;
  const result = { ...base };
  Object.keys(saved || {}).forEach(key => {
    result[key] = mergeDeep(base[key], saved[key]);
  });
  return result;
};

const getSettingValue = (key, fallback = {}) => {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
  if (!row) return fallback;
  try {
    return JSON.parse(row.value);
  } catch {
    return fallback;
  }
};

const getSystemSettings = () => systemSettingsService.getSystemSettings();

const maskSystemSettings = (settings) => systemSettingsService.maskSystemSettings(settings);

const saveSystemSettingsValue = (settings, userId) => systemSettingsService.saveSystemSettingsValue(settings, userId);

// ========== 认证与权限 ==========
app.use('/api/auth', createAuthRoutes({
  authRequired,
  bcrypt,
  clearLoginAttempt,
  db,
  error,
  getLoginAttempt,
  loginAttemptKey,
  registerLoginFailure,
  signUserToken,
  success,
  validateRequired
}));

// ========== 系统设置 API ==========
app.use('/api', createSystemSettingsRoutes({
  adminRequired,
  authRequired,
  COS,
  error,
  success,
  systemSettingsService,
  upyunStorage,
  validateRequired
}));

// ========== 系统用户 API ==========
app.use('/api/system-users', createSystemUsersRoutes({
  adminRequired,
  authRequired,
  bcrypt,
  db,
  error,
  generateId,
  requireAdminOrSelf,
  success,
  validateRequired
}));

// ========== 系统健康与备份 API ==========
app.use('/api', createSystemMaintenanceRoutes({
  adminRequired,
  authRequired,
  dayjs,
  db,
  error,
  success
}));

// ========== 通用后台 API ==========
app.use('/api', createCommonRoutes({
  authRequired,
  buildTaskProgress,
  dayjs,
  db,
  error,
  isCityRole,
  success
}));

// ========== 公开媒体分享 API ==========
app.use('/api', createPublicMediaRoutes({
  crypto,
  dayjs,
  db,
  error,
  getCosPreviewUrl,
  getFolderById: (id) => getFolderById(id),
  jwt,
  jwtSecret: JWT_SECRET,
  logger,
  normalizeCosKey,
  validatePreviewUrl
}));

// ========== 公开 H5 视频任务 API ==========
app.use('/api', h5VideoTaskRoutes.publicRouter);

// ========== DataEase 开放只读 API ==========
// 说明：这些接口位于全局 /api 鉴权中间件之前，使用独立 DATAEASE_API_KEY，只读、不修改数据库。
app.use('/api/open/dataease', createDataEaseOpenApiRoutes({
  crypto,
  dayjs,
  db,
  error,
  getUnifiedReportsCte: () => unifiedReportsCte,
  success
}));

app.use('/api', authRequired, roleGuard, operationLogger);

// ========== H5 视频下发任务管理 API ==========
app.use('/api', h5VideoTaskRoutes.adminRouter);

// ========== 后台媒体上传与分享 API ==========
app.use('/api', createProtectedMediaRoutes({
  crypto,
  dayjs,
  db,
  error,
  getCosPreviewUrl,
  getFolderById: (id) => getFolderById(id),
  jwt,
  jwtSecret: JWT_SECRET,
  logger,
  materialLegacyFolderId: 'folder_legacy',
  normalizeCosKey,
  success,
  validatePreviewUrl
}));

// ========== 工作台 API ==========
app.get('/api/dashboard', (req, res) => {
  const selectedDay = req.query.date ? dayjs(req.query.date) : dayjs();
  const today = selectedDay.format('YYYY-MM-DD');
  const yesterday = selectedDay.subtract(1, 'day').format('YYYY-MM-DD');
  const monthStart = selectedDay.startOf('month').format('YYYY-MM-DD');
  const monthEnd = selectedDay.endOf('month').format('YYYY-MM-DD');
  const weekStart = selectedDay.startOf('week').format('YYYY-MM-DD');
  const weekEnd = selectedDay.endOf('week').format('YYYY-MM-DD');

  // 本月成品上传数
  const monthUploadFiles = db.prepare(`
    SELECT COUNT(*) as total FROM material_files
    WHERE status != 'deleted' AND date >= ? AND date <= ?
  `).get(monthStart, monthEnd);

  // 本月目标
  const monthGoal = db.prepare('SELECT * FROM monthly_goals WHERE month = ?').get(selectedDay.format('YYYY-MM'));
  const taskProgress = buildTaskProgress({ user: req.user, month: selectedDay.format('YYYY-MM') });

  // 今日手动记录的拍摄素材数
  const todayShoot = db.prepare(`
    SELECT SUM(shoot_count) as total FROM materials WHERE date = ?
  `).get(today);

  const yesterdayShoot = db.prepare(`
    SELECT SUM(shoot_count) as total FROM materials WHERE date = ?
  `).get(yesterday);

  const todayUploadFiles = db.prepare(`
    SELECT COUNT(*) as total FROM material_files WHERE status != 'deleted' AND date = ?
  `).get(today);

  const hqPublishedToday = db.prepare(`
    SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
    FROM schedules
    WHERE date = ?
      AND status = 'published'
      AND city_distribution_id IS NULL
  `).get(today);

  const hqPendingToday = db.prepare(`
    SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
    FROM schedules
    WHERE date = ? AND COALESCE(status, 'pending') != 'published'
  `).get(today);

  const cityPublishedToday = db.prepare(`
    SELECT
      COALESCE(SUM(total), 0) as total,
      COALESCE(SUM(accounts), 0) as accounts
    FROM (
      SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
      FROM city_distributions
      WHERE COALESCE(NULLIF(substr(actual_publish_time, 1, 10), ''), date) = ?
        AND status = 'published'
      UNION ALL
      SELECT COUNT(v.id) as total, COUNT(DISTINCT p.id) as accounts
      FROM h5_video_task_videos v
      JOIN h5_video_task_people p ON p.id = v.person_id
      WHERE v.status = 'submitted'
        AND substr(v.submitted_at, 1, 10) = ?
    )
  `).get(today, today);

  const cityPendingToday = db.prepare(`
    SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
    FROM city_distributions
    WHERE date = ? AND COALESCE(status, 'distributed') != 'published'
  `).get(today);

  const hqPublishedMonth = db.prepare(`
    SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
    FROM schedules
    WHERE date >= ?
      AND date <= ?
      AND status = 'published'
      AND city_distribution_id IS NULL
  `).get(monthStart, monthEnd);

  const cityPublishedMonth = db.prepare(`
    SELECT
      COALESCE(SUM(total), 0) as total,
      COALESCE(SUM(accounts), 0) as accounts
    FROM (
      SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
      FROM city_distributions
      WHERE COALESCE(NULLIF(substr(actual_publish_time, 1, 10), ''), date) >= ?
        AND COALESCE(NULLIF(substr(actual_publish_time, 1, 10), ''), date) <= ?
        AND status = 'published'
      UNION ALL
      SELECT COUNT(v.id) as total, COUNT(DISTINCT p.id) as accounts
      FROM h5_video_task_videos v
      JOIN h5_video_task_people p ON p.id = v.person_id
      WHERE v.status = 'submitted'
        AND substr(v.submitted_at, 1, 10) >= ?
        AND substr(v.submitted_at, 1, 10) <= ?
    )
  `).get(monthStart, monthEnd, monthStart, monthEnd);

  const publishOverview = {
    todayPublished: {
      hq: hqPublishedToday.total || 0,
      city: cityPublishedToday.total || 0,
      total: (hqPublishedToday.total || 0) + (cityPublishedToday.total || 0),
      hqAccounts: hqPublishedToday.accounts || 0,
      cityAccounts: cityPublishedToday.accounts || 0
    },
    todayPending: {
      hq: hqPendingToday.total || 0,
      city: cityPendingToday.total || 0,
      total: (hqPendingToday.total || 0) + (cityPendingToday.total || 0),
      hqAccounts: hqPendingToday.accounts || 0,
      cityAccounts: cityPendingToday.accounts || 0
    },
    monthPublished: {
      hq: hqPublishedMonth.total || 0,
      city: cityPublishedMonth.total || 0,
      total: (hqPublishedMonth.total || 0) + (cityPublishedMonth.total || 0),
      hqAccounts: hqPublishedMonth.accounts || 0,
      cityAccounts: cityPublishedMonth.accounts || 0
    }
  };

  // 今日待发布
  const todayPending = db.prepare(`
    SELECT COUNT(*) as count, COUNT(DISTINCT account_id) as accounts
    FROM schedules WHERE date = ? AND status = 'pending'
  `).get(today);

  // 超期提醒（昨天及之前的未发布）
  const overdue = db.prepare(`
    SELECT
      cd.id,
      c.name as city_name,
      a.name as account_name,
      cd.video_title,
      cd.status,
      julianday(?) - julianday(cd.date) as days_overdue
    FROM city_distributions cd
    LEFT JOIN cities c ON cd.city_id = c.id
    LEFT JOIN accounts a ON cd.account_id = a.id
    WHERE cd.status IN ('distributed', 'confirmed') AND cd.date < ?
    ORDER BY days_overdue DESC
    LIMIT 10
  `).all(today, today);

  // 今日产量汇总（按类型）
  const todayProduction = db.prepare(`
    SELECT
      vt.id,
      vt.name,
      vt.icon,
      vt.color,
      COALESCE(m.shoot, 0) as shoot,
      COALESCE(m.edit, 0) as edit,
      COALESCE(mf.upload, 0) as upload,
      COALESCE(s.publish, 0) as publish
    FROM video_types vt
    LEFT JOIN (
      SELECT video_type_id, SUM(shoot_count) as shoot, SUM(edit_count) as edit
      FROM materials
      WHERE date = ?
      GROUP BY video_type_id
    ) m ON vt.id = m.video_type_id
    LEFT JOIN (
      SELECT video_type_id, COUNT(*) as upload
      FROM material_files
      WHERE date = ? AND status != 'deleted'
      GROUP BY video_type_id
    ) mf ON vt.id = mf.video_type_id
    LEFT JOIN (
      SELECT
        s.video_type_id,
        COUNT(*) as publish
      FROM schedules s
      WHERE s.date = ? AND s.status = 'published'
        AND COALESCE(s.video_type_id, '') != ''
      GROUP BY s.video_type_id
    ) s ON vt.id = s.video_type_id
    WHERE vt.status = 'active'
    ORDER BY vt.sort_order, vt.name
  `).all(today, today, today);

  // 待发布队列
  const pendingQueue = db.prepare(`
    SELECT
      s.id,
      s.time,
      a.name as account_name,
      a.platform,
      s.video_title,
      s.status
    FROM schedules s
    LEFT JOIN accounts a ON s.account_id = a.id
    WHERE s.status = 'pending' AND s.date = ?
    ORDER BY s.time ASC
    LIMIT 10
  `).all(today);

  // 城市发布看板
  const cityBoard = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM city_distributions cd
        WHERE cd.city_id = c.id AND cd.status = 'published' AND cd.date = ?
      ) THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN EXISTS (
        SELECT 1 FROM city_distributions cd
        WHERE cd.city_id = c.id AND cd.status IN ('distributed', 'confirmed') AND cd.date < ?
      ) THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN NOT EXISTS (
        SELECT 1 FROM city_distributions cd WHERE cd.city_id = c.id
      ) THEN 1 ELSE 0 END) as not_started
    FROM cities c
    WHERE c.status = 'active'
  `).get(today, today);

  // 本周进度
  const weekShoot = db.prepare(`SELECT SUM(shoot_count) as total FROM materials WHERE date >= ? AND date <= ?`).get(weekStart, weekEnd);
  const weekEdit = db.prepare(`SELECT SUM(edit_count) as total FROM materials WHERE date >= ? AND date <= ?`).get(weekStart, weekEnd);
  const weekPublish = db.prepare(`SELECT COUNT(*) as total FROM schedules WHERE date >= ? AND date <= ? AND status = 'published'`).get(weekStart, weekEnd);

  // 今日发布排期
  const todaySchedule = db.prepare(`
    SELECT
      s.id,
      s.time,
      a.platform,
      a.name as account_name,
      s.video_title,
      s.status
    FROM schedules s
    LEFT JOIN accounts a ON s.account_id = a.id
    WHERE s.date = ?
    ORDER BY s.time ASC
    LIMIT 10
  `).all(today);

  // 平台统计
  const platformStats = db.prepare(`
    SELECT a.platform, COUNT(*) as count
    FROM schedules s
    LEFT JOIN accounts a ON s.account_id = a.id
    WHERE s.date = ?
    GROUP BY a.platform
  `).all(today);

  res.json(success({
    monthProgress: {
      completed: taskProgress.progress.completed,
      target: taskProgress.progress.target,
      percentage: taskProgress.progress.percentage,
      daysLeft: taskProgress.progress.daysLeft,
      status: taskProgress.progress.status,
      source: 'task-progress'
    },
    taskProgress,
    todayStats: {
      shoot: todayShoot.total || 0,
      upload: todayUploadFiles.total || 0,
      shootGrowth: (todayShoot.total || 0) - (yesterdayShoot.total || 0)
    },
    todayPending: {
      count: publishOverview.todayPending.total,
      accounts: (publishOverview.todayPending.hqAccounts || 0) + (publishOverview.todayPending.cityAccounts || 0),
      hq: publishOverview.todayPending.hq,
      city: publishOverview.todayPending.city,
      hqAccounts: publishOverview.todayPending.hqAccounts,
      cityAccounts: publishOverview.todayPending.cityAccounts
    },
    publishOverview,
    overdue: {
      count: overdue.length,
      urgent: overdue.filter(o => o.days_overdue >= 1).length,
      list: overdue
    },
    todayProduction: todayProduction.map(p => ({
      ...p,
      shoot: p.shoot || 0,
      edit: p.edit || 0,
      upload: p.upload || 0,
      publish: p.publish || 0
    })),
    pendingQueue,
    cityBoard: {
      total: cityBoard.total || 0,
      published: cityBoard.published || 0,
      pending: cityBoard.pending || 0,
      notStarted: cityBoard.not_started || 0,
      publishedPercent: cityBoard.total ? Math.round((cityBoard.published || 0) / cityBoard.total * 100) : 0,
      pendingPercent: cityBoard.total ? Math.round((cityBoard.pending || 0) / cityBoard.total * 100) : 0,
      notStartedPercent: cityBoard.total ? Math.round((cityBoard.not_started || 0) / cityBoard.total * 100) : 0
    },
    weekProgress: {
      shoot: weekShoot.total || 0,
      shootTarget: monthGoal?.shoot_target || 100,
      shootPercent: Math.round((weekShoot.total || 0) / (monthGoal?.shoot_target || 100) * 100),
      edit: weekEdit.total || 0,
      editPercent: Math.round((weekEdit.total || 0) / (monthGoal?.edit_target || 100) * 100),
      publish: weekPublish.total || 0,
      publishPercent: Math.round((weekPublish.total || 0) / (monthGoal?.publish_target || 100) * 100),
      targetPercent: taskProgress.progress.percentage
    },
    aiSummary: {
      text: `今日已发布${publishOverview.todayPublished.total}条，待发布${publishOverview.todayPending.total}条，本月累计发布${publishOverview.monthPublished.total}条，超期${overdue.length}项。`,
      date: today
    },
    todaySchedule,
    platformStats: platformStats.reduce((acc, p) => ({ ...acc, [p.platform]: p.count }), {})
  }));
});

// ========== 素材管理 API ==========
app.get('/api/materials', (req, res) => {
  const { page = 1, pageSize = 20, dateFrom, dateTo, staffId, videoTypeId, status } = req.query;
  let where = [];
  let params = [];

  if (dateFrom) { where.push('m.date >= ?'); params.push(dateFrom); }
  if (dateTo) { where.push('m.date <= ?'); params.push(dateTo); }
  if (staffId) { where.push('m.staff_id = ?'); params.push(staffId); }
  if (videoTypeId) { where.push('m.video_type_id = ?'); params.push(videoTypeId); }
  if (status) { where.push('m.status = ?'); params.push(status); }

  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const materials = db.prepare(`
    SELECT
      m.*,
      s.name as staff_name,
      vt.name as type_name,
      vt.icon as type_icon,
      vt.color as type_color
    FROM materials m
    LEFT JOIN staffs s ON m.staff_id = s.id
    LEFT JOIN video_types vt ON m.video_type_id = vt.id
    ${whereStr}
    ORDER BY m.date DESC, m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM materials m ${whereStr}`).get(...params);

  res.json(success({ list: materials, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.post('/api/materials', (req, res) => {
  const {
    date,
    staff_id,
    staff_name,
    video_type_id,
    shoot_count,
    edit_count,
    upload_count,
    netdisk_path,
    remark,
    work_plan,
    work_done,
    completion_status
  } = req.body;
  const id = generateId();
  const status = upload_count >= shoot_count ? 'all_uploaded' : upload_count > 0 ? 'partial' : 'not_uploaded';

  db.prepare(`
    INSERT INTO materials (
      id, date, staff_id, staff_name, video_type_id, shoot_count, edit_count,
      upload_count, netdisk_path, status, remark, work_plan, work_done, completion_status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    date,
    staff_id || 'manual',
    staff_name || '',
    video_type_id,
    shoot_count || 0,
    edit_count || 0,
    upload_count || 0,
    netdisk_path || '',
    status,
    remark || '',
    work_plan || '',
    work_done || '',
    completion_status || 'planned'
  );

  res.json(success({ id }, '创建成功'));
});

app.put('/api/materials/:id', (req, res) => {
  const { id } = req.params;
  const { date, staff_id, video_type_id, shoot_count, edit_count, upload_count, netdisk_path, remark } = req.body;
  const status = upload_count >= shoot_count ? 'all_uploaded' : upload_count > 0 ? 'partial' : 'not_uploaded';

  db.prepare(`
    UPDATE materials
    SET date = ?, staff_id = ?, video_type_id = ?, shoot_count = ?, edit_count = ?, upload_count = ?, netdisk_path = ?, status = ?, remark = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(date, staff_id, video_type_id, shoot_count, edit_count, upload_count, netdisk_path, status, remark, id);

  res.json(success(null, '更新成功'));
});

app.delete('/api/materials/:id', (req, res) => {
  db.prepare('DELETE FROM materials WHERE id = ?').run(req.params.id);
  res.json(success(null, '删除成功'));
});

// 批量创建素材
app.post('/api/materials/batch', (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json(error('请求体必须是非空数组', 400));
  }
  const insert = db.prepare(`
    INSERT INTO materials (
      id, date, staff_id, staff_name, video_type_id, shoot_count, edit_count,
      upload_count, netdisk_path, status, remark, work_plan, work_done, completion_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const results = [];
  const insertAll = db.transaction((items) => {
    for (const item of items) {
      const id = generateId();
      const status = (item.upload_count || 0) >= (item.shoot_count || 0) ? 'all_uploaded'
        : (item.upload_count || 0) > 0 ? 'partial' : 'not_uploaded';
      insert.run(
        id,
        item.date,
        item.staff_id || 'manual',
        item.staff_name || '',
        item.video_type_id,
        item.shoot_count || 0,
        item.edit_count || 0,
        item.upload_count || 0,
        item.netdisk_path || '',
        status,
        item.remark || '',
        item.work_plan || '',
        item.work_done || '',
        item.completion_status || 'planned'
      );
      results.push({ id, date: item.date });
    }
  });
  insertAll(items);
  res.json(success(results, `成功创建${results.length}条记录`));
});

// 批量更新素材
app.put('/api/materials/batch', (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json(error('请求体必须是非空数组', 400));
  }
  const update = db.prepare(`
    UPDATE materials
    SET date = ?, staff_id = ?, video_type_id = ?, shoot_count = ?, edit_count = ?,
        upload_count = ?, netdisk_path = ?, status = ?, remark = ?,
        work_plan = ?, work_done = ?, completion_status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);
  const results = [];
  const updateAll = db.transaction((items) => {
    for (const item of items) {
      if (!item.id) continue;
      const status = (item.upload_count || 0) >= (item.shoot_count || 0) ? 'all_uploaded'
        : (item.upload_count || 0) > 0 ? 'partial' : 'not_uploaded';
      update.run(
        item.date,
        item.staff_id,
        item.video_type_id,
        item.shoot_count || 0,
        item.edit_count || 0,
        item.upload_count || 0,
        item.netdisk_path || '',
        status,
        item.remark || '',
        item.work_plan || '',
        item.work_done || '',
        item.completion_status || 'planned',
        item.id
      );
      results.push({ id: item.id });
    }
  });
  updateAll(items);
  res.json(success(results, `成功更新${results.length}条记录`));
});

// 批量删除素材（软删除）
app.delete('/api/materials/batch', (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json(error('缺少 ids 参数', 400));
  }
  const placeholders = ids.map(() => '?').join(',');
  const result = db.prepare(`DELETE FROM materials WHERE id IN (${placeholders})`).run(...ids);
  res.json(success({ deleted: result.changes }, `成功删除${result.changes}条记录`));
});

// 视频类型
app.get('/api/video-types', (req, res) => {
  const types = db.prepare(`
    SELECT
      vt.*,
      COALESCE(stats.count, 0) AS count,
      COALESCE(stats.count, 0) AS material_count
    FROM video_types vt
    LEFT JOIN (
      SELECT
        vt_inner.id AS video_type_id,
        COUNT(mf.id) AS count
      FROM video_types vt_inner
      LEFT JOIN material_files mf
        ON mf.status != 'deleted'
        AND (
          mf.video_type_id = vt_inner.id
          OR (
            COALESCE(mf.video_type_id, '') = ''
            AND mf.type_name = vt_inner.name
          )
        )
      GROUP BY vt_inner.id
    ) stats ON stats.video_type_id = vt.id
    WHERE vt.status = ?
    ORDER BY vt.sort_order
  `).all('active');
  res.json(success(types));
});

app.post('/api/video-types', (req, res) => {
  const { name, icon, color, parent_id, sort_order } = req.body;
  const id = generateId();
  db.prepare('INSERT INTO video_types (id, name, icon, color, parent_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)').run(id, name, icon, color, parent_id, sort_order || 0);
  res.json(success({ id }, '创建成功'));
});

app.put('/api/video-types/:id', (req, res) => {
  const { name, icon, color, parent_id, sort_order, status } = req.body;
  db.prepare('UPDATE video_types SET name = ?, icon = ?, color = ?, parent_id = ?, sort_order = ?, status = ? WHERE id = ?').run(name, icon, color, parent_id, sort_order, status || 'active', req.params.id);
  res.json(success(null, '更新成功'));
});

app.delete('/api/video-types/:id', (req, res) => {
  db.prepare('UPDATE video_types SET status = ? WHERE id = ?').run('archived', req.params.id);
  res.json(success(null, '已归档'));
});

// ========== 拍摄人员 API ==========
app.get('/api/staffs', (req, res) => {
  const staffs = db.prepare('SELECT * FROM staffs WHERE status = ? ORDER BY name').all('active');
  res.json(success(staffs));
});

app.post('/api/staffs', (req, res) => {
  const { name, role, contact } = req.body;
  const id = generateId();
  db.prepare('INSERT INTO staffs (id, name, role, contact) VALUES (?, ?, ?, ?)').run(id, name, role || 'both', contact);
  res.json(success({ id }, '创建成功'));
});

app.put('/api/staffs/:id', (req, res) => {
  const { name, role, contact, status } = req.body;
  db.prepare('UPDATE staffs SET name = ?, role = ?, contact = ?, status = ? WHERE id = ?').run(name, role, contact, status || 'active', req.params.id);
  res.json(success(null, '更新成功'));
});

app.delete('/api/staffs/:id', (req, res) => {
  db.prepare('UPDATE staffs SET status = ? WHERE id = ?').run('archived', req.params.id);
  res.json(success(null, '删除成功'));
});

// ========== 月度目标 API ==========
app.get('/api/monthly-goals', (req, res) => {
  const { month } = req.query;
  let goals;
  if (month) {
    goals = db.prepare('SELECT * FROM monthly_goals WHERE month = ?').all(month);
  } else {
    goals = db.prepare('SELECT * FROM monthly_goals ORDER BY month DESC').all();
  }
  res.json(success(goals));
});

app.post('/api/monthly-goals', (req, res) => {
  validateRequired(req.body, ['month']);
  const { month, shoot_target, edit_target, publish_target, play_target } = req.body;
  const id = generateId();
  db.prepare(`
    INSERT INTO monthly_goals (id, month, shoot_target, edit_target, publish_target, play_target)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, month, shoot_target || 0, edit_target || 0, publish_target || 0, play_target || 0);
  res.json(success({ id }, '创建成功'));
});

app.put('/api/monthly-goals/:month', (req, res) => {
  const { shoot_target, edit_target, publish_target, play_target } = req.body;
  const existing = db.prepare('SELECT * FROM monthly_goals WHERE month = ?').get(req.params.month);
  if (!existing) {
    return res.status(404).json(error('目标不存在', 404));
  }
  db.prepare(`
    UPDATE monthly_goals SET
      shoot_target = COALESCE(?, shoot_target),
      edit_target = COALESCE(?, edit_target),
      publish_target = COALESCE(?, publish_target),
      play_target = COALESCE(?, play_target)
    WHERE month = ?
  `).run(shoot_target, edit_target, publish_target, play_target, req.params.month);
  res.json(success(null, '更新成功'));
});

// ========== 账号管理 API ==========

// 发布统计：查询指定日期+类型的已发布/待发布数量
app.get('/api/accounts/publish-stats', (req, res) => {
  const { date, type } = req.query;
  const targetDate = date || dayjs().format('YYYY-MM-DD');
  let typeCondition = '';
  const params = [targetDate];
  if (type) {
    typeCondition = 'AND a.type = ?';
    params.push(type);
  }
  const published = db.prepare(`
    SELECT COUNT(DISTINCT s.account_id) as count
    FROM schedules s
    LEFT JOIN accounts a ON s.account_id = a.id
    WHERE s.date = ? AND s.status = 'published' ${typeCondition}
  `).get(...params);
  const pending = db.prepare(`
    SELECT COUNT(DISTINCT s.account_id) as count
    FROM schedules s
    LEFT JOIN accounts a ON s.account_id = a.id
    WHERE s.date = ? AND s.status = 'pending' ${typeCondition}
  `).get(...params);
  res.json(success({ published: published?.count || 0, pending: pending?.count || 0 }));
});

app.get('/api/accounts', authRequired, (req, res) => {
  const { type, platform, cityId, city_id, status } = req.query;
  let where = [];
  let params = [];

  if (status === 'all') {
    where.push('status != ?');
    params.push('archived');
  } else if (status) {
    where.push('status = ?');
    params.push(status);
  } else {
    where.push('status = ?');
    params.push('active');
  }

  if (type) { where.push('type = ?'); params.push(type); }
  if (platform) { where.push('platform = ?'); params.push(platform); }
  // 城市用户只能查询自己城市的账号
  if (isCityRole(req.user.role)) {
    where.push('city_id = ?');
    params.push(req.user.city_id || '__none__');
  } else if (cityId || city_id) {
    where.push('city_id = ?');
    params.push(cityId || city_id);
  }

  const whereStr = `WHERE ${where.join(' AND ')}`;
  const accounts = db.prepare(`SELECT * FROM accounts ${whereStr} ORDER BY name`).all(...params);
  res.json(success(attachPublishStatus(accounts)));
});

app.post('/api/accounts', authRequired, (req, res) => {
  validateRequired(req.body, ['name']);
  const account = normalizeAccountPayload(req.body);
  // 城市用户只能创建 type=city 且 city_id 为自己的账号
  if (isCityRole(req.user.role)) {
    account.type = 'city';
    account.city_id = req.user.city_id;
  } else {
    validateHqAccountType(account);
  }
  const id = generateId();
  db.prepare(`
    INSERT INTO accounts (
      id, name, platform, platform_account, type, city_id, status, browser_profile,
      account_type, platform_label, cert, frequency, priority, owner, editor, purpose, remark,
      avatar, owner_avatar, qrcode_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    account.name,
    account.platform,
    account.platform_account,
    account.type,
    account.city_id,
    account.status,
    account.browser_profile,
    account.account_type,
    account.platform_label,
    account.cert,
    account.frequency,
    account.priority,
    account.owner,
    account.editor,
    account.purpose,
    account.remark,
    account.avatar || '',
    account.owner_avatar || '',
    account.qrcode_url || ''
  );
  savePublishStatus(id, req.body.publish_status);
  res.json(success({ id }, '创建成功'));
});

app.put('/api/accounts/:id', authRequired, (req, res) => {
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ? AND status != ?').get(req.params.id, 'archived');
  if (!existing) return res.status(404).json(error('账号不存在', 404));
  // 城市用户只能修改自己城市的账号
  if (isCityRole(req.user.role)) {
    if (existing.city_id !== req.user.city_id) return res.status(403).json(error('没有权限修改该账号', 403));
    // 城市用户只能修改部分字段，强制 type 和 city_id 不可改
    const { name, platform_account, status, remark, platform_label, qrcode_url } = req.body;
    const result = db.prepare(`
      UPDATE accounts SET
        name = ?,
        platform_account = ?,
        status = ?,
        platform_label = ?,
        remark = ?,
        qrcode_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, platform_account, status, platform_label || '', remark || '', qrcode_url || '', req.params.id);
    if (!result.changes) return res.status(409).json(error('账号未更新，请刷新后重试', 409));
    const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
    return res.json(success(updated, '更新成功'));
  }
  const account = normalizeAccountPayload(req.body);
  validateHqAccountType(account);
  const result = db.prepare(`
    UPDATE accounts SET
      name = ?,
      platform = ?,
      platform_account = ?,
      type = ?,
      city_id = ?,
      status = ?,
      browser_profile = ?,
      account_type = ?,
      platform_label = ?,
      cert = ?,
      frequency = ?,
      priority = ?,
      owner = ?,
      editor = ?,
      purpose = ?,
      remark = ?,
      avatar = ?,
      owner_avatar = ?,
      qrcode_url = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    account.name,
    account.platform,
    account.platform_account,
    account.type,
    account.city_id,
    account.status,
    account.browser_profile,
    account.account_type,
    account.platform_label,
    account.cert,
    account.frequency,
    account.priority,
    account.owner,
    account.editor,
    account.purpose,
    account.remark,
    account.avatar || '',
    account.owner_avatar || '',
    account.qrcode_url || '',
    req.params.id
  );
  if (!result.changes) return res.status(409).json(error('账号未更新，请刷新后重试', 409));
  savePublishStatus(req.params.id, req.body.publish_status);
  const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  res.json(success(updated, '更新成功'));
});

app.delete('/api/accounts/:id', authRequired, (req, res) => {
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json(error('账号不存在', 404));
  // 城市用户只能删除自己城市的账号
  if (isCityRole(req.user.role) && existing.city_id !== req.user.city_id) {
    return res.status(403).json(error('没有权限删除该账号', 403));
  }
  // 检查是否有发布记录
  const publishCount = db.prepare('SELECT COUNT(*) as cnt FROM city_distributions WHERE account_id = ?').get(req.params.id);
  if (publishCount?.cnt > 0) {
    return res.status(400).json(error(`该账号已有 ${publishCount.cnt} 条发布记录，建议编辑而非删除`, 400));
  }
  db.prepare('UPDATE accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('archived', req.params.id);
  res.json(success(null, '删除成功'));
});

app.put('/api/accounts/:id/publish-status', authRequired, (req, res) => {
  const { date, status, schedule_id, remark } = req.body;
  if (!date) return res.status(400).json(error('缺少日期', 400));
  db.prepare(`
    INSERT INTO account_publish_status (id, account_id, date, status, schedule_id, remark)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, date) DO UPDATE SET
      status = excluded.status,
      schedule_id = excluded.schedule_id,
      remark = excluded.remark,
      updated_at = CURRENT_TIMESTAMP
  `).run(generateId(), req.params.id, date, status || 'none', schedule_id, remark);
  res.json(success(null, '更新成功'));
});

// ========== 城市管理 API ==========
app.get('/api/cities', (req, res) => {
  const cities = db.prepare(`
    SELECT
      c.*,
      a_ks.name as kuaishou_name,
      a_wx.name as weixin_name
    FROM cities c
    LEFT JOIN accounts a_ks ON c.kuaishou_account_id = a_ks.id
    LEFT JOIN accounts a_wx ON c.weixin_account_id = a_wx.id
    WHERE c.status != 'archived'
    ORDER BY c.name
  `).all();
  const accounts = db.prepare(`
    SELECT * FROM accounts
    WHERE status != ? AND city_id IS NOT NULL
    ORDER BY name
  `).all('archived');
  const accountsByCity = accounts.reduce((map, account) => {
    if (!map[account.city_id]) map[account.city_id] = [];
    map[account.city_id].push({
      ...account,
      url: account.platform_account,
      type_note: account.account_type,
      platform_label: account.platform_label || platformLabelMap[account.platform] || account.platform,
      qrcode_url: account.qrcode_url
    });
    return map;
  }, {});
  cities.forEach(city => {
    city.accounts = accountsByCity[city.id] || [];
    city.contact = city.contact_name;
    city.phone = city.contact_info;
  });
  res.json(success(cities));
});

app.get('/api/cities/board', authRequired, (req, res) => {
  const { date = dayjs().format('YYYY-MM-DD') } = req.query;
  const monthStart = dayjs(date).startOf('month').format('YYYY-MM-DD');
  const monthEnd = dayjs(date).endOf('month').format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');
  const isCity = isCityRole(req.user.role);
  const scopedCityId = isCity ? req.user.city_id : null;
  const cityWhere = scopedCityId ? 'AND c.id = ?' : '';
  const cityParams = scopedCityId ? [scopedCityId] : [];
  const statusSql = cityDistributionWorkflow.statusSql('cd');
  const cities = db.prepare(`
    SELECT
      c.*,
      a_ks.name as kuaishou_name,
      a_wx.name as weixin_name,
      cds.status as daily_status,
      cds.reason as daily_status_reason,
      cds.updated_at as daily_status_updated_at,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ? AND ${statusSql.published}) as published_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ? AND ${statusSql.pending}) as pending_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ? AND ${statusSql.publishing}) as publishing_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ? AND ${statusSql.downloaded}) as downloaded_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ? AND ${statusSql.failed}) as failed_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ? AND ${statusSql.unfinished} AND cd.date < ?) as overdue_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ?) as total_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date >= ? AND cd.date <= ? AND ${statusSql.published}) as month_published_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date >= ? AND cd.date <= ? AND ${statusSql.pending}) as month_pending_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date >= ? AND cd.date <= ? AND ${statusSql.publishing}) as month_publishing_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date >= ? AND cd.date <= ? AND ${statusSql.downloaded}) as month_downloaded_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date >= ? AND cd.date <= ? AND ${statusSql.failed}) as month_failed_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date >= ? AND cd.date <= ? AND ${statusSql.unfinished} AND cd.date < ?) as month_overdue_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date >= ? AND cd.date <= ?) as month_total_count
    FROM cities c
    LEFT JOIN accounts a_ks ON c.kuaishou_account_id = a_ks.id
    LEFT JOIN accounts a_wx ON c.weixin_account_id = a_wx.id
    LEFT JOIN city_daily_publish_status cds ON cds.city_id = c.id AND cds.date = ?
    WHERE c.status != 'archived' ${cityWhere}
    ORDER BY c.name
  `).all(
    date, date, date, date, date, date, today, date,
    monthStart, monthEnd,
    monthStart, monthEnd,
    monthStart, monthEnd,
    monthStart, monthEnd,
    monthStart, monthEnd,
    monthStart, monthEnd, today,
    monthStart, monthEnd,
    date,
    ...cityParams
  );
  const accWhere = scopedCityId ? 'AND city_id = ?' : '';
  const accounts = db.prepare(`
    SELECT * FROM accounts
    WHERE status = ? AND type = ? AND city_id IS NOT NULL ${accWhere}
    ORDER BY name
  `).all('active', 'city', ...cityParams);
  const accountsByCity = accounts.reduce((map, account) => {
    if (!map[account.city_id]) map[account.city_id] = [];
    map[account.city_id].push({
      ...account,
      url: account.platform_account,
      platform_label: account.platform_label || account.platform
    });
    return map;
  }, {});
  cities.forEach(city => {
    city.accounts = accountsByCity[city.id] || [];
    city.account_name = city.accounts[0]?.name || city.kuaishou_name || city.weixin_name || '';
    city.daily_status = city.daily_status || 'normal';
    city.daily_status_reason = city.daily_status_reason || '';
  });
  res.json(success(cities));
});

app.put('/api/cities/:id/daily-status', authRequired, (req, res) => {
  const city = db.prepare("SELECT id, name FROM cities WHERE id = ? AND status != 'archived'").get(req.params.id);
  if (!city) return res.status(404).json(error('城市不存在', 404));
  if (isCityRole(req.user.role) && req.user.city_id !== city.id) {
    return res.status(403).json(error('只能修改本城市状态', 403));
  }
  const date = String(req.body.date || dayjs().format('YYYY-MM-DD')).slice(0, 10);
  const status = String(req.body.status || 'normal').trim();
  const reason = String(req.body.reason || '').trim();
  const allowed = new Set(['normal', 'vacation', 'paused', 'no_publish', 'other']);
  if (!allowed.has(status)) return res.status(400).json(error('状态值无效', 400));
  if (status !== 'normal' && !reason) return res.status(400).json(error('请填写状态原因', 400));

  if (status === 'normal') {
    db.prepare('DELETE FROM city_daily_publish_status WHERE city_id = ? AND date = ?').run(city.id, date);
    return res.json(success({ city_id: city.id, date, status: 'normal', reason: '' }, '已恢复正常'));
  }

  const id = generateId();
  db.prepare(`
    INSERT INTO city_daily_publish_status (id, city_id, date, status, reason, updated_by)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(city_id, date) DO UPDATE SET
      status = excluded.status,
      reason = excluded.reason,
      updated_by = excluded.updated_by,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, city.id, date, status, reason, req.user.id);
  const saved = db.prepare('SELECT * FROM city_daily_publish_status WHERE city_id = ? AND date = ?').get(city.id, date);
  res.json(success(saved, '城市今日状态已更新'));
});

app.get('/api/cities/:id', (req, res) => {
  const city = db.prepare(`
    SELECT c.*, a_ks.name as kuaishou_name, a_wx.name as weixin_name
    FROM cities c
    LEFT JOIN accounts a_ks ON c.kuaishou_account_id = a_ks.id
    LEFT JOIN accounts a_wx ON c.weixin_account_id = a_wx.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!city) {
    res.status(404).json({ success: false, message: '城市不存在' });
    return;
  }
  res.json(success(city));
});

app.post('/api/cities', (req, res) => {
  validateRequired(req.body, ['name']);
  const { name, kuaishou_account_id, weixin_account_id, netdisk_folder, material_folder_id } = req.body;
  const contactName = req.body.contact_name || req.body.contact || '';
  const contactInfo = req.body.contact_info || req.body.phone || '';
  const materialFolder = material_folder_id ? getFolderById(material_folder_id) : null;
  const id = generateId();
  db.prepare('INSERT INTO cities (id, name, contact_name, contact_info, kuaishou_account_id, weixin_account_id, netdisk_folder, material_folder_id, material_folder_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(id, name, contactName, contactInfo, kuaishou_account_id, weixin_account_id, netdisk_folder, materialFolder?.id || '', materialFolder?.path || '');
  res.json(success({ id }, '创建成功'));
});

app.put('/api/cities/:id', (req, res) => {
  const { name, kuaishou_account_id, weixin_account_id, netdisk_folder, status, material_folder_id } = req.body;
  const contactName = req.body.contact_name || req.body.contact || '';
  const contactInfo = req.body.contact_info || req.body.phone || '';
  const materialFolder = material_folder_id ? getFolderById(material_folder_id) : null;
  db.prepare('UPDATE cities SET name = ?, contact_name = ?, contact_info = ?, kuaishou_account_id = ?, weixin_account_id = ?, netdisk_folder = ?, status = ?, material_folder_id = COALESCE(?, material_folder_id), material_folder_path = COALESCE(?, material_folder_path), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, contactName, contactInfo, kuaishou_account_id, weixin_account_id, netdisk_folder, status || 'active', material_folder_id === undefined ? null : (materialFolder?.id || ''), material_folder_id === undefined ? null : (materialFolder?.path || ''), req.params.id);
  res.json(success(null, '更新成功'));
});

app.put('/api/cities/:id/material-folder', authRequired, (req, res) => {
  const city = db.prepare("SELECT * FROM cities WHERE id = ? AND status != 'archived'").get(req.params.id);
  if (!city) return res.status(404).json(error('城市不存在', 404));
  const folderId = String(req.body.folder_id || req.body.folderId || '').trim();
  if (!folderId) {
    db.prepare("UPDATE cities SET material_folder_id = '', material_folder_path = '', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(city.id);
    return res.json(success({ city_id: city.id, material_folder_id: '', material_folder_path: '' }, '已取消绑定'));
  }
  const folder = getFolderById(folderId);
  if (!folder) return res.status(404).json(error('素材文件夹不存在', 404));
  if (folder.id === MATERIAL_LEGACY_FOLDER_ID) return res.status(400).json(error('历史素材目录不能绑定城市', 400));
  db.prepare("UPDATE cities SET material_folder_id = ?, material_folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(folder.id, folder.path, city.id);
  res.json(success({ city_id: city.id, city_name: city.name, material_folder_id: folder.id, material_folder_path: folder.path }, '城市素材文件夹已绑定'));
});

app.get('/api/cities/:id/material-files', authRequired, (req, res) => {
  const city = db.prepare("SELECT * FROM cities WHERE id = ? AND COALESCE(status, 'active') != 'archived'").get(req.params.id);
  if (!city) return res.status(404).json(error('城市不存在', 404));
  if (isCityRole(req.user.role) && req.user.city_id !== city.id) return res.status(403).json(error('只能查看本城市素材', 403));
  if (!city.material_folder_id) return res.json(success({ folder: null, list: [], total: 0 }));
  const folder = getFolderById(city.material_folder_id);
  if (!folder) return res.json(success({ folder: null, list: [], total: 0 }));
  const pageSize = Math.min(Number(req.query.pageSize || 200), 500);
  const dateFrom = String(req.query.dateFrom || req.query.date || '').trim();
  const dateTo = String(req.query.dateTo || req.query.date || '').trim();
  const dateWhere = [];
  const dateParams = [];
  if (dateFrom) {
    dateWhere.push("COALESCE(mf.date, substr(mf.created_at, 1, 10)) >= ?");
    dateParams.push(dateFrom);
  }
  if (dateTo) {
    dateWhere.push("COALESCE(mf.date, substr(mf.created_at, 1, 10)) <= ?");
    dateParams.push(dateTo);
  }
  const folderPrefix = folder.path === '/' ? '/%' : `${folder.path}/%`;
  const files = db.prepare(`
    SELECT mf.*, vt.name as type_name
    FROM material_files mf
    LEFT JOIN video_types vt ON mf.video_type_id = vt.id
    LEFT JOIN material_folders folder ON mf.folder_id = folder.id
    WHERE mf.status != 'deleted'
      AND (
        mf.folder_id = ?
        OR folder.path LIKE ?
        OR mf.folder_path LIKE ?
      )
      ${dateWhere.length ? `AND ${dateWhere.join(' AND ')}` : ''}
    ORDER BY mf.created_at DESC
    LIMIT ?
  `).all(folder.id, folderPrefix, folderPrefix, ...dateParams, pageSize);
  res.json(success({ folder, list: files, total: files.length }));
});

app.delete('/api/cities/:id', (req, res) => {
  db.prepare('UPDATE cities SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('archived', req.params.id);
  db.prepare('UPDATE accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE city_id = ?').run('archived', req.params.id);
  res.json(success(null, '删除成功'));
});

// ========== 城市分发 API ==========
app.get('/api/city-video-reuse', authRequired, (req, res) => {
  ensureCityDistributionMaterialKeys();
  const {
    page = 1, pageSize = 20, dateFrom, dateTo, keyword,
    publishedPlatform, availablePlatform, account_id, onlyReusable
  } = req.query;
  const cityId = getCityReuseScope(req, req.query.cityId || req.query.city_id || '');
  if (isCityRole(req.user.role) && !cityId) return res.status(403).json(error('城市账号未绑定城市', 403));
  const publishedSql = cityDistributionPublishedSql('cd');

  const where = ["COALESCE(cd.material_key, '') != ''"];
  const params = [];
  if (cityId) { where.push('cd.city_id = ?'); params.push(cityId); }
  if (dateFrom) { where.push("COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) >= ?"); params.push(dateFrom); }
  if (dateTo) { where.push("COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) <= ?"); params.push(dateTo); }
  if (account_id) { where.push('cd.account_id = ?'); params.push(account_id); }
  if (keyword) {
    where.push('(cd.video_title LIKE ? OR cd.video_url LIKE ? OR cd.material_url LIKE ? OR a.name LIKE ?)');
    params.push(...Array(4).fill(`%${keyword}%`));
  }
  const whereSql = where.join(' AND ');
  const having = [];
  const havingParams = [];
  if (publishedPlatform) {
    having.push('SUM(CASE WHEN platform = ? THEN 1 ELSE 0 END) > 0');
    havingParams.push(publishedPlatform);
  }
  if (availablePlatform) {
    having.push('SUM(CASE WHEN platform = ? THEN 1 ELSE 0 END) = 0');
    havingParams.push(availablePlatform);
  }
  if (String(onlyReusable || '') === '1') {
    having.push(`COUNT(DISTINCT CASE WHEN platform IN (${REUSE_PLATFORMS.map(() => '?').join(',')}) THEN platform END) < ?`);
    havingParams.push(...REUSE_PLATFORMS, REUSE_PLATFORMS.length);
  }
  const havingSql = having.length ? `HAVING ${having.join(' AND ')}` : '';
  const baseSql = `
    WITH scoped AS (
      SELECT cd.*, c.name AS city_name, a.name AS account_name,
        COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') AS platform,
        COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) AS publish_date,
        CASE WHEN ${publishedSql} THEN 1 ELSE 0 END AS is_published
      FROM city_distributions cd
      LEFT JOIN cities c ON c.id = cd.city_id
      LEFT JOIN accounts a ON a.id = cd.account_id
      WHERE ${whereSql}
    ),
    grouped AS (
      SELECT
        city_id,
        material_key,
        COUNT(*) AS record_count,
        COUNT(DISTINCT CASE WHEN is_published = 1 THEN platform END) AS published_platform_count,
        GROUP_CONCAT(DISTINCT CASE WHEN is_published = 1 THEN platform END) AS published_platforms,
        MIN(publish_date) AS first_publish_date,
        MAX(publish_date) AS last_publish_date,
        SUM(CASE WHEN COALESCE(reuse_from_distribution_id, '') != '' THEN 1 ELSE 0 END) AS reuse_count
      FROM scoped
      GROUP BY city_id, material_key
      ${havingSql}
    )
  `;
  const list = db.prepare(`
    ${baseSql}
    SELECT g.*,
      latest.id AS latest_distribution_id,
      latest.video_title,
      latest.video_url,
      latest.material_url,
      latest.material_file_id,
      latest.city_name,
      latest.account_name AS latest_account_name,
      latest.platform AS latest_platform,
      latest.publish_time AS latest_publish_time,
      latest.actual_publish_time AS latest_actual_publish_time
    FROM grouped g
    JOIN scoped latest ON latest.id = (
      SELECT s2.id FROM scoped s2
      WHERE s2.city_id = g.city_id AND s2.material_key = g.material_key
      ORDER BY s2.publish_date DESC, s2.created_at DESC
      LIMIT 1
    )
    ORDER BY g.last_publish_date DESC, latest.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, ...havingParams, Number(pageSize), (Number(page) - 1) * Number(pageSize)).map(row => {
    const published = String(row.published_platforms || '').split(',').filter(Boolean);
    return {
      ...row,
      record_count: Number(row.record_count || 0),
      published_platform_count: Number(row.published_platform_count || 0),
      reuse_count: Number(row.reuse_count || 0),
      published_platforms: published,
      available_platforms: REUSE_PLATFORMS.filter(platform => !published.includes(platform))
    };
  });
  const totalRow = db.prepare(`${baseSql} SELECT COUNT(*) AS total FROM grouped`).get(...params, ...havingParams);
  const statsRows = db.prepare(`
    WITH scoped AS (
      SELECT cd.city_id, cd.material_key,
        COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') AS platform,
        COALESCE(cd.reuse_from_distribution_id, '') AS reuse_from_distribution_id,
        CASE WHEN ${publishedSql} THEN 1 ELSE 0 END AS is_published
      FROM city_distributions cd
      LEFT JOIN accounts a ON a.id = cd.account_id
      WHERE ${whereSql}
    ),
    grouped AS (
      SELECT city_id, material_key,
        COUNT(DISTINCT CASE WHEN is_published = 1 THEN platform END) AS platform_count,
        SUM(CASE WHEN COALESCE(reuse_from_distribution_id, '') != '' THEN 1 ELSE 0 END) AS reuse_count
      FROM scoped
      GROUP BY city_id, material_key
    )
    SELECT
      COUNT(*) AS video_count,
      SUM(CASE WHEN platform_count < ? THEN 1 ELSE 0 END) AS reusable_count,
      SUM(reuse_count) AS reuse_count
    FROM grouped
  `).get(...params, REUSE_PLATFORMS.length);
  const platformRows = db.prepare(`
    SELECT COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') AS platform, COUNT(*) AS count
    FROM city_distributions cd
    LEFT JOIN accounts a ON a.id = cd.account_id
    WHERE ${whereSql} AND ${publishedSql}
    GROUP BY platform
  `).all(...params);
  res.json(success({
    list,
    total: Number(totalRow?.total || 0),
    page: Number(page),
    pageSize: Number(pageSize),
    platforms: REUSE_PLATFORMS,
    stats: {
      video_count: Number(statsRows?.video_count || 0),
      reusable_count: Number(statsRows?.reusable_count || 0),
      reuse_count: Number(statsRows?.reuse_count || 0),
      platform_counts: platformRows
    }
  }));
});

app.get('/api/city-video-reuse/:materialKey/records', authRequired, (req, res) => {
  ensureCityDistributionMaterialKeys();
  const cityId = getCityReuseScope(req, req.query.cityId || req.query.city_id || '');
  const materialKey = String(req.params.materialKey || '').trim();
  if (!cityId || !materialKey) return res.status(400).json(error('缺少城市或视频标识', 400));
  const today = dayjs().format('YYYY-MM-DD');
  const records = db.prepare(`
    SELECT cd.*, c.name AS city_name, a.name AS account_name,
      COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') AS platform,
      a.platform_account
    FROM city_distributions cd
    LEFT JOIN cities c ON c.id = cd.city_id
    LEFT JOIN accounts a ON a.id = cd.account_id
    WHERE cd.city_id = ? AND cd.material_key = ?
    ORDER BY cd.date DESC, COALESCE(cd.publish_time, '') DESC, cd.created_at DESC
  `).all(cityId, materialKey).map(item => ({
    ...item,
    display_status: getCityDistributionDisplayStatus(item, today),
    status_label: CITY_DISTRIBUTION_STATUS_LABELS[normalizeCityDistributionStatus(item.status)] || item.status || '待下载'
  }));
  res.json(success({ list: records, total: records.length }));
});

const loadReusableVideoSource = (cityId, materialKey) => db.prepare(`
  SELECT cd.*
  FROM city_distributions cd
  WHERE cd.city_id = ? AND cd.material_key = ?
  ORDER BY COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) DESC, cd.created_at DESC
  LIMIT 1
`).get(cityId, materialKey);

const validateReuseAccount = (accountId, cityId) => {
  const account = db.prepare('SELECT id, city_id, type, name, platform FROM accounts WHERE id = ? AND status != ?').get(accountId, 'archived');
  if (!account || account.type !== 'city' || account.city_id !== cityId) {
    const err = new Error('请选择该城市绑定的城市账号');
    err.statusCode = 400;
    throw err;
  }
  return account;
};

app.post('/api/city-video-reuse/quick-publish', authRequired, (req, res) => {
  const cityId = getCityReuseScope(req, req.body.city_id || req.body.cityId || '');
  const materialKey = String(req.body.material_key || req.body.materialKey || '').trim();
  const accountId = String(req.body.account_id || req.body.accountId || '').trim();
  const account = validateReuseAccount(accountId, cityId);
  const source = loadReusableVideoSource(cityId, materialKey);
  if (!source) return res.status(404).json(error('可复用视频不存在', 404));
  const platform = resolveDistributionPlatform(req.body, account);
  const publishUrl = normalizeDistributionUrl(req.body.publish_url || req.body.publishUrl || '');
  const actualPublishTime = String(req.body.actual_publish_time || req.body.actualPublishTime || '').trim();
  if (!publishUrl) return res.status(400).json(error('请填写发布链接', 400));
  if (!actualPublishTime) return res.status(400).json(error('请填写实际发布时间', 400));
  try {
    assertCityVideoPlatformAvailable({ cityId, materialKey, platform });
  } catch (e) {
    return res.status(e.statusCode || 400).json({ ...error(e.message, e.statusCode || 400), data: { duplicate: e.duplicate } });
  }
  const id = generateId();
  const date = String(req.body.date || actualPublishTime.slice(0, 10) || dayjs().format('YYYY-MM-DD')).slice(0, 10);
  db.prepare(`
    INSERT INTO city_distributions (
      id, date, city_id, account_id, video_title, video_url, material_url, material_key,
      publish_time, publish_requirement, status, publish_screenshot,
      publish_platform, publish_account_name, publish_url, actual_publish_time,
      play_count, like_count, comment_count, deal_count, deal_amount, favorite_count, share_count, city_remark,
      submitted_by, submitted_at, published_at, material_file_id, schedule_id,
      reuse_from_distribution_id, reuse_mode
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, date, cityId, account.id,
    req.body.video_title || source.video_title || '复用视频',
    source.video_url || source.material_url || '',
    source.material_url || source.video_url || '',
    materialKey,
    req.body.publish_time || req.body.time || actualPublishTime.slice(11, 16) || '',
    req.body.publish_requirement || req.body.requirement || source.publish_requirement || '',
    req.body.publish_screenshot || '',
    platform,
    req.body.publish_account_name || account.name || '',
    publishUrl,
    actualPublishTime,
    req.body.play_count || 0,
    req.body.like_count || 0,
    req.body.comment_count || 0,
    req.body.deal_count || 0,
    req.body.deal_amount || 0,
    req.body.favorite_count || 0,
    req.body.share_count || 0,
    req.body.city_remark || '',
    req.user.id,
    dayjs().format(),
    dayjs().format(),
    source.material_file_id,
    source.schedule_id,
    source.id,
    'quick_publish'
  );
  const createdLog = loadCityDistributionForLog(id);
  setOperationLog(req, {
    action: 'city_video_reuse_quick_publish',
    actionLabel: '快速复用发布',
    resource: 'city_distributions',
    resourceId: id,
    summary: `${cityDistributionLogTitle(createdLog)}：复用发布到${platformLabelMap[platform] || platform}`,
    after: cityDistributionLogSnapshot(createdLog)
  });
  res.json(success({ id }, '复用发布已保存'));
});

app.post('/api/city-video-reuse/schedule', authRequired, (req, res) => {
  const cityId = getCityReuseScope(req, req.body.city_id || req.body.cityId || '');
  const materialKey = String(req.body.material_key || req.body.materialKey || '').trim();
  const accountId = String(req.body.account_id || req.body.accountId || '').trim();
  const account = validateReuseAccount(accountId, cityId);
  const source = loadReusableVideoSource(cityId, materialKey);
  if (!source) return res.status(404).json(error('可复用视频不存在', 404));
  const platform = resolveDistributionPlatform(req.body, account);
  try {
    assertCityVideoPlatformAvailable({ cityId, materialKey, platform });
  } catch (e) {
    return res.status(e.statusCode || 400).json({ ...error(e.message, e.statusCode || 400), data: { duplicate: e.duplicate } });
  }
  const id = generateId();
  const date = String(req.body.date || dayjs().format('YYYY-MM-DD')).slice(0, 10);
  db.prepare(`
    INSERT INTO city_distributions (
      id, date, city_id, account_id, video_title, video_url, material_url, material_key,
      publish_time, publish_requirement, status, publish_platform, publish_account_name,
      material_file_id, schedule_id, reuse_from_distribution_id, reuse_mode
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'distributed', ?, ?, ?, ?, ?, ?)
  `).run(
    id, date, cityId, account.id,
    req.body.video_title || source.video_title || '复用视频',
    source.video_url || source.material_url || '',
    source.material_url || source.video_url || '',
    materialKey,
    req.body.publish_time || req.body.time || '',
    req.body.publish_requirement || req.body.requirement || source.publish_requirement || '',
    platform,
    req.body.publish_account_name || account.name || '',
    source.material_file_id,
    source.schedule_id,
    source.id,
    'schedule'
  );
  const createdLog = loadCityDistributionForLog(id);
  setOperationLog(req, {
    action: 'city_video_reuse_schedule',
    actionLabel: '创建复用排期',
    resource: 'city_distributions',
    resourceId: id,
    summary: `${cityDistributionLogTitle(createdLog)}：复用排期到${platformLabelMap[platform] || platform}`,
    after: cityDistributionLogSnapshot(createdLog)
  });
  res.json(success({ id }, '复用排期已创建'));
});

app.get('/api/city-distributions', authRequired, (req, res) => {
  const {
    page = 1, pageSize = 20, dateFrom, dateTo, actualDateFrom, actualDateTo,
    downloadDateFrom, downloadDateTo, submittedDateFrom, submittedDateTo, cityId, status, downloadStatus,
    account_id, timeFrom, timeTo, keyword
  } = req.query;
  let where = [];
  let params = [];

  if (dateFrom) { where.push('cd.date >= ?'); params.push(dateFrom); }
  if (dateTo) { where.push('cd.date <= ?'); params.push(dateTo); }
  if (actualDateFrom) {
    where.push("COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) >= ?");
    params.push(actualDateFrom);
  }
  if (actualDateTo) {
    where.push("COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) <= ?");
    params.push(actualDateTo);
  }
  if (downloadDateFrom) {
    where.push("substr(cd.downloaded_at, 1, 10) >= ?");
    params.push(downloadDateFrom);
  }
  if (downloadDateTo) {
    where.push("substr(cd.downloaded_at, 1, 10) <= ?");
    params.push(downloadDateTo);
  }
  if (submittedDateFrom) {
    where.push("substr(cd.submitted_at, 1, 10) >= ?");
    params.push(submittedDateFrom);
  }
  if (submittedDateTo) {
    where.push("substr(cd.submitted_at, 1, 10) <= ?");
    params.push(submittedDateTo);
  }
  if (cityId) { where.push('cd.city_id = ?'); params.push(cityId); }
  if (status) {
    const filter = cityDistributionWorkflow.statusFilterSql('cd', status, dayjs().format('YYYY-MM-DD'));
    where.push(filter.clause);
    params.push(...filter.params);
  }
  if (downloadStatus === 'downloaded') where.push('cd.downloaded_at IS NOT NULL');
  if (downloadStatus === 'not_downloaded') where.push('cd.downloaded_at IS NULL');
  if (account_id) { where.push('cd.account_id = ?'); params.push(account_id); }
  if (timeFrom) { where.push('cd.publish_time >= ?'); params.push(timeFrom); }
  if (timeTo) { where.push('cd.publish_time <= ?'); params.push(timeTo); }
  if (keyword) {
    where.push('(cd.video_title LIKE ? OR cd.video_url LIKE ? OR cd.publish_account_name LIKE ? OR c.name LIKE ? OR a.name LIKE ? OR a.platform LIKE ?)');
    params.push(...Array(6).fill(`%${keyword}%`));
  }
  if (isCityRole(req.user.role)) {
    where.push('cd.city_id = ?');
    params.push(req.user.city_id || '__none__');
  }

  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const today = dayjs().format('YYYY-MM-DD');
  const distributions = db.prepare(`
    SELECT
      cd.*,
      c.name as city_name,
      a.name as account_name,
      a.platform,
      a.platform_account
    FROM city_distributions cd
    LEFT JOIN cities c ON cd.city_id = c.id
    LEFT JOIN accounts a ON cd.account_id = a.id
    ${whereStr}
    ORDER BY cd.date DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize)).map(item => ({
    ...item,
    display_status: getCityDistributionDisplayStatus(item, today),
    status_label: CITY_DISTRIBUTION_STATUS_LABELS[normalizeCityDistributionStatus(item.status)] || item.status || '待下载'
  }));

  const { total } = db.prepare(`
    SELECT COUNT(*) as total
    FROM city_distributions cd
    LEFT JOIN cities c ON cd.city_id = c.id
    LEFT JOIN accounts a ON cd.account_id = a.id
    ${whereStr}
  `).get(...params);

  res.json(success({ list: distributions, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.get('/api/city-distributions/:id', authRequired, (req, res) => {
  const item = db.prepare(`
    SELECT
      cd.*,
      c.name as city_name,
      a.name as account_name,
      a.platform,
      a.platform_account
    FROM city_distributions cd
    LEFT JOIN cities c ON cd.city_id = c.id
    LEFT JOIN accounts a ON cd.account_id = a.id
    WHERE cd.id = ?
  `).get(req.params.id);
  if (!item) return res.status(404).json(error('下发任务不存在', 404));
  if (isCityRole(req.user.role) && item.city_id !== req.user.city_id) {
    return res.status(403).json(error('只能查看本城市任务', 403));
  }
  const today = dayjs().format('YYYY-MM-DD');
  res.json(success({
    ...item,
    display_status: getCityDistributionDisplayStatus(item, today),
    status_label: CITY_DISTRIBUTION_STATUS_LABELS[normalizeCityDistributionStatus(item.status)] || item.status || '待下载'
  }));
});

app.post('/api/city-distributions/:id/download', authRequired, (req, res) => {
  if (!isCityRole(req.user.role)) {
    return res.status(403).json(error('仅城市端可记录素材下载', 403));
  }
  const distribution = db.prepare(`
    SELECT id, city_id, video_url, material_url, status, downloaded_at, download_count
    FROM city_distributions WHERE id = ?
  `).get(req.params.id);
  if (!distribution) return res.status(404).json(error('下发任务不存在', 404));
  if (!req.user.city_id || distribution.city_id !== req.user.city_id) {
    return res.status(403).json(error('无权下载其他城市的素材', 403));
  }
  if (!distribution.video_url && !distribution.material_url) {
    return res.status(400).json(error('当前任务没有可下载的素材', 400));
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const currentStatus = normalizeCityDistributionStatus(distribution.status);
  const nextStatus = ['published', 'failed'].includes(currentStatus)
    ? currentStatus
    : 'downloaded';
  const beforeLog = loadCityDistributionForLog(distribution.id);
  db.prepare(`
    UPDATE city_distributions
    SET downloaded_at = COALESCE(downloaded_at, ?),
        last_downloaded_at = ?,
        download_count = COALESCE(download_count, 0) + 1,
        downloaded_by = COALESCE(downloaded_by, ?),
        status = ?,
        workflow_updated_at = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(now, now, req.user.id, nextStatus, now, distribution.id);

  const updated = db.prepare(`
    SELECT id, status, downloaded_at, last_downloaded_at, download_count, downloaded_by, workflow_updated_at
    FROM city_distributions WHERE id = ?
  `).get(distribution.id);
  const afterLog = loadCityDistributionForLog(distribution.id);
  setOperationLog(req, {
    action: 'city_distribution_download',
    actionLabel: '城市任务下载素材',
    resource: 'city_distributions',
    resourceId: distribution.id,
    summary: `${cityDistributionLogTitle(afterLog)}：${CITY_DISTRIBUTION_STATUS_LABELS[currentStatus] || currentStatus} -> ${CITY_DISTRIBUTION_STATUS_LABELS[nextStatus] || nextStatus}`,
    before: cityDistributionLogSnapshot(beforeLog),
    after: cityDistributionLogSnapshot(afterLog)
  });
  res.json(success(updated, '已记录素材下载'));
});

app.put('/api/city-distributions/:id/workflow', authRequired, (req, res) => {
  const { status, workflow_note, exception_type, exception_reason } = req.body || {};
  const nextStatus = normalizeCityDistributionStatus(status);

  const existing = db.prepare('SELECT * FROM city_distributions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json(error('下发任务不存在', 404));
  if (isCityRole(req.user.role) && existing.city_id !== req.user.city_id) {
    return res.status(403).json(error('只能操作本城市任务', 403));
  }
  const beforeLog = loadCityDistributionForLog(existing.id);
  const transition = cityDistributionWorkflow.validateTransition(existing.status, nextStatus, {
    isAdmin: !isCityRole(req.user.role)
  });
  if (!transition.ok) {
    return res.status(400).json(error(transition.message, 400));
  }
  if (nextStatus === 'failed' && !String(exception_reason || workflow_note || '').trim()) {
    return res.status(400).json(error('请填写异常原因', 400));
  }

  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const finalExceptionReason = nextStatus === 'failed'
    ? String(exception_reason || workflow_note || '').trim()
    : '';
  db.prepare(`
    UPDATE city_distributions SET
      status = ?,
      workflow_note = COALESCE(?, workflow_note),
      exception_type = ?,
      exception_reason = ?,
      exception_at = ?,
      failed_reason = ?,
      workflow_updated_at = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    nextStatus,
    workflow_note === undefined ? null : String(workflow_note || '').trim(),
    nextStatus === 'failed' ? String(exception_type || '').trim() : '',
    finalExceptionReason,
    nextStatus === 'failed' ? now : '',
    finalExceptionReason,
    now,
    existing.id
  );

  const updated = db.prepare('SELECT * FROM city_distributions WHERE id = ?').get(existing.id);
  const afterLog = loadCityDistributionForLog(existing.id);
  setOperationLog(req, {
    action: 'city_distribution_workflow',
    actionLabel: `城市任务标记为${CITY_DISTRIBUTION_STATUS_LABELS[nextStatus] || nextStatus}`,
    resource: 'city_distributions',
    resourceId: existing.id,
    summary: `${cityDistributionLogTitle(afterLog)}：${CITY_DISTRIBUTION_STATUS_LABELS[transition.current] || transition.current} -> ${CITY_DISTRIBUTION_STATUS_LABELS[nextStatus] || nextStatus}`,
    before: cityDistributionLogSnapshot(beforeLog),
    after: cityDistributionLogSnapshot(afterLog)
  });
  res.json(success({
    ...updated,
    display_status: getCityDistributionDisplayStatus(updated),
    status_label: CITY_DISTRIBUTION_STATUS_LABELS[normalizeCityDistributionStatus(updated.status)] || updated.status
  }, '任务流程已更新'));
});

app.post('/api/city-distributions/:id/remind', authRequired, adminRequired, (req, res) => {
  const distribution = db.prepare(`
    SELECT cd.*, c.name AS city_name, a.name AS account_name
    FROM city_distributions cd
    LEFT JOIN cities c ON c.id = cd.city_id
    LEFT JOIN accounts a ON a.id = cd.account_id
    WHERE cd.id = ?
  `).get(req.params.id);
  if (!distribution) return res.status(404).json(error('下发任务不存在', 404));
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(`
    UPDATE city_distributions
    SET reminded_at = ?, remind_count = COALESCE(remind_count, 0) + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(now, distribution.id);
  notifyCityUsers(distribution.city_id, {
    type: 'city_distribution_remind',
    title: '发布任务提醒',
    content: `${distribution.city_name || '城市'} 的「${distribution.video_title || distribution.account_name || '发布任务'}」还未完成，请及时处理。`,
    level: 'warning',
    relatedType: 'city_distribution',
    relatedId: distribution.id
  });
  setOperationLog(req, {
    action: 'city_distribution_remind',
    actionLabel: '催办城市任务',
    resource: 'city_distributions',
    resourceId: distribution.id,
    summary: `${cityDistributionLogTitle(distribution)}：已发送第 ${Number(distribution.remind_count || 0) + 1} 次催办`,
    before: cityDistributionLogSnapshot(distribution),
    after: { id: distribution.id, reminded_at: now, remind_count: Number(distribution.remind_count || 0) + 1 }
  });
  res.json(success({ id: distribution.id, reminded_at: now }, '已提醒城市端'));
});

app.get('/api/cities/:id/task-detail', authRequired, (req, res) => {
  const cityId = req.params.id;
  if (isCityRole(req.user.role) && req.user.city_id !== cityId) {
    return res.status(403).json(error('无权查看其他城市的任务', 403));
  }
  const city = db.prepare('SELECT id, name, status FROM cities WHERE id = ?').get(cityId);
  if (!city) return res.status(404).json(error('城市不存在', 404));

  const requestedMonth = /^\d{4}-\d{2}$/.test(String(req.query.month || ''))
    ? String(req.query.month)
    : dayjs().format('YYYY-MM');
  const monthStart = `${requestedMonth}-01`;
  const monthEnd = dayjs(monthStart).endOf('month').format('YYYY-MM-DD');
  const today = dayjs().format('YYYY-MM-DD');
  const statusSql = cityDistributionWorkflow.statusSql('cd');

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS monthAssigned,
      SUM(CASE WHEN cd.date = ? THEN 1 ELSE 0 END) AS todayAssigned,
      SUM(CASE WHEN ${statusSql.published} THEN 1 ELSE 0 END) AS monthPublished,
      SUM(CASE WHEN cd.date = ? AND ${statusSql.published} THEN 1 ELSE 0 END) AS todayPublished,
      SUM(CASE WHEN cd.downloaded_at IS NOT NULL THEN 1 ELSE 0 END) AS downloaded,
      SUM(CASE WHEN cd.downloaded_at IS NULL THEN 1 ELSE 0 END) AS notDownloaded,
      SUM(CASE WHEN ${statusSql.publishing} THEN 1 ELSE 0 END) AS publishing,
      SUM(CASE WHEN ${statusSql.failed} THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN ${statusSql.unfinished} AND cd.date < ? THEN 1 ELSE 0 END) AS overdue
    FROM city_distributions cd
    WHERE cd.city_id = ? AND cd.date >= ? AND cd.date <= ?
  `).get(today, today, today, cityId, monthStart, monthEnd);

  const tasks = db.prepare(`
    SELECT cd.*, a.name AS account_name, a.platform
    FROM city_distributions cd
    LEFT JOIN accounts a ON a.id = cd.account_id
    WHERE cd.city_id = ? AND cd.date >= ? AND cd.date <= ?
    ORDER BY cd.date DESC, COALESCE(cd.publish_time, '') DESC, cd.created_at DESC
  `).all(cityId, monthStart, monthEnd).map(task => ({
    ...task,
    display_status: getCityDistributionDisplayStatus(task, today),
    status_label: CITY_DISTRIBUTION_STATUS_LABELS[normalizeCityDistributionStatus(task.status)] || task.status
  }));

  const normalizedSummary = Object.fromEntries(
    Object.entries(summary || {}).map(([key, value]) => [key, Number(value || 0)])
  );
  normalizedSummary.publishRate = normalizedSummary.monthAssigned
    ? Math.round((normalizedSummary.monthPublished / normalizedSummary.monthAssigned) * 100)
    : 0;

  res.json(success({ city, month: requestedMonth, summary: normalizedSummary, tasks }));
});

app.post('/api/city-distributions', (req, res) => {
  let { date, city_id, account_id, video_title, video_url, material_file_id, schedule_id, time, publish_time, material_url } = req.body;
  const {
    status, publish_screenshot, publish_platform, publish_account_name, publish_url, actual_publish_time,
    play_count, like_count, comment_count, deal_count, deal_amount, favorite_count, share_count, city_remark
  } = req.body;
  const publishRequirement = req.body.publish_requirement || req.body.requirement || '';
  if (isCityRole(req.user.role)) {
    city_id = req.user.city_id;
    if (!account_id) {
      const defaultAccount = db.prepare("SELECT id FROM accounts WHERE city_id = ? AND type = 'city' AND status = 'active' ORDER BY created_at LIMIT 1").get(city_id);
      account_id = defaultAccount?.id;
    }
  }
  if (!date || !city_id || !account_id) {
    return res.status(400).json(error('缺少必填字段：date, city_id, account_id', 400));
  }
  const account = db.prepare('SELECT id, city_id, type, platform FROM accounts WHERE id = ? AND status != ?').get(account_id, 'archived');
  if (!account || account.type !== 'city' || account.city_id !== city_id) {
    return res.status(400).json(error('请选择该城市绑定的城市账号', 400));
  }
  const finalMaterialUrl = normalizeDistributionUrl(material_url || video_url || '');
  const finalVideoUrl = normalizeDistributionUrl(video_url || material_url || '');
  const materialKey = buildCityDistributionMaterialKey({ material_file_id, material_url: finalMaterialUrl, video_url: finalVideoUrl });
  const finalPublishPlatform = resolveDistributionPlatform({ publish_platform }, account);
  try {
    assertCityVideoPlatformAvailable({ cityId: city_id, materialKey, platform: finalPublishPlatform });
  } catch (e) {
    return res.status(e.statusCode || 400).json({ ...error(e.message, e.statusCode || 400), data: { duplicate: e.duplicate } });
  }
  const id = generateId();
  const isCitySubmit = isCityRole(req.user.role);
  const finalStatus = isCitySubmit ? 'published' : normalizeCityDistributionStatus(status);
  if (isCitySubmit && (finalStatus === 'published' || publish_url || actual_publish_time)) {
    if (!actual_publish_time) {
      return res.status(400).json(error('请填写实际发布时间', 400));
    }
    const actualPublishDate = String(actual_publish_time).slice(0, 10);
    const taskDate = String(date).slice(0, 10);
    if (actualPublishDate !== taskDate) {
      return res.status(400).json(error(`实际发布时间必须与发布日期一致：${taskDate}`, 400));
    }
  }
  const finalActualPublishTime = actual_publish_time || '';
  const finalPublishedAt = finalStatus === 'published' ? dayjs().format() : null;
  db.prepare(`
    INSERT INTO city_distributions (
      id, date, city_id, account_id, video_title, video_url, material_url, material_key,
      publish_time, publish_requirement, status, publish_screenshot,
      publish_platform, publish_account_name, publish_url, actual_publish_time,
      play_count, like_count, comment_count, deal_count, deal_amount, favorite_count, share_count, city_remark,
      submitted_by, submitted_at, published_at, material_file_id, schedule_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, date, city_id, account_id, video_title || '城市下发任务', finalVideoUrl,
    finalMaterialUrl, materialKey, publish_time || time || '', publishRequirement, finalStatus,
    publish_screenshot || '', finalPublishPlatform, publish_account_name || '', publish_url || '',
    finalActualPublishTime, play_count || 0, like_count || 0, comment_count || 0, deal_count || 0, deal_amount || 0, favorite_count || 0,
    share_count || 0, city_remark || '', isCitySubmit ? req.user.id : null,
    isCitySubmit && (finalStatus === 'published' || publish_url) ? dayjs().format() : null,
    finalPublishedAt, material_file_id, schedule_id
  );
  const city = db.prepare('SELECT name FROM cities WHERE id = ?').get(city_id);
  notifyCityUsers(city_id, {
    type: 'city_distribution',
    title: '收到新的下发任务',
    content: `${city?.name || '城市'} 有新的素材发布任务，请进入城市端处理。`,
    level: 'info',
    relatedType: 'city_distribution',
    relatedId: id
  });
  const createdLog = loadCityDistributionForLog(id);
  setOperationLog(req, {
    action: 'city_distribution_create',
    actionLabel: isCitySubmit ? '城市提交发布数据' : '下发城市任务',
    resource: 'city_distributions',
    resourceId: id,
    summary: `${cityDistributionLogTitle(createdLog)}：${CITY_DISTRIBUTION_STATUS_LABELS[finalStatus] || finalStatus}`,
    after: cityDistributionLogSnapshot(createdLog)
  });
  res.json(success({ id }, '下发成功'));
});

app.put('/api/city-distributions/:id', (req, res) => {
  const {
    date, city_id, account_id, video_title, video_url, material_url, time, publish_time,
    status, publish_screenshot, material_file_id, schedule_id, failed_reason,
    publish_platform, publish_account_name, publish_url, actual_publish_time,
    play_count, like_count, comment_count, deal_count, deal_amount, favorite_count, share_count, city_remark
  } = req.body;
  const publishRequirement = req.body.publish_requirement || req.body.requirement;
  const existing = db.prepare('SELECT * FROM city_distributions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json(error('下发任务不存在', 404));
  if (isCityRole(req.user.role) && existing.city_id !== req.user.city_id) {
    return res.status(403).json(error('只能操作本城市任务', 403));
  }
  const beforeLog = loadCityDistributionForLog(existing.id);
  if (isCityRole(req.user.role) && (status === 'published' || publish_url || actual_publish_time)) {
    if (!actual_publish_time) {
      return res.status(400).json(error('请填写实际发布时间', 400));
    }
    const actualPublishDate = String(actual_publish_time).slice(0, 10);
    const taskDate = String(existing.date).slice(0, 10);
    if (actualPublishDate !== taskDate) {
      return res.status(400).json(error(`实际发布时间必须与下发任务日期一致：${taskDate}`, 400));
    }
  }
  const nextCityId = city_id || existing.city_id;
  const nextAccountId = account_id || existing.account_id;
  const nextAccount = nextAccountId
    ? db.prepare('SELECT id, city_id, type, platform FROM accounts WHERE id = ? AND status != ?').get(nextAccountId, 'archived')
    : null;
  if (nextAccountId && nextCityId) {
    if (!nextAccount || nextAccount.type !== 'city' || nextAccount.city_id !== nextCityId) {
      return res.status(400).json(error('请选择该城市绑定的城市账号', 400));
    }
  }
  const nextVideoUrl = video_url === undefined ? existing.video_url : normalizeDistributionUrl(video_url || material_url || '');
  const nextMaterialUrl = material_url === undefined ? existing.material_url : normalizeDistributionUrl(material_url || video_url || '');
  const nextMaterialFileId = material_file_id === undefined ? existing.material_file_id : material_file_id;
  const materialKey = buildCityDistributionMaterialKey({
    material_file_id: nextMaterialFileId,
    material_url: nextMaterialUrl,
    video_url: nextVideoUrl
  }) || existing.material_key || '';
  const nextPublishPlatform = publish_platform === undefined
    ? (existing.publish_platform || nextAccount?.platform || '')
    : resolveDistributionPlatform({ publish_platform }, nextAccount || {});
  try {
    assertCityVideoPlatformAvailable({ cityId: nextCityId, materialKey, platform: nextPublishPlatform, excludeId: existing.id });
  } catch (e) {
    return res.status(e.statusCode || 400).json({ ...error(e.message, e.statusCode || 400), data: { duplicate: e.duplicate } });
  }
  const nextStatus = status === undefined ? null : normalizeCityDistributionStatus(status);
  const publishedAt = nextStatus === 'published' ? dayjs().format() : null;
  const workflowUpdatedAt = nextStatus ? dayjs().format('YYYY-MM-DD HH:mm:ss') : null;
  const finalFailedReason = nextStatus === 'published' ? '' : failed_reason;
  db.prepare(`
    UPDATE city_distributions SET
      date = COALESCE(?, date),
      city_id = COALESCE(?, city_id),
      account_id = COALESCE(?, account_id),
      video_title = COALESCE(?, video_title),
      video_url = COALESCE(?, video_url),
      material_url = COALESCE(?, material_url),
      material_key = COALESCE(?, material_key),
      publish_time = COALESCE(?, publish_time),
      publish_requirement = COALESCE(?, publish_requirement),
      status = COALESCE(?, status),
      publish_screenshot = COALESCE(?, publish_screenshot),
      publish_platform = COALESCE(?, publish_platform),
      publish_account_name = COALESCE(?, publish_account_name),
      publish_url = COALESCE(?, publish_url),
      actual_publish_time = COALESCE(?, actual_publish_time),
      play_count = COALESCE(?, play_count),
      like_count = COALESCE(?, like_count),
      comment_count = COALESCE(?, comment_count),
      deal_count = COALESCE(?, deal_count),
      deal_amount = COALESCE(?, deal_amount),
      favorite_count = COALESCE(?, favorite_count),
      share_count = COALESCE(?, share_count),
      city_remark = COALESCE(?, city_remark),
      submitted_by = COALESCE(?, submitted_by),
      submitted_at = COALESCE(?, submitted_at),
      confirmed_at = COALESCE(?, confirmed_at),
      published_at = COALESCE(?, published_at),
      material_file_id = COALESCE(?, material_file_id),
      schedule_id = COALESCE(?, schedule_id),
      failed_reason = COALESCE(?, failed_reason),
      exception_type = CASE WHEN ? = 'published' THEN '' ELSE exception_type END,
      exception_reason = CASE WHEN ? = 'published' THEN '' ELSE exception_reason END,
      exception_at = CASE WHEN ? = 'published' THEN '' ELSE exception_at END,
      workflow_updated_at = COALESCE(?, workflow_updated_at),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    date, city_id, account_id, video_title, video_url, material_url || video_url, materialKey || null, publish_time || time,
    publishRequirement, nextStatus, publish_screenshot,
    publish_platform, publish_account_name, publish_url, actual_publish_time,
    play_count, like_count, comment_count, deal_count, deal_amount, favorite_count, share_count, city_remark,
    isCityRole(req.user.role) ? req.user.id : null,
    isCityRole(req.user.role) && (status === 'published' || publish_url) ? dayjs().format() : null,
    publishedAt, publishedAt, material_file_id, schedule_id,
    finalFailedReason, nextStatus, nextStatus, nextStatus, workflowUpdatedAt, req.params.id
  );
  const afterLog = loadCityDistributionForLog(req.params.id);
  setOperationLog(req, {
    action: 'city_distribution_update',
    actionLabel: nextStatus ? `更新城市任务为${CITY_DISTRIBUTION_STATUS_LABELS[nextStatus] || nextStatus}` : '编辑城市任务',
    resource: 'city_distributions',
    resourceId: req.params.id,
    summary: `${cityDistributionLogTitle(afterLog)}${nextStatus ? `：${CITY_DISTRIBUTION_STATUS_LABELS[normalizeCityDistributionStatus(beforeLog?.status)] || beforeLog?.status} -> ${CITY_DISTRIBUTION_STATUS_LABELS[nextStatus] || nextStatus}` : '：任务信息已更新'}`,
    before: cityDistributionLogSnapshot(beforeLog),
    after: cityDistributionLogSnapshot(afterLog)
  });
  res.json(success(null, '更新成功'));
});

app.delete('/api/city-distributions/:id', (req, res) => {
  const beforeLog = loadCityDistributionForLog(req.params.id);
  db.prepare('DELETE FROM city_distributions WHERE id = ?').run(req.params.id);
  setOperationLog(req, {
    action: 'city_distribution_delete',
    actionLabel: '删除城市任务',
    resource: 'city_distributions',
    resourceId: req.params.id,
    summary: `${cityDistributionLogTitle(beforeLog)}：任务已删除`,
    before: cityDistributionLogSnapshot(beforeLog)
  });
  res.json(success(null, '删除成功'));
});

// 批量创建城市分发
app.post('/api/city-distributions/batch', (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json(error('请求体必须是非空数组', 400));
  }
  const reuseGroups = new Map();
  items.forEach((item, index) => {
    const cityId = isCityRole(req.user.role) ? req.user.city_id : item.city_id;
    const account = item.account_id
      ? db.prepare('SELECT id, platform FROM accounts WHERE id = ? AND status != ?').get(item.account_id, 'archived')
      : null;
    const materialKey = buildCityDistributionMaterialKey(item);
    const platform = resolveDistributionPlatform(item, account || {});
    if (!cityId || !materialKey || !platform) return;
    const key = `${cityId}|${materialKey}|${platform}`;
    if (!reuseGroups.has(key)) reuseGroups.set(key, { material_key: materialKey, platform, rows: [] });
    reuseGroups.get(key).rows.push(index + 1);
  });
  const duplicates = [...reuseGroups.values()].filter(item => item.rows.length > 1);
  if (duplicates.length) {
    return res.status(400).json({
      code: 400,
      message: `发现 ${duplicates.length} 个同视频同平台重复任务，请修改后再下发`,
      data: { duplicates }
    });
  }
  const insert = db.prepare(`
    INSERT INTO city_distributions (
      id, date, city_id, account_id, video_title, video_url, material_url, material_key,
      publish_time, publish_requirement, status, material_file_id, schedule_id, publish_platform
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const results = [];
  const insertAll = db.transaction((items) => {
    for (const item of items) {
      const cityId = isCityRole(req.user.role) ? req.user.city_id : item.city_id;
      const account = db.prepare('SELECT id, city_id, type, platform FROM accounts WHERE id = ? AND status != ?').get(item.account_id, 'archived');
      if (!item.date || !cityId || !item.account_id) {
        throw new Error('批量下发缺少必填字段：date, city_id, account_id');
      }
      if (!account || account.type !== 'city' || account.city_id !== cityId) {
        throw new Error('批量下发包含不属于该城市的账号');
      }
      const videoUrl = normalizeDistributionUrl(item.video_url || item.material_url);
      const materialUrl = normalizeDistributionUrl(item.material_url || item.video_url);
      const materialKey = buildCityDistributionMaterialKey({ ...item, video_url: videoUrl, material_url: materialUrl });
      const platform = resolveDistributionPlatform(item, account);
      assertCityVideoPlatformAvailable({ cityId, materialKey, platform });
      const id = generateId();
      insert.run(
        id,
        item.date,
        cityId,
        item.account_id,
        item.video_title || '城市下发任务',
        videoUrl,
        materialUrl,
        materialKey,
        item.publish_time || item.time || '',
        item.publish_requirement || item.requirement || '',
        normalizeCityDistributionStatus(item.status),
        item.material_file_id,
        item.schedule_id,
        platform
      );
      results.push({ id, date: item.date, city_id: cityId, account_id: item.account_id });
    }
  });
  try {
    insertAll(items);
    const cityIds = [...new Set(results.map(item => item.city_id).filter(Boolean))];
    cityIds.forEach(cityId => {
      const city = db.prepare('SELECT name FROM cities WHERE id = ?').get(cityId);
      notifyCityUsers(cityId, {
        type: 'city_distribution',
        title: '收到新的批量下发任务',
        content: `${city?.name || '城市'} 收到 ${results.filter(item => item.city_id === cityId).length} 条素材发布任务，请进入城市端处理。`,
        level: 'info',
        relatedType: 'city_distribution',
        relatedId: results.find(item => item.city_id === cityId)?.id
      });
    });
    setOperationLog(req, {
      action: 'city_distribution_batch_create',
      actionLabel: '批量下发城市任务',
      resource: 'city_distributions',
      resourceId: results[0]?.id || null,
      summary: `批量下发 ${results.length} 条城市任务，覆盖 ${cityIds.length} 个城市`,
      after: { count: results.length, city_ids: cityIds, task_ids: results.map(item => item.id) }
    });
    res.json(success(results, `成功创建${results.length}条分发记录`));
  } catch (e) {
    res.status(400).json(error(e.message || '批量下发失败', 400));
  }
});

// ========== 城市蓝V账号 API ==========
app.get('/api/bluev-fields', authRequired, (req, res) => {
  const fields = db.prepare('SELECT * FROM bluev_fields WHERE is_active = 1 ORDER BY sort_order').all();
  res.json(success(fields));
});

app.post('/api/bluev-fields', authRequired, (req, res) => {
  const { field_key, field_label, field_type = 'text', field_options = '', sort_order = 0, is_required = 0 } = req.body;
  if (!field_key || !field_label) {
    return res.status(400).json(error('字段标识和字段名称不能为空', 400));
  }
  const exists = db.prepare('SELECT id FROM bluev_fields WHERE field_key = ?').get(field_key);
  if (exists) {
    return res.status(400).json(error('字段标识已存在', 400));
  }
  const id = generateId();
  db.prepare(`
    INSERT INTO bluev_fields (id, field_key, field_label, field_type, field_options, sort_order, is_required, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `).run(id, field_key, field_label, field_type, field_options, sort_order, is_required ? 1 : 0);
  res.json(success({ id, field_key, field_label }, '字段创建成功'));
});

app.put('/api/bluev-fields/:id', authRequired, (req, res) => {
  const { field_label, field_type, field_options, sort_order, is_required, is_active } = req.body;
  const updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const reqInt = (val) => val === undefined || val === null ? null : (val ? 1 : 0);
  db.prepare(`
    UPDATE bluev_fields SET
      field_label = COALESCE(?, field_label),
      field_type = COALESCE(?, field_type),
      field_options = COALESCE(?, field_options),
      sort_order = COALESCE(?, sort_order),
      is_required = COALESCE(?, is_required),
      is_active = COALESCE(?, is_active),
      updated_at = ?
    WHERE id = ?
  `).run(
    field_label ?? null,
    field_type ?? null,
    field_options ?? null,
    sort_order ?? null,
    reqInt(is_required),
    reqInt(is_active),
    updatedAt,
    req.params.id
  );
  res.json(success(null, '字段更新成功'));
});

app.delete('/api/bluev-fields/:id', authRequired, (req, res) => {
  db.prepare('DELETE FROM bluev_fields WHERE id = ?').run(req.params.id);
  res.json(success(null, '字段删除成功'));
});

app.get('/api/bluev-accounts', authRequired, (req, res) => {
  const { page = 1, pageSize = 20, cityId, keyword } = req.query;
  let where = [];
  let params = [];
  if (cityId) { where.push('city_id = ?'); params.push(cityId); }
  if (keyword) {
    where.push('(city_name LIKE ? OR data LIKE ?)');
    params.push(`%${keyword}%`, `%${keyword}%`);
  }
  if (isCityRole(req.user.role)) {
    where.push('city_id = ?');
    params.push(req.user.city_id || '__none__');
  }
  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const accounts = db.prepare(`
    SELECT * FROM bluev_accounts ${whereStr} ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM bluev_accounts ${whereStr}`).get(...params);
  accounts.forEach(a => {
    try { a.data = JSON.parse(a.data); } catch { a.data = {}; }
  });
  res.json(success({ list: accounts, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.post('/api/bluev-accounts', authRequired, (req, res) => {
  const { city_id, city_name, data, created_at } = req.body;
  if (!city_id || !city_name) {
    return res.status(400).json(error('城市信息不能为空', 400));
  }
  if (isCityRole(req.user.role) && req.user.city_id !== city_id) {
    return res.status(403).json(error('只能管理自己城市的数据', 403));
  }
  const id = generateId();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const createdAt = created_at || now;
  db.prepare(`
    INSERT INTO bluev_accounts (id, city_id, city_name, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, city_id, city_name, JSON.stringify(data || {}), createdAt, now);
  res.json(success({ id }, '账号注册成功'));
});

app.put('/api/bluev-accounts/:id', authRequired, (req, res) => {
  const { city_id, city_name, data, created_at } = req.body;
  const account = db.prepare('SELECT city_id FROM bluev_accounts WHERE id = ?').get(req.params.id);
  if (!account) return res.status(404).json(error('账号不存在', 404));
  if (isCityRole(req.user.role) && req.user.city_id !== account.city_id) {
    return res.status(403).json(error('只能管理自己城市的数据', 403));
  }
  const updatedAt = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(`
    UPDATE bluev_accounts SET
      city_id = COALESCE(?, city_id),
      city_name = COALESCE(?, city_name),
      data = COALESCE(?, data),
      created_at = COALESCE(?, created_at),
      updated_at = ?
    WHERE id = ?
  `).run(city_id, city_name, JSON.stringify(data || {}), created_at, updatedAt, req.params.id);
  res.json(success(null, '账号更新成功'));
});

app.delete('/api/bluev-accounts/:id', authRequired, (req, res) => {
  const account = db.prepare('SELECT city_id FROM bluev_accounts WHERE id = ?').get(req.params.id);
  if (!account) return res.status(404).json(error('账号不存在', 404));
  if (isCityRole(req.user.role) && req.user.city_id !== account.city_id) {
    return res.status(403).json(error('只能管理自己城市的数据', 403));
  }
  db.prepare('DELETE FROM bluev_accounts WHERE id = ?').run(req.params.id);
  res.json(success(null, '账号删除成功'));
});

// ========== 直播管理 API ==========
// 直播账号台账：用于维护各平台直播账号、主播、蓝V和负责人，后续平台同步任务会基于这些账号写入直播数据。
const LIVE_PLATFORM_LABELS = {
  douyin: '抖音',
  kuaishou: '快手',
  weixin: '视频号',
  xiaohongshu: '小红书',
  other: '其他'
};

const normalizeLiveAccountPayload = (body = {}) => {
  const platform = String(body.platform || 'douyin').trim();
  return {
    platform,
    platform_label: String(body.platform_label || LIVE_PLATFORM_LABELS[platform] || body.platform || '其他').trim(),
    account_name: String(body.account_name || body.name || '').trim(),
    platform_account: String(body.platform_account || '').trim(),
    live_person: String(body.live_person || '').trim(),
    is_blue_v: body.is_blue_v || body.isBlueV ? 1 : 0,
    manager: String(body.manager || '').trim(),
    status: ['active', 'paused'].includes(body.status) ? body.status : 'active',
    room_url: String(body.room_url || '').trim(),
    remark: String(body.remark || '').trim(),
    last_live_status: String(body.last_live_status || 'unknown').trim()
  };
};

app.get('/api/live/accounts', authRequired, (req, res) => {
  const { platform, status = 'all', keyword } = req.query;
  const where = ['status != ?'];
  const params = ['archived'];

  if (platform && platform !== 'all') {
    where.push('platform = ?');
    params.push(platform);
  }
  if (status && status !== 'all') {
    where.push('status = ?');
    params.push(status);
  }
  if (keyword) {
    where.push('(account_name LIKE ? OR platform_account LIKE ? OR live_person LIKE ? OR manager LIKE ?)');
    const like = `%${keyword}%`;
    params.push(like, like, like, like);
  }

  const whereStr = `WHERE ${where.join(' AND ')}`;
  const list = db.prepare(`
    SELECT
      la.*,
      COALESCE(ls.session_count, 0) as session_count,
      COALESCE(ls.total_viewers, 0) as total_viewers,
      COALESCE(ls.total_sales, 0) as total_sales
    FROM live_accounts la
    LEFT JOIN (
      SELECT
        live_account_id,
        COUNT(*) as session_count,
        SUM(viewer_count) as total_viewers,
        SUM(sales_count) as total_sales
      FROM live_sessions
      GROUP BY live_account_id
    ) ls ON ls.live_account_id = la.id
    ${whereStr}
    ORDER BY la.updated_at DESC, la.created_at DESC
  `).all(...params);

  const summary = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN is_blue_v = 1 THEN 1 ELSE 0 END) as bluev,
      SUM(CASE WHEN last_live_status = 'living' THEN 1 ELSE 0 END) as living,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active
    FROM live_accounts
    WHERE status != 'archived'
  `).get();

  res.json(success({ list, summary }));
});

app.post('/api/live/accounts', authRequired, (req, res) => {
  validateRequired(req.body, ['account_name']);
  const account = normalizeLiveAccountPayload(req.body);
  const id = generateId();
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(`
    INSERT INTO live_accounts (
      id, platform, platform_label, account_name, platform_account, live_person,
      is_blue_v, manager, status, room_url, remark, last_live_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    account.platform,
    account.platform_label,
    account.account_name,
    account.platform_account,
    account.live_person,
    account.is_blue_v,
    account.manager,
    account.status,
    account.room_url,
    account.remark,
    account.last_live_status,
    now,
    now
  );
  res.json(success({ id }, '直播账号创建成功'));
});

app.put('/api/live/accounts/:id', authRequired, (req, res) => {
  const existing = db.prepare('SELECT * FROM live_accounts WHERE id = ? AND status != ?').get(req.params.id, 'archived');
  if (!existing) return res.status(404).json(error('直播账号不存在', 404));
  validateRequired(req.body, ['account_name']);
  const account = normalizeLiveAccountPayload(req.body);
  const result = db.prepare(`
    UPDATE live_accounts SET
      platform = ?,
      platform_label = ?,
      account_name = ?,
      platform_account = ?,
      live_person = ?,
      is_blue_v = ?,
      manager = ?,
      status = ?,
      room_url = ?,
      remark = ?,
      last_live_status = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    account.platform,
    account.platform_label,
    account.account_name,
    account.platform_account,
    account.live_person,
    account.is_blue_v,
    account.manager,
    account.status,
    account.room_url,
    account.remark,
    account.last_live_status,
    req.params.id
  );
  if (!result.changes) return res.status(409).json(error('直播账号未更新，请刷新后重试', 409));
  res.json(success(null, '直播账号更新成功'));
});

app.delete('/api/live/accounts/:id', authRequired, (req, res) => {
  const existing = db.prepare('SELECT * FROM live_accounts WHERE id = ? AND status != ?').get(req.params.id, 'archived');
  if (!existing) return res.status(404).json(error('直播账号不存在', 404));
  db.prepare('UPDATE live_accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('archived', req.params.id);
  res.json(success(null, '直播账号删除成功'));
});

app.get('/api/live/accounts/:id/sessions', authRequired, (req, res) => {
  const account = db.prepare('SELECT * FROM live_accounts WHERE id = ? AND status != ?').get(req.params.id, 'archived');
  if (!account) return res.status(404).json(error('直播账号不存在', 404));
  const sessions = db.prepare(`
    SELECT * FROM live_sessions
    WHERE live_account_id = ?
    ORDER BY COALESCE(started_at, created_at) DESC
    LIMIT 100
  `).all(req.params.id);
  res.json(success({ account, list: sessions }));
});

// ========== 发布排期 API ==========
app.get('/api/schedules', (req, res) => {
  const { page = 1, pageSize = 20, dateFrom, dateTo, accountId, status } = req.query;
  let where = [];
  let params = [];

  if (dateFrom) { where.push('s.date >= ?'); params.push(dateFrom); }
  if (dateTo) { where.push('s.date <= ?'); params.push(dateTo); }
  if (accountId) { where.push('s.account_id = ?'); params.push(accountId); }
  if (status) { where.push('s.status = ?'); params.push(status); }

  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const schedules = db.prepare(`
    SELECT
      s.*,
      a.name as account_name,
      a.platform,
      a.account_type,
      a.platform_account,
      vt.name as type_name,
      vt.color as type_color,
      mf.name as material_file_name,
      mf.url as material_file_url
    FROM schedules s
    LEFT JOIN accounts a ON s.account_id = a.id
    LEFT JOIN video_types vt ON s.video_type_id = vt.id
    LEFT JOIN material_files mf ON s.material_file_id = mf.id
    ${whereStr}
    ORDER BY s.date DESC, s.time ASC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM schedules s ${whereStr}`).get(...params);

  res.json(success({ list: schedules, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.get('/api/schedules/calendar', authRequired, (req, res) => {
  const { year, month } = req.query;
  const startDate = dayjs(`${year}-${month}-01`).format('YYYY-MM-DD');
  const endDate = dayjs(`${year}-${month}-01`).endOf('month').format('YYYY-MM-DD');
  const isCity = isCityRole(req.user.role);
  const scopedCityId = isCity ? req.user.city_id : null;
  const cityWhere = scopedCityId ? 'AND a.city_id = ?' : '';
  const cityParams = scopedCityId ? [scopedCityId] : [];

  const schedules = db.prepare(`
    SELECT
      s.id,
      s.date,
      s.time,
      s.video_title,
      s.status,
      a.name as account_name,
      a.platform
    FROM schedules s
    LEFT JOIN accounts a ON s.account_id = a.id
    WHERE s.date >= ? AND s.date <= ? ${cityWhere}
    ORDER BY s.date, s.time
  `).all(startDate, endDate, ...cityParams);

  res.json(success(schedules));
});

app.post('/api/schedules', (req, res) => {
  validateRequired(req.body, ['date', 'time', 'account_id', 'video_title']);
  const {
    date,
    time,
    account_id,
    video_title,
    video_url,
    cover_url,
    tags,
    video_type_id,
    material_id,
    city_id,
    city_distribution_id,
    material_file_id,
    status,
    published_url,
    fail_reason
  } = req.body;
  const id = generateId();
  const publishedAt = status === 'published' ? dayjs().format() : null;
  db.prepare(`
    INSERT INTO schedules (
      id, date, time, account_id, video_title, video_url, cover_url, tags,
      video_type_id, material_id, city_id, city_distribution_id, material_file_id,
      status, published_url, fail_reason, published_at, status_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(
    id,
    date,
    time,
    account_id,
    video_title,
    video_url,
    cover_url,
    tags,
    video_type_id,
    material_id,
    city_id,
    city_distribution_id,
    material_file_id,
    status || 'pending',
    published_url,
    fail_reason,
    publishedAt
  );
  res.json(success({ id }, '创建成功'));
});

app.put('/api/schedules/:id', (req, res) => {
  const {
    date,
    time,
    account_id,
    video_title,
    video_url,
    cover_url,
    tags,
    video_type_id,
    material_id,
    city_id,
    city_distribution_id,
    material_file_id,
    status,
    published_url,
    fail_reason
  } = req.body;
  db.prepare(`
    UPDATE schedules
    SET date = ?,
        time = ?,
        account_id = ?,
        video_title = ?,
        video_url = ?,
        cover_url = ?,
        tags = ?,
        video_type_id = ?,
        material_id = ?,
        city_id = ?,
        city_distribution_id = ?,
        material_file_id = ?,
        status = ?,
        published_url = ?,
        fail_reason = ?,
        published_at = ?,
        status_updated_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(date, time, account_id, video_title, video_url, cover_url, tags, video_type_id, material_id, city_id, city_distribution_id, material_file_id, status, published_url, fail_reason, status === 'published' ? dayjs().format() : null, req.params.id);
  res.json(success(null, '更新成功'));
});

app.delete('/api/schedules/:id', (req, res) => {
  db.prepare('DELETE FROM schedules WHERE id = ?').run(req.params.id);
  res.json(success(null, '删除成功'));
});

// 批量创建排期
app.post('/api/schedules/batch', (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json(error('请求体必须是非空数组', 400));
  }
  const insert = db.prepare(`
    INSERT INTO schedules (
      id, date, time, account_id, video_title, video_url, cover_url, tags,
      video_type_id, material_id, city_id, city_distribution_id, material_file_id,
      status, published_url, fail_reason, published_at, status_updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
  `);
  const results = [];
  const insertAll = db.transaction((items) => {
    for (const item of items) {
      const id = generateId();
      const publishedAt = item.status === 'published' ? dayjs().format() : null;
      insert.run(
        id,
        item.date,
        item.time,
        item.account_id,
        item.video_title,
        item.video_url,
        item.cover_url,
        item.tags,
        item.video_type_id,
        item.material_id,
        item.city_id,
        item.city_distribution_id,
        item.material_file_id,
        item.status || 'pending',
        item.published_url,
        item.fail_reason,
        publishedAt
      );
      results.push({ id, date: item.date, time: item.time, account_id: item.account_id });
    }
  });
  insertAll(items);
  res.json(success(results, `成功创建${results.length}条排期记录`));
});

// ========== 数据追踪 API ==========
const unifiedReportsCte = `
  WITH reports AS (
    SELECT
      'batch:' || dt.report_batch_id AS id,
      CASE WHEN dt.period_start = dt.period_end THEN 'single_snapshot' ELSE 'range_summary' END AS record_type,
      dt.report_batch_id, dt.period_start, dt.period_end, dt.account_id,
      a.name AS account_name, a.platform, a.city_id, c.name AS city_name,
      MAX(dt.video_title) AS video_title,
      SUM(COALESCE(dt.play_count, 0)) AS views,
      SUM(COALESCE(dt.like_count, 0)) AS likes,
      SUM(COALESCE(dt.comment_count, 0)) AS comments,
      SUM(COALESCE(dt.favorite_count, 0)) AS favorites,
      SUM(COALESCE(dt.share_count, 0)) AS shares,
      SUM(COALESCE(dt.deal_count, 0)) AS deals,
      SUM(COALESCE(dt.deal_amount, 0)) AS revenue,
      MAX(COALESCE(dt.report_source, 'manual')) AS report_source,
      MAX(dt.created_at) AS created_at
    FROM data_tracks dt
    LEFT JOIN accounts a ON a.id = dt.account_id
    LEFT JOIN cities c ON c.id = a.city_id
    WHERE dt.report_batch_id IS NOT NULL
    GROUP BY dt.report_batch_id, dt.period_start, dt.period_end, dt.account_id,
      a.name, a.platform, a.city_id, c.name
    UNION ALL
    SELECT
      dt.id, 'single_record', NULL, dt.date, dt.date, dt.account_id,
      a.name, a.platform, a.city_id, c.name,
      COALESCE(dt.video_title, '单日手工数据'),
      COALESCE(dt.play_count, 0), COALESCE(dt.like_count, 0), COALESCE(dt.comment_count, 0),
      COALESCE(dt.favorite_count, 0), COALESCE(dt.share_count, 0),
      COALESCE(dt.deal_count, 0), COALESCE(dt.deal_amount, 0),
      COALESCE(dt.report_source, 'manual'), dt.created_at
    FROM data_tracks dt
    LEFT JOIN accounts a ON a.id = dt.account_id
    LEFT JOIN cities c ON c.id = a.city_id
    WHERE dt.report_batch_id IS NULL
    UNION ALL
    SELECT
      cd.id, 'published_video', NULL,
      COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date),
      COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date),
      cd.account_id, COALESCE(a.name, cd.publish_account_name, '未绑定账号'),
      COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other'),
      cd.city_id, c.name, cd.video_title,
      COALESCE(cd.play_count, 0), COALESCE(cd.like_count, 0), COALESCE(cd.comment_count, 0),
      COALESCE(cd.favorite_count, 0), COALESCE(cd.share_count, 0),
      COALESCE(cd.deal_count, 0), COALESCE(cd.deal_amount, 0),
      'city_publish', cd.created_at
    FROM city_distributions cd
    LEFT JOIN accounts a ON a.id = cd.account_id
    LEFT JOIN cities c ON c.id = cd.city_id
    WHERE cd.status = 'published'
      AND (
        COALESCE(cd.play_count, 0) != 0 OR
        COALESCE(cd.like_count, 0) != 0 OR
        COALESCE(cd.comment_count, 0) != 0 OR
        COALESCE(cd.favorite_count, 0) != 0 OR
        COALESCE(cd.share_count, 0) != 0 OR
        COALESCE(cd.deal_count, 0) != 0 OR
        COALESCE(cd.deal_amount, 0) != 0
      )
  )
`;

app.get('/api/data-tracks', authRequired, (req, res) => {
  const { page = 1, pageSize = 20, dateFrom, dateTo, accountId, range } = req.query;
  const rangeDates = parseRangeToDates({ dateFrom, dateTo, range });
  const params = [rangeDates.start, rangeDates.end];
  let accountFilter = '';
  if (accountId) {
    accountFilter = 'AND account_id = ?';
    params.push(accountId);
  }
  // 城市用户：只看自己城市的数据
  let cityFilter = '';
  if (isCityRole(req.user.role)) {
    cityFilter = 'AND city_id = ?';
    params.push(req.user.city_id || '__none__');
  }

  const tracks = db.prepare(`
    WITH all_tracks AS (
      SELECT
        dt.id,
        dt.date,
        dt.account_id,
        dt.schedule_id,
        dt.city_distribution_id,
        a.city_id as city_id,
        c.name as city_name,
        a.name as account_name,
        COALESCE(a.platform, 'other') as platform,
        COALESCE(NULLIF(dt.video_title, ''), s.video_title) as video_title,
        dt.play_count as views,
        dt.like_count as likes,
        dt.comment_count as comments,
        dt.deal_count as deals,
        dt.deal_amount as revenue,
        dt.favorite_count as favorites,
        dt.share_count as shares,
        dt.period_start,
        dt.period_end,
        dt.report_batch_id,
        COALESCE(dt.report_source, 'manual') as report_source,
        NULL as publish_url,
        NULL as publish_screenshot,
        'manual' as source,
        dt.created_at
      FROM data_tracks dt
      LEFT JOIN accounts a ON dt.account_id = a.id
      LEFT JOIN cities c ON a.city_id = c.id
      LEFT JOIN schedules s ON dt.schedule_id = s.id
      UNION ALL
      SELECT
        cd.id,
        COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) as date,
        cd.account_id,
        cd.schedule_id,
        cd.id as city_distribution_id,
        cd.city_id,
        c.name as city_name,
        COALESCE(a.name, NULLIF(cd.publish_account_name, ''), '未绑定账号') as account_name,
        COALESCE(a.platform, NULLIF(cd.publish_platform, ''), 'other') as platform,
        cd.video_title,
        cd.play_count as views,
        cd.like_count as likes,
        cd.comment_count as comments,
        cd.deal_count as deals,
        cd.deal_amount as revenue,
        cd.favorite_count as favorites,
        cd.share_count as shares,
        NULL as period_start,
        NULL as period_end,
        NULL as report_batch_id,
        'city' as report_source,
        cd.publish_url,
        cd.publish_screenshot,
        'city' as source,
        cd.created_at
      FROM city_distributions cd
      LEFT JOIN accounts a ON cd.account_id = a.id
      LEFT JOIN cities c ON cd.city_id = c.id
      WHERE cd.status = 'published'
    )
    SELECT *
    FROM all_tracks
    WHERE date >= ? AND date <= ? ${accountFilter} ${cityFilter}
    ORDER BY date DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

  const { total } = db.prepare(`
    WITH all_tracks AS (
      SELECT dt.date, dt.account_id, a.city_id FROM data_tracks dt
      LEFT JOIN accounts a ON dt.account_id = a.id
      UNION ALL
      SELECT COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) as date, cd.account_id, cd.city_id
      FROM city_distributions cd
      WHERE cd.status = 'published'
    )
    SELECT COUNT(*) as total
    FROM all_tracks
    WHERE date >= ? AND date <= ? ${accountFilter} ${cityFilter}
  `).get(...params);

  res.json(success({ list: tracks, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.post('/api/data-tracks', authRequired, (req, res) => {
  validateRequired(req.body, ['date', 'account_id']);
  const {
    date,
    account_id,
    schedule_id,
    city_distribution_id,
    material_file_id,
    play_count,
    like_count,
    comment_count,
    deal_count,
    deal_amount,
    views,
    likes,
    comments,
    deals,
    revenue
  } = req.body;
  const account = db.prepare('SELECT id, city_id FROM accounts WHERE id = ? AND status != ?').get(account_id, 'archived');
  if (!account) {
    return res.status(400).json(error('请选择有效的发布账号', 400));
  }
  if (isCityRole(req.user.role) && account.city_id !== req.user.city_id) {
    return res.status(403).json(error('只能录入本城市账号的数据', 403));
  }

  const id = generateId();
  db.prepare(`
    INSERT INTO data_tracks (
      id, date, account_id, schedule_id, city_distribution_id, material_file_id,
      play_count, like_count, comment_count, deal_count, deal_amount, captured_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    date,
    account_id,
    schedule_id,
    city_distribution_id,
    material_file_id,
    play_count ?? views ?? 0,
    like_count ?? likes ?? 0,
    comment_count ?? comments ?? 0,
    deal_count ?? deals ?? 0,
    deal_amount ?? revenue ?? 0,
    req.body.captured_at || dayjs().format()
  );
  res.json(success({ id }, '创建成功'));
});

app.post('/api/data-tracks/range-report', authRequired, (req, res) => {
  validateRequired(req.body, ['period_start', 'period_end', 'account_id']);
  const start = String(req.body.period_start);
  const end = String(req.body.period_end);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || dayjs(end).isBefore(dayjs(start))) {
    return res.status(400).json(error('统计周期不合法', 400));
  }

  const account = db.prepare(`
    SELECT id, city_id, name, platform FROM accounts WHERE id = ? AND status != ?
  `).get(req.body.account_id, 'archived');
  if (!account) return res.status(400).json(error('请选择有效的发布账号', 400));
  if (isCityRole(req.user.role) && account.city_id !== req.user.city_id) {
    return res.status(403).json(error('只能录入本城市账号的数据', 403));
  }

  let reportSource = isCityRole(req.user.role) ? 'city_manual' : 'admin_manual';
  const replaceBatchId = String(req.body.replace_batch_id || '').trim();
  if (replaceBatchId) {
    const replaceBatch = db.prepare(`
      SELECT dt.report_batch_id, dt.account_id, dt.report_source, a.city_id
      FROM data_tracks dt
      LEFT JOIN accounts a ON a.id = dt.account_id
      WHERE dt.report_batch_id = ? LIMIT 1
    `).get(replaceBatchId);
    if (!replaceBatch || replaceBatch.account_id !== account.id) {
      return res.status(400).json(error('原数据批次不存在或账号不一致', 400));
    }
    if (isCityRole(req.user.role) && replaceBatch.city_id !== req.user.city_id) {
      return res.status(403).json(error('无权修改其他城市的数据', 403));
    }
    reportSource = replaceBatch.report_source || reportSource;
  }
  const overlaps = db.prepare(`
    SELECT report_batch_id, report_source, period_start, period_end, COUNT(*) AS row_count
    FROM data_tracks
    WHERE account_id = ?
      AND period_start IS NOT NULL AND period_end IS NOT NULL
      AND period_start <= ? AND period_end >= ?
      AND (? = '' OR report_batch_id != ?)
    GROUP BY report_batch_id, report_source, period_start, period_end
  `).all(account.id, end, start, replaceBatchId, replaceBatchId);
  const exact = overlaps.filter(item => item.period_start === start && item.period_end === end);
  const partial = overlaps.filter(item => item.period_start !== start || item.period_end !== end);
  if (partial.length && req.body.overwrite !== true) {
    return res.status(409).json({ code: 409, message: '所选时间与已有数据重叠，请确认是否覆盖', data: { overlaps: partial } });
  }

  const days = dayjs(end).diff(dayjs(start), 'day') + 1;
  const distributeInteger = (value) => {
    const total = Math.max(0, Math.round(Number(value || 0)));
    const base = Math.floor(total / days);
    const remainder = total - base * days;
    return Array.from({ length: days }, (_, index) => base + (index < remainder ? 1 : 0));
  };
  const distributeMoney = (value) => distributeInteger(Math.round(Math.max(0, Number(value || 0)) * 100))
    .map(cents => cents / 100);
  const metrics = {
    plays: distributeInteger(req.body.play_count ?? req.body.views),
    likes: distributeInteger(req.body.like_count ?? req.body.likes),
    comments: distributeInteger(req.body.comment_count ?? req.body.comments),
    favorites: distributeInteger(req.body.favorite_count ?? req.body.favorites),
    shares: distributeInteger(req.body.share_count ?? req.body.shares),
    deals: distributeInteger(req.body.deal_count ?? req.body.deals),
    amounts: distributeMoney(req.body.deal_amount ?? req.body.revenue)
  };
  const batchId = generateId();
  const batchesToDelete = [...new Set([
    ...(replaceBatchId ? [replaceBatchId] : []),
    ...exact.map(item => item.report_batch_id),
    ...(req.body.overwrite === true ? partial.map(item => item.report_batch_id) : [])
  ].filter(Boolean))];
  const previousRows = batchesToDelete.length
    ? db.prepare(`SELECT * FROM data_tracks WHERE report_batch_id IN (${batchesToDelete.map(() => '?').join(',')})`).all(...batchesToDelete)
    : [];
  const insert = db.prepare(`
    INSERT INTO data_tracks (
      id, date, account_id, play_count, like_count, comment_count, favorite_count,
      share_count, deal_count, deal_amount, video_title, captured_at,
      period_start, period_end, report_batch_id, report_source, updated_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const saveReport = db.transaction(() => {
    for (const oldBatchId of batchesToDelete) {
      db.prepare('DELETE FROM data_tracks WHERE report_batch_id = ?').run(oldBatchId);
    }
    db.prepare(`
      DELETE FROM city_distributions
      WHERE account_id = ? AND city_remark LIKE '区间汇总 %'
        AND city_remark LIKE ?
    `).run(account.id, `%${start} 至 ${end}%`);
    for (let index = 0; index < days; index++) {
      const date = dayjs(start).add(index, 'day').format('YYYY-MM-DD');
      insert.run(
        generateId(), date, account.id, metrics.plays[index], metrics.likes[index], metrics.comments[index],
        metrics.favorites[index], metrics.shares[index], metrics.deals[index], metrics.amounts[index],
        req.body.video_title || `区间汇总 - ${start} 至 ${end}`, dayjs().format(),
        start, end, batchId, reportSource, req.user.id, dayjs().format()
      );
    }
  });
  saveReport();

  writeDataAudit({
    action: batchesToDelete.length ? 'replace' : 'create',
    targetType: 'report_batch', targetId: batchId, accountId: account.id, cityId: account.city_id,
    periodStart: start, periodEnd: end, before: previousRows,
    after: { ...req.body, report_batch_id: batchId, report_source: reportSource, days }, user: req.user
  });

  res.json(success({
    batch_id: batchId,
    period_start: start,
    period_end: end,
    days,
    replaced: batchesToDelete.length > 0
  }, batchesToDelete.length ? '原周期数据已覆盖' : '区间数据已保存'));
});

app.delete('/api/data-tracks/batch/:batchId', authRequired, (req, res) => {
  const rows = db.prepare(`
    SELECT dt.*, a.city_id
    FROM data_tracks dt
    LEFT JOIN accounts a ON a.id = dt.account_id
    WHERE dt.report_batch_id = ?
  `).all(req.params.batchId);
  if (!rows.length) return res.status(404).json(error('数据批次不存在', 404));
  if (isCityRole(req.user.role) && rows.some(row => row.city_id !== req.user.city_id)) {
    return res.status(403).json(error('无权删除其他城市的数据', 403));
  }
  db.prepare('DELETE FROM data_tracks WHERE report_batch_id = ?').run(req.params.batchId);
  writeDataAudit({
    action: 'delete', targetType: 'report_batch', targetId: req.params.batchId,
    accountId: rows[0].account_id, cityId: rows[0].city_id,
    periodStart: rows[0].period_start, periodEnd: rows[0].period_end, before: rows, after: null, user: req.user
  });
  res.json(success(null, '数据已删除'));
});

app.put('/api/data-tracks/:id', authRequired, (req, res) => {
  const existing = db.prepare(`
    SELECT dt.*, a.city_id FROM data_tracks dt
    LEFT JOIN accounts a ON a.id = dt.account_id WHERE dt.id = ?
  `).get(req.params.id);
  if (!existing) return res.status(404).json(error('数据记录不存在', 404));
  if (existing.report_batch_id) return res.status(400).json(error('区间数据请按完整批次编辑', 400));
  if (isCityRole(req.user.role) && existing.city_id !== req.user.city_id) {
    return res.status(403).json(error('无权修改其他城市的数据', 403));
  }
  const accountId = req.body.account_id || existing.account_id;
  const account = db.prepare('SELECT id, city_id FROM accounts WHERE id = ? AND status != ?').get(accountId, 'archived');
  if (!account) return res.status(400).json(error('请选择有效的发布账号', 400));
  if (isCityRole(req.user.role) && account.city_id !== req.user.city_id) {
    return res.status(403).json(error('只能录入本城市账号的数据', 403));
  }
  db.prepare(`
    UPDATE data_tracks SET
      date = ?, account_id = ?, play_count = ?, like_count = ?, comment_count = ?,
      favorite_count = ?, share_count = ?, deal_count = ?, deal_amount = ?,
      video_title = ?, updated_by = ?, updated_at = ?
    WHERE id = ?
  `).run(
    req.body.date || existing.date, accountId,
    Number(req.body.play_count ?? req.body.views ?? existing.play_count ?? 0),
    Number(req.body.like_count ?? req.body.likes ?? existing.like_count ?? 0),
    Number(req.body.comment_count ?? req.body.comments ?? existing.comment_count ?? 0),
    Number(req.body.favorite_count ?? req.body.favorites ?? existing.favorite_count ?? 0),
    Number(req.body.share_count ?? req.body.shares ?? existing.share_count ?? 0),
    Number(req.body.deal_count ?? req.body.deals ?? existing.deal_count ?? 0),
    Number(req.body.deal_amount ?? req.body.revenue ?? existing.deal_amount ?? 0),
    req.body.video_title ?? existing.video_title, req.user.id, dayjs().format(), req.params.id
  );
  const updated = db.prepare('SELECT * FROM data_tracks WHERE id = ?').get(req.params.id);
  writeDataAudit({
    action: 'update', targetType: 'single_record', targetId: req.params.id,
    accountId, cityId: account.city_id, periodStart: updated.date, periodEnd: updated.date,
    before: existing, after: updated, user: req.user
  });
  res.json(success({ id: req.params.id }, '数据已更新'));
});

app.delete('/api/data-tracks/:id', authRequired, (req, res) => {
  const existing = db.prepare(`
    SELECT dt.*, a.city_id FROM data_tracks dt
    LEFT JOIN accounts a ON a.id = dt.account_id WHERE dt.id = ?
  `).get(req.params.id);
  if (!existing) return res.status(404).json(error('数据记录不存在', 404));
  if (existing.report_batch_id) return res.status(400).json(error('区间数据请按完整批次删除', 400));
  if (isCityRole(req.user.role) && existing.city_id !== req.user.city_id) {
    return res.status(403).json(error('无权删除其他城市的数据', 403));
  }
  db.prepare('DELETE FROM data_tracks WHERE id = ?').run(req.params.id);
  writeDataAudit({
    action: 'delete', targetType: 'single_record', targetId: req.params.id,
    accountId: existing.account_id, cityId: existing.city_id,
    periodStart: existing.date, periodEnd: existing.date, before: existing, after: null, user: req.user
  });
  res.json(success(null, '数据已删除'));
});

app.get('/api/data-report-details', authRequired, (req, res) => {
  const rangeDates = parseRangeToDates(req.query);
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize || 20)));
  const where = ['period_end >= ?', 'period_start <= ?'];
  const params = [rangeDates.start, rangeDates.end];
  if (req.query.platform) { where.push('platform = ?'); params.push(req.query.platform); }
  if (req.query.accountId) { where.push('account_id = ?'); params.push(req.query.accountId); }
  if (req.query.cityId) { where.push('city_id = ?'); params.push(req.query.cityId); }
  if (req.query.recordType) { where.push('record_type = ?'); params.push(req.query.recordType); }
  if (isCityRole(req.user.role)) { where.push('city_id = ?'); params.push(req.user.city_id || '__none__'); }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const list = db.prepare(`
    ${unifiedReportsCte}
    SELECT * FROM reports ${whereSql}
    ORDER BY period_end DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, (page - 1) * pageSize);
  const { total } = db.prepare(`${unifiedReportsCte} SELECT COUNT(*) AS total FROM reports ${whereSql}`).get(...params);
  res.json(success({ list, total, page, pageSize }));
});

app.get('/api/data-dashboard/export', authRequired, (req, res) => {
  const rangeDates = parseRangeToDates(req.query);
  const metricsWhere = ['period_end >= ?', 'period_start <= ?'];
  const metricsParams = [rangeDates.start, rangeDates.end];

  if (req.query.platform) { metricsWhere.push('platform = ?'); metricsParams.push(req.query.platform); }
  if (req.query.cityId) { metricsWhere.push('city_id = ?'); metricsParams.push(req.query.cityId); }
  if (req.query.accountId) { metricsWhere.push('account_id = ?'); metricsParams.push(req.query.accountId); }
  if (isCityRole(req.user.role)) { metricsWhere.push('city_id = ?'); metricsParams.push(req.user.city_id || '__none__'); }

  const metricsWhereSql = `WHERE ${metricsWhere.join(' AND ')}`;
  const cityMetrics = db.prepare(`
    ${unifiedReportsCte}
    SELECT
      city_id,
      COALESCE(city_name, '未绑定城市') AS city_name,
      COUNT(DISTINCT account_id) AS account_count,
      COALESCE(SUM(views), 0) AS views,
      COALESCE(SUM(likes), 0) AS likes,
      COALESCE(SUM(comments), 0) AS comments,
      COALESCE(SUM(deals), 0) AS deals,
      COALESCE(SUM(revenue), 0) AS revenue
    FROM reports
    ${metricsWhereSql}
    GROUP BY city_id, COALESCE(city_name, '未绑定城市')
    ORDER BY views DESC
  `).all(...metricsParams);

  const accountMetrics = db.prepare(`
    ${unifiedReportsCte}
    SELECT
      city_id,
      account_id,
      COALESCE(city_name, '未绑定城市') AS city_name,
      COALESCE(account_name, '未绑定账号') AS account_name,
      COALESCE(platform, 'other') AS platform,
      COALESCE(SUM(views), 0) AS views,
      COALESCE(SUM(likes), 0) AS likes,
      COALESCE(SUM(comments), 0) AS comments,
      COALESCE(SUM(deals), 0) AS deals,
      COALESCE(SUM(revenue), 0) AS revenue,
      COUNT(*) AS report_count,
      MAX(period_end) AS latest_period
    FROM reports
    ${metricsWhereSql}
    GROUP BY city_id, account_id, COALESCE(city_name, '未绑定城市'), COALESCE(account_name, '未绑定账号'), COALESCE(platform, 'other')
    ORDER BY city_name, views DESC
  `).all(...metricsParams);

  const publishedStatusSql = cityDistributionWorkflow.statusSql('cd');
  const publishedWhere = [
    'ledger_date >= ?',
    'ledger_date <= ?'
  ];
  const publishedParams = [rangeDates.start, rangeDates.end];
  if (req.query.platform) { publishedWhere.push('platform = ?'); publishedParams.push(req.query.platform); }
  if (req.query.cityId) { publishedWhere.push('city_id = ?'); publishedParams.push(req.query.cityId); }
  if (req.query.accountId) { publishedWhere.push('account_id = ?'); publishedParams.push(req.query.accountId); }
  if (isCityRole(req.user.role)) { publishedWhere.push('city_id = ?'); publishedParams.push(req.user.city_id || '__none__'); }
  const publishedWhereSql = `WHERE ${publishedWhere.join(' AND ')}`;
  const publishedItemsCte = `
    WITH published_items AS (
      SELECT
        s.date AS ledger_date,
        s.account_id,
        a.name AS account_name,
        COALESCE(a.platform, 'other') AS platform,
        a.city_id,
        c.name AS city_name
      FROM schedules s
      LEFT JOIN accounts a ON a.id = s.account_id
      LEFT JOIN cities c ON c.id = a.city_id
      WHERE s.status = 'published'
        AND COALESCE(s.city_distribution_id, '') = ''
      UNION ALL
      SELECT
        cd.date AS ledger_date,
        cd.account_id,
        COALESCE(a.name, NULLIF(cd.publish_account_name, ''), '未绑定账号') AS account_name,
        COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') AS platform,
        cd.city_id,
        c.name AS city_name
      FROM city_distributions cd
      LEFT JOIN accounts a ON a.id = cd.account_id
      LEFT JOIN cities c ON c.id = cd.city_id
      WHERE ${publishedStatusSql.published}
    )
  `;
  const cityPublished = db.prepare(`
    ${publishedItemsCte}
    SELECT
      city_id,
      COALESCE(city_name, '未绑定城市') AS city_name,
      COUNT(*) AS published_videos
    FROM published_items
    ${publishedWhereSql}
    GROUP BY city_id, COALESCE(city_name, '未绑定城市')
  `).all(...publishedParams);

  const accountPublished = db.prepare(`
    ${publishedItemsCte}
    SELECT
      city_id,
      account_id,
      COALESCE(city_name, '未绑定城市') AS city_name,
      COALESCE(account_name, '未绑定账号') AS account_name,
      COALESCE(platform, 'other') AS platform,
      COUNT(*) AS published_videos
    FROM published_items
    ${publishedWhereSql}
    GROUP BY city_id, account_id, COALESCE(city_name, '未绑定城市'), COALESCE(account_name, '未绑定账号'), COALESCE(platform, 'other')
  `).all(...publishedParams);

  const cityMap = new Map();
  const cityKey = (row) => row.city_id ? `id:${row.city_id}` : `name:${row.city_name || '未绑定城市'}`;
  const ensureCityRow = (row) => {
    const key = cityKey(row);
    if (!cityMap.has(key)) {
      cityMap.set(key, {
        city_name: row.city_name || '未绑定城市',
        account_count: 0,
        published_videos: 0,
        views: 0,
        likes: 0,
        comments: 0,
        deals: 0,
        revenue: 0
      });
    }
    return cityMap.get(key);
  };
  cityMetrics.forEach(row => Object.assign(ensureCityRow(row), {
    account_count: Number(row.account_count || 0),
    views: Number(row.views || 0),
    likes: Number(row.likes || 0),
    comments: Number(row.comments || 0),
    deals: Number(row.deals || 0),
    revenue: Number(row.revenue || 0)
  }));
  cityPublished.forEach(row => {
    ensureCityRow(row).published_videos = Number(row.published_videos || 0);
  });

  const accountMap = new Map();
  const accountKey = (row) => [
    row.city_id ? `city:${row.city_id}` : `cityName:${row.city_name || '未绑定城市'}`,
    row.account_id ? `account:${row.account_id}` : `accountName:${row.account_name || '未绑定账号'}`,
    row.platform || 'other'
  ].join('||');
  const ensureAccountRow = (row) => {
    const key = accountKey(row);
    if (!accountMap.has(key)) {
      accountMap.set(key, {
        city_name: row.city_name || '未绑定城市',
        account_name: row.account_name || '未绑定账号',
        platform: row.platform || 'other',
        published_videos: 0,
        views: 0,
        likes: 0,
        comments: 0,
        deals: 0,
        revenue: 0,
        report_count: 0,
        latest_period: ''
      });
    }
    return accountMap.get(key);
  };
  accountMetrics.forEach(row => Object.assign(ensureAccountRow(row), {
    views: Number(row.views || 0),
    likes: Number(row.likes || 0),
    comments: Number(row.comments || 0),
    deals: Number(row.deals || 0),
    revenue: Number(row.revenue || 0),
    report_count: Number(row.report_count || 0),
    latest_period: row.latest_period || ''
  }));
  accountPublished.forEach(row => {
    ensureAccountRow(row).published_videos = Number(row.published_videos || 0);
  });

  const cityOverview = Array.from(cityMap.values()).sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
  const accountDetails = Array.from(accountMap.values()).sort((a, b) => {
    const cityCompare = String(a.city_name || '').localeCompare(String(b.city_name || ''), 'zh-CN');
    return cityCompare || Number(b.views || 0) - Number(a.views || 0);
  });

  res.json(success({
    dateFrom: rangeDates.start,
    dateTo: rangeDates.end,
    cityOverview,
    accountDetails
  }));
});

app.get('/api/data-report-audits', authRequired, adminRequired, (req, res) => {
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(100, Math.max(10, Number(req.query.pageSize || 20)));
  const where = [];
  const params = [];
  if (req.query.accountId) { where.push('account_id = ?'); params.push(req.query.accountId); }
  if (req.query.cityId) { where.push('city_id = ?'); params.push(req.query.cityId); }
  if (req.query.action) { where.push('action = ?'); params.push(req.query.action); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const list = db.prepare(`SELECT * FROM data_report_audit_logs ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);
  const { total } = db.prepare(`SELECT COUNT(*) AS total FROM data_report_audit_logs ${whereSql}`).get(...params);
  res.json(success({ list, total, page, pageSize }));
});

app.get('/api/data-dashboard', authRequired, (req, res) => {
  const { start, end } = parseRangeToDates(req.query);

  // 城市用户：只看自己城市的数据
  let cityFilter = '';
  const cityParams = [];
  if (isCityRole(req.user.role)) {
    cityFilter = 'AND city_id = ?';
    cityParams.push(req.user.city_id || '__none__');
  }

  // 总数据
  const summary = db.prepare(`
    WITH all_tracks AS (
      SELECT
        dt.date,
        COALESCE(dt.report_batch_id, dt.id) as record_key,
        COALESCE(dt.play_count, 0) as play_count,
        COALESCE(dt.like_count, 0) as like_count,
        COALESCE(dt.comment_count, 0) as comment_count,
        COALESCE(dt.deal_count, 0) as deal_count,
        COALESCE(dt.deal_amount, 0) as deal_amount,
        a.city_id as city_id
      FROM data_tracks dt
      LEFT JOIN accounts a ON dt.account_id = a.id
      UNION ALL
      SELECT
        COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) as date,
        cd.id as record_key,
        COALESCE(cd.play_count, 0) as play_count,
        COALESCE(cd.like_count, 0) as like_count,
        COALESCE(cd.comment_count, 0) as comment_count,
        COALESCE(cd.deal_count, 0) as deal_count,
        COALESCE(cd.deal_amount, 0) as deal_amount,
        cd.city_id as city_id
      FROM city_distributions cd
      WHERE cd.status = 'published'
    )
    SELECT
      COALESCE(SUM(play_count), 0) as total_plays,
      COALESCE(SUM(like_count), 0) as total_likes,
      COALESCE(SUM(comment_count), 0) as total_comments,
      COALESCE(SUM(deal_count), 0) as total_deals,
      COALESCE(SUM(deal_amount), 0) as total_amount,
      COUNT(DISTINCT record_key) as total_videos
    FROM all_tracks
    WHERE date >= ? AND date <= ? ${cityFilter}
  `).get(start, end, ...cityParams);

  // 平台分布
  const platformStats = db.prepare(`
    WITH all_tracks AS (
      SELECT
        dt.date,
        COALESCE(dt.report_batch_id, dt.id) as record_key,
        COALESCE(a.platform, 'other') as platform,
        COALESCE(dt.play_count, 0) as play_count,
        COALESCE(dt.like_count, 0) as like_count,
        COALESCE(dt.comment_count, 0) as comment_count,
        COALESCE(dt.deal_count, 0) as deal_count,
        COALESCE(dt.deal_amount, 0) as deal_amount,
        a.city_id as city_id
      FROM data_tracks dt
      LEFT JOIN accounts a ON dt.account_id = a.id
      UNION ALL
      SELECT
        COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) as date,
        cd.id as record_key,
        COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') as platform,
        COALESCE(cd.play_count, 0) as play_count,
        COALESCE(cd.like_count, 0) as like_count,
        COALESCE(cd.comment_count, 0) as comment_count,
        COALESCE(cd.deal_count, 0) as deal_count,
        COALESCE(cd.deal_amount, 0) as deal_amount,
        cd.city_id as city_id
      FROM city_distributions cd
      LEFT JOIN accounts a ON cd.account_id = a.id
      WHERE cd.status = 'published'
    )
	    SELECT
	      platform,
	      COALESCE(SUM(play_count), 0) as plays,
	      COALESCE(SUM(like_count), 0) as likes,
	      COALESCE(SUM(comment_count), 0) as comments,
	      COALESCE(SUM(deal_count), 0) as deals,
	      COALESCE(SUM(deal_amount), 0) as revenue,
	      COUNT(DISTINCT record_key) as videos
    FROM all_tracks
    WHERE date >= ? AND date <= ? ${cityFilter}
    GROUP BY platform
  `).all(start, end, ...cityParams);

  // 趋势数据
  const trend = db.prepare(`
    WITH all_tracks AS (
	      SELECT
	        dt.date,
	        COALESCE(a.platform, 'other') as platform,
	        COALESCE(dt.play_count, 0) as play_count,
	        COALESCE(dt.like_count, 0) as like_count,
	        COALESCE(dt.comment_count, 0) as comment_count,
	        COALESCE(dt.deal_count, 0) as deal_count,
	        COALESCE(dt.deal_amount, 0) as deal_amount,
	        a.city_id as city_id
      FROM data_tracks dt
      LEFT JOIN accounts a ON dt.account_id = a.id
      UNION ALL
	      SELECT
	        COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) as date,
	        COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other') as platform,
	        COALESCE(cd.play_count, 0) as play_count,
	        COALESCE(cd.like_count, 0) as like_count,
	        COALESCE(cd.comment_count, 0) as comment_count,
	        COALESCE(cd.deal_count, 0) as deal_count,
	        COALESCE(cd.deal_amount, 0) as deal_amount,
	        cd.city_id as city_id
      FROM city_distributions cd
      LEFT JOIN accounts a ON cd.account_id = a.id
      WHERE cd.status = 'published'
    )
    SELECT
      date,
      platform,
      COALESCE(SUM(play_count), 0) as plays,
      COALESCE(SUM(like_count), 0) as likes,
      COALESCE(SUM(comment_count), 0) as comments,
      COALESCE(SUM(deal_count), 0) as deals,
      COALESCE(SUM(deal_amount), 0) as revenue,
      COUNT(*) as videos
    FROM all_tracks
    WHERE date >= ? AND date <= ? ${cityFilter}
    GROUP BY date, platform
    ORDER BY date
  `).all(start, end, ...cityParams);

  const aggregateCte = `
    WITH all_tracks AS (
      SELECT dt.date, dt.account_id, a.name AS account_name, a.platform, a.city_id, c.name AS city_name,
        COALESCE(dt.play_count, 0) AS views, COALESCE(dt.like_count, 0) AS likes,
        COALESCE(dt.comment_count, 0) AS comments, COALESCE(dt.deal_count, 0) AS deals,
        COALESCE(dt.deal_amount, 0) AS revenue,
        CASE WHEN dt.report_source = 'city_manual' THEN 'city' ELSE 'admin' END AS source
      FROM data_tracks dt
      LEFT JOIN accounts a ON a.id = dt.account_id
      LEFT JOIN cities c ON c.id = a.city_id
      UNION ALL
      SELECT COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date), cd.account_id,
        COALESCE(a.name, cd.publish_account_name, '未绑定账号'),
        COALESCE(NULLIF(cd.publish_platform, ''), a.platform, 'other'), cd.city_id, c.name,
        COALESCE(cd.play_count, 0), COALESCE(cd.like_count, 0), COALESCE(cd.comment_count, 0),
        COALESCE(cd.deal_count, 0), COALESCE(cd.deal_amount, 0), 'city'
      FROM city_distributions cd
      LEFT JOIN accounts a ON a.id = cd.account_id
      LEFT JOIN cities c ON c.id = cd.city_id
      WHERE cd.status = 'published'
    )
  `;
  const accountStats = db.prepare(`
    ${aggregateCte}
    SELECT account_id, account_name, platform, city_id, city_name,
      SUM(views) AS total_views, SUM(likes) AS total_likes, SUM(comments) AS total_comments,
      SUM(deals) AS total_deals, SUM(revenue) AS total_revenue,
      SUM(CASE WHEN source = 'admin' THEN views ELSE 0 END) AS admin_views,
      SUM(CASE WHEN source = 'city' THEN views ELSE 0 END) AS city_views
    FROM all_tracks WHERE date >= ? AND date <= ? ${cityFilter}
    GROUP BY account_id, account_name, platform, city_id, city_name
    ORDER BY total_views DESC
  `).all(start, end, ...cityParams);
  const cityStats = db.prepare(`
    ${aggregateCte}
    SELECT city_id, city_name, COUNT(DISTINCT account_id) AS account_count,
      SUM(views) AS total_views, SUM(likes) AS total_likes, SUM(comments) AS total_comments,
      SUM(deals) AS total_deals, SUM(revenue) AS total_revenue
    FROM all_tracks WHERE date >= ? AND date <= ? AND city_id IS NOT NULL ${cityFilter}
    GROUP BY city_id, city_name ORDER BY total_views DESC
  `).all(start, end, ...cityParams);

  const reportCountWhere = ['period_end >= ?', 'period_start <= ?'];
  const reportCountParams = [start, end];
  if (isCityRole(req.user.role)) { reportCountWhere.push('city_id = ?'); reportCountParams.push(req.user.city_id || '__none__'); }
  const recordCounts = db.prepare(`
    ${unifiedReportsCte}
    SELECT
      SUM(CASE WHEN record_type = 'published_video' THEN 1 ELSE 0 END) AS published_videos,
      SUM(CASE WHEN record_type != 'published_video' THEN 1 ELSE 0 END) AS report_batches,
      SUM(CASE WHEN record_type IN ('single_snapshot', 'single_record') THEN 1 ELSE 0 END) AS single_records,
      SUM(CASE WHEN record_type = 'range_summary' THEN 1 ELSE 0 END) AS range_records
    FROM reports WHERE ${reportCountWhere.join(' AND ')}
  `).get(...reportCountParams);
  const distributionCountWhere = ['date >= ?', 'date <= ?'];
  const distributionCountParams = [start, end];
  if (isCityRole(req.user.role)) {
    distributionCountWhere.push('city_id = ?');
    distributionCountParams.push(req.user.city_id || '__none__');
  }
  const distStatusSql = cityDistributionWorkflow.statusSql('city_distributions');
  const distributionCounts = db.prepare(`
    SELECT
      COUNT(*) AS distributed_videos,
      SUM(CASE WHEN ${distStatusSql.pending} THEN 1 ELSE 0 END) AS pending_videos,
      SUM(CASE WHEN downloaded_at IS NOT NULL THEN 1 ELSE 0 END) AS downloaded_videos,
      SUM(CASE WHEN ${distStatusSql.publishing} THEN 1 ELSE 0 END) AS publishing_videos,
      SUM(CASE WHEN ${distStatusSql.failed} THEN 1 ELSE 0 END) AS failed_videos,
      SUM(CASE WHEN ${distStatusSql.unfinished} AND date < ? THEN 1 ELSE 0 END) AS overdue_videos
    FROM city_distributions
    WHERE ${distributionCountWhere.join(' AND ')}
  `).get(dayjs().format('YYYY-MM-DD'), ...distributionCountParams);
  const h5DistributionCountWhere = [
    "COALESCE(NULLIF(t.publish_date, ''), substr(t.created_at, 1, 10)) >= ?",
    "COALESCE(NULLIF(t.publish_date, ''), substr(t.created_at, 1, 10)) <= ?"
  ];
  const h5DistributionCountParams = [start, end];
  if (isCityRole(req.user.role)) {
    h5DistributionCountWhere.push('t.city_id = ?');
    h5DistributionCountParams.push(req.user.city_id || '__none__');
  }
  const h5DistributionCounts = db.prepare(`
    SELECT
      COUNT(v.id) AS distributed_videos,
      SUM(CASE WHEN v.status = 'pending' THEN 1 ELSE 0 END) AS pending_videos,
      SUM(CASE WHEN v.downloaded_at IS NOT NULL THEN 1 ELSE 0 END) AS downloaded_videos,
      SUM(CASE WHEN v.status = 'downloaded' THEN 1 ELSE 0 END) AS publishing_videos,
      0 AS failed_videos,
      0 AS overdue_videos
    FROM h5_video_task_videos v
    JOIN h5_video_tasks t ON t.id = v.task_id
    WHERE ${h5DistributionCountWhere.join(' AND ')}
  `).get(...h5DistributionCountParams);
  const hqPublished = isCityRole(req.user.role) ? { total: 0 } : db.prepare(`
    SELECT COUNT(*) AS total
    FROM schedules
    WHERE status = 'published'
      AND city_distribution_id IS NULL
      AND date >= ? AND date <= ?
  `).get(start, end);
  const cityPublishedWhere = [
    "cd.status = 'published'",
    "COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) >= ?",
    "COALESCE(NULLIF(substr(cd.actual_publish_time, 1, 10), ''), cd.date) <= ?"
  ];
  const cityPublishedParams = [start, end];
  if (isCityRole(req.user.role)) {
    cityPublishedWhere.push('cd.city_id = ?');
    cityPublishedParams.push(req.user.city_id || '__none__');
  }
  const cityPublished = db.prepare(`
    SELECT COUNT(*) AS total
    FROM city_distributions cd
    WHERE ${cityPublishedWhere.join(' AND ')}
  `).get(...cityPublishedParams);
  const h5PublishedWhere = [
    "v.status = 'submitted'",
    "substr(v.submitted_at, 1, 10) >= ?",
    "substr(v.submitted_at, 1, 10) <= ?"
  ];
  const h5PublishedParams = [start, end];
  if (isCityRole(req.user.role)) {
    h5PublishedWhere.push('t.city_id = ?');
    h5PublishedParams.push(req.user.city_id || '__none__');
  }
  const h5Published = db.prepare(`
    SELECT COUNT(*) AS total
    FROM h5_video_task_videos v
    JOIN h5_video_tasks t ON t.id = v.task_id
    WHERE ${h5PublishedWhere.join(' AND ')}
  `).get(...h5PublishedParams);
  const accountReportMeta = db.prepare(`
    ${unifiedReportsCte}
    SELECT account_id, COUNT(*) AS report_count, MAX(period_end) AS latest_period_end
    FROM reports WHERE ${reportCountWhere.join(' AND ')}
    GROUP BY account_id
  `).all(...reportCountParams);
  const accountMetaMap = new Map(accountReportMeta.map(item => [item.account_id, item]));
  accountStats.forEach(item => {
    const meta = accountMetaMap.get(item.account_id) || {};
    item.report_count = Number(meta.report_count || 0);
    item.latest_period = meta.latest_period_end || '';
  });
  Object.assign(summary, Object.fromEntries(Object.entries(recordCounts || {}).map(([key, value]) => [key, Number(value || 0)])));
  Object.assign(summary, Object.fromEntries(Object.entries(distributionCounts || {}).map(([key, value]) => [key, Number(value || 0)])));
  Object.entries(h5DistributionCounts || {}).forEach(([key, value]) => {
    summary[key] = Number(summary[key] || 0) + Number(value || 0);
  });
  summary.published_hq_videos = Number(hqPublished?.total || 0);
  summary.published_city_videos = Number(cityPublished?.total || 0) + Number(h5Published?.total || 0);
  summary.published_videos = summary.published_hq_videos + summary.published_city_videos;

  res.json(success({ summary, platformStats, trend, accountStats, cityStats }));
});

// ========== AI 分析 API ==========
app.get('/api/ai-reports', (req, res) => {
  const { type, page = 1, pageSize = 20 } = req.query;
  let where = type ? 'WHERE type = ?' : '';
  let params = type ? [type] : [];

  const reports = db.prepare(`SELECT * FROM ai_reports ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM ai_reports ${where}`).get(...params);

  res.json(success({ list: reports, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.get('/api/ai-reports/status', authRequired, (req, res) => {
  res.json(success(aiService.getStatus()));
});

app.post('/api/ai-reports/generate', async (req, res) => {
  const type = req.body.type || 'daily';
  let periodStart = req.body.periodStart;
  let periodEnd = req.body.periodEnd;
  const userContext = req.body.userContext && typeof req.body.userContext === 'object' ? req.body.userContext : {};
  const id = generateId();

  try {
    let result;
    if (type === 'daily') {
      periodStart = periodStart || dayjs().format('YYYY-MM-DD');
      periodEnd = periodEnd || periodStart;
      result = await aiService.generateDailyReport(db, periodStart, { userContext });
    } else if (type === 'weekly') {
      periodEnd = periodEnd || dayjs().format('YYYY-MM-DD');
      periodStart = periodStart || dayjs(periodEnd).subtract(6, 'day').format('YYYY-MM-DD');
      result = await aiService.generateWeeklyReport(db, periodStart, periodEnd, { userContext });
    } else if (type === 'monthly') {
      periodEnd = periodEnd || dayjs().format('YYYY-MM-DD');
      periodStart = periodStart || dayjs(periodEnd).startOf('month').format('YYYY-MM-DD');
      result = await aiService.generateMonthlyReport(db, periodStart, periodEnd, { userContext });
    } else {
      periodStart = periodStart || dayjs().format('YYYY-MM-DD');
      periodEnd = periodEnd || periodStart;
      result = await aiService.generateDailyReport(db, periodStart, { userContext });
    }

    db.prepare(`
      INSERT INTO ai_reports (id, type, period_start, period_end, content, raw_data, prompt_template, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      type,
      periodStart,
      periodEnd,
      result.content,
      JSON.stringify(result.rawData || {}),
      result.promptTemplate || '',
      'completed'
    );
    res.json(success({
      id,
      type,
      period_start: periodStart,
      period_end: periodEnd,
      content: result.content,
      raw_data: result.rawData,
      prompt_template: result.promptTemplate
    }, '分析已生成'));
  } catch (err) {
    logger.error('[ai-report] 生成失败:', err);
    res.status(500).json(error('AI 分析生成失败：' + err.message, 500));
  }
});

app.post('/api/ai-reports/chat', authRequired, async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const writeEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    res.flush?.();
  };

  try {
    const prepared = aiService.prepareChat(db, req.body || {});
    const periodStart = prepared.data.meta.startDate;
    const periodEnd = prepared.data.meta.endDate;
    const reportType = prepared.data.meta.type || req.body?.type || 'daily';
    prepared.tools.forEach(tool => writeEvent('tool', tool));
    const deterministicReply = aiService.shouldUseDeterministicChat(req.body?.message || '', prepared.data)
      ? aiService.localChatReply(req.body?.message || '', req.body?.userContext || {}, prepared.data)
      : '';

    if (deterministicReply) {
      writeEvent('meta', { mode: aiService.isConfigured() ? 'ai-deterministic' : 'local', status: aiService.getStatus() });
      for (const chunk of String(deterministicReply).match(/.{1,4}/gs) || ['收到']) {
        writeEvent('chunk', { text: chunk });
        await new Promise(resolve => setTimeout(resolve, 24));
      }
      const id = generateId();
      db.prepare(`
        INSERT INTO ai_reports (id, type, period_start, period_end, content, raw_data, prompt_template, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, reportType, periodStart, periodEnd, deterministicReply, JSON.stringify(prepared.data || {}), 'deterministic-chat-session', 'completed');
      writeEvent('saved', { id, type: reportType, period_start: periodStart, period_end: periodEnd });
    } else if (aiService.isConfigured()) {
      writeEvent('meta', { mode: 'ai', status: aiService.getStatus() });
      const fullText = await aiService.chatStream(prepared.messages, 0.35, (text) => {
        writeEvent('chunk', { text });
      });
      if (!fullText) writeEvent('chunk', { text: '我已收到，请继续指定时间、城市、账号或平台，我会按系统数据分析。' });
      if (fullText) {
        const id = generateId();
        db.prepare(`
          INSERT INTO ai_reports (id, type, period_start, period_end, content, raw_data, prompt_template, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, reportType, periodStart, periodEnd, fullText, JSON.stringify(prepared.data || {}), 'ai-chat-session', 'completed');
        writeEvent('saved', { id, type: reportType, period_start: periodStart, period_end: periodEnd });
      }
    } else {
      writeEvent('meta', { mode: 'local', status: aiService.getStatus() });
      const reply = await aiService.generateChatReply(db, req.body || {});
      const chunks = String(reply || '').match(/.{1,4}/gs) || ['收到'];
      for (const chunk of chunks) {
        writeEvent('chunk', { text: chunk });
        await new Promise(resolve => setTimeout(resolve, 28));
      }
      const id = generateId();
      db.prepare(`
        INSERT INTO ai_reports (id, type, period_start, period_end, content, raw_data, prompt_template, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, reportType, periodStart, periodEnd, reply, JSON.stringify(prepared.data || {}), 'local-chat-session', 'completed');
      writeEvent('saved', { id, type: reportType, period_start: periodStart, period_end: periodEnd });
    }
    writeEvent('done', { ok: true });
    res.end();
  } catch (err) {
    logger.error('[ai-report-chat] 回复失败:', err);
    const reply = await aiService.generateChatReply(db, req.body || {});
    writeEvent('meta', { mode: 'fallback', status: aiService.getStatus(), reason: err.message });
    for (const chunk of String(reply).match(/.{1,4}/gs) || ['收到']) {
      writeEvent('chunk', { text: chunk });
      await new Promise(resolve => setTimeout(resolve, 28));
    }
    writeEvent('done', { ok: true, fallback: true });
    res.end();
  }
});

app.post('/api/ai-reports/manual', (req, res) => {
  try {
    const type = req.body.type || 'daily';
    const periodStart = req.body.periodStart || dayjs().format('YYYY-MM-DD');
    const periodEnd = req.body.periodEnd || periodStart;
    const content = String(req.body.content || '').trim();

    if (!content) {
      return res.status(400).json(error('请先填写分析内容', 400));
    }

    const id = generateId();
    const rawData = {
      meta: {
        type,
        startDate: periodStart,
        endDate: periodEnd,
        generatedAt: new Date().toISOString(),
        manual: true
      }
    };

    db.prepare(`
      INSERT INTO ai_reports (id, type, period_start, period_end, content, raw_data, prompt_template, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      type,
      periodStart,
      periodEnd,
      content,
      JSON.stringify(rawData),
      'manual-report-v1',
      'manual'
    );

    res.json(success({
      id,
      type,
      period_start: periodStart,
      period_end: periodEnd,
      content,
      raw_data: rawData,
      prompt_template: 'manual-report-v1',
      status: 'manual'
    }, '分析已保存'));
  } catch (err) {
    logger.error('[ai-report] 手动保存失败:', err);
    res.status(500).json(error('分析保存失败：' + err.message, 500));
  }
});

// ========== COS API ==========
app.get('/api/cos/sts-credential', (req, res) => {
  const storage = getStorageConfig();
  const secretId = storage.secretId;
  const secretKey = storage.secretKey;
  const bucket = storage.bucket;
  const region = storage.region || 'ap-shanghai';

  if (!secretId || !secretKey || !bucket) {
    return res.status(503).json(error('COS 未配置，请到系统设置里配置存储桶', 503));
  }

  res.json(success({
    TmpSecretId: secretId,
    TmpSecretKey: secretKey,
    SecurityToken: process.env.COS_SECURITY_TOKEN || null,
    Bucket: bucket,
    Region: region,
    Domain: storage.domain || null,
    CDNDomain: storage.cdnDomain || null,
    UploadPrefix: storage.uploadPrefix || 'materials/',
    ExpiredTime: Math.floor(Date.now() / 1000) + 3600
  }, 'COS凭证'));
});

app.delete('/api/cos/object', (req, res, next) => {
  const { key } = req.query;
  if (!key) return res.status(400).json(error('缺少 COS 对象 key', 400));
  try {
    const cos = getCosClient();
    const storage = getStorageConfig();
    cos.deleteObject({
      Bucket: storage.bucket,
      Region: storage.region || 'ap-shanghai',
      Key: key
    }, (err, data) => {
      if (err) return next(err);
      res.json(success(data || null, '删除成功'));
    });
  } catch (e) {
    next(e);
  }
});

// ========== 又拍云 API（拍摄原片专用） ==========
app.post('/api/upyun/form-token', authRequired, (req, res, next) => {
  try {
    const token = signFormPolicy({
      filename: req.body.filename || req.body.name,
      folderPath: req.body.folderPath || req.body.folder_path || '/',
      contentType: req.body.contentType || req.body.mime,
      size: req.body.size
    });
    res.json(success(token, '又拍云上传签名'));
  } catch (e) {
    if (e.message?.includes('UPYUN_')) e.message = '又拍云未配置，请先配置服务名、操作员和密码';
    next(e);
  }
});

app.delete('/api/upyun/object', authRequired, async (req, res, next) => {
  const { key } = req.query;
  if (!key) return res.status(400).json(error('缺少又拍云对象路径', 400));
  try {
    const result = await deleteUpyunObject(key);
    res.json(success(result, '删除成功'));
  } catch (e) {
    next(e);
  }
});

// ========== 素材文件夹 API ==========
const MATERIAL_ROOT_FOLDER_ID = 'folder_root';
const MATERIAL_LEGACY_FOLDER_ID = 'folder_legacy';
const MATERIAL_TREE_ROOT_ID = 'folder_workspace_root';

const normalizeFolderName = (value) => String(value || '').trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').slice(0, 80);
const normalizeFolderPath = (value) => {
  const parts = String(value || '')
    .split('/')
    .map(part => normalizeFolderName(part))
    .filter(Boolean);
  return parts.length ? `/${parts.join('/')}` : '/';
};

const ensureMaterialDefaultFolders = () => {
  const upsert = db.prepare(`
    INSERT INTO material_folders (id, name, parent_id, path, storage_policy_id, sort_order, status)
    VALUES (?, ?, ?, ?, ?, ?, 'active')
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      parent_id = excluded.parent_id,
      path = excluded.path,
      storage_policy_id = excluded.storage_policy_id,
      sort_order = excluded.sort_order,
      status = 'active',
      updated_at = CURRENT_TIMESTAMP
  `);
  upsert.run(MATERIAL_ROOT_FOLDER_ID, '我的素材', null, '/', 'default', 0);
  upsert.run(MATERIAL_LEGACY_FOLDER_ID, '历史素材', MATERIAL_ROOT_FOLDER_ID, '/历史素材', 'default', 999);
};

const buildMaterialFolderTree = (rows) => {
  const map = new Map(rows.map(row => [row.id, { ...row, children: [] }]));
  const topLevel = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else {
      topLevel.push(node);
    }
  }
  const sortTree = (node) => {
    node.children.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'));
    node.children.forEach(sortTree);
  };
  const rollupCounts = (node) => {
    const directFileCount = Number(node.direct_file_count ?? node.file_count ?? 0);
    let totalFileCount = directFileCount;
    let totalFolderCount = node.children.length;
    node.children.forEach(child => {
      const childCounts = rollupCounts(child);
      totalFileCount += childCounts.fileCount;
      totalFolderCount += childCounts.folderCount;
    });
    node.direct_file_count = directFileCount;
    node.file_count = totalFileCount;
    node.folder_count = totalFolderCount;
    return { fileCount: totalFileCount, folderCount: totalFolderCount };
  };
  const root = {
    id: MATERIAL_TREE_ROOT_ID,
    name: '文件树根目录',
    parent_id: null,
    path: '/',
    storage_policy_id: 'default',
    sort_order: -1,
    children: topLevel
  };
  sortTree(root);
  rollupCounts(root);
  return root;
};

const getFolderById = (id) => db.prepare("SELECT * FROM material_folders WHERE id = ? AND status != 'deleted'").get(id);

app.get('/api/material-folders/tree', (req, res) => {
  ensureMaterialDefaultFolders();
  const rows = db.prepare(`
    SELECT
      f.*,
      (SELECT COUNT(*) FROM material_folders c WHERE c.parent_id = f.id AND c.status != 'deleted') AS direct_folder_count,
      CASE
        WHEN f.id = ? THEN (SELECT COUNT(*) FROM material_files mf WHERE mf.status != 'deleted' AND (mf.folder_id IS NULL OR mf.folder_id = ''))
        ELSE (SELECT COUNT(*) FROM material_files mf WHERE mf.status != 'deleted' AND mf.folder_id = f.id)
      END AS direct_file_count
    FROM material_folders f
    WHERE f.status != 'deleted'
    ORDER BY f.sort_order ASC, f.created_at ASC
  `).all(MATERIAL_LEGACY_FOLDER_ID);
  res.json(success(buildMaterialFolderTree(rows)));
});

app.post('/api/material-folders', (req, res) => {
  const name = normalizeFolderName(req.body.name);
  const hasParent = Object.prototype.hasOwnProperty.call(req.body, 'parent_id') || Object.prototype.hasOwnProperty.call(req.body, 'parentId');
  const requestedParentId = Object.prototype.hasOwnProperty.call(req.body, 'parent_id') ? req.body.parent_id : req.body.parentId;
  const parentId = hasParent
    ? (requestedParentId === MATERIAL_TREE_ROOT_ID ? null : requestedParentId)
    : MATERIAL_ROOT_FOLDER_ID;
  if (!name) return res.status(400).json(error('文件夹名称不能为空', 400));
  const parent = parentId ? getFolderById(parentId) : null;
  if (parentId && !parent) return res.status(404).json(error('父文件夹不存在', 404));
  if (parent?.id === MATERIAL_LEGACY_FOLDER_ID) return res.status(400).json(error('历史素材目录不能创建子目录', 400));

  const parentPath = parent?.path === '/' ? '' : parent?.path || '';
  const pathValue = normalizeFolderPath(`${parentPath}/${name}`);
  const existed = parent
    ? db.prepare("SELECT id FROM material_folders WHERE parent_id = ? AND name = ? AND status != 'deleted'").get(parent.id, name)
    : db.prepare("SELECT id FROM material_folders WHERE parent_id IS NULL AND name = ? AND status != 'deleted'").get(name);
  if (existed) return res.status(409).json(error('同级目录下已存在同名文件夹', 409));

  const nextSort = parent
    ? db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS value FROM material_folders WHERE parent_id = ?").get(parent.id).value
    : db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS value FROM material_folders WHERE parent_id IS NULL").get().value;
  const deletedSamePath = db.prepare("SELECT id FROM material_folders WHERE path = ? AND status = 'deleted'").get(pathValue);
  if (deletedSamePath) {
    db.prepare(`
      UPDATE material_folders
      SET name = ?, parent_id = ?, path = ?, storage_policy_id = ?, sort_order = ?, status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, parent?.id || null, pathValue, parent?.storage_policy_id || 'default', nextSort, deletedSamePath.id);
    return res.json(success({ id: deletedSamePath.id, name, parent_id: parent?.id || null, path: pathValue }, '文件夹创建成功'));
  }

  const id = generateId();
  db.prepare(`
    INSERT INTO material_folders (id, name, parent_id, path, storage_policy_id, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, name, parent?.id || null, pathValue, parent?.storage_policy_id || 'default', nextSort);
  res.json(success({ id, name, parent_id: parent?.id || null, path: pathValue }, '文件夹创建成功'));
});

app.put('/api/material-folders/:id', (req, res) => {
  const folder = getFolderById(req.params.id);
  if (!folder) return res.status(404).json(error('文件夹不存在', 404));
  if ([MATERIAL_ROOT_FOLDER_ID, MATERIAL_LEGACY_FOLDER_ID].includes(folder.id)) {
    return res.status(400).json(error('系统目录不能重命名', 400));
  }
  const name = normalizeFolderName(req.body.name);
  if (!name) return res.status(400).json(error('文件夹名称不能为空', 400));
  const existed = folder.parent_id
    ? db.prepare("SELECT id FROM material_folders WHERE parent_id = ? AND name = ? AND id != ? AND status != 'deleted'").get(folder.parent_id, name, folder.id)
    : db.prepare("SELECT id FROM material_folders WHERE parent_id IS NULL AND name = ? AND id != ? AND status != 'deleted'").get(name, folder.id);
  if (existed) return res.status(409).json(error('同级目录下已存在同名文件夹', 409));

  const parent = folder.parent_id ? getFolderById(folder.parent_id) : null;
  const parentPath = parent?.path === '/' ? '' : parent?.path || '';
  const nextPath = normalizeFolderPath(`${parentPath}/${name}`);
  const oldPrefix = folder.path === '/' ? '/' : `${folder.path}/`;
  const childRows = db.prepare("SELECT id, path FROM material_folders WHERE status != 'deleted' AND path LIKE ?").all(`${oldPrefix}%`);

  const tx = db.transaction(() => {
    db.prepare("UPDATE material_folders SET name = ?, path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(name, nextPath, folder.id);
    for (const child of childRows) {
      const suffix = child.path.slice(folder.path.length);
      const childPath = normalizeFolderPath(`${nextPath}${suffix}`);
      db.prepare("UPDATE material_folders SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(childPath, child.id);
      db.prepare("UPDATE material_files SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ?").run(childPath, child.id);
    }
    db.prepare("UPDATE material_files SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ?").run(nextPath, folder.id);
  });
  tx();
  res.json(success({ id: folder.id, name, path: nextPath }, '文件夹更新成功'));
});

app.delete('/api/material-folders/:id', (req, res) => {
  const folder = getFolderById(req.params.id);
  if (!folder) return res.status(404).json(error('文件夹不存在', 404));
  if ([MATERIAL_ROOT_FOLDER_ID, MATERIAL_LEGACY_FOLDER_ID].includes(folder.id)) {
    return res.status(400).json(error('系统目录不能删除', 400));
  }
  const childCount = db.prepare("SELECT COUNT(*) AS total FROM material_folders WHERE parent_id = ? AND status != 'deleted'").get(folder.id).total;
  const fileCount = db.prepare("SELECT COUNT(*) AS total FROM material_files WHERE folder_id = ? AND status != 'deleted'").get(folder.id).total;
  if (childCount || fileCount) return res.status(400).json(error('请先清空该文件夹后再删除', 400));
  db.prepare("UPDATE material_folders SET path = ?, status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(`${folder.path}.__deleted_${folder.id}`, folder.id);
  res.json(success(null, '文件夹删除成功'));
});

// ========== 素材文件表 API (COS 上传后记录) ==========
app.get('/api/material-files', (req, res) => {
  const { page = 1, pageSize = 50, date, dateFrom, dateTo, videoTypeId, folderId, uploaderId, uploadedBy } = req.query;
  let where = ["mf.status != 'deleted'"];
  let params = [];

  if (date) { where.push('date >= ? AND date <= ?'); params.push(date, date); }
  if (dateFrom) { where.push("COALESCE(mf.date, substr(mf.created_at, 1, 10)) >= ?"); params.push(dateFrom); }
  if (dateTo) { where.push("COALESCE(mf.date, substr(mf.created_at, 1, 10)) <= ?"); params.push(dateTo); }
  if (videoTypeId) { where.push('video_type_id = ?'); params.push(videoTypeId); }
  if (uploaderId) {
    where.push('mf.uploaded_by_user_id = ?');
    params.push(uploaderId);
  } else if (uploadedBy) {
    where.push('mf.uploaded_by = ?');
    params.push(uploadedBy);
  }
  if (folderId) {
    if (folderId === MATERIAL_LEGACY_FOLDER_ID) {
      where.push("(mf.folder_id IS NULL OR mf.folder_id = '')");
    } else {
      where.push('mf.folder_id = ?');
      params.push(folderId);
    }
  }

  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const files = db.prepare(`
    SELECT
      mf.*,
      vt.name as type_name,
      vt.icon as type_icon,
      u.name AS uploader_name,
      u.username AS uploader_username,
      COALESCE(usage.distribution_count, 0) AS distribution_count,
      COALESCE(usage.published_count, 0) AS published_count,
      COALESCE(usage.failed_count, 0) AS failed_count,
      usage.last_distributed_at
    FROM material_files mf
    LEFT JOIN video_types vt ON mf.video_type_id = vt.id
    LEFT JOIN users u ON mf.uploaded_by_user_id = u.id
    LEFT JOIN (
      SELECT
        material_file_id,
        COUNT(*) AS distribution_count,
        SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_count,
        MAX(created_at) AS last_distributed_at
      FROM city_distributions
      WHERE material_file_id IS NOT NULL AND material_file_id != ''
      GROUP BY material_file_id
    ) usage ON usage.material_file_id = mf.id
    ${whereStr}
    ORDER BY mf.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM material_files mf ${whereStr}`).get(...params);

  res.json(success({ list: files, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.get('/api/material-files/upload-stats', (req, res) => {
  const selectedMonth = /^\d{4}-\d{2}$/.test(String(req.query.month || ''))
    ? String(req.query.month)
    : dayjs().format('YYYY-MM');
  const startDate = req.query.dateFrom || `${selectedMonth}-01`;
  const endDate = req.query.dateTo || dayjs(startDate).endOf('month').format('YYYY-MM-DD');
  const params = [startDate, endDate];
  const uploaderCondition = req.query.uploaderId ? 'AND mf.uploaded_by_user_id = ?' : '';
  if (req.query.uploaderId) params.push(req.query.uploaderId);

  const rows = db.prepare(`
    SELECT
      COALESCE(NULLIF(mf.uploaded_by_user_id, ''), 'legacy:' || COALESCE(NULLIF(mf.uploaded_by, ''), 'unknown')) AS uploader_id,
      COALESCE(NULLIF(u.name, ''), NULLIF(u.username, ''), NULLIF(mf.uploaded_by, ''), '未知上传人') AS uploader_name,
      COALESCE(NULLIF(u.username, ''), '') AS uploader_username,
      COUNT(*) AS total_count,
      SUM(CASE
        WHEN LOWER(COALESCE(mf.mime, '')) LIKE 'video/%'
          OR LOWER(mf.name) GLOB '*.mp4'
          OR LOWER(mf.name) GLOB '*.mov'
          OR LOWER(mf.name) GLOB '*.m4v'
          OR LOWER(mf.name) GLOB '*.webm'
          OR LOWER(mf.name) GLOB '*.flv'
          OR LOWER(mf.name) GLOB '*.mkv'
        THEN 1 ELSE 0 END) AS video_count,
      SUM(CASE
        WHEN LOWER(COALESCE(mf.mime, '')) LIKE 'image/%'
        THEN 1 ELSE 0 END) AS image_count,
      COALESCE(SUM(mf.size), 0) AS total_size,
      MIN(COALESCE(mf.date, substr(mf.created_at, 1, 10))) AS first_upload_date,
      MAX(COALESCE(mf.date, substr(mf.created_at, 1, 10))) AS last_upload_date
    FROM material_files mf
    LEFT JOIN users u ON mf.uploaded_by_user_id = u.id
    WHERE mf.status != 'deleted'
      AND COALESCE(mf.date, substr(mf.created_at, 1, 10)) >= ?
      AND COALESCE(mf.date, substr(mf.created_at, 1, 10)) <= ?
      ${uploaderCondition}
    GROUP BY uploader_id, uploader_name, uploader_username
    ORDER BY video_count DESC, total_count DESC, uploader_name
  `).all(...params).map(row => ({
    ...row,
    total_count: Number(row.total_count || 0),
    video_count: Number(row.video_count || 0),
    image_count: Number(row.image_count || 0),
    total_size: Number(row.total_size || 0)
  }));

  res.json(success({
    month: selectedMonth,
    dateRange: { start: startDate, end: endDate },
    totals: rows.reduce((acc, row) => ({
      total_count: acc.total_count + row.total_count,
      video_count: acc.video_count + row.video_count,
      image_count: acc.image_count + row.image_count,
      total_size: acc.total_size + row.total_size
    }), { total_count: 0, video_count: 0, image_count: 0, total_size: 0 }),
    list: rows
  }));
});

app.post('/api/material-files', (req, res) => {
  validateRequired(req.body, ['name', 'key']);
  const {
    name,
    size,
    key,
    url,
    type_name,
    video_type_id,
    date,
    staff_id,
    duration,
    mime,
    thumbnail_url,
    material_id,
    schedule_id,
    city_distribution_id,
    account_id,
    source,
    storage_provider,
    folder_id,
    folder_path,
    storage_policy_id,
    object_key
  } = req.body;
  const id = generateId();
  const folder = folder_id ? getFolderById(folder_id) : null;
  const resolvedFolderPath = folder?.path || folder_path || null;
  const uploadedByName = req.user?.name || req.user?.username || req.body.uploaded_by || '未知上传人';
  const uploadedByUserId = req.user?.id || req.body.uploaded_by_user_id || null;
  db.prepare(`
    INSERT INTO material_files (
      id, name, size, cos_key, url, type_name, video_type_id, date, staff_id,
      duration, mime, uploaded_by, uploaded_by_user_id, thumbnail_url, material_id, schedule_id,
      city_distribution_id, account_id, source, storage_provider, folder_id, folder_path,
      storage_policy_id, object_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    size,
    key,
    url,
    type_name,
    video_type_id,
    date,
    staff_id,
    duration,
    mime,
    uploadedByName,
    uploadedByUserId,
    thumbnail_url,
    material_id,
    schedule_id,
    city_distribution_id,
    account_id,
    source || 'cos',
    storage_provider || 'cos',
    folder?.id || folder_id || null,
    resolvedFolderPath,
    storage_policy_id || folder?.storage_policy_id || 'default',
    object_key || key
  );
  res.json(success({ id, uploaded_by: uploadedByName, uploaded_by_user_id: uploadedByUserId }, '文件记录创建成功'));
});

app.put('/api/material-files/:id', (req, res) => {
  const {
    name,
    duration,
    thumbnail_url,
    material_id,
    schedule_id,
    city_distribution_id,
    account_id,
    status,
    folder_id,
    folder_path
  } = req.body;
  const folder = folder_id ? getFolderById(folder_id) : null;
  db.prepare(`
    UPDATE material_files SET
      name = COALESCE(?, name),
      duration = COALESCE(?, duration),
      thumbnail_url = COALESCE(?, thumbnail_url),
      material_id = COALESCE(?, material_id),
      schedule_id = COALESCE(?, schedule_id),
      city_distribution_id = COALESCE(?, city_distribution_id),
      account_id = COALESCE(?, account_id),
      folder_id = COALESCE(?, folder_id),
      folder_path = COALESCE(?, folder_path),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, duration, thumbnail_url, material_id, schedule_id, city_distribution_id, account_id, folder?.id || folder_id, folder?.path || folder_path, status, req.params.id);
  res.json(success(null, '更新成功'));
});

app.delete('/api/material-files/:id', (req, res) => {
  db.prepare('UPDATE material_files SET status = ?, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('deleted', req.params.id);
  res.json(success(null, '删除成功'));
});

// ========== 拍摄原片库 API ==========
const RAW_MATERIAL_ROOT_FOLDER_ID = 'raw_folder_root';

const ensureRawMaterialDefaultFolders = () => {
  db.prepare(`
    INSERT INTO raw_material_folders (id, name, parent_id, path, sort_order, status)
    VALUES (?, ?, NULL, '/', 0, 'active')
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      parent_id = excluded.parent_id,
      path = excluded.path,
      sort_order = excluded.sort_order,
      status = 'active',
      updated_at = CURRENT_TIMESTAMP
  `).run(RAW_MATERIAL_ROOT_FOLDER_ID, '拍摄原片');
};

const getRawFolderById = (id) => db.prepare("SELECT * FROM raw_material_folders WHERE id = ? AND status != 'deleted'").get(id);

const buildRawMaterialFolderTree = (rows) => {
  const map = new Map(rows.map(row => [row.id, { ...row, children: [] }]));
  let root = map.get(RAW_MATERIAL_ROOT_FOLDER_ID);
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id).children.push(node);
    } else if (node.id !== RAW_MATERIAL_ROOT_FOLDER_ID && root) {
      root.children.push(node);
    }
  }
  const sortTree = (node) => {
    node.children.sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.name).localeCompare(String(b.name), 'zh-Hans-CN'));
    node.children.forEach(sortTree);
  };
  const rollupCounts = (node) => {
    const directFileCount = Number(node.direct_file_count ?? 0);
    let totalFileCount = directFileCount;
    let totalFolderCount = node.children.length;
    node.children.forEach(child => {
      const childCounts = rollupCounts(child);
      totalFileCount += childCounts.fileCount;
      totalFolderCount += childCounts.folderCount;
    });
    node.direct_file_count = directFileCount;
    node.file_count = totalFileCount;
    node.folder_count = totalFolderCount;
    return { fileCount: totalFileCount, folderCount: totalFolderCount };
  };
  if (root) {
    sortTree(root);
    rollupCounts(root);
  }
  return root || { id: RAW_MATERIAL_ROOT_FOLDER_ID, name: '拍摄原片', path: '/', children: [] };
};

const getRawFolderTreeRows = () => db.prepare(`
  SELECT
    f.*,
    (SELECT COUNT(*) FROM raw_material_folders c WHERE c.parent_id = f.id AND c.status != 'deleted') AS direct_folder_count,
    (SELECT COUNT(*) FROM raw_material_files rf WHERE rf.status != 'deleted' AND rf.folder_id = f.id) AS direct_file_count
  FROM raw_material_folders f
  WHERE f.status != 'deleted'
  ORDER BY f.sort_order ASC, f.created_at ASC
`).all();

const rawFolderDescendantIds = (folderId) => {
  const rows = getRawFolderTreeRows();
  const byParent = rows.reduce((map, row) => {
    const parent = row.parent_id || '';
    if (!map[parent]) map[parent] = [];
    map[parent].push(row);
    return map;
  }, {});
  const ids = [];
  const visit = (id) => {
    ids.push(id);
    (byParent[id] || []).forEach(child => visit(child.id));
  };
  visit(folderId);
  return ids;
};

const rawFileIsVideoSql = `
  LOWER(COALESCE(mime, '')) LIKE 'video/%'
  OR LOWER(name) GLOB '*.mp4'
  OR LOWER(name) GLOB '*.mov'
  OR LOWER(name) GLOB '*.m4v'
  OR LOWER(name) GLOB '*.webm'
  OR LOWER(name) GLOB '*.flv'
  OR LOWER(name) GLOB '*.mkv'
`;

app.get('/api/raw-material-folders/tree', (req, res) => {
  ensureRawMaterialDefaultFolders();
  res.json(success(buildRawMaterialFolderTree(getRawFolderTreeRows())));
});

app.post('/api/raw-material-folders', (req, res) => {
  const name = normalizeFolderName(req.body.name);
  const parentId = req.body.parent_id || req.body.parentId || RAW_MATERIAL_ROOT_FOLDER_ID;
  if (!name) return res.status(400).json(error('文件夹名称不能为空', 400));
  const parent = getRawFolderById(parentId);
  if (!parent) return res.status(404).json(error('父文件夹不存在', 404));
  const parentPath = parent.path === '/' ? '' : parent.path;
  const pathValue = normalizeFolderPath(`${parentPath}/${name}`);
  const existed = db.prepare("SELECT id FROM raw_material_folders WHERE parent_id = ? AND name = ? AND status != 'deleted'").get(parent.id, name);
  if (existed) return res.status(409).json(error('同级目录下已存在同名文件夹', 409));
  const nextSort = db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS value FROM raw_material_folders WHERE parent_id = ?").get(parent.id).value;
  const id = generateId();
  db.prepare(`
    INSERT INTO raw_material_folders (id, name, parent_id, path, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, parent.id, pathValue, nextSort);
  res.json(success({ id, name, parent_id: parent.id, path: pathValue }, '文件夹创建成功'));
});

app.put('/api/raw-material-folders/:id', (req, res) => {
  const folder = getRawFolderById(req.params.id);
  if (!folder) return res.status(404).json(error('文件夹不存在', 404));
  if (folder.id === RAW_MATERIAL_ROOT_FOLDER_ID) return res.status(400).json(error('根目录不能重命名', 400));
  const name = normalizeFolderName(req.body.name);
  if (!name) return res.status(400).json(error('文件夹名称不能为空', 400));
  const existed = db.prepare("SELECT id FROM raw_material_folders WHERE parent_id = ? AND name = ? AND id != ? AND status != 'deleted'").get(folder.parent_id, name, folder.id);
  if (existed) return res.status(409).json(error('同级目录下已存在同名文件夹', 409));
  const parent = getRawFolderById(folder.parent_id);
  const parentPath = parent?.path === '/' ? '' : parent?.path || '';
  const nextPath = normalizeFolderPath(`${parentPath}/${name}`);
  const oldPrefix = folder.path === '/' ? '/' : `${folder.path}/`;
  const childRows = db.prepare("SELECT id, path FROM raw_material_folders WHERE status != 'deleted' AND path LIKE ?").all(`${oldPrefix}%`);
  const tx = db.transaction(() => {
    db.prepare("UPDATE raw_material_folders SET name = ?, path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(name, nextPath, folder.id);
    for (const child of childRows) {
      const suffix = child.path.slice(folder.path.length);
      const childPath = normalizeFolderPath(`${nextPath}${suffix}`);
      db.prepare("UPDATE raw_material_folders SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(childPath, child.id);
      db.prepare("UPDATE raw_material_files SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ?").run(childPath, child.id);
    }
    db.prepare("UPDATE raw_material_files SET folder_path = ?, updated_at = CURRENT_TIMESTAMP WHERE folder_id = ?").run(nextPath, folder.id);
  });
  tx();
  res.json(success({ id: folder.id, name, path: nextPath }, '文件夹更新成功'));
});

app.delete('/api/raw-material-folders/:id', (req, res) => {
  const folder = getRawFolderById(req.params.id);
  if (!folder) return res.status(404).json(error('文件夹不存在', 404));
  if (folder.id === RAW_MATERIAL_ROOT_FOLDER_ID) return res.status(400).json(error('根目录不能删除', 400));
  const childCount = db.prepare("SELECT COUNT(*) AS total FROM raw_material_folders WHERE parent_id = ? AND status != 'deleted'").get(folder.id).total;
  const fileCount = db.prepare("SELECT COUNT(*) AS total FROM raw_material_files WHERE folder_id = ? AND status != 'deleted'").get(folder.id).total;
  if (childCount || fileCount) return res.status(400).json(error('请先清空该文件夹后再删除', 400));
  db.prepare("UPDATE raw_material_folders SET path = ?, status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(`${folder.path}.__deleted_${folder.id}`, folder.id);
  res.json(success(null, '文件夹删除成功'));
});

app.get('/api/raw-material-files', (req, res) => {
  const { page = 1, pageSize = 80, folderId, recursive, photographer, uploader, uploaderName, dateFrom, dateTo } = req.query;
  let where = ["rf.status != 'deleted'"];
  let params = [];
  if (folderId) {
    if (recursive === '1' || recursive === 'true') {
      const ids = rawFolderDescendantIds(folderId);
      where.push(`rf.folder_id IN (${ids.map(() => '?').join(',') || "''"})`);
      params.push(...ids);
    } else {
      where.push('rf.folder_id = ?');
      params.push(folderId);
    }
  }
  const uploaderFilter = uploader || uploaderName || photographer;
  if (uploaderFilter) {
    where.push("COALESCE(NULLIF(rf.uploaded_by, ''), '未知上传人') = ?");
    params.push(uploaderFilter);
  }
  if (dateFrom) { where.push("COALESCE(rf.date, substr(rf.created_at, 1, 10)) >= ?"); params.push(dateFrom); }
  if (dateTo) { where.push("COALESCE(rf.date, substr(rf.created_at, 1, 10)) <= ?"); params.push(dateTo); }
  const whereStr = `WHERE ${where.join(' AND ')}`;
  const limit = Math.min(Number(pageSize || 80), 1000);
  const files = db.prepare(`
    SELECT rf.*
    FROM raw_material_files rf
    ${whereStr}
    ORDER BY rf.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, (Number(page) - 1) * limit);
  const total = db.prepare(`SELECT COUNT(*) AS total FROM raw_material_files rf ${whereStr}`).get(...params).total;
  res.json(success({ list: files, total, page: Number(page), pageSize: limit }));
});

app.get('/api/raw-material-folders/:id/files', (req, res) => {
  const folder = getRawFolderById(req.params.id);
  if (!folder) return res.status(404).json(error('文件夹不存在', 404));
  const ids = rawFolderDescendantIds(folder.id);
  const files = db.prepare(`
    SELECT *
    FROM raw_material_files
    WHERE status != 'deleted' AND folder_id IN (${ids.map(() => '?').join(',') || "''"})
    ORDER BY folder_path, created_at DESC
    LIMIT 1000
  `).all(...ids);
  res.json(success({ folder, list: files, total: files.length }));
});

app.post('/api/raw-material-files', (req, res) => {
  validateRequired(req.body, ['name', 'key']);
  const folder = req.body.folder_id ? getRawFolderById(req.body.folder_id) : getRawFolderById(RAW_MATERIAL_ROOT_FOLDER_ID);
  const id = generateId();
  const uploadedByName = req.user?.name || req.user?.username || '未知上传人';
  const photographer = String(req.body.photographer || '').trim() || uploadedByName;
  db.prepare(`
    INSERT INTO raw_material_files (
      id, name, size, cos_key, object_key, storage_provider, url, folder_id, folder_path,
      photographer, date, duration, mime, uploaded_by, uploaded_by_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.body.name,
    Number(req.body.size || 0),
    req.body.key,
    req.body.object_key || req.body.key,
    req.body.storage_provider || req.body.provider || 'cos',
    req.body.url || '',
    folder?.id || RAW_MATERIAL_ROOT_FOLDER_ID,
    folder?.path || '/',
    photographer,
    req.body.date || dayjs().format('YYYY-MM-DD'),
    req.body.duration || null,
    req.body.mime || '',
    uploadedByName,
    req.user?.id || null
  );
  res.json(success({ id, uploaded_by: uploadedByName, uploaded_by_user_id: req.user?.id || null, storage_provider: req.body.storage_provider || req.body.provider || 'cos' }, '原片记录创建成功'));
});

app.put('/api/raw-material-files/:id', (req, res) => {
  const folder = req.body.folder_id ? getRawFolderById(req.body.folder_id) : null;
  db.prepare(`
    UPDATE raw_material_files SET
      name = COALESCE(?, name),
      photographer = COALESCE(?, photographer),
      date = COALESCE(?, date),
      duration = COALESCE(?, duration),
      folder_id = COALESCE(?, folder_id),
      folder_path = COALESCE(?, folder_path),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status != 'deleted'
  `).run(
    req.body.name,
    req.body.photographer,
    req.body.date,
    req.body.duration,
    folder?.id || req.body.folder_id,
    folder?.path || req.body.folder_path,
    req.params.id
  );
  res.json(success(null, '原片更新成功'));
});

app.delete('/api/raw-material-files/:id', (req, res) => {
  db.prepare("UPDATE raw_material_files SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.params.id);
  res.json(success(null, '原片删除成功'));
});

app.get('/api/raw-material-stats', (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(String(req.query.month || '')) ? String(req.query.month) : dayjs().format('YYYY-MM');
  const startDate = req.query.dateFrom || `${month}-01`;
  const endDate = req.query.dateTo || dayjs(startDate).endOf('month').format('YYYY-MM-DD');
  const params = [startDate, endDate];
  const uploaderNameSql = "COALESCE(NULLIF(rf.uploaded_by, ''), '未知上传人')";
  const rows = db.prepare(`
    SELECT
      ${uploaderNameSql} AS uploader_name,
      ${uploaderNameSql} AS photographer,
      COALESCE(rf.uploaded_by_user_id, '') AS uploader_id,
      COUNT(*) AS total_count,
      SUM(CASE WHEN ${rawFileIsVideoSql} THEN 1 ELSE 0 END) AS video_count,
      COALESCE(SUM(rf.size), 0) AS total_size,
      MIN(COALESCE(rf.date, substr(rf.created_at, 1, 10))) AS first_upload_date,
      MAX(COALESCE(rf.date, substr(rf.created_at, 1, 10))) AS last_upload_date
    FROM raw_material_files rf
    WHERE rf.status != 'deleted'
      AND COALESCE(rf.date, substr(rf.created_at, 1, 10)) >= ?
      AND COALESCE(rf.date, substr(rf.created_at, 1, 10)) <= ?
    GROUP BY uploader_id, uploader_name
    ORDER BY video_count DESC, total_count DESC, uploader_name
  `).all(...params).map(row => ({
    ...row,
    total_count: Number(row.total_count || 0),
    video_count: Number(row.video_count || 0),
    total_size: Number(row.total_size || 0)
  }));
  res.json(success({
    month,
    dateRange: { start: startDate, end: endDate },
    totals: rows.reduce((acc, row) => ({
      total_count: acc.total_count + row.total_count,
      video_count: acc.video_count + row.video_count,
      total_size: acc.total_size + row.total_size
    }), { total_count: 0, video_count: 0, total_size: 0 }),
    list: rows
  }));
});

app.use((req, res) => {
  res.status(404).json(error('接口不存在', 404));
});

app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = status >= 500 ? '服务器错误，请稍后重试' : err.message;
  if (status >= 500) logger.error('[server-error]', err);
  res.status(status).json(error(message, status));
});

module.exports = app;
