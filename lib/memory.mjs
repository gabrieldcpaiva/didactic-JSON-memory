/**
 * memory.mjs — a small, scored lesson store.
 *
 * Memory is NOT a log of images. Logs grow forever and teach nothing.
 * Here we store only "mutations": one short instruction that fixed a problem.
 * Each one carries a score. Good ones climb. Bad ones retire.
 * The renderer injects only the top few, so prompts stay short.
 *
 * Zero dependencies. Node 18+.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { MEMORY_STATUSES } from './validate.mjs';

/**
 * Two kinds of lesson live in one file:
 *   scope "prompt"   -> goes into the image prompt (the model must read it)
 *   scope "workflow" -> stays out of the image prompt (it is advice for the human)
 * Mixing them wastes tokens and confuses the model. The renderer only injects "prompt".
 */
export const SCOPES = ['prompt', 'workflow'];

/**
 * Provenance separates "I believe this" from "I watched it work".
 *   prior   -> shipped with the repo. Never scored. Zero by definition.
 *   tested  -> earned a win or a loss against a real image.
 * A score without provenance is just a mood.
 */
export const PROVENANCES = ['prior', 'tested'];

export const DEFAULT_RULES = {
  max_active_lessons: 24,
  max_chars_per_lesson: 240,
  promote_at: 2,      // wins needed to leave "trial"
  retire_below: -2,   // score at or under this retires an active lesson
};

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const today = () => new Date().toISOString().slice(0, 10);

export function loadMemory(path) {
  const raw = readFileSync(path, 'utf8');
  let mem;
  try {
    mem = JSON.parse(raw);
  } catch (e) {
    throw new Error(`${path} is not valid JSON. ${e.message}`);
  }
  mem.rules = { ...DEFAULT_RULES, ...(mem.rules ?? {}) };
  mem.lessons = Array.isArray(mem.lessons) ? mem.lessons : [];
  return mem;
}

export function saveMemory(path, mem) {
  mem.updated_at = today();
  writeFileSync(path, JSON.stringify(mem, null, 2) + '\n', 'utf8');
  return path;
}

export function nextId(mem) {
  const nums = mem.lessons
    .map((l) => Number(String(l.id).replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n));
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `L${String(n).padStart(3, '0')}`;
}

/**
 * Add a lesson. If the same instruction already exists, score it instead of duplicating.
 * @returns {{lesson:object, duplicate:boolean}}
 */
export function addLesson(mem, { title, instruction, tags = [], trigger = '', source = 'user', scope = 'prompt' }) {
  if (!SCOPES.includes(scope)) throw new Error('scope must be "prompt" or "workflow".');
  const clean = String(instruction ?? '').trim();
  if (!clean) throw new Error('A lesson needs an instruction. Example: "Put the headline in the top third."');
  if (clean.length > mem.rules.max_chars_per_lesson) {
    throw new Error(
      `Instruction is ${clean.length} characters. Limit is ${mem.rules.max_chars_per_lesson}. ` +
      'A lesson is one fix, not a paragraph. Split it.',
    );
  }

  const key = slug(clean);
  const found = mem.lessons.find((l) => slug(l.instruction) === key);
  if (found) {
    found.wins += 1;
    found.score = found.wins - found.losses;
    if (found.status === 'retired' && found.score > mem.rules.retire_below) found.status = 'trial';
    if (found.status === 'trial' && found.wins >= mem.rules.promote_at) found.status = 'active';
    found.evidence = `Confirmed again on ${today()}.`;
    return { lesson: found, duplicate: true };
  }

  const lesson = {
    id: nextId(mem),
    title: String(title ?? clean.slice(0, 48)).trim(),
    trigger,
    instruction: clean,
    scope,
    provenance: 'prior',
    tags: Array.isArray(tags) ? tags.map((t) => String(t).toLowerCase().trim()).filter(Boolean) : [],
    score: 0,
    wins: 0,
    losses: 0,
    status: 'trial',
    source,
    created_at: today(),
    evidence: '',
  };
  mem.lessons.push(lesson);
  return { lesson, duplicate: false };
}

/**
 * Record a win or a loss for one lesson.
 * @param {'win'|'loss'} outcome
 */
