const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTestDb, setupTestEnv } = require('./helpers');

setupTestEnv('workflow-e2e');
const app = require('../server');
const listen = () => new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});
const call = async (base, path, token, options = {}) => {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
  const payload = await response.json();
  return { response, payload };
};
const login = async (base, username, password) => {
  const { payload } = await call(base, '/auth/login', '', { method: 'POST', body: JSON.stringify({ username, password }) });
  return payload.data.token;
};

test('cross-portal data workflow stays synchronized and city scope is enforced', async (t) => {
  const server = await listen();
  t.after(() => { server.close(); cleanupTestDb(); });
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const admin = await login(base, 'admin_test', 'StrongTestPassword!123');

  const createCity = async (name) => (await call(base, '/cities', admin, {
    method: 'POST', body: JSON.stringify({ name, status: 'active' })
  })).payload.data.id;
  const cityA = await createCity('同步测试甲城');
  const cityB = await createCity('同步测试乙城');
  const createAccount = async (name, cityId) => (await call(base, '/accounts', admin, {
    method: 'POST', body: JSON.stringify({ name, platform: 'douyin', type: 'city', city_id: cityId })
  })).payload.data.id;
  const accountA = await createAccount('甲城账号', cityA);
  await createAccount('乙城账号', cityB);
  const createUser = async (username, cityId) => call(base, '/system-users', admin, {
    method: 'POST', body: JSON.stringify({ username, password: 'StrongCityPassword!123', name: username, role: 'city', city_id: cityId })
  });
  await createUser('city_sync_a', cityA);
  await createUser('city_sync_b', cityB);
  const tokenA = await login(base, 'city_sync_a', 'StrongCityPassword!123');
  const tokenB = await login(base, 'city_sync_b', 'StrongCityPassword!123');

  // 1. 城市下载素材，管理端看到状态。
  const distribution = (await call(base, '/city-distributions', admin, {
    method: 'POST', body: JSON.stringify({ date: '2026-07-01', city_id: cityA, account_id: accountA, video_title: 'E2E素材', video_url: 'https://example.com/a.mp4' })
  })).payload.data;
  assert.equal((await call(base, `/city-distributions/${distribution.id}/download`, tokenA, { method: 'POST' })).response.status, 200);
  const adminDownloads = await call(base, '/city-distributions?downloadStatus=downloaded', admin);
  assert.ok(adminDownloads.payload.data.list.some(item => item.id === distribution.id && item.downloaded_at));

  // 6. 城市账号无法操作其他城市数据。
  assert.equal((await call(base, `/city-distributions/${distribution.id}/download`, tokenB, { method: 'POST' })).response.status, 403);
  assert.equal((await call(base, '/data-tracks/range-report', tokenB, {
    method: 'POST', body: JSON.stringify({ period_start: '2026-07-01', period_end: '2026-07-07', account_id: accountA, play_count: 99 })
  })).response.status, 403);

  const wrongPublishDate = await call(base, `/city-distributions/${distribution.id}`, tokenA, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'published',
      publish_url: 'https://example.com/published-wrong-date',
      actual_publish_time: '2026-06-30 23:59:00'
    })
  });
  assert.equal(wrongPublishDate.response.status, 400);

  const rightPublishDate = await call(base, `/city-distributions/${distribution.id}`, tokenA, {
    method: 'PUT',
    body: JSON.stringify({
      status: 'published',
      publish_url: 'https://example.com/published-right-date',
      actual_publish_time: '2026-07-01 20:00:00'
    })
  });
  assert.equal(rightPublishDate.response.status, 200);

  // 2. 城市录入周期数据，管理端同步。
  const cityReport = await call(base, '/data-tracks/range-report', tokenA, {
    method: 'POST', body: JSON.stringify({ period_start: '2026-07-01', period_end: '2026-07-07', account_id: accountA, play_count: 1000, like_count: 80 })
  });
  const firstBatch = cityReport.payload.data.batch_id;
  let details = await call(base, `/data-report-details?dateFrom=2026-07-01&dateTo=2026-07-31&accountId=${accountA}`, admin);
  assert.equal(details.payload.data.list.find(item => item.report_batch_id === firstBatch).views, 1000);

  // 3. 管理端编辑城市数据，城市端同步，并保留城市来源。
  const edited = await call(base, '/data-tracks/range-report', admin, {
    method: 'POST', body: JSON.stringify({ period_start: '2026-07-01', period_end: '2026-07-07', account_id: accountA, play_count: 1200, like_count: 90, replace_batch_id: firstBatch })
  });
  const editedBatch = edited.payload.data.batch_id;
  details = await call(base, `/data-report-details?dateFrom=2026-07-01&dateTo=2026-07-31&accountId=${accountA}`, tokenA);
  const cityVisible = details.payload.data.list.find(item => item.report_batch_id === editedBatch);
  assert.equal(cityVisible.views, 1200);
  assert.equal(cityVisible.report_source, 'city_manual');

  // 4. 管理端删除数据，城市端同步消失。
  assert.equal((await call(base, `/data-tracks/batch/${editedBatch}`, admin, { method: 'DELETE' })).response.status, 200);
  details = await call(base, `/data-report-details?dateFrom=2026-07-01&dateTo=2026-07-31&accountId=${accountA}`, tokenA);
  assert.ok(!details.payload.data.list.some(item => item.report_batch_id === editedBatch));

  // 5. 相同周期重新录入只保留一份。
  const samePayload = { period_start: '2026-07-08', period_end: '2026-07-14', account_id: accountA, play_count: 500 };
  await call(base, '/data-tracks/range-report', tokenA, { method: 'POST', body: JSON.stringify(samePayload) });
  const replaced = await call(base, '/data-tracks/range-report', tokenA, { method: 'POST', body: JSON.stringify({ ...samePayload, play_count: 600 }) });
  assert.equal(replaced.payload.data.replaced, true);
  details = await call(base, `/data-report-details?dateFrom=2026-07-08&dateTo=2026-07-14&accountId=${accountA}`, admin);
  const matching = details.payload.data.list.filter(item => item.period_start === '2026-07-08' && item.period_end === '2026-07-14');
  assert.equal(matching.length, 1);
  assert.equal(matching[0].views, 600);

  const audits = await call(base, `/data-report-audits?accountId=${accountA}&pageSize=100`, admin);
  assert.ok(audits.payload.data.list.some(item => item.action === 'replace' && item.before_data && item.after_data));
  assert.ok(audits.payload.data.list.some(item => item.action === 'delete'));

  const dualTimeBatch = await call(base, '/city-distributions/batch', admin, {
    method: 'POST',
    body: JSON.stringify([
      { date: '2026-07-20', city_id: cityA, account_id: accountA, publish_time: '16:00', video_url: 'https://example.com/batch-1600.mp4' },
      { date: '2026-07-20', city_id: cityA, account_id: accountA, publish_time: '20:00', video_url: 'https://example.com/batch-2000.mp4' }
    ])
  });
  assert.equal(dualTimeBatch.response.status, 200);
  assert.equal(dualTimeBatch.payload.data.length, 2);

  const duplicateBatch = await call(base, '/city-distributions/batch', admin, {
    method: 'POST',
    body: JSON.stringify([
      { date: '2026-07-21', city_id: cityA, account_id: accountA, publish_time: '16:00', video_url: 'https://example.com/duplicated.mp4' },
      { date: '2026-07-21', city_id: cityA, account_id: accountA, publish_time: '20:00', video_url: 'https://example.com/duplicated.mp4' }
    ])
  });
  assert.equal(duplicateBatch.response.status, 400);
  assert.equal(duplicateBatch.payload.data.duplicates[0].rows.length, 2);
});
