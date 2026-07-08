const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTestDb, setupTestEnv } = require('./helpers');

setupTestEnv('download-tracking');

const app = require('../server');

const listen = () => new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

const request = (base, path, token, options = {}) => fetch(`${base}${path}`, {
  ...options,
  headers: {
    'content-type': 'application/json',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  }
});

const login = async (base, username, password) => {
  const response = await request(base, '/auth/login', '', {
    method: 'POST', body: JSON.stringify({ username, password })
  });
  const payload = await response.json();
  return payload.data.token;
};

test('city download is tracked and visible in city detail', async (t) => {
  const server = await listen();
  t.after(() => { server.close(); cleanupTestDb(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const adminToken = await login(base, 'admin_test', 'StrongTestPassword!123');

  const cityPayload = await (await request(base, '/cities', adminToken, {
    method: 'POST', body: JSON.stringify({ name: '下载测试城市', status: 'active' })
  })).json();
  const cityId = cityPayload.data.id;

  const accountPayload = await (await request(base, '/accounts', adminToken, {
    method: 'POST', body: JSON.stringify({ name: '城市下载账号', platform: 'douyin', type: 'city', city_id: cityId })
  })).json();
  const accountId = accountPayload.data.id;

  await request(base, '/system-users', adminToken, {
    method: 'POST',
    body: JSON.stringify({ username: 'city_download_test', password: 'StrongCityPassword!123', name: '城市测试员', role: 'city', city_id: cityId })
  });
  const cityToken = await login(base, 'city_download_test', 'StrongCityPassword!123');

  const distributionPayload = await (await request(base, '/city-distributions', adminToken, {
    method: 'POST',
    body: JSON.stringify({
      date: new Date().toISOString().slice(0, 10), city_id: cityId, account_id: accountId,
      video_title: '下载状态测试素材', video_url: 'https://example.com/material.mp4'
    })
  })).json();
  const distributionId = distributionPayload.data.id;

  const blocked = await request(base, `/city-distributions/${distributionId}/download`, adminToken, { method: 'POST' });
  assert.equal(blocked.status, 403);

  for (let i = 0; i < 2; i++) {
    const tracked = await request(base, `/city-distributions/${distributionId}/download`, cityToken, { method: 'POST' });
    assert.equal(tracked.status, 200);
  }

  const downloaded = await (await request(base, '/city-distributions?downloadStatus=downloaded', adminToken)).json();
  const record = downloaded.data.list.find(item => item.id === distributionId);
  assert.ok(record.downloaded_at);
  assert.equal(record.download_count, 2);

  const downloadDate = record.downloaded_at.slice(0, 10);
  const downloadedToday = await (await request(
    base,
    `/city-distributions?downloadStatus=downloaded&downloadDateFrom=${downloadDate}&downloadDateTo=${downloadDate}`,
    adminToken
  )).json();
  assert.equal(downloadedToday.data.total, 1);
  assert.equal(downloadedToday.data.list[0].id, distributionId);

  const detail = await (await request(base, `/cities/${cityId}/task-detail?month=${new Date().toISOString().slice(0, 7)}`, adminToken)).json();
  assert.equal(detail.data.summary.monthAssigned, 1);
  assert.equal(detail.data.summary.downloaded, 1);
  assert.equal(detail.data.summary.notDownloaded, 0);
  assert.equal(detail.data.tasks[0].download_count, 2);
});
