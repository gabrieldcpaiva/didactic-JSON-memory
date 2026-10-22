/**
 * render.mjs — turns a structured JSON package into one clean prompt string.
 *
 * The rule that matters most:
 *   Never paste raw JSON into the image model.
 *   JSON braces, quotes and keys can be painted into the picture as literal text.
 *   We read the JSON here, then write short labeled sentences.
 *
 * Zero dependencies. Node 18+.
 */

import { estimateTokens } from './validate.mjs';

const LABEL = {
  task: 'TASK',
  canvas: 'CANVAS',
  subject: 'SUBJECT',
  scene: 'SCENE',
  style: 'STYLE',
  camera: 'CAMERA',
  light: 'LIGHT',
  text: 'TEXT IN IMAGE',
  keep: 'MUST KEEP',
  avoid: 'AVOID',
  lessons: 'LESSONS THAT WORKED BEFORE',
  check: 'FINAL CHECK',
};

const asList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : typeof v === 'string' && v.trim() ? [v] : []);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Find every {{placeholder}} used in the package. */
export function findVariables(node, found = new Set()) {
  if (typeof node === 'string') {
    for (const m of node.matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)) found.add(m[1]);
  } else if (Array.isArray(node)) {
    node.forEach((x) => findVariables(x, found));
  } else if (isObj(node)) {
    Object.values(node).forEach((x) => findVariables(x, found));
  }
  return [...found];
}

/** Replace {{key}} with values. Throws a plain-language error if one is missing. */
export function applyVariables(node, vars, missing = new Set()) {
  if (typeof node === 'string') {
    return node.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
      const v = vars[key];
      if (v === undefined || v === null || v === '') {
        missing.add(key);
        return `{{${key}}}`;
      }
      return String(v);
    });
  }
  if (Array.isArray(node)) return node.map((x) => applyVariables(x, vars, missing));
  if (isObj(node)) {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = applyVariables(v, vars, missing);
    return out;
  }
  return node;
}

function textLines(items) {
  return items.map((t, i) => {
    if (typeof t === 'string') return `${i + 1}. "${t}"`;
    const bits = [];
    if (t.placement) bits.push(t.placement);
    if (t.style) bits.push(t.style);
    if (t.size) bits.push(t.size);
    const tail = bits.length ? ` — ${bits.join('; ')}` : '';
    return `${i + 1}. "${t.content}"${tail}`;
  });
}

/**
 * Render one package.
 * @param {object} pkg    Bare prompt_package object (no outer wrapper).
 * @param {object} opts   { vars, lessons, maxLessonChars }
 * @returns {{prompt:string, settings:object, blocks:object, used_lessons:string[], chars:number, tokens:number}}
 */
export function renderPackage(pkg, opts = {}) {
  const { vars: rawVars = {}, lessons = [], maxLessonChars = 1400 } = opts;
  const np = pkg.nano_banana_prompt;

  // Optional fields can carry a "default" in input_schema. Those fill themselves,
  // so a template still runs when the user leaves a nice-to-have blank.
  const defaults = Object.fromEntries(
    (pkg.input_schema?.fields ?? [])
      .filter((f) => f && 'default' in f && f.default !== '')
      .map((f) => [f.name, f.default]),
  );
  const vars = { ...defaults, ...rawVars };
  const missing = new Set();
  const blocks = applyVariables(np.blocks ?? {}, vars, missing);
  const settings = applyVariables(np.settings ?? {}, vars, missing);

  if (missing.size) {
    const err = new Error(
      `Missing input value(s): ${[...missing].join(', ')}. Add them to your vars file, e.g. { "${[...missing][0]}": "your value" }.`,
    );
    err.code = 'MISSING_VARS';
    err.missing = [...missing];
    throw err;
  }

  const out = [];
  const push = (label, body) => {
    if (!body || !String(body).trim()) return;
    const text = String(body);
    // Keep a leading newline so bullets start on their own line. Trim the rest.
    out.push(`${label}: ${text.startsWith('\n') ? text.replace(/[ \t]+$/, '') : text.trim()}`);
  };

  push(LABEL.task, blocks.task);

  const ratio = settings.aspect_ratio ?? '1:1';
  const res = settings.resolution ?? '1K';
  const refs = Number(settings.reference_images ?? 0);
  const shape = ratio === 'auto'
    ? "Keep the source image's aspect ratio and framing exactly."
    : `Aspect ratio ${ratio}.`;
  const canvas = [
    `Make one image. ${shape} Output ${res}.`,
    refs > 0 ? `Use the ${refs === 1 ? 'reference image' : `${refs} reference images`} I attach as the source of truth for identity and shape.` : '',
    settings.search_grounding ? 'Use current, factual real-world details; do not invent data.' : '',
  ].filter(Boolean).join(' ');
  push(LABEL.canvas, canvas);
  push(LABEL.subject, blocks.subject);
  push(LABEL.scene, blocks.scene);

  const style = asList(blocks.style);
  push(LABEL.style, style.length ? style.join(', ') + '.' : '');

  const cam = [blocks.camera, blocks.lens, blocks.framing].filter((x) => typeof x === 'string' && x.trim()).join(' ');
  push(LABEL.camera, cam);
  push(LABEL.light, blocks.light);

  const texts = Array.isArray(blocks.text_in_image) ? blocks.text_in_image.filter((t) => t && t.content) : [];
  if (texts.length) {
    push(
      LABEL.text,
      `Render only these strings. Copy each character exactly, including spelling, accents and capitals. ` +
      `Do not draw the list numbering or the quotation marks.\n` +
      textLines(texts).join('\n'),
    );
  }

  const keep = asList(blocks.locks);
  push(LABEL.keep, keep.length ? '\n' + keep.map((k) => `- ${k.trim()}`).join('\n') : '');

  const avoid = asList(blocks.avoid);
  push(LABEL.avoid, avoid.length ? '\n' + avoid.map((a) => `- ${a.trim()}`).join('\n') : '');

  const extra = asList(blocks.extra);
  if (extra.length) push('EXTRA', extra.join(' '));

  // Memory: only the lessons selected by the caller. Budgeted by characters.
  const chosen = [];
  let budget = maxLessonChars;
  for (const l of lessons) {
    const line = `- ${String(l.instruction).trim()}`;
    if (line.length > budget) break;
    budget -= line.length;
    chosen.push(l);
  }
  if (chosen.length) push(LABEL.lessons, '\n' + chosen.map((l) => `- ${l.instruction.trim()}`).join('\n'));

  push(
    LABEL.check,
    [
      'Before drawing, silently check the plan against every line above.',
      texts.length
        ? 'Re-read the text list and compare it letter by letter.'
        : refs > 0
          ? 'Do not add any words, numbers or logos that are not already visible in the reference image.'
          : 'Draw no words, letters, numbers or logos.',
      'Do not draw labels, captions, watermarks, borders or interface elements that were not requested.',
      res === '4K' || res === '2K' ? 'Keep fine detail crisp at full resolution.' : '',
    ].filter(Boolean).join(' '),
  );

  const prompt = out.join('\n\n');
  return {
    prompt,
    settings: { ...settings },
    blocks,
    used_lessons: chosen.map((l) => l.id),
    chars: prompt.length,
    tokens: estimateTokens(prompt),
  };
}

/** Human-readable preview for the terminal. */
export function previewPrompt(prompt) {
  const bar = '─'.repeat(64);
  return `${bar}\n${prompt}\n${bar}`;
}
