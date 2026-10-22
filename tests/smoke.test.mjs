/**
 * Smoke tests. Zero dependencies — uses the built-in node:test runner.
 * Run: node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { validatePackage, validateMemory } from '../lib/validate.mjs';
import { renderPackage, findVariables } from '../lib/render.mjs';
import {
  addLesson, scoreLesson, selectLessons, DEFAULT_RULES,
  saveMemory, loadMemory, staleLessons, memoryStats,
} from '../lib/memory.mjs';

const root = new URL('..', import.meta.url).pathname;
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const templates = readdirSync(join(root, 'templates'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f.replace('.json', ''), data: readJson(join(root, 'templates', f)) }));

test('every template is valid', () => {
  assert.ok(templates.length >= 5, 'expected at least 5 templates');
  for (const t of templates) {
    const r = validatePackage(t.data, t.name);
    assert.equal(r.ok, true, `${t.name} should be valid: ${r.errors.join(' | ')}`);
  }
});

test('the memory file is valid', () => {
  const r = validateMemory(readJson(join(root, 'memory', 'core.memory.json')), 'memory');
  assert.equal(r.ok, true, r.errors.join(' | '));
});

test('every placeholder has a matching input field', () => {
  for (const t of templates) {
    const vars = findVariables(t.data.prompt_package.nano_banana_prompt);
    const fields = t.data.prompt_package.input_schema.fields.map((f) => f.name);
    const orphans = vars.filter((v) => !fields.includes(v));
    assert.deepEqual(orphans, [], `${t.name} has placeholders with no input field: ${orphans.join(', ')}`);
  }
});

test('bad aspect ratio is rejected with a readable message', () => {
  const pkg = structuredClone(templates[0].data);
  pkg.prompt_package.nano_banana_prompt.settings.aspect_ratio = '4x5';
  const r = validatePackage(pkg, 'bad');
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /aspect_ratio/);
});

test('over-long on-image text is rejected', () => {
  const pkg = structuredClone(templates[0].data);
  pkg.prompt_package.nano_banana_prompt.blocks.text_in_image = [{ content: 'x'.repeat(120) }];
  const r = validatePackage(pkg, 'long');
  assert.equal(r.ok, false);
  assert.match(r.errors.join(' '), /under 80 characters/);
});

test('render fills placeholders and leaves none behind', () => {
  const pkg = templates.find((t) => t.name === 'youtube-thumbnail').data.prompt_package;
  const out = renderPackage(pkg, {
    vars: {
      video_topic: 'Sleep', headline: 'SLEEP FIXED', person: 'a man', expression: 'surprised',
      hero_object: 'a clock', background_style: 'navy', text_color: 'cream', side: 'right', text_side: 'left',
    },
    lessons: [],
  });
  assert.ok(!out.prompt.includes('{{'), 'no unfilled placeholders');
  assert.ok(out.prompt.includes('"SLEEP FIXED"'));
  assert.ok(out.tokens > 50);
});

test('optional fields with a default fill themselves', () => {
  const pkg = templates.find((t) => t.name === 'product-hero-shot').data.prompt_package;
  const out = renderPackage(pkg, {
    vars: { product_name: 'Candle', surface: 'stone', brand_color: 'sand', material: 'glass' },
  });
  assert.ok(out.prompt.includes('A clean, unmarked top'), 'default should be used');
});

test('render stops with a clear error when a value is missing', () => {
  const pkg = templates.find((t) => t.name === 'product-hero-shot').data.prompt_package;
  assert.throws(() => renderPackage(pkg, { vars: {} }), (e) => e.code === 'MISSING_VARS');
});

test('render is deterministic', () => {
  const pkg = templates.find((t) => t.name === 'product-hero-shot').data.prompt_package;
  const vars = {
    product_name: 'Candle', surface: 'stone', brand_color: 'sand',
    material: 'glass', key_detail: 'A clean, unmarked top',
  };
  assert.equal(renderPackage(pkg, { vars }).prompt, renderPackage(pkg, { vars }).prompt);
});

test('memory lifecycle: add, score, promote, retire', () => {
  const mem = { rules: { ...DEFAULT_RULES }, lessons: [] };
  const { lesson } = addLesson(mem, { title: 'Test', instruction: 'Use one light source.', tags: ['light'] });
  assert.equal(lesson.status, 'trial');
  scoreLesson(mem, lesson.id, 'win');
  scoreLesson(mem, lesson.id, 'win');
  assert.equal(mem.lessons[0].status, 'active');
  scoreLesson(mem, lesson.id, 'loss');
  scoreLesson(mem, lesson.id, 'loss');
  scoreLesson(mem, lesson.id, 'loss');
  scoreLesson(mem, lesson.id, 'loss');
  assert.equal(mem.lessons[0].status, 'retired');
});

test('duplicate lessons are merged, not duplicated', () => {
  const mem = { rules: { ...DEFAULT_RULES }, lessons: [] };
  addLesson(mem, { instruction: 'Name the light direction.' });
  const second = addLesson(mem, { instruction: 'Name the light direction.' });
  assert.equal(mem.lessons.length, 1);
  assert.equal(second.duplicate, true);
  assert.equal(mem.lessons[0].wins, 1);
});

test('workflow lessons never reach the image prompt', () => {
  const mem = loadMemory(join(root, 'memory', 'core.memory.json'));
  const chosen = selectLessons(mem, { tags: ['text'], scope: 'prompt' });
  assert.ok(chosen.length > 0);
  for (const l of chosen) assert.notEqual(l.scope, 'workflow');
});

test('lessons respect the character budget', () => {
  const mem = loadMemory(join(root, 'memory', 'core.memory.json'));
  const chosen = selectLessons(mem, { tags: [], scope: 'prompt', charBudget: 300 });
  const total = chosen.reduce((n, l) => n + l.instruction.length, 0);
  assert.ok(total <= 300, `budget exceeded: ${total}`);
});

test('shipped lessons are honest: no wins without a result', () => {
  const mem = loadMemory(join(root, 'memory', 'core.memory.json'));
  const claims = mem.lessons.filter((l) => l.wins > 0 || l.losses > 0 || l.score !== 0);
  assert.deepEqual(claims.map((l) => l.id), [], 'shipped lessons must start at 0/0');
  for (const l of mem.lessons) {
    assert.equal(l.status, 'trial', `${l.id} should ship as trial`);
    assert.equal(l.provenance, 'prior', `${l.id} should be marked prior`);
  }
  const st = memoryStats(mem);
  assert.equal(st.tested, 0);
  assert.equal(st.untested_priors, mem.lessons.length);
});

test('prune protects priors', () => {
  const mem = loadMemory(join(root, 'memory', 'core.memory.json'));
  assert.equal(staleLessons(mem).length, 0, 'priors must not be prunable by default');
  assert.ok(staleLessons(mem, { includePriors: true }).length > 0, 'but they exist when asked');
});

test('scoring marks a prior as tested', () => {
  const mem = { rules: { ...DEFAULT_RULES }, lessons: [] };
  const { lesson } = addLesson(mem, { instruction: 'Say the light direction.' });
  assert.equal(lesson.provenance, 'prior');
  scoreLesson(mem, lesson.id, 'win');
  assert.equal(mem.lessons[0].provenance, 'tested');
  assert.equal(staleLessons(mem, { includePriors: true }).length, 0, 'a scored lesson is no longer stale');
});

test('memory round-trips through disk', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nbjson-'));
  const file = join(dir, 'mem.json');
  const mem = { rules: { ...DEFAULT_RULES }, lessons: [] };
  addLesson(mem, { instruction: 'Keep the grain.' });
  saveMemory(file, mem);
  const back = loadMemory(file);
  assert.equal(back.lessons.length, 1);
  assert.equal(back.lessons[0].instruction, 'Keep the grain.');
});
