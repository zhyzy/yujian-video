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
const { Readable } = require('stream');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

// Create logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
const uploadsDir = path.join(__dirname, 'uploads');
const avatarUploadsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarUploadsDir)) {
  fs.mkdirSync(avatarUploadsDir, { recursive: true });
}
const qrcodeUploadsDir = path.join(uploadsDir, 'qrcodes');
if (!fs.existsSync(qrcodeUploadsDir)) {
  fs.mkdirSync(qrcodeUploadsDir, { recursive: true });
}

// Winston logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'yj-media-backend' },
  transports: [
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') }),
    new winston.transports.File({ 
      filename: path.join(logsDir, 'access.log'),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, method, path, status, responseTime }) => {
          return `${timestamp} ${method} ${path} ${status} ${responseTime}ms`;
        })
      )
    })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

const app = express();
const PORT = Number(process.env.PORT || 3001);

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || ''
    };
    if (res.statusCode >= 400) {
      logger.warn('access', logEntry);
    } else {
      logger.info('access', logEntry);
    }
  });
  next();
});

const aiService = require('./services/ai');
const systemSettingsService = require('./services/systemSettings').createSystemSettingsService(db);

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));
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
const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const LOGIN_MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MINUTES || 15) * 60 * 1000;
const LOGIN_LOCK_MS = Number(process.env.LOGIN_LOCK_MINUTES || 15) * 60 * 1000;
const loginAttempts = new Map();

// 统一响应格式
const success = (data, message = 'success') => ({ code: 200, message, data });
const error = (message = 'error', code = 500) => ({ code, message, data: null });

const sanitizeBody = (body = {}) => {
  const clone = { ...body };
  ['password', 'password_hash', 'token', 'TmpSecretKey', 'SecretKey'].forEach(key => {
    if (key in clone) clone[key] = '***';
  });
  return JSON.stringify(clone).slice(0, 2000);
};

const validateRequired = (body, fields) => {
  const missing = fields.filter(field => body[field] === undefined || body[field] === null || body[field] === '');
  if (missing.length) {
    const err = new Error(`缺少必填字段：${missing.join(', ')}`);
    err.status = 400;
    throw err;
  }
};

const getClientIp = (req) => String(req.headers['x-forwarded-for'] || req.ip || '')
  .split(',')[0]
  .trim();

const loginAttemptKey = (req, username = '') => `${getClientIp(req)}:${String(username || '').trim().toLowerCase()}`;

const getLoginAttempt = (key) => {
  const now = Date.now();
  const attempt = loginAttempts.get(key);
  if (!attempt) return { count: 0, firstAt: now, lockedUntil: 0 };
  if (attempt.lockedUntil && attempt.lockedUntil > now) return attempt;
  if (now - attempt.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(key);
    return { count: 0, firstAt: now, lockedUntil: 0 };
  }
  return attempt;
};

const registerLoginFailure = (key) => {
  const now = Date.now();
  const attempt = getLoginAttempt(key);
  const next = {
    count: attempt.count + 1,
    firstAt: attempt.firstAt || now,
    lockedUntil: attempt.lockedUntil || 0
  };
  if (next.count >= LOGIN_MAX_ATTEMPTS) {
    next.lockedUntil = now + LOGIN_LOCK_MS;
  }
  loginAttempts.set(key, next);
  return next;
};

const clearLoginAttempt = (key) => {
  loginAttempts.delete(key);
};

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

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
};

const signUserToken = (user) => jwt.sign({
  id: user.id,
  username: user.username,
  name: user.name,
  role: user.role,
  city_id: user.city_id || null,
  token_version: user.token_version || 0
}, JWT_SECRET, { expiresIn: TOKEN_EXPIRES_IN });

const authRequired = (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) return res.status(401).json(error('请先登录', 401));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, username, name, role, status, city_id, avatar_url, token_version FROM users WHERE id = ?').get(payload.id);
    if (!user || user.status !== 'active') return res.status(401).json(error('登录状态已失效', 401));
    if (user.token_version !== payload.token_version) return res.status(401).json(error('登录状态已失效，请重新登录', 401));
    req.user = user;
    next();
  } catch {
    res.status(401).json(error('登录状态已失效', 401));
  }
};

const adminRequired = (req, res, next) => {
  if (req.user?.role !== 'admin') return res.status(403).json(error('仅管理员可操作', 403));
  next();
};

const isCityRole = (role) => ['city', 'city_account', 'cityUser', 'city_user', '城市账号'].includes(String(role || ''));

