/**
 * server.mjs — a zero-dependency web app in front of the prompt engine.
 *
 *   node app/server.mjs          ->  http://localhost:5173
 *
 * Why no framework:
 *  - The whole product is one form, one renderer, one memory file.
 *  - A framework would add 200 MB to do what 120 lines of http does.
 *  - Anyone can read this file in five minutes and own it.
 *
 * Routes
 *   GET  /                 the app
 *   GET  /api/bootstrap    templates + memory summary
 *   POST /api/render       { id, vars } -> prompt
 *   POST /api/score        { id, outcome } -> lesson
 *   POST /api/lesson       { title, instruction, tags, scope } -> lesson
 *   GET  /api/memory       stats + lessons
 *   GET  /api/health       { ok: true }
 */

import { createServer } from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, extname, normalize } from 'node:path';

import { validatePackage, validateMemory } from '../lib/validate.mjs';
import { renderPackage } from '../lib/render.mjs';
import {
  loadMemory, saveMemory, addLesson, scoreLesson, selectLessons,
  memoryStats, SCOPES,
} from '../lib/memory.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const PUBLIC = join(ROOT, 'app', 'public');
const TEMPLATES = join(ROOT, 'templates');
const MEMORY_PATH = join(ROOT, 'memory', 'core.memory.json');
const PORT = Number(process.env.PORT || 5173);

const PRICE = { '1K': 0.134, '2K': 0.134, '4K': 0.24 };

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/* ------------------------------------------------------------------ data */

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const templateFiles = () =>
  existsSync(TEMPLATES) ? readdirSync(TEMPLATES).filter((f) => f.endsWith('.json')) : [];

function getTemplate(name) {
  const safe = String(name || '').replace(/[^a-z0-9-]/gi, '');
  const file = join(TEMPLATES, `${safe}.json`);
  if (!safe || !existsSync(file)) return null;
  const parsed = readJson(file);
  const checked = validatePackage(parsed);
  if (!checked.ok) {
    const err = new Error(`Template "${safe}" is invalid: ${checked.errors.join(' | ')}`);
    err.status = 422;
    throw err;
  }
  return checked.package;
}

