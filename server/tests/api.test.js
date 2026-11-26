import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'registry-test-'));
process.env.DATA_DIR = dataDir;
process.env.JWT_SECRET = 'x'.repeat(48);

const { createApp } = await import('../app.js');
const { db } = await import('../db.js');
const { hashPassword } = await import('../lib/password.js');
const { computeState } = await import('../lib/status.js');

let server, base;
const H = { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' };

async function login(email, password) {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: H, body: JSON.stringify({ email, password }) });
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  return { res, cookie, body: await res.json() };
}
const api = (cookie) => (p, opts = {}) =>
  fetch(`${base}${p}`, { ...opts, headers: { ...H, ...(opts.headers || {}), Cookie: cookie } });

const dog = {
  dog_name: 'Luna', owner_name: 'María Ríos', owner_document: '1020482K', microchip: '985112003456789',
  breed: 'Golden', specialty: 'psychiatric_service', country: 'CO', issue_date: '2026-01-10',
  expiry_date: '2099-01-10', lifetime: false, tasks: ['Tarea uno'], notes: 'secreto interno',
};

before(async () => {
  db.prepare('INSERT INTO users (email,name,role,password_hash) VALUES (?,?,?,?)').run('admin@test.com', 'Admin', 'admin', await hashPassword('Admin12345x'));
  db.prepare('INSERT INTO users (email,name,role,password_hash) VALUES (?,?,?,?)').run('ver@test.com', 'Viewer', 'viewer', await hashPassword('Viewer12345x'));
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => {
  server.close();
  db.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test('estado de la credencial respeta la prioridad', () => {
  const t = '2026-11-26';
  assert.equal(computeState({ status: 'inactive', issue_date: '2020-01-01', lifetime: 1 }, t), 'inactive');
  assert.equal(computeState({ status: 'active', issue_date: '2026-12-01', expiry_date: '2027-12-01' }, t), 'pending');
  assert.equal(computeState({ status: 'active', issue_date: '2020-01-01', lifetime: 1, expiry_date: null }, t), 'lifetime');
  assert.equal(computeState({ status: 'active', issue_date: '2024-01-01', expiry_date: '2025-11-24' }, t), 'expired');
  assert.equal(computeState({ status: 'active', issue_date: '2026-01-01', expiry_date: '2026-11-26' }, t), 'active');
});

test('sin sesión no se accede a los registros', async () => {
  const res = await fetch(`${base}/api/dogs`);
  assert.equal(res.status, 401);
});

test('peticiones sin cabecera anti-CSRF se rechazan', async () => {
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
});

test('login incorrecto y bloqueo tras 5 intentos', async () => {
  db.prepare('INSERT INTO users (email,name,role,password_hash) VALUES (?,?,?,?)').run('lock@test.com', 'L', 'editor', await hashPassword('Lock123456x'));
  for (let i = 0; i < 5; i++) assert.equal((await login('lock@test.com', 'mala')).res.status, 401);
  assert.equal((await login('lock@test.com', 'Lock123456x')).res.status, 423);
});

test('flujo completo: crear, listar, perfil público, QR, PDF, permisos', async () => {
  const { cookie, body } = await login('admin@test.com', 'Admin12345x');
  assert.equal(body.user.role, 'admin');
  const a = api(cookie);

  const created = await a('/api/dogs', { method: 'POST', body: JSON.stringify(dog) });
  assert.equal(created.status, 201);
  const { dog: d } = await created.json();
  assert.match(d.reg_number, /^WWT-\d{4}-[A-Z0-9]{6}$/);
  assert.equal(d.state, 'active');

  const dup = await a('/api/dogs', { method: 'POST', body: JSON.stringify(dog) });
  assert.equal(dup.status, 409);

  const life = await a('/api/dogs', { method: 'POST', body: JSON.stringify({ ...dog, microchip: null, dog_name: 'Kira', lifetime: true, expiry_date: '' }) });
  assert.equal((await life.json()).dog.state, 'lifetime');

  const list = await (await a('/api/dogs?q=luna&state=valid')).json();
  assert.equal(list.total, 1);

  const pub = await (await fetch(`${base}/api/public/dogs/${d.reg_number}`)).json();
  assert.equal(pub.state, 'active');
  assert.equal(pub.dog.notes, undefined);
  assert.equal(pub.dog.owner_document, '••••482K');

  assert.equal((await fetch(`${base}/api/public/dogs/WWT-2026-NOPE00`)).status, 404);

  const svg = await a(`/api/dogs/${d.id}/qr.svg`);
  assert.match(await svg.text(), /<svg/);
  const pdf = await a(`/api/dogs/${d.id}/card.pdf`);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.ok((await pdf.arrayBuffer()).byteLength > 1000);

  const st = await a(`/api/dogs/${d.id}/status`, { method: 'POST', body: JSON.stringify({ status: 'inactive' }) });
  assert.equal((await st.json()).dog.state, 'inactive');

  const viewer = api((await login('ver@test.com', 'Viewer12345x')).cookie);
  assert.equal((await viewer('/api/dogs')).status, 200);
  assert.equal((await viewer('/api/dogs', { method: 'POST', body: JSON.stringify(dog) })).status, 403);
  assert.equal((await viewer(`/api/dogs/${d.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: 'Luna' }) })).status, 403);

  assert.equal((await a(`/api/dogs/${d.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: 'otro' }) })).status, 400);
  assert.equal((await a(`/api/dogs/${d.id}`, { method: 'DELETE', body: JSON.stringify({ confirm: 'luna' }) })).status, 200);

  const log = await (await a('/api/audit')).json();
  assert.ok(log.items.some((x) => x.action === 'delete'));
});