const requireAdminOrSelf = (req, res, next) => {
  if (req.user?.role === 'admin' || req.user?.id === req.params.id) return next();
  return res.status(403).json(error('没有权限操作该账号', 403));
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
      db.prepare(`
        INSERT INTO operation_logs (
          id, user_id, username, action, method, path, resource, resource_id,
          status_code, request_body, ip, user_agent
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId(),
        req.user?.id || null,
        req.user?.username || null,
        `${req.method} ${req.path}`,
        req.method,
        req.path,
        req.path.split('/').filter(Boolean)[1] || '',
        req.params?.id || req.body?.id || null,
        res.statusCode,
        sanitizeBody(req.body),
        req.ip,
        req.headers['user-agent'] || ''
      );
    } catch (e) {
      logger.warn('[operation-log] 写入失败:', e.message);
    }
  });
  next();
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

const getStorageConfig = () => {
  const storage = getSystemSettings().storage || {};
  return {
    secretId: storage.secretId || process.env.COS_SECRET_ID,
    secretKey: storage.secretKey || process.env.COS_SECRET_KEY,
    bucket: storage.bucket || process.env.COS_BUCKET,
    region: storage.region || process.env.COS_REGION || 'ap-shanghai',
    domain: storage.domain || process.env.COS_DOMAIN,
    cdnDomain: storage.cdnDomain || process.env.COS_CDN_DOMAIN,
    previewExpires: Number(storage.previewExpires || 600),
    uploadPrefix: storage.uploadPrefix || 'materials/'
  };
};

const getCosClient = () => {
  const config = getStorageConfig();
  validateRequired({ COS_SECRET_ID: config.secretId, COS_SECRET_KEY: config.secretKey, COS_BUCKET: config.bucket }, ['COS_SECRET_ID', 'COS_SECRET_KEY', 'COS_BUCKET']);
  return new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey,
    SecurityToken: process.env.COS_SECURITY_TOKEN || undefined
  });
};

const getCosSigner = () => {
  const config = getStorageConfig();
  validateRequired({ COS_SECRET_ID: config.secretId, COS_SECRET_KEY: config.secretKey }, ['COS_SECRET_ID', 'COS_SECRET_KEY']);
  return new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey,
    SecurityToken: process.env.COS_SECURITY_TOKEN || undefined
  });
};

const parseCosLocationFromUrl = (rawUrl) => {
  if (!rawUrl) return {};
  try {
    const target = new URL(rawUrl);
    const match = target.hostname.match(/^(.+)\.cos\.([a-z0-9-]+)\.myqcloud\.com$/i);
    if (!match) return {};
    return { bucket: match[1], region: match[2] };
  } catch {
    return {};
  }
};

const validatePreviewUrl = (rawUrl) => {
  if (!rawUrl) {
    const err = new Error('缺少视频地址');
    err.status = 400;
    throw err;
  }

  let target;
  try {
    target = new URL(rawUrl);
  } catch {
    const err = new Error('视频地址不正确');
    err.status = 400;
    throw err;
  }

  const storage = getStorageConfig();
  const allowedHosts = new Set([
    storage.bucket && storage.region
      ? `${storage.bucket}.cos.${storage.region}.myqcloud.com`
      : '',
    storage.cdnDomain || ''
  ].filter(Boolean));

  const isTencentCosHost = /^.+\.cos\.[a-z0-9-]+\.myqcloud\.com$/i.test(target.hostname);

  if (!['https:', 'http:'].includes(target.protocol) || (!allowedHosts.has(target.host) && !isTencentCosHost)) {
    const err = new Error('仅支持当前 COS 存储桶的视频预览');
    err.status = 400;
    throw err;
  }
  return target;
};

const normalizeCosKey = (rawKey) => {
  const key = String(rawKey || '').trim().replace(/^\/+/, '');
  if (!key || key.includes('..')) {
    const err = new Error('COS 对象 key 不正确');
    err.status = 400;
    throw err;
  }
  return key;
};

const getCosPreviewUrl = (key, rawUrl) => new Promise((resolve, reject) => {
  const storage = getStorageConfig();
  const location = parseCosLocationFromUrl(rawUrl);
  const bucket = storage.bucket || location.bucket;
  const region = storage.region || location.region || 'ap-shanghai';
  if (!bucket) {
    const err = new Error('缺少 COS 存储桶配置');
    err.status = 400;
    reject(err);
    return;
  }
  const cos = getCosSigner();
  cos.getObjectUrl({
    Bucket: bucket,
    Region: region,
    Key: normalizeCosKey(key),
    Sign: true,
    Expires: storage.previewExpires || 600
  }, (err, data) => {
    if (err) return reject(err);
    resolve(data.Url);
  });
});

const signPreviewToken = (url) => jwt.sign(
  { purpose: 'media-preview', url },
  JWT_SECRET,
  { expiresIn: '10m' }
);

const verifyPreviewToken = (token) => {
  const payload = jwt.verify(token, JWT_SECRET);
  if (payload.purpose !== 'media-preview' || !payload.url) {
    const err = new Error('预览凭证无效');
    err.status = 401;
    throw err;
  }
  return payload.url;
};

// ========== 认证与权限 ==========
app.post('/api/auth/login', (req, res) => {
  validateRequired(req.body, ['username', 'password']);
  const { username, password } = req.body;
  const attemptKey = loginAttemptKey(req, username);
  const currentAttempt = getLoginAttempt(attemptKey);
  if (currentAttempt.lockedUntil && currentAttempt.lockedUntil > Date.now()) {
    const waitMinutes = Math.ceil((currentAttempt.lockedUntil - Date.now()) / 60000);
    return res.status(429).json(error(`登录失败次数过多，请 ${waitMinutes} 分钟后再试`, 429));
  }
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || user.status !== 'active' || !bcrypt.compareSync(password, user.password_hash)) {
    const nextAttempt = registerLoginFailure(attemptKey);
    if (nextAttempt.lockedUntil && nextAttempt.lockedUntil > Date.now()) {
      const waitMinutes = Math.ceil((nextAttempt.lockedUntil - Date.now()) / 60000);
      return res.status(429).json(error(`登录失败次数过多，请 ${waitMinutes} 分钟后再试`, 429));
    }
    return res.status(401).json(error('账号或密码不正确', 401));
  }
  clearLoginAttempt(attemptKey);
  db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const safeUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    city_id: user.city_id || null,
    avatar_url: user.avatar_url || '',
    token_version: user.token_version || 0
  };
  res.json(success({ token: signUserToken(safeUser), user: safeUser }, '登录成功'));
});

app.get('/api/auth/me', authRequired, (req, res) => {
  const user = db.prepare(`
    SELECT u.id, u.username, u.name, u.role, u.status, u.city_id, u.avatar_url, u.phone, u.remark,
           c.name as city_name, u.last_login_at, u.created_at, u.updated_at
    FROM users u
    LEFT JOIN cities c ON u.city_id = c.id
    WHERE u.id = ?
  `).get(req.user.id);
  res.json(success(user || req.user));
});

// Token刷新 - 如果旧token仍然有效，则颁发新token并递增版本号
app.post('/api/auth/refresh', authRequired, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user || user.status !== 'active') {
    return res.status(401).json(error('用户状态异常', 401));
  }
  // 递增token版本号
  db.prepare('UPDATE users SET token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
  const newVersion = (user.token_version || 0) + 1;
  const safeUser = { id: user.id, username: user.username, name: user.name, role: user.role, token_version: newVersion };
  res.json(success({ token: signUserToken(safeUser), user: safeUser }, '刷新成功'));
});

// 修改密码
app.put('/api/auth/password', authRequired, (req, res) => {
  validateRequired(req.body, ['oldPassword', 'newPassword']);
  const { oldPassword, newPassword } = req.body;
  if (newPassword.length < 6) {
    return res.status(400).json(error('新密码长度不能少于6位', 400));
  }
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) {
    return res.status(404).json(error('用户不存在', 404));
  }
  if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
    return res.status(400).json(error('原密码不正确', 400));
  }
  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newHash, user.id);
  res.json(success(null, '密码修改成功，请重新登录'));
});

app.put('/api/auth/profile', authRequired, (req, res) => {
  const { name, avatar_url, phone, remark } = req.body;
  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      avatar_url = COALESCE(?, avatar_url),
      phone = COALESCE(?, phone),
      remark = COALESCE(?, remark),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, avatar_url, phone, remark, req.user.id);
  const user = db.prepare('SELECT id, username, name, role, city_id, avatar_url, phone, remark, token_version FROM users WHERE id = ?').get(req.user.id);
  res.json(success({ user, token: signUserToken(user) }, '资料已更新'));
});

// ========== 系统设置 API ==========
app.get('/api/system-settings/public', (req, res) => {
  const settings = systemSettingsService.maskSystemSettings(systemSettingsService.getSystemSettings());
  res.json(success({
    brand: settings.brand,
    copy: settings.copy
  }));
});

app.get('/api/system-settings', authRequired, (req, res) => {
  res.json(success(systemSettingsService.maskSystemSettings(systemSettingsService.getSystemSettings())));
});

app.put('/api/system-settings', authRequired, adminRequired, (req, res) => {
  const current = systemSettingsService.getSystemSettings();
  const incoming = req.body || {};
  const next = systemSettingsService.mergeDeep(current, incoming);
  if (incoming.storage && incoming.storage.secretKey === '') {
    next.storage.secretKey = current.storage.secretKey || '';
  }
  systemSettingsService.saveSystemSettingsValue(next, req.user.id);
  res.json(success(systemSettingsService.maskSystemSettings(next), '系统设置已保存'));
});

app.post('/api/system-settings/storage/test', authRequired, adminRequired, (req, res) => {
  const storage = mergeDeep(getSystemSettings().storage, req.body || {});
  if (!storage.secretKey) storage.secretKey = getSystemSettings().storage.secretKey || process.env.COS_SECRET_KEY || '';
  validateRequired({
    secretId: storage.secretId,
    secretKey: storage.secretKey,
    bucket: storage.bucket,
    region: storage.region
  }, ['secretId', 'secretKey', 'bucket', 'region']);
  const cos = new COS({ SecretId: storage.secretId, SecretKey: storage.secretKey });
  cos.headBucket({ Bucket: storage.bucket, Region: storage.region }, (err) => {
    if (err) return res.status(400).json(error(err.message || '存储桶连接失败', 400));
    res.json(success({ ok: true }, '存储桶连接成功'));
  });
});

// ========== 系统用户 API ==========
app.get('/api/system-users', authRequired, adminRequired, (req, res) => {
  const { role, cityId, status, page = 1, pageSize = 100 } = req.query;
  const where = [];
  const params = [];
  if (role) { where.push('u.role = ?'); params.push(role); }
  if (cityId) { where.push('u.city_id = ?'); params.push(cityId); }
  if (status) { where.push('u.status = ?'); params.push(status); }
  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const users = db.prepare(`
    SELECT u.id, u.username, u.name, u.role, u.status, u.city_id, u.avatar_url, u.phone, u.remark,
           u.last_login_at, u.created_at, u.updated_at, c.name as city_name
    FROM users u
    LEFT JOIN cities c ON u.city_id = c.id
    ${whereStr}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM users u ${whereStr}`).get(...params);
  res.json(success({ list: users, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.post('/api/system-users', authRequired, adminRequired, (req, res) => {
  validateRequired(req.body, ['username', 'password', 'name', 'role']);
  const { username, password, name, role, city_id, status = 'active', avatar_url = '', phone = '', remark = '' } = req.body;
  if (password.length < 6) return res.status(400).json(error('密码长度不能少于6位', 400));
  if (role === 'city' && !city_id) return res.status(400).json(error('城市账号必须绑定城市', 400));
  if (city_id) {
    const city = db.prepare('SELECT id FROM cities WHERE id = ? AND status != ?').get(city_id, 'archived');
    if (!city) return res.status(400).json(error('绑定城市不存在', 400));
  }
  const existed = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existed) return res.status(400).json(error('账号已存在', 400));
  const id = generateId();
  db.prepare(`
    INSERT INTO users (id, username, password_hash, name, role, status, city_id, avatar_url, phone, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, username, bcrypt.hashSync(password, 10), name, role, status, city_id || null, avatar_url, phone, remark);
  res.json(success({ id }, '账号已创建'));
});

