/**
 * server.test.mjs — starts the real HTTP server on a spare port and talks to it.
 * No mocking. If this passes, the app really serves and really renders.
 *
 * Run: node --test tests/server.test.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const PORT = 5199;
const BASE = `http://127.0.0.1:${PORT}`;
let child;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function up() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return true;
    } catch { /* not listening yet */ }
    await wait(100);
  }
  return false;
}

before(async () => {
  child = spawn(process.execPath, [join(root, 'app', 'server.mjs')], {
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'ignore',
  });
  const ok = await up();
  assert.ok(ok, 'server did not start');
});

after(() => { if (child) child.kill('SIGKILL'); });

test('health responds', async () => {
  const r = await fetch(`${BASE}/api/health`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).ok, true);
});

test('index.html is served with the right type', async () => {
  const r = await fetch(BASE);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  const html = await r.text();
  assert.match(html, /Prompt Foundry/);
  assert.match(html, /app\.js/);
});

test('assets are served', async () => {
  for (const [path, type] of [['/styles.css', /text\/css/], ['/app.js', /javascript/]]) {
    const r = await fetch(BASE + path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers.get('content-type'), type, path);
  }
});

test('path traversal is refused', async () => {
  const r = await fetch(`${BASE}/..%2fpackage.json`);
  assert.ok([403, 404].includes(r.status), `expected refusal, got ${r.status}`);
});

test('bootstrap lists every template with fields', async () => {
  const r = await fetch(`${BASE}/api/bootstrap`);
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.templates.length >= 7);
  for (const t of d.templates) {
    assert.ok(t.fields.length > 0, `${t.id} has no fields`);
    assert.ok(typeof t.goal === 'string' && t.goal.length > 10, `${t.id} has no goal`);
  }
  assert.ok(d.memory.stats.total > 0);
});

test('render returns a prompt, settings, cost and lessons', async () => {
  const r = await fetch(`${BASE}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'product-hero-shot',
      vars: {
        product_name: 'Test Candle', surface: 'stone',
        brand_color: 'sand', material: 'glass',
      },
    }),
  });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.ok(d.prompt.includes('Test Candle'));
  assert.ok(!d.prompt.includes('{{'), 'no unfilled placeholders');
  assert.equal(d.settings.aspect_ratio, '4:5');
  assert.equal(d.cost, 0.134);
  assert.ok(Array.isArray(d.lessons));
  for (const l of d.lessons) assert.notEqual(l.status, 'retired');
});

test('render without memory still works', async () => {
  const r = await fetch(`${BASE}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: 'product-hero-shot',
      use_memory: false,
      vars: { product_name: 'X', surface: 'stone', brand_color: 'sand', material: 'glass' },
    }),
  });
  const d = await r.json();
  assert.equal(d.lessons.length, 0);
  assert.ok(d.prompt.length > 200);
});

test('missing values produce a helpful 400', async () => {
  const r = await fetch(`${BASE}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'product-hero-shot', vars: {} }),
  });
  assert.equal(r.status, 400);
  const d = await r.json();
  assert.ok(Array.isArray(d.missing) && d.missing.length > 0);
});

test('unknown template and bad body are handled', async () => {
  const notFound = await fetch(`${BASE}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'nope', vars: {} }),
  });
  assert.equal(notFound.status, 404);

  const badJson = await fetch(`${BASE}/api/render`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{not json',
  });
  assert.equal(badJson.status, 400);
});

test('memory endpoint separates prompt rules from human rules', async () => {
  const r = await fetch(`${BASE}/api/memory`);
  const d = await r.json();
  assert.ok(d.lessons.length > 0);
  for (const l of d.lessons) assert.equal(l.scope, 'prompt');
  for (const l of d.workflow) assert.equal(l.scope, 'workflow');
});
