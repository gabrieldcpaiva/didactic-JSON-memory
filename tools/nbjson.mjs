#!/usr/bin/env node
/**
 * nbjson — one small command line tool for JSON prompt packages.
 * Zero dependencies. Node 18+.
 *
 *   node tools/nbjson.mjs validate                 check every template
 *   node tools/nbjson.mjs render <template> --vars vars.json
 *   node tools/nbjson.mjs list [--tags text,poster] [--status active]
 *   node tools/nbjson.mjs add --title "..." --instruction "..." --tags text,poster
 *   node tools/nbjson.mjs score L002 win
 *   node tools/nbjson.mjs stats
 *   node tools/nbjson.mjs prune --yes
 *
 * Run `node tools/nbjson.mjs help` for every flag.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { validatePackage, validateMemory, report } from '../lib/validate.mjs';
import { renderPackage, previewPrompt, findVariables } from '../lib/render.mjs';
import {
  loadMemory, saveMemory, addLesson, scoreLesson, selectLessons,
  memoryStats, staleLessons, removeLesson,
} from '../lib/memory.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const TEMPLATES = join(ROOT, 'templates');
const MEMORY = join(ROOT, 'memory', 'core.memory.json');

const readJson = (p) => {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    console.error(`Cannot read ${p} as JSON. ${e.message}`);
    process.exit(1);
  }
};

const listFiles = (dir, ext = '.json') =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(ext)).map((f) => join(dir, f)) : [];

const splitList = (s) => (s ? String(s).split(',').map((x) => x.trim()).filter(Boolean) : []);

function resolveTemplate(name) {
  const direct = existsSync(name) ? name : join(TEMPLATES, name.endsWith('.json') ? name : `${name}.json`);
  if (!existsSync(direct)) {
    console.error(`No template called "${name}". Available:`);
    for (const f of listFiles(TEMPLATES)) console.error(`  - ${basename(f, '.json')}`);
    process.exit(1);
  }
  return direct;
}

/* ------------------------------------------------------------------ help */
function help() {
  console.log(`
nbjson — JSON prompt packages for Nano Banana Pro

  validate [file]           Check one package, or every template if no file.
  render <template> [opts]  Print the finished prompt.
      --vars <file>         JSON file with your values. Can be a list for batch.
      --tags a,b            Pick memory lessons by tag.
      --no-memory           Skip memory lessons.
      --lesson-budget <n>   Max characters of lessons (default 1400).
      --out <file|dir>      Save prompts to a file, or one file per batch item.
      --json                Also print settings as JSON.
  list [opts]               Show lessons.
      --tags a,b  --status active|trial|retired  --chars
  add --title "..." --instruction "..." [--tags a,b] [--trigger "..."]
  score <lesson-id> win|loss
  stats                     Counts, characters and token estimate.
  checklist [--tags a,b]    Print the human checklist (workflow lessons).
  prune [--yes]             Delete trial lessons with no wins and no losses.
  learn <file>              Add every lesson found in a snippet of JSON.
  help                      Show this text.

Examples
  node tools/nbjson.mjs render product-hero-shot --vars examples/candle.vars.json
  node tools/nbjson.mjs validate
  node tools/nbjson.mjs add --title "Name the light" --instruction "Say the light direction in words: soft key from the top left." --tags light,product
`);
}

/* --------------------------------------------------------------- validate */
function cmdValidate(flags) {
  const target = flags._[1];
  let ok = true;
  const files = target ? [target] : listFiles(TEMPLATES);
  if (!files.length) {
    console.error('No JSON files found to check.');
    process.exit(1);
  }
  files.forEach((f) => {
    console.log(`\n${basename(f)}`);
    const res = validatePackage(readJson(f), basename(f, '.json'));
    if (!report(res, basename(f, '.json'))) ok = false;
  });
  console.log(`\nMemory file:`);
  const mem = validateMemory(readJson(MEMORY), 'core.memory');
  if (!report(mem, 'core.memory')) ok = false;
  process.exit(ok ? 0 : 1);
}