app.put('/api/system-users/:id', authRequired, requireAdminOrSelf, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json(error('账号不存在', 404));
  const isAdmin = req.user.role === 'admin';
  const name = req.body.name;
  const avatarUrl = req.body.avatar_url;
  const phone = req.body.phone;
  const remark = req.body.remark;
  const role = isAdmin ? req.body.role : target.role;
  const status = isAdmin ? req.body.status : target.status;
  const cityId = isAdmin ? (req.body.city_id ?? target.city_id) : target.city_id;
  if (role === 'city' && !cityId) return res.status(400).json(error('城市账号必须绑定城市', 400));
  db.prepare(`
    UPDATE users SET
      name = COALESCE(?, name),
      avatar_url = COALESCE(?, avatar_url),
      phone = COALESCE(?, phone),
      remark = COALESCE(?, remark),
      role = COALESCE(?, role),
      status = COALESCE(?, status),
      city_id = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, avatarUrl, phone, remark, role, status, cityId || null, req.params.id);
  res.json(success(null, '账号已更新'));
});

app.put('/api/system-users/:id/password', authRequired, requireAdminOrSelf, (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json(error('账号不存在', 404));
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 6) return res.status(400).json(error('新密码长度不能少于6位', 400));
  if (req.user.role !== 'admin') {
    if (!oldPassword || !bcrypt.compareSync(oldPassword, target.password_hash)) {
      return res.status(400).json(error('原密码不正确', 400));
    }
  }
  db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(bcrypt.hashSync(newPassword, 10), req.params.id);
  res.json(success(null, req.user.role === 'admin' ? '密码已重置' : '密码已修改'));
});

app.delete('/api/system-users/:id', authRequired, adminRequired, (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json(error('不能停用当前登录账号', 400));
  db.prepare('UPDATE users SET status = ?, token_version = token_version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('disabled', req.params.id);
  res.json(success(null, '账号已停用'));
});

// 健康检查
app.get('/api/health', (req, res) => {
  const memUsage = process.memoryUsage();
  res.json(success({
    status: 'ok',
    timestamp: dayjs().format(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
    }
  }));
});

// 全局搜索
app.get('/api/search', authRequired, (req, res) => {
  const { q, type } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json(error('搜索关键词至少需要2个字符', 400));
  }
  const keyword = `%${q.trim()}%`;
  const results = {};

  if (!type || type === 'accounts') {
    const accounts = db.prepare(`
      SELECT id, name, platform, platform_account as account, type, status, 'account' as category
      FROM accounts
      WHERE status = 'active' AND (name LIKE ? OR platform_account LIKE ? OR platform_label LIKE ?)
      LIMIT 20
    `).all(keyword, keyword, keyword);
    results.accounts = accounts;
  }

  if (!type || type === 'materials') {
    const materials = db.prepare(`
      SELECT m.id, m.date, m.shoot_count, m.edit_count, m.upload_count, m.status,
             s.name as staff_name, vt.name as type_name, 'material' as category
      FROM materials m
      LEFT JOIN staffs s ON m.staff_id = s.id
      LEFT JOIN video_types vt ON m.video_type_id = vt.id
      WHERE m.status != 'deleted' AND (m.remark LIKE ? OR s.name LIKE ? OR vt.name LIKE ?)
      LIMIT 20
    `).all(keyword, keyword, keyword);
    results.materials = materials;
  }

  if (!type || type === 'schedules') {
    const schedules = db.prepare(`
      SELECT s.id, s.date, s.time, s.video_title, s.status,
             a.name as account_name, 'schedule' as category
      FROM schedules s
      LEFT JOIN accounts a ON s.account_id = a.id
      WHERE s.video_title LIKE ? OR a.name LIKE ?
      LIMIT 20
    `).all(keyword, keyword);
    results.schedules = schedules;
  }

  if (!type || type === 'cities') {
    const cities = db.prepare(`
      SELECT id, name, contact_name, contact_info, status, 'city' as category
      FROM cities
      WHERE status != 'archived' AND (name LIKE ? OR contact_name LIKE ?)
      LIMIT 20
    `).all(keyword, keyword);
    results.cities = cities;
  }

  res.json(success(results));
});

// 获取用户通知
app.get('/api/notifications', authRequired, (req, res) => {
  const { page = 1, pageSize = 20, isRead } = req.query;
  let where = ['user_id = ?'];
  let params = [req.user.id];

  if (isRead !== undefined) {
    where.push('is_read = ?');
    params.push(isRead === 'true' ? 1 : 0);
  }

  const whereStr = `WHERE ${where.join(' AND ')}`;
  const notifications = db.prepare(`
    SELECT * FROM notifications
    ${whereStr}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

  const { total } = db.prepare(`SELECT COUNT(*) as total FROM notifications ${whereStr}`).get(...params);
  const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);

  res.json(success({
    list: notifications,
    total,
    unread: unreadCount.count,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  }));
});

