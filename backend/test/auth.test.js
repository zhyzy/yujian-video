const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanupTestDb, setupTestEnv } = require('./helpers');

setupTestEnv('auth');

const app = require('../server');

const listen = () => new Promise(resolve => {
  const server = app.listen(0, '127.0.0.1', () => resolve(server));
});

test('auth protects APIs and allows valid login', async (t) => {
  const server = await listen();
  t.after(() => {
    server.close();
    cleanupTestDb()
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  const blocked = await fetch(`${base}/dashboard`);
  assert.equal(blocked.status, 401);

  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'admin_test', password: 'StrongTestPassword!123' })
  });
  assert.equal(login.status, 200);
  const payload = await login.json();
  assert.equal(payload.code, 200);
  assert.ok(payload.data.token);

  const authed = await fetch(`${base}/dashboard`, {
    headers: { authorization: `Bearer ${payload.data.token}` }
  });
  assert.equal(authed.status, 200);
});
