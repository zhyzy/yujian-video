const crypto = require('crypto');
const https = require('https');

const createUpyunStorage = ({ systemSettingsService, validateRequired }) => {
  const stripProtocol = (value) => String(value || '').replace(/^https?:\/\//, '').replace(/\/+$/, '');

  const getUpyunConfig = () => {
    const settings = systemSettingsService.getSystemSettings();
    const rawStorage = settings.rawStorage || {};
    return {
      service: rawStorage.service || process.env.UPYUN_SERVICE || '',
      operator: rawStorage.operator || process.env.UPYUN_OPERATOR || '',
      password: rawStorage.password || process.env.UPYUN_PASSWORD || '',
      domain: stripProtocol(rawStorage.domain || process.env.UPYUN_DOMAIN || ''),
      uploadPrefix: rawStorage.uploadPrefix || process.env.UPYUN_UPLOAD_PREFIX || 'raw-materials/',
      formApiHost: rawStorage.formApiHost || process.env.UPYUN_FORM_API_HOST || 'https://v0.api.upyun.com',
      previewExpires: Number(rawStorage.previewExpires || process.env.UPYUN_PREVIEW_EXPIRES || 600)
    };
  };

  const normalizeObjectPath = (rawPath) => {
    const path = String(rawPath || '').trim().replace(/^\/+/, '');
    if (!path || path.includes('..')) {
      const err = new Error('又拍云对象路径不正确');
      err.status = 400;
      throw err;
    }
    return `/${path}`;
  };

  const sanitizePathPart = (value, fallback = 'file') => {
    const text = String(value || fallback).replace(/[\\:*?"<>|\s]+/g, '_').replace(/^_+|_+$/g, '');
    return text || fallback;
  };

  const buildObjectPath = ({ filename, folderPath = '/' } = {}) => {
    const config = getUpyunConfig();
    const prefix = String(config.uploadPrefix || 'raw-materials/').replace(/^\/+/, '').replace(/\/?$/, '/');
    const cleanFolder = String(folderPath || '/')
      .split('/')
      .map(part => sanitizePathPart(part, ''))
      .filter(Boolean)
      .join('/');
    const original = String(filename || 'raw-video');
    const dotIndex = original.lastIndexOf('.');
    const base = dotIndex > 0 ? original.slice(0, dotIndex) : original;
    const ext = dotIndex > 0 ? original.slice(dotIndex).toLowerCase() : '';
    const safeName = sanitizePathPart(base, 'raw-video').slice(0, 80);
    const stamp = Date.now();
    const middle = cleanFolder ? `${cleanFolder}/` : '';
    return normalizeObjectPath(`${prefix}${middle}${safeName}_${stamp}${ext}`);
  };

  const getPublicUrl = (objectPath) => {
    const config = getUpyunConfig();
    if (!config.domain) return '';
    return `https://${config.domain}${normalizeObjectPath(objectPath)}`;
  };

  const signFormPolicy = ({ filename, folderPath, contentType, size } = {}) => {
    const config = getUpyunConfig();
    validateRequired({
      UPYUN_SERVICE: config.service,
      UPYUN_OPERATOR: config.operator,
      UPYUN_PASSWORD: config.password
    }, ['UPYUN_SERVICE', 'UPYUN_OPERATOR', 'UPYUN_PASSWORD']);

    const objectPath = buildObjectPath({ filename, folderPath });
    const expiration = Math.floor(Date.now() / 1000) + 3600;
    const date = new Date().toUTCString();
    const policyData = {
      bucket: config.service,
      'save-key': objectPath,
      expiration,
      date,
      'content-type': contentType || 'application/octet-stream'
    };
    const policy = Buffer.from(JSON.stringify(policyData)).toString('base64');
    const passwordMd5 = crypto.createHash('md5').update(config.password).digest('hex');
    const signature = crypto.createHmac('sha1', passwordMd5)
      .update(['POST', `/${config.service}`, date, policy].join('&'))
      .digest('base64');
    const uploadUrl = `${config.formApiHost.replace(/\/+$/, '')}/${encodeURIComponent(config.service)}`;
    return {
      provider: 'upyun',
      service: config.service,
      uploadUrl,
      path: objectPath,
      key: objectPath,
      url: getPublicUrl(objectPath),
      policy,
      date,
      authorization: `UPYUN ${config.operator}:${signature}`,
      expiresAt: expiration
    };
  };

  const deleteObject = (objectPath) => new Promise((resolve, reject) => {
    const config = getUpyunConfig();
    validateRequired({
      UPYUN_SERVICE: config.service,
      UPYUN_OPERATOR: config.operator,
      UPYUN_PASSWORD: config.password
    }, ['UPYUN_SERVICE', 'UPYUN_OPERATOR', 'UPYUN_PASSWORD']);
    const path = normalizeObjectPath(objectPath);
    const method = 'DELETE';
    const uri = `/${config.service}${path}`;
    const requestPath = encodeURI(uri);
    const date = new Date().toUTCString();
    const passwordMd5 = crypto.createHash('md5').update(config.password).digest('hex');
    const signText = `${method}&${requestPath}&${date}`;
    const signature = crypto.createHmac('sha1', passwordMd5).update(signText).digest('base64');
    const req = https.request({
      method,
      hostname: 'v0.api.upyun.com',
      path: requestPath,
      headers: {
        Date: date,
        Authorization: `UPYUN ${config.operator}:${signature}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ ok: true, statusCode: res.statusCode });
        const err = new Error(body || `又拍云删除失败：${res.statusCode}`);
        err.status = res.statusCode || 500;
        reject(err);
      });
    });
    req.on('error', reject);
    req.end();
  });

  const testConnection = (override = {}) => new Promise((resolve, reject) => {
    const baseConfig = getUpyunConfig();
    const config = { ...baseConfig, ...override };
    validateRequired({
      UPYUN_SERVICE: config.service,
      UPYUN_OPERATOR: config.operator,
      UPYUN_PASSWORD: config.password
    }, ['UPYUN_SERVICE', 'UPYUN_OPERATOR', 'UPYUN_PASSWORD']);
    const method = 'GET';
    const uri = `/${config.service}/`;
    const date = new Date().toUTCString();
    const passwordMd5 = crypto.createHash('md5').update(config.password).digest('hex');
    const signText = `${method}&${encodeURI(uri)}&${date}`;
    const signature = crypto.createHmac('sha1', passwordMd5).update(signText).digest('base64');
    const req = https.request({
      method,
      hostname: 'v0.api.upyun.com',
      path: encodeURI(uri),
      headers: {
        Date: date,
        Authorization: `UPYUN ${config.operator}:${signature}`
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ ok: true, statusCode: res.statusCode });
        const err = new Error(body || `又拍云连接失败：${res.statusCode}`);
        err.status = res.statusCode || 500;
        reject(err);
      });
    });
    req.on('error', reject);
    req.end();
  });

  return {
    deleteObject,
    getPublicUrl,
    getUpyunConfig,
    normalizeObjectPath,
    signFormPolicy,
    testConnection
  };
};

module.exports = createUpyunStorage;