// 标记通知已读
app.put('/api/notifications/:id/read', authRequired, (req, res) => {
  const notification = db.prepare('SELECT * FROM notifications WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!notification) {
    return res.status(404).json(error('通知不存在', 404));
  }
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json(success(null, '已标记为已读'));
});

// 全部标记已读
app.put('/api/notifications/read-all', authRequired, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').run(req.user.id);
  res.json(success(null, '已全部标记为已读'));
});

app.get('/api/operation-logs', authRequired, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json(error('仅管理员可查看操作日志', 403));
  const { page = 1, pageSize = 50, user_id, username, dateFrom, dateTo, action, method, path } = req.query;
  let where = [];
  let params = [];
  
  if (user_id) { where.push('user_id = ?'); params.push(user_id); }
  if (username) { where.push('username LIKE ?'); params.push(`%${username}%`); }
  if (dateFrom) { where.push('created_at >= ?'); params.push(dateFrom); }
  if (dateTo) { where.push('created_at <= ?'); params.push(dateTo); }
  if (action) { where.push('action LIKE ?'); params.push(`%${action}%`); }
  if (method) { where.push('method LIKE ?'); params.push(`%${method}%`); }
  if (path) { where.push('path LIKE ?'); params.push(`%${path}%`); }
  
  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
  
  const logs = db.prepare(`
    SELECT * FROM operation_logs
    ${whereStr}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM operation_logs ${whereStr}`).get(...params);
  res.json(success({ list: logs, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.get('/api/task-progress', authRequired, (req, res) => {
  const month = req.query.month || (req.query.date ? dayjs(req.query.date).format('YYYY-MM') : dayjs().format('YYYY-MM'));
  const cityId = req.query.cityId || req.query.city_id || null;
  res.json(success(buildTaskProgress({ user: req.user, month, cityId })));
});

// ========== 媒体预览代理 ==========
app.get('/api/media/proxy', async (req, res, next) => {
  try {
    const token = String(req.query.token || '');
    const target = new URL(verifyPreviewToken(token));
    if (!['https:', 'http:'].includes(target.protocol)) {
      const err = new Error('预览地址不正确');
      err.status = 400;
      throw err;
    }

    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;

    const upstream = await fetch(target, { headers });
    if (!upstream.ok && upstream.status !== 206) {
      return res.status(upstream.status).json(error('视频读取失败', upstream.status));
    }

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type') || 'video/mp4';
    const contentLength = upstream.headers.get('content-length');
    const contentRange = upstream.headers.get('content-range');
    const acceptRanges = upstream.headers.get('accept-ranges') || 'bytes';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', acceptRanges);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, max-age=300');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentRange) res.setHeader('Content-Range', contentRange);

    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) {
    next(e);
  }
});

app.use('/api', authRequired, roleGuard, operationLogger);

app.post('/api/uploads/avatar', (req, res) => {
  const { filename = 'avatar.png', mime = '', data = '' } = req.body || {};
  const match = String(data).match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/i);
  const contentType = match?.[1] || mime;
  const base64 = match?.[2] || data;

  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(contentType)) {
    return res.status(400).json(error('只支持 png、jpg、webp、gif 图片', 400));
  }
  if (!base64) {
    return res.status(400).json(error('缺少图片内容', 400));
  }

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json(error('头像图片不能超过 5MB', 400));
  }

  const extByMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  const ext = extByMime[contentType.toLowerCase()] || path.extname(filename).slice(1).toLowerCase() || 'png';
  const safeName = `${dayjs().format('YYYYMMDD')}_${crypto.randomBytes(10).toString('hex')}.${ext}`;
  const filePath = path.join(avatarUploadsDir, safeName);
  fs.writeFileSync(filePath, buffer);

  res.json(success({
    url: `/api/uploads/avatars/${safeName}`,
    filename: safeName,
    size: buffer.length,
    mime: contentType
  }, '头像上传成功'));
});

