const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const envPath = path.join(__dirname, '.env');
const jwtSecretPath = path.join(__dirname, '.jwt_secret');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

// JWT Secret 持久化到文件，避免重启后失效
if (!process.env.JWT_SECRET) {
  if (fs.existsSync(jwtSecretPath)) {
    process.env.JWT_SECRET = fs.readFileSync(jwtSecretPath, 'utf8').trim();
  } else {
    const newSecret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(jwtSecretPath, newSecret, { mode: 0o600 });
    process.env.JWT_SECRET = newSecret;
  }
}