/* ----------------------------------------------------------------- render */
function cmdRender(flags) {
  const name = flags._[1];
  if (!name) {
    console.error('Which template? Example: node tools/nbjson.mjs render product-hero-shot --vars my.json');
    process.exit(1);
  }
  const file = resolveTemplate(name);
  const parsed = readJson(file);
  const check = validatePackage(parsed, basename(file, '.json'));
  if (!check.ok) {
    report(check, basename(file, '.json'));
    console.error('Fix the package before rendering.');
    process.exit(1);
  }
  const pkg = check.package;
  const varsPath = flags.vars;
  const varsRaw = varsPath ? readJson(varsPath) : {};
  const batch = Array.isArray(varsRaw) ? varsRaw : [varsRaw];

  const mem = flags['no-memory'] ? null : loadMemory(MEMORY);
  const tags = splitList(flags.tags);
  const budget = Number(flags['lesson-budget'] ?? 1400);
  const lessons = mem
    ? selectLessons(mem, { tags: tags.length ? tags : pkgTags(pkg), limit: 8, charBudget: budget })
    : [];

  const results = [];
  for (const [i, vars] of batch.entries()) {
    try {
      const out = renderPackage(pkg, { vars, lessons, maxLessonChars: budget });
      results.push(out);
      const head = batch.length > 1 ? `\n### Prompt ${i + 1} of ${batch.length}\n` : '\n';
      console.log(head + previewPrompt(out.prompt));
      console.log(
        `Chars: ${out.chars}   ~Tokens: ${out.tokens}   ` +
        `Aspect: ${out.settings.aspect_ratio}   Res: ${out.settings.resolution}   ` +
        `Lessons: ${out.used_lessons.join(', ') || 'none'}`,
      );
      if (flags.json) console.log(JSON.stringify({ settings: out.settings, lessons: out.used_lessons }, null, 2));
    } catch (e) {
      if (e.code === 'MISSING_VARS') {
        const fields = pkg.input_schema?.fields ?? [];
        const starter = {};
        for (const f of fields) {
          const ex = 'default' in f ? f.default : f.example;
          starter[f.name] =
            typeof ex === 'string' ? ex
            : typeof ex === 'number' || typeof ex === 'boolean' ? ex
            : Array.isArray(ex) ? ex.join(', ')
            : JSON.stringify(ex ?? '');
        }
        const placeholder = Object.fromEntries(
          findVariables(pkg.nano_banana_prompt).filter((k) => !(k in starter)).map((k) => [k, '']),
        );
        console.error(`\nMissing value(s): ${e.missing.join(', ')}`);
        console.error(`\nFill in this file. The values below are examples — replace them with yours.`);
        console.error(`Save it as ${varsPath ?? 'my.vars.json'}, then run the same command again.\n`);
        console.error(JSON.stringify({ ...starter, ...placeholder }, null, 2));
        process.exit(1);
      }
      throw e;
    }
  }

  if (flags.out) {
    const outTarget = flags.out;
    if (batch.length > 1 || outTarget.endsWith('/')) {
      mkdirSync(outTarget, { recursive: true });
      results.forEach((r, i) => {
        const seed = firstUsefulValue(r.blocks) || String(r.blocks?.task ?? 'prompt');
        const slug = seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).replace(/-$/, '');
        const p = join(outTarget, `${String(i + 1).padStart(3, '0')}-${slug || 'prompt'}.txt`);
        writeFileSync(p, r.prompt + '\n', 'utf8');
      });
      console.log(`\nSaved ${results.length} prompt file(s) in ${outTarget}`);
    } else {
      writeFileSync(outTarget, results[0].prompt + '\n', 'utf8');
      console.log(`\nSaved prompt to ${outTarget}`);
    }
  }
}

function firstUsefulValue(blocks) {
  if (!blocks) return '';
  if (Array.isArray(blocks.text_in_image) && blocks.text_in_image[0]?.content) {
    return blocks.text_in_image[0].content;
  }
  const skip = new Set(['task', 'text_in_image', 'locks', 'avoid', 'extra']);
  for (const [k, v] of Object.entries(blocks)) {
    if (skip.has(k)) continue;
    if (typeof v === 'string' && v.trim()) return v.split(/[.,]/)[0];
  }
  return '';
}

function pkgTags(pkg) {
  if (Array.isArray(pkg.tags) && pkg.tags.length) return pkg.tags;
  return String(pkg.id ?? '').split('-').filter(Boolean);
}

/* ------------------------------------------------------------------- list */
function cmdList(flags) {
  const mem = loadMemory(MEMORY);
  const tags = splitList(flags.tags);
  const status = flags.status;
  let rows = mem.lessons;
  if (status) rows = rows.filter((l) => l.status === status);
  if (tags.length) rows = rows.filter((l) => (l.tags ?? []).some((t) => tags.includes(t)));

  if (!rows.length) {
    console.log('No lessons match. Try without --tags or --status.');
    return;
  }
  console.log(`${'ID'.padEnd(6)}${'SCORE'.padEnd(7)}${'W/L'.padEnd(8)}${'STATUS'.padEnd(10)}TITLE`);
  for (const l of rows.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))) {
    console.log(`${l.id.padEnd(6)}${String(l.score).padEnd(7)}${`${l.wins}/${l.losses}`.padEnd(8)}${l.status.padEnd(10)}${l.title}`);
    if (flags.chars) {
      console.log(`${' '.repeat(6)}${l.instruction}`);
      console.log(`${' '.repeat(6)}tags: ${(l.tags ?? []).join(', ') || 'none'} (${l.instruction.length} chars)`);
    }
  }
  const st = memoryStats(mem);
  console.log(`\n${st.total} lessons: ${st.active} active, ${st.trial} trial, ${st.retired} retired. Active text ~${st.approx_active_tokens} tokens.`);
}