app.post('/api/uploads/qrcode', authRequired, (req, res) => {
  const { filename = 'qrcode.png', mime = '', data = '' } = req.body || {};
  const match = String(data).match(/^data:(image\/(?:png|jpe?g|webp|gif));base64,(.+)$/i);
  const contentType = match?.[1] || mime;
  const base64 = match?.[2] || data;

  if (!/^image\/(png|jpe?g|webp|gif)$/i.test(contentType)) {
    return res.status(400).json(error('只支持 png、jpg、webp、gif 图片', 400));
  }
  if (!base64) {
    return res.status(400).json(error('缺少图片内容', 400));
  }

  const buffer = Buffer.from(base64, 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json(error('二维码图片不能超过 5MB', 400));
  }

  const extByMime = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  const ext = extByMime[contentType.toLowerCase()] || path.extname(filename).slice(1).toLowerCase() || 'png';
  const safeName = `${dayjs().format('YYYYMMDD')}_${crypto.randomBytes(10).toString('hex')}.${ext}`;
  const filePath = path.join(qrcodeUploadsDir, safeName);
  fs.writeFileSync(filePath, buffer);

  res.json(success({
    url: `/api/uploads/qrcodes/${safeName}`,
    filename: safeName,
    size: buffer.length,
    mime: contentType
  }, '二维码上传成功'));
});

