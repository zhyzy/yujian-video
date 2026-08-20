// 系统设置路由：负责品牌/文案配置、对象存储连接测试，以及后台开放接口配置说明。
const express = require('express');
const dataEaseOpenApiDefinitions = require('../lib/dataEaseDefinitions');

const createSystemSettingsRoutes = ({
  adminRequired,
  authRequired,
  COS,
  error,
  success,
  systemSettingsService,
  upyunStorage,
  validateRequired
}) => {
  const router = express.Router();

  router.get('/system-settings/public', (req, res) => {
    const settings = systemSettingsService.maskSystemSettings(systemSettingsService.getSystemSettings());
    res.json(success({
      brand: settings.brand,
      copy: settings.copy
    }));
  });

  router.get('/system-settings', authRequired, (req, res) => {
    res.json(success(systemSettingsService.maskSystemSettings(systemSettingsService.getSystemSettings())));
  });

  router.put('/system-settings', authRequired, adminRequired, (req, res) => {
    const current = systemSettingsService.getSystemSettings();
    const incoming = req.body || {};
    const next = systemSettingsService.mergeDeep(current, incoming);
    if (incoming.storage && incoming.storage.secretKey === '') {
      next.storage.secretKey = current.storage.secretKey || '';
    }
    if (incoming.rawStorage && incoming.rawStorage.password === '') {
      next.rawStorage.password = current.rawStorage?.password || '';
    }
    systemSettingsService.saveSystemSettingsValue(next, req.user.id);
    res.json(success(systemSettingsService.maskSystemSettings(next), '系统设置已保存'));
  });

  router.post('/system-settings/storage/test', authRequired, adminRequired, (req, res) => {
    const current = systemSettingsService.getSystemSettings();
    const provider = String(req.body?.provider || current.storage?.provider || 'cos').toLowerCase();
    if (provider === 'upyun') {
      const rawStorage = systemSettingsService.mergeDeep(current.rawStorage || {}, req.body?.rawStorage || req.body || {});
      if (!rawStorage.password) rawStorage.password = current.rawStorage?.password || process.env.UPYUN_PASSWORD || '';
      return upyunStorage.testConnection(rawStorage)
        .then(() => res.json(success({ ok: true, provider: 'upyun' }, '又拍云连接成功')))
        .catch((err) => res.status(400).json(error(err.message || '又拍云连接失败', 400)));
    }

    const storage = systemSettingsService.mergeDeep(current.storage, req.body || {});
    if (!storage.secretKey) storage.secretKey = current.storage.secretKey || process.env.COS_SECRET_KEY || '';
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

  router.get('/system/open-interfaces', authRequired, adminRequired, (req, res) => {
    const origin = `${req.protocol}://${req.get('host')}`;
    const dataEaseApiKey = String(process.env.DATAEASE_API_KEY || '').trim();
    res.json(success({
      provider: 'DataEase',
      enabled: Boolean(dataEaseApiKey),
      baseUrl: `${origin}/api/open/dataease`,
      auth: {
        type: 'API Key',
        headerName: 'X-DataEase-Key',
        queryName: 'api_key',
        bearerSupported: true,
        key: dataEaseApiKey,
        configured: Boolean(dataEaseApiKey),
        tip: 'DataEase 中建议使用请求头 X-DataEase-Key；如果未配置 DATAEASE_API_KEY，开放接口会返回 503。'
      },
      pagination: {
        pageParam: 'page',
        pageSizeParam: 'pageSize',
        listPath: '$.data.list',
        totalPath: '$.data.total',
        maxPageSize: 1000
      },
      commonParams: [
        { name: 'start_date', required: false, example: '2026-07-01', description: '统计开始日期，默认本月 1 日' },
        { name: 'end_date', required: false, example: '2026-07-31', description: '统计结束日期，默认今天' },
        { name: 'city_id', required: false, example: '', description: '城市 ID，可选筛选' },
        { name: 'account_id', required: false, example: '', description: '账号 ID，可选筛选' },
        { name: 'platform', required: false, example: 'kuaishou', description: '平台筛选：douyin、kuaishou、weixin、xiaohongshu、weibo、bilibili、other' },
        { name: 'page', required: false, example: '1', description: '分页页码，明细/列表接口使用' },
        { name: 'pageSize', required: false, example: '100', description: '每页数量，最大 1000' }
      ],
      interfaces: dataEaseOpenApiDefinitions.map((item) => ({
        ...item,
        fullUrl: `${origin}${item.path}`
      }))
    }));
  });

  return router;
};

module.exports = createSystemSettingsRoutes;