export function scoreLesson(mem, id, outcome) {
  const l = mem.lessons.find((x) => x.id === id);
  if (!l) throw new Error(`No lesson with id "${id}". Run: node tools/nbjson.mjs list`);

  if (outcome === 'win') l.wins += 1;
  else if (outcome === 'loss') l.losses += 1;
  else throw new Error('Outcome must be "win" or "loss".');

  l.score = l.wins - l.losses;
  l.provenance = 'tested';

  if (l.status === 'trial' && l.wins >= mem.rules.promote_at) l.status = 'active';
  if (l.status === 'active' && l.score <= mem.rules.retire_below) l.status = 'retired';
  if (l.status === 'retired' && l.score > mem.rules.retire_below) l.status = 'trial';

  l.evidence = `Updated ${today()}: ${l.wins} win(s), ${l.losses} loss(es).`;
  return l;
}

/**
 * Pick the best lessons for a job.
 * Tag match first, then score, then total wins. Deterministic, so output is reproducible.
 */
export function selectLessons(mem, { tags = [], limit = 8, charBudget = 1400, includeTrial = true, scope = 'prompt' } = {}) {
  const wanted = tags.map((t) => String(t).toLowerCase());
  const pool = mem.lessons.filter((l) =>
    (l.scope ?? 'prompt') === scope &&
    (l.status === 'active' || (includeTrial && l.status === 'trial')),
  );

  const ranked = pool
    .map((l) => {
      const hits = (l.tags ?? []).filter((t) => wanted.includes(t)).length;
      return { l, hits };
    })
    .filter(({ l, hits }) => (wanted.length === 0 ? true : hits > 0))
    .sort((a, b) =>
      b.hits - a.hits ||
      b.l.score - a.l.score ||
      b.l.wins - a.l.wins ||
      String(a.l.id).localeCompare(String(b.l.id)),
    )
    .map(({ l }) => l);

  const chosen = [];
  let budget = charBudget;
  for (const l of ranked) {
    if (chosen.length >= limit) break;
    if (l.instruction.length > budget) continue;
    budget -= l.instruction.length;
    chosen.push(l);
  }
  return chosen;
}

export function memoryStats(mem) {
  const by = Object.fromEntries(MEMORY_STATUSES.map((s) => [s, 0]));
  for (const l of mem.lessons) by[l.status] = (by[l.status] ?? 0) + 1;
  const tested = mem.lessons.filter((l) => (l.provenance ?? 'prior') === 'tested').length;
  const activeChars = mem.lessons
    .filter((l) => l.status === 'active')
    .reduce((n, l) => n + l.instruction.length, 0);
  // What can actually reach a prompt: prompt-scope lessons that are not retired.
  const injectable = mem.lessons.filter(
    (l) => (l.scope ?? 'prompt') === 'prompt' && l.status !== 'retired',
  );
  const injectableChars = injectable.reduce((n, l) => n + l.instruction.length, 0);
  return {
    total: mem.lessons.length,
    ...by,
    tested,                                   // lessons that earned a real win or loss
    untested_priors: mem.lessons.length - tested,
    active_chars: activeChars,
    approx_active_tokens: Math.ceil(activeChars / 4),
    injectable_lessons: injectable.length,
    injectable_chars: injectableChars,
    approx_injectable_tokens: Math.ceil(injectableChars / 4),
    updated_at: mem.updated_at ?? 'unknown',
  };
}

/**
 * Lessons that never won and never lost — candidates for deletion.
 * Priors are excluded: they ship unproven on purpose, and deleting them
 * on day one would empty the memory file.
 */
export function staleLessons(mem, { includePriors = false } = {}) {
  return mem.lessons.filter((l) =>
    l.status === 'trial' &&
    l.wins === 0 &&
    l.losses === 0 &&
    (includePriors || (l.provenance ?? 'prior') !== 'prior'),
  );
}

export function removeLesson(mem, id) {
  const i = mem.lessons.findIndex((l) => l.id === id);
  if (i === -1) throw new Error(`No lesson with id "${id}".`);
  return mem.lessons.splice(i, 1)[0];
}