app.post('/api/media/preview-token', async (req, res, next) => {
  try {
    let target;
    if (req.body.key) {
      try {
        target = new URL(await getCosPreviewUrl(req.body.key, req.body.url));
      } catch (e) {
        if (!req.body.url) throw e;
        logger.warn('[media-preview] COS key 签名失败，尝试使用原始 URL', { message: e.message });
      }
    }
    if (!target) target = validatePreviewUrl(req.body.url);
    const token = signPreviewToken(target.toString());
    res.json(success({
      previewUrl: `/api/media/proxy?token=${encodeURIComponent(token)}`,
      expiresIn: 600
    }));
  } catch (e) {
    next(e);
  }
});

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
    WITH published_items AS (
      SELECT 'schedule:' || s.id as item_key, s.account_id
      FROM schedules s
      WHERE s.date = ? AND s.status = 'published'
      UNION
      SELECT
        CASE
          WHEN COALESCE(dt.schedule_id, '') != '' THEN 'schedule:' || dt.schedule_id
          ELSE 'track:' || dt.id
        END as item_key,
        dt.account_id
      FROM data_tracks dt
      WHERE dt.date = ? AND COALESCE(dt.city_distribution_id, '') = ''
    )
    SELECT COUNT(DISTINCT item_key) as total, COUNT(DISTINCT account_id) as accounts
    FROM published_items
  `).get(today, today);

  const hqPendingToday = db.prepare(`
    SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
    FROM schedules
    WHERE date = ? AND COALESCE(status, 'pending') != 'published'
  `).get(today);

  const cityPublishedToday = db.prepare(`
    SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
    FROM city_distributions
    WHERE COALESCE(NULLIF(substr(actual_publish_time, 1, 10), ''), date) = ?
      AND status = 'published'
  `).get(today);

  const cityPendingToday = db.prepare(`
    SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
    FROM city_distributions
    WHERE date = ? AND COALESCE(status, 'distributed') != 'published'
  `).get(today);

  const hqPublishedMonth = db.prepare(`
    WITH published_items AS (
      SELECT 'schedule:' || s.id as item_key, s.account_id
      FROM schedules s
      WHERE s.date >= ? AND s.date <= ? AND s.status = 'published'
      UNION
      SELECT
        CASE
          WHEN COALESCE(dt.schedule_id, '') != '' THEN 'schedule:' || dt.schedule_id
          ELSE 'track:' || dt.id
        END as item_key,
        dt.account_id
      FROM data_tracks dt
      WHERE dt.date >= ? AND dt.date <= ? AND COALESCE(dt.city_distribution_id, '') = ''
    )
    SELECT COUNT(DISTINCT item_key) as total, COUNT(DISTINCT account_id) as accounts
    FROM published_items
  `).get(monthStart, monthEnd, monthStart, monthEnd);

  const cityPublishedMonth = db.prepare(`
    SELECT COUNT(*) as total, COUNT(DISTINCT account_id) as accounts
    FROM city_distributions
    WHERE COALESCE(NULLIF(substr(actual_publish_time, 1, 10), ''), date) >= ?
      AND COALESCE(NULLIF(substr(actual_publish_time, 1, 10), ''), date) <= ?
      AND status = 'published'
  `).get(monthStart, monthEnd);

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
  const types = db.prepare('SELECT * FROM video_types WHERE status = ? ORDER BY sort_order').all('active');
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
  const { type, platform, cityId, city_id } = req.query;
  let where = ['status = ?'];
  let params = ['active'];
  
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
  const isCity = isCityRole(req.user.role);
  const scopedCityId = isCity ? req.user.city_id : null;
  const cityWhere = scopedCityId ? 'AND c.id = ?' : '';
  const cityParams = scopedCityId ? [scopedCityId] : [];
  const cities = db.prepare(`
    SELECT 
      c.*,
      a_ks.name as kuaishou_name,
      a_wx.name as weixin_name,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ? AND cd.status = 'published') as published_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ? AND cd.status IN ('distributed', 'confirmed')) as pending_count,
      (SELECT COUNT(*) FROM city_distributions cd WHERE cd.city_id = c.id AND cd.date = ?) as total_count
    FROM cities c
    LEFT JOIN accounts a_ks ON c.kuaishou_account_id = a_ks.id
    LEFT JOIN accounts a_wx ON c.weixin_account_id = a_wx.id
    WHERE c.status != 'archived' ${cityWhere}
    ORDER BY c.name
  `).all(date, date, date, ...cityParams);
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
  });
  res.json(success(cities));
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
  const { name, kuaishou_account_id, weixin_account_id, netdisk_folder } = req.body;
  const contactName = req.body.contact_name || req.body.contact || '';
  const contactInfo = req.body.contact_info || req.body.phone || '';
  const id = generateId();
  db.prepare('INSERT INTO cities (id, name, contact_name, contact_info, kuaishou_account_id, weixin_account_id, netdisk_folder) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, name, contactName, contactInfo, kuaishou_account_id, weixin_account_id, netdisk_folder);
  res.json(success({ id }, '创建成功'));
});

app.put('/api/cities/:id', (req, res) => {
  const { name, kuaishou_account_id, weixin_account_id, netdisk_folder, status } = req.body;
  const contactName = req.body.contact_name || req.body.contact || '';
  const contactInfo = req.body.contact_info || req.body.phone || '';
  db.prepare('UPDATE cities SET name = ?, contact_name = ?, contact_info = ?, kuaishou_account_id = ?, weixin_account_id = ?, netdisk_folder = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(name, contactName, contactInfo, kuaishou_account_id, weixin_account_id, netdisk_folder, status || 'active', req.params.id);
  res.json(success(null, '更新成功'));
});

app.delete('/api/cities/:id', (req, res) => {
  db.prepare('UPDATE cities SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('archived', req.params.id);
  db.prepare('UPDATE accounts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE city_id = ?').run('archived', req.params.id);
  res.json(success(null, '删除成功'));
});

// ========== 城市分发 API ==========
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
  if (status) { where.push('cd.status = ?'); params.push(status); }
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
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  
  const { total } = db.prepare(`
    SELECT COUNT(*) as total
    FROM city_distributions cd
    LEFT JOIN cities c ON cd.city_id = c.id
    LEFT JOIN accounts a ON cd.account_id = a.id
    ${whereStr}
  `).get(...params);
  
  res.json(success({ list: distributions, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
});

app.post('/api/city-distributions/:id/download', authRequired, (req, res) => {
  if (!isCityRole(req.user.role)) {
    return res.status(403).json(error('仅城市端可记录素材下载', 403));
  }
  const distribution = db.prepare(`
    SELECT id, city_id, video_url, material_url, downloaded_at, download_count
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
  db.prepare(`
    UPDATE city_distributions
    SET downloaded_at = COALESCE(downloaded_at, ?),
        last_downloaded_at = ?,
        download_count = COALESCE(download_count, 0) + 1,
        downloaded_by = COALESCE(downloaded_by, ?),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(now, now, req.user.id, distribution.id);

  const updated = db.prepare(`
    SELECT id, downloaded_at, last_downloaded_at, download_count, downloaded_by
    FROM city_distributions WHERE id = ?
  `).get(distribution.id);
  res.json(success(updated, '已记录素材下载'));
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

  const summary = db.prepare(`
    SELECT
      COUNT(*) AS monthAssigned,
      SUM(CASE WHEN date = ? THEN 1 ELSE 0 END) AS todayAssigned,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS monthPublished,
      SUM(CASE WHEN date = ? AND status = 'published' THEN 1 ELSE 0 END) AS todayPublished,
      SUM(CASE WHEN downloaded_at IS NOT NULL THEN 1 ELSE 0 END) AS downloaded,
      SUM(CASE WHEN downloaded_at IS NULL THEN 1 ELSE 0 END) AS notDownloaded,
      SUM(CASE WHEN status != 'published' AND date < ? THEN 1 ELSE 0 END) AS overdue
    FROM city_distributions
    WHERE city_id = ? AND date >= ? AND date <= ?
  `).get(today, today, today, cityId, monthStart, monthEnd);

  const tasks = db.prepare(`
    SELECT cd.*, a.name AS account_name, a.platform
    FROM city_distributions cd
    LEFT JOIN accounts a ON a.id = cd.account_id
    WHERE cd.city_id = ? AND cd.date >= ? AND cd.date <= ?
    ORDER BY cd.date DESC, COALESCE(cd.publish_time, '') DESC, cd.created_at DESC
  `).all(cityId, monthStart, monthEnd).map(task => ({
    ...task,
    display_status: task.status !== 'published' && task.date < today ? 'overdue' : task.status
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
  const account = db.prepare('SELECT id, city_id, type FROM accounts WHERE id = ? AND status != ?').get(account_id, 'archived');
  if (!account || account.type !== 'city' || account.city_id !== city_id) {
    return res.status(400).json(error('请选择该城市绑定的城市账号', 400));
  }
  const id = generateId();
  const isCitySubmit = isCityRole(req.user.role);
  const finalStatus = isCitySubmit ? 'published' : (status || 'distributed');
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
      id, date, city_id, account_id, video_title, video_url, material_url,
      publish_time, publish_requirement, status, publish_screenshot,
      publish_platform, publish_account_name, publish_url, actual_publish_time,
      play_count, like_count, comment_count, deal_count, deal_amount, favorite_count, share_count, city_remark,
      submitted_by, submitted_at, published_at, material_file_id, schedule_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, date, city_id, account_id, video_title || '城市下发任务', video_url || material_url || '',
    material_url || video_url || '', publish_time || time || '', publishRequirement, finalStatus,
    publish_screenshot || '', publish_platform || '', publish_account_name || '', publish_url || '',
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
  if (account_id && city_id) {
    const account = db.prepare('SELECT id, city_id, type FROM accounts WHERE id = ? AND status != ?').get(account_id, 'archived');
    if (!account || account.type !== 'city' || account.city_id !== city_id) {
      return res.status(400).json(error('请选择该城市绑定的城市账号', 400));
    }
  }
  const publishedAt = status === 'published' ? dayjs().format() : null;
  db.prepare(`
    UPDATE city_distributions SET
      date = COALESCE(?, date),
      city_id = COALESCE(?, city_id),
      account_id = COALESCE(?, account_id),
      video_title = COALESCE(?, video_title),
      video_url = COALESCE(?, video_url),
      material_url = COALESCE(?, material_url),
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
      failed_reason = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    date, city_id, account_id, video_title, video_url, material_url || video_url, publish_time || time,
    publishRequirement, status, publish_screenshot,
    publish_platform, publish_account_name, publish_url, actual_publish_time,
    play_count, like_count, comment_count, deal_count, deal_amount, favorite_count, share_count, city_remark,
    isCityRole(req.user.role) ? req.user.id : null,
    isCityRole(req.user.role) && (status === 'published' || publish_url) ? dayjs().format() : null,
    publishedAt, publishedAt, material_file_id, schedule_id, failed_reason, req.params.id
  );
  res.json(success(null, '更新成功'));
});