/* -------------------------------------------------------------------- add */
function cmdAdd(flags) {
  const mem = loadMemory(MEMORY);
  if (!flags.instruction) {
    console.error('Add an --instruction. Example: --instruction "Say the light direction in words."');
    process.exit(1);
  }
  const { lesson, duplicate } = addLesson(mem, {
    title: flags.title,
    instruction: flags.instruction,
    tags: splitList(flags.tags),
    trigger: flags.trigger ?? '',
    source: 'user',
  });
  saveMemory(MEMORY, mem);
  console.log(duplicate ? `Already known. Scored again: ${lesson.id} (${lesson.score}).` : `Added ${lesson.id}: ${lesson.title}`);
}

/* ------------------------------------------------------------------ score */
function cmdScore(flags) {
  const [id, outcome] = flags._.slice(1);
  if (!id || !outcome) {
    console.error('Usage: node tools/nbjson.mjs score L002 win');
    process.exit(1);
  }
  const mem = loadMemory(MEMORY);
  try {
    const l = scoreLesson(mem, id, outcome);
    saveMemory(MEMORY, mem);
    console.log(`${l.id} now ${l.score} (${l.wins} wins, ${l.losses} losses) — status: ${l.status}`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ stats */
function cmdStats() {
  const mem = loadMemory(MEMORY);
  const st = memoryStats(mem);
  console.log(JSON.stringify(st, null, 2));
  const stale = staleLessons(mem);
  if (stale.length) {
    console.log(`\n${stale.length} trial lesson(s) with no results yet:`);
    for (const l of stale) console.log(`  ${l.id}  ${l.title}  → score it, or delete it with prune`);
  }
}

/* ------------------------------------------------------------------ prune */
function cmdPrune(flags) {
  const mem = loadMemory(MEMORY);
  const stale = staleLessons(mem);
  if (!stale.length) {
    console.log('Nothing to prune. Every lesson has a result.');
    return;
  }
  for (const l of stale) console.log(`  would remove ${l.id}  ${l.title}`);
  if (!flags.yes) {
    console.log('\nDry run. Add --yes to remove them.');
    return;
  }
  for (const l of stale) removeLesson(mem, l.id);
  saveMemory(MEMORY, mem);
  console.log(`Removed ${stale.length} lesson(s).`);
}

/* ------------------------------------------------------------------ learn */
function cmdLearn(flags) {
  const file = flags._[1];
  if (!file) {
    console.error('Usage: node tools/nbjson.mjs learn lessons.json');
    console.error('File shape: { "lessons": [ { "title": "...", "instruction": "...", "tags": ["text"] } ] }');
    process.exit(1);
  }
  const data = readJson(file);
  const incoming = Array.isArray(data) ? data : data.lessons ?? [];
  const mem = loadMemory(MEMORY);
  let added = 0;
  let merged = 0;
  for (const l of incoming) {
    if (!l.instruction) continue;
    const r = addLesson(mem, {
      title: l.title,
      instruction: l.instruction,
      tags: l.tags ?? [],
      trigger: l.trigger ?? '',
      source: 'import',
    });
    r.duplicate ? merged++ : added++;
  }
  saveMemory(MEMORY, mem);
  console.log(`Imported ${incoming.length}: ${added} new, ${merged} already known.`);
}

/* -------------------------------------------------------------- checklist */
function cmdChecklist(flags) {
  const mem = loadMemory(MEMORY);
  const tags = splitList(flags.tags);
  const rows = selectLessons(mem, { tags, scope: 'workflow', limit: 12, charBudget: 4000 });
  if (!rows.length) {
    console.log('No workflow lessons match. Try: --tags text,quality');
    return;
  }
  console.log('HUMAN CHECKLIST — do these yourself. They never go into the image prompt.\n');
  for (const l of rows) console.log(`[ ] ${l.id}  ${l.title}\n    ${l.instruction}\n`);
}

/* ------------------------------------------------------------------- main */
const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    vars: { type: 'string' },
    tags: { type: 'string' },
    status: { type: 'string' },
    title: { type: 'string' },
    instruction: { type: 'string' },
    trigger: { type: 'string' },
    out: { type: 'string' },
    json: { type: 'boolean' },
    chars: { type: 'boolean' },
    yes: { type: 'boolean' },
    'no-memory': { type: 'boolean' },
    'lesson-budget': { type: 'string' },
  },
});

const cmd = positionals[0] ?? 'help';
flags._ = positionals;
const table = {
  validate: cmdValidate,
  render: cmdRender,
  list: cmdList,
  add: cmdAdd,
  score: cmdScore,
  stats: cmdStats,
  checklist: cmdChecklist,
  prune: cmdPrune,
  learn: cmdLearn,
  help,
};

if (!table[cmd]) {
  console.error(`Unknown command "${cmd}".`);
  help();
  process.exit(1);
}
table[cmd](flags);