function templateIndex() {
  return templateFiles()
    .map((f) => {
      const pkg = readJson(join(TEMPLATES, f));
      const p = pkg.prompt_package ?? pkg;
      return {
        id: f.replace(/\.json$/, ''),
        title: p.id ?? f.replace(/\.json$/, ''),
        goal: p.goal_summary ?? '',
        tags: p.tags ?? [],
        settings: p.nano_banana_prompt?.settings ?? {},
        fields: (p.input_schema?.fields ?? []).map((x) => ({
          name: x.name,
          type: x.type,
          required: Boolean(x.required),
          example: x.example,
          default: x.default,
          description: x.description ?? '',
        })),
        has_text: Array.isArray(p.nano_banana_prompt?.blocks?.text_in_image)
          && p.nano_banana_prompt.blocks.text_in_image.length > 0,
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

/* --------------------------------------------------------------- helpers */

const json = (res, code, body) => {
  const payload = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
};

function readBody(req, limit = 256 * 1024) {
  return new Promise((ok, fail) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        fail(Object.assign(new Error('Body too large.'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return ok({});
      try {
        ok(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        fail(Object.assign(new Error('Body must be valid JSON.'), { status: 400 }));
      }
    });
    req.on('error', fail);
  });
}

/* ------------------------------------------------------------------- api */

async function api(req, res, url) {
  const route = `${req.method} ${url.pathname}`;

  if (route === 'GET /api/health') return json(res, 200, { ok: true, version: '1.1.0' });

  if (route === 'GET /api/bootstrap') {
    const mem = loadMemory(MEMORY_PATH);
    const check = validateMemory(mem, 'memory');
    return json(res, 200, {
      templates: templateIndex(),
      memory: { stats: memoryStats(mem), warnings: check.warnings },
      prices: PRICE,
    });
  }

  if (route === 'GET /api/memory') {
    const mem = loadMemory(MEMORY_PATH);
    const tags = (url.searchParams.get('tags') ?? '').split(',').filter(Boolean);
    return json(res, 200, {
      stats: memoryStats(mem),
      lessons: selectLessons(mem, { tags, scope: 'prompt', limit: 12, charBudget: 4000 }),
      workflow: selectLessons(mem, { tags, scope: 'workflow', limit: 12, charBudget: 4000 }),
    });
  }

  if (route === 'POST /api/render') {
    const body = await readBody(req);
    const pkg = getTemplate(body.id);
    if (!pkg) return json(res, 404, { error: `No template called "${body.id}".` });

    const mem = loadMemory(MEMORY_PATH);
    const tags = (body.tags ?? pkg.tags ?? []).filter(Boolean);
    const lessons = body.use_memory === false
      ? []
      : selectLessons(mem, { tags, scope: 'prompt', limit: 8, charBudget: 1400 });

    try {
      const out = renderPackage(pkg, { vars: body.vars ?? {}, lessons });
      return json(res, 200, {
        prompt: out.prompt,
        settings: out.settings,
        chars: out.chars,
        tokens: out.tokens,
        cost: PRICE[out.settings.resolution] ?? null,
        lessons: lessons.map((l) => ({
          id: l.id, title: l.title, instruction: l.instruction, score: l.score, status: l.status,
        })),
      });
    } catch (e) {
      if (e.code === 'MISSING_VARS') {
        return json(res, 400, { error: 'Some values are empty.', missing: e.missing });
      }
      throw e;
    }
  }

  if (route === 'POST /api/score') {
    const body = await readBody(req);
    if (!body.id || !['win', 'loss'].includes(body.outcome)) {
      return json(res, 400, { error: 'Send { id, outcome: "win" | "loss" }.' });
    }
    const mem = loadMemory(MEMORY_PATH);
    const lesson = scoreLesson(mem, body.id, body.outcome);
    saveMemory(MEMORY_PATH, mem);
    return json(res, 200, { lesson, stats: memoryStats(mem) });
  }

  if (route === 'POST /api/lesson') {
    const body = await readBody(req);
    const scope = SCOPES.includes(body.scope) ? body.scope : 'prompt';
    const mem = loadMemory(MEMORY_PATH);
    const result = addLesson(mem, {
      title: body.title,
      instruction: body.instruction,
      tags: Array.isArray(body.tags) ? body.tags : String(body.tags ?? '').split(','),
      scope,
      source: 'user',
    });
    saveMemory(MEMORY_PATH, mem);
    return json(res, 200, { ...result, stats: memoryStats(mem) });
  }

  return json(res, 404, { error: 'Unknown API route.' });
}

/* ---------------------------------------------------------------- static */

function serveStatic(req, res, url) {
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const target = resolve(join(PUBLIC, normalize(rel)));
  if (!target.startsWith(PUBLIC)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  if (!existsSync(target)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  const type = MIME[extname(target)] ?? 'application/octet-stream';
  const body = readFileSync(target);
  res.writeHead(200, {
    'content-type': type,
    'cache-control': 'no-cache',
    'content-length': body.length,
    // Deliberately permissive: this app is meant to be embedded in a preview pane.
    'x-content-type-options': 'nosniff',
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

/* ---------------------------------------------------------------- server */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await api(req, res, url);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end('Method not allowed');
      return;
    }
    serveStatic(req, res, url);
  } catch (e) {
    const code = e.status ?? 500;
    if (code >= 500) console.error(e);
    if (!res.headersSent) json(res, code, { error: e.message ?? 'Server error.' });
    else res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`nbjson app  →  http://localhost:${PORT}`);
  console.log(`templates   →  ${TEMPLATES}`);
  console.log(`memory      →  ${MEMORY_PATH}`);
});