app.delete('/api/city-distributions/:id', (req, res) => {
  db.prepare('DELETE FROM city_distributions WHERE id = ?').run(req.params.id);
  res.json(success(null, '删除成功'));
});

// 批量创建城市分发
app.post('/api/city-distributions/batch', (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json(error('请求体必须是非空数组', 400));
  }
  const normalizeDistributionUrl = (value = '') => String(value || '').trim().replace(/[，,。.;；]+$/g, '');
  const urlGroups = new Map();
  items.forEach((item, index) => {
    const url = normalizeDistributionUrl(item.video_url || item.material_url);
    if (!url) return;
    if (!urlGroups.has(url)) urlGroups.set(url, []);
    urlGroups.get(url).push(index + 1);
  });
  const duplicates = [...urlGroups.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([video_url, rows]) => ({ video_url, rows }));
  if (duplicates.length) {
    return res.status(400).json({
      code: 400,
      message: `发现 ${duplicates.length} 个重复链接，请修改后再下发`,
      data: { duplicates }
    });
  }
  const insert = db.prepare(`
    INSERT INTO city_distributions (
      id, date, city_id, account_id, video_title, video_url, material_url,
      publish_time, publish_requirement, status, material_file_id, schedule_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const results = [];
  const insertAll = db.transaction((items) => {
    for (const item of items) {
      const cityId = isCityRole(req.user.role) ? req.user.city_id : item.city_id;
      const account = db.prepare('SELECT id, city_id, type FROM accounts WHERE id = ? AND status != ?').get(item.account_id, 'archived');
      if (!item.date || !cityId || !item.account_id) {
        throw new Error('批量下发缺少必填字段：date, city_id, account_id');
      }
      if (!account || account.type !== 'city' || account.city_id !== cityId) {
        throw new Error('批量下发包含不属于该城市的账号');
      }
      const id = generateId();
      insert.run(
        id,
        item.date,
        cityId,
        item.account_id,
        item.video_title || '城市下发任务',
        normalizeDistributionUrl(item.video_url || item.material_url),
        normalizeDistributionUrl(item.material_url || item.video_url),
        item.publish_time || item.time || '',
        item.publish_requirement || item.requirement || '',
        item.status || 'distributed',
        item.material_file_id,
        item.schedule_id
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
  const distributionCounts = db.prepare(`
    SELECT COUNT(*) AS distributed_videos
    FROM city_distributions
    WHERE ${distributionCountWhere.join(' AND ')}
  `).get(...distributionCountParams);
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
  summary.distributed_videos = Number(distributionCounts?.distributed_videos || 0);
  summary.published_hq_videos = Number(hqPublished?.total || 0);
  summary.published_city_videos = Number(cityPublished?.total || 0);
  summary.published_videos = summary.published_hq_videos + summary.published_city_videos;

  res.json(success({ summary, platformStats, trend, accountStats, cityStats }));
});

// ========== AI 报告 API ==========
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
    }, '报告已生成'));
  } catch (err) {
    logger.error('[ai-report] 生成失败:', err);
    res.status(500).json(error('AI 日报生成失败：' + err.message, 500));
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
  };

  try {
    if (aiService.isConfigured()) {
      writeEvent('meta', { mode: 'ai', status: aiService.getStatus() });
      const messages = aiService.buildChatMessages(db, req.body || {});
      const fullText = await aiService.chatStream(messages, 0.35, (text) => {
        writeEvent('chunk', { text });
      });
      if (!fullText) writeEvent('chunk', { text: '我已收到，请继续补充更具体的工作事项。' });
    } else {
      writeEvent('meta', { mode: 'local', status: aiService.getStatus() });
      const reply = await aiService.generateChatReply(db, req.body || {});
      const chunks = String(reply || '').match(/.{1,4}/gs) || ['收到'];
      for (const chunk of chunks) {
        writeEvent('chunk', { text: chunk });
        await new Promise(resolve => setTimeout(resolve, 28));
      }
    }
    writeEvent('done', { ok: true });
    res.end();
  } catch (err) {
    logger.error('[ai-report-chat] 回复失败:', err);
    const reply = aiService.localChatReply(req.body?.message, req.body?.userContext || {});
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
      return res.status(400).json(error('请先填写报告内容', 400));
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
    }, '报告已保存'));
  } catch (err) {
    logger.error('[ai-report] 手动保存失败:', err);
    res.status(500).json(error('报告保存失败：' + err.message, 500));
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

// ========== 素材文件表 API (COS 上传后记录) ==========
app.get('/api/material-files', (req, res) => {
  const { page = 1, pageSize = 50, date, videoTypeId } = req.query;
  let where = ["mf.status != 'deleted'"];
  let params = [];
  
  if (date) { where.push('date >= ? AND date <= ?'); params.push(date, date); }
  if (videoTypeId) { where.push('video_type_id = ?'); params.push(videoTypeId); }
  
  const whereStr = where.length ? `WHERE ${where.join(' AND ')}` : '';
  
  const files = db.prepare(`
    SELECT mf.*, vt.name as type_name, vt.icon as type_icon
    FROM material_files mf
    LEFT JOIN video_types vt ON mf.video_type_id = vt.id
    ${whereStr}
    ORDER BY mf.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));
  
  const { total } = db.prepare(`SELECT COUNT(*) as total FROM material_files mf ${whereStr}`).get(...params);
  
  res.json(success({ list: files, total, page: parseInt(page), pageSize: parseInt(pageSize) }));
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
    uploaded_by,
    thumbnail_url,
    material_id,
    schedule_id,
    city_distribution_id,
    account_id,
    source,
    storage_provider
  } = req.body;
  const id = generateId();
  db.prepare(`
    INSERT INTO material_files (
      id, name, size, cos_key, url, type_name, video_type_id, date, staff_id,
      duration, mime, uploaded_by, thumbnail_url, material_id, schedule_id,
      city_distribution_id, account_id, source, storage_provider
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    uploaded_by,
    thumbnail_url,
    material_id,
    schedule_id,
    city_distribution_id,
    account_id,
    source || 'cos',
    storage_provider || 'cos'
  );
  res.json(success({ id }, '文件记录创建成功'));
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
    status
  } = req.body;
  db.prepare(`
    UPDATE material_files SET
      name = COALESCE(?, name),
      duration = COALESCE(?, duration),
      thumbnail_url = COALESCE(?, thumbnail_url),
      material_id = COALESCE(?, material_id),
      schedule_id = COALESCE(?, schedule_id),
      city_distribution_id = COALESCE(?, city_distribution_id),
      account_id = COALESCE(?, account_id),
      status = COALESCE(?, status),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, duration, thumbnail_url, material_id, schedule_id, city_distribution_id, account_id, status, req.params.id);
  res.json(success(null, '更新成功'));
});

app.delete('/api/material-files/:id', (req, res) => {
  db.prepare('UPDATE material_files SET status = ?, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run('deleted', req.params.id);
  res.json(success(null, '删除成功'));
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

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`服务器运行在 http://0.0.0.0:${PORT}`);
  });
}

module.exports = app;
