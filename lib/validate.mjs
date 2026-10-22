/**
 * validate.mjs — plain-language checks for prompt packages and memory files.
 * Zero dependencies. Node 18+.
 *
 * Why hand-written and not a JSON Schema library?
 *  1. No install step. Works offline, in a sandbox, or on a locked-down laptop.
 *  2. The error messages are written for non-technical users.
 *  3. The rules you read here are the rules that run. No hidden behavior.
 */

// "auto" means: keep the shape of the attached photo. Best for edits and repairs.
export const ASPECT_RATIOS = [
  'auto', '1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4',
  '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1',
];

export const RESOLUTIONS = ['1K', '2K', '4K'];

export const MEMORY_STATUSES = ['active', 'trial', 'retired'];
export const MEMORY_SCOPES = ['prompt', 'workflow'];

const PACKAGE_SECTIONS = [
  'goal_summary',
  'user_profile',
  'nano_banana_prompt',
  'input_schema',
  'output_schema',
  'examples',
  'non_obvious_insights',
  'monetization_ideas',
  'reusability_notes',
];

/** Words that usually signal a weak, negative instruction. */
const NEGATIVE_OPENERS = /^(no|not|don't|do not|never|avoid)\b/i;

const isText = (v) => typeof v === 'string' && v.trim().length > 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isList = (v) => Array.isArray(v);

function needText(errors, obj, key, where, max = 2000) {
  if (!isText(obj?.[key])) {
    errors.push(`${where}.${key}: add text. It cannot be empty.`);
    return;
  }
  if (obj[key].length > max) {
    errors.push(`${where}.${key}: shorten it to ${max} characters or fewer (now ${obj[key].length}).`);
  }
}

function needList(errors, obj, key, where, min = 1) {
  if (!isList(obj?.[key])) {
    errors.push(`${where}.${key}: must be a list [...] with at least ${min} item(s).`);
    return false;
  }
  if (obj[key].length < min) {
    errors.push(`${where}.${key}: add at least ${min} item(s).`);
    return false;
  }
  return true;
}

/**
 * Validate one prompt package.
 * @param {any} input  Either {prompt_package:{...}} or the bare package.
 * @param {string} label  Name shown in messages.
 * @returns {{ok:boolean, errors:string[], warnings:string[], package:object|null}}
 */
export function validatePackage(input, label = 'package') {
  const errors = [];
  const warnings = [];

  if (!isObj(input)) {
    return { ok: false, errors: [`${label}: file must contain a JSON object { ... }.`], warnings, package: null };
  }

  let pkg = input;
  if ('prompt_package' in input) {
    if (!isObj(input.prompt_package)) {
      return { ok: false, errors: [`${label}: "prompt_package" must be an object { ... }.`], warnings, package: null };
    }
    pkg = input.prompt_package;
  } else {
    warnings.push(`${label}: no outer "prompt_package" wrapper. Wrapping it is the safe default.`);
  }

  for (const key of PACKAGE_SECTIONS) {
    if (!(key in pkg)) errors.push(`${label}: missing section "${key}".`);
  }

  // --- tags (optional, but they decide which memory lessons get used) ------
  if ('tags' in pkg && (!isList(pkg.tags) || !pkg.tags.every(isText))) {
    errors.push(`${label}.tags: must be a list of short words, e.g. ["text","poster"].`);
  } else if (!('tags' in pkg)) {
    warnings.push(`${label}.tags: missing. Add 2-4 words like ["text","poster"] so memory picks the right lessons.`);
  }

  // --- goal_summary -------------------------------------------------------
  if ('goal_summary' in pkg) needText(errors, pkg, 'goal_summary', `${label}.goal_summary`, 400);

  // --- user_profile -------------------------------------------------------
  if ('user_profile' in pkg) {
    const up = pkg.user_profile;
    if (!isObj(up)) {
      errors.push(`${label}.user_profile: must be an object { who, skill_level, language, time_budget }.`);
    } else {
      for (const key of ['who', 'skill_level', 'language']) {
        needText(errors, up, key, `${label}.user_profile`, 300);
      }
    }
  }

  // --- nano_banana_prompt -------------------------------------------------
  if ('nano_banana_prompt' in pkg) {
    const np = pkg.nano_banana_prompt;
    const where = `${label}.nano_banana_prompt`;
    if (!isObj(np)) {
      errors.push(`${where}: must be an object { model, settings, blocks }.`);
    } else {
      needText(errors, np, 'model', where, 80);
      if (isText(np.model) && !np.model.startsWith('gemini-')) {
        errors.push(`${where}.model: use a Gemini image model id, e.g. "gemini-3-pro-image".`);
      }

      const st = np.settings;
      if (!isObj(st)) {
        errors.push(`${where}.settings: add { aspect_ratio, resolution, reference_images } .`);
      } else {
        if (!ASPECT_RATIOS.includes(st.aspect_ratio)) {
          errors.push(`${where}.settings.aspect_ratio: "${st.aspect_ratio}" is not supported. Use one of: ${ASPECT_RATIOS.join(', ')}.`);
        }
        if (!RESOLUTIONS.includes(st.resolution)) {
          errors.push(`${where}.settings.resolution: "${st.resolution}" is not supported. Use 1K, 2K, or 4K.`);
        }
        if (st.reference_images !== undefined) {
          if (!Number.isInteger(st.reference_images) || st.reference_images < 0 || st.reference_images > 14) {
            errors.push(`${where}.settings.reference_images: use a whole number from 0 to 14.`);
          }
        }
        if (st.resolution === '4K' && isText(np.blocks?.task)) {
          warnings.push(`${where}: 4K costs about 2x a 2K image. Test at 1K first, then re-run the winner at 4K.`);
        }
      }

      const blocks = np.blocks;
      if (!isObj(blocks)) {
        errors.push(`${where}.blocks: add the prompt blocks { task, subject, scene, style, camera, light, text_in_image, locks, avoid }.`);
      } else {
        needText(errors, blocks, 'task', `${where}.blocks`, 400);
        if (isList(blocks.style) && blocks.style.length === 0) {
          warnings.push(`${where}.blocks.style: empty. Add 2–4 style words so the look is repeatable.`);
        }
        if (isList(blocks.text_in_image)) {
          blocks.text_in_image.forEach((t, i) => {
            const tw = `${where}.blocks.text_in_image[${i}]`;
            if (!isObj(t) || !isText(t.content)) {
              errors.push(`${tw}: each entry needs "content" (the exact words to draw).`);
              return;
            }
            if (t.content.length > 80) {
              errors.push(`${tw}.content: keep on-image text under 80 characters (now ${t.content.length}). Long text fails.`);
            } else if (t.content.length > 32) {
              warnings.push(`${tw}.content: ${t.content.length} characters. Text over ~32 characters gets less reliable.`);
            }
          });
          if (blocks.text_in_image.length > 6) {
            warnings.push(`${where}.blocks.text_in_image: ${blocks.text_in_image.length} text items. Fewer than 7 reads better.`);
          }
        }
        for (const key of ['locks', 'avoid']) {
          if (isList(blocks[key])) {
            blocks[key].forEach((line, i) => {
              if (!isText(line)) errors.push(`${where}.blocks.${key}[${i}]: write a short sentence.`);
              else if (key === 'avoid' && NEGATIVE_OPENERS.test(line)) {
                warnings.push(`${where}.blocks.avoid[${i}]: starts with a negation ("${line.slice(0, 24)}…"). Say what you DO want where possible.`);
              }
            });
          }
        }
        if (!isList(blocks.locks) || blocks.locks.length === 0) {
          warnings.push(`${where}.blocks.locks: empty. Add 1–3 things that must not change (face, logo shape, product label).`);
        }
      }
    }
  }

  // --- input_schema / output_schema --------------------------------------
  if ('input_schema' in pkg) {
    const sch = pkg.input_schema;
    if (!isObj(sch)) {
      errors.push(`${label}.input_schema: must be an object { description, fields }.`);
    } else {
      needText(errors, sch, 'description', `${label}.input_schema`, 400);
      if (needList(errors, sch, 'fields', `${label}.input_schema`, 1)) {
        sch.fields.forEach((f, i) => {
          const w = `${label}.input_schema.fields[${i}]`;
          if (!isObj(f)) return errors.push(`${w}: must be an object.`);
          for (const k of ['name', 'type']) if (!isText(f[k])) errors.push(`${w}.${k}: required.`);
          if (typeof f.required !== 'boolean') errors.push(`${w}.required: use true or false.`);
          if (!('example' in f)) errors.push(`${w}.example: required. Show one real value.`);
          if (f.required === false && !('default' in f)) {
            warnings.push(`${w}: optional and no "default". If it is used in the prompt, the render will stop. Add a "default" or mark it required.`);
          }
        });
        const names = sch.fields.filter(isObj).map((f) => f.name);
        const dupes = names.filter((n, i) => names.indexOf(n) !== i);
        if (dupes.length) errors.push(`${label}.input_schema: duplicate field name(s): ${[...new Set(dupes)].join(', ')}.`);
      }
    }
  }

  if ('output_schema' in pkg) {
    const sch = pkg.output_schema;
    if (!isObj(sch)) {
      errors.push(`${label}.output_schema: must be an object { description, fields }.`);
    } else {
      needText(errors, sch, 'description', `${label}.output_schema`, 400);
      if (needList(errors, sch, 'fields', `${label}.output_schema`, 1)) {
        sch.fields.forEach((f, i) => {
          const w = `${label}.output_schema.fields[${i}]`;
          if (!isObj(f)) return errors.push(`${w}: must be an object.`);
          for (const k of ['name', 'type']) if (!isText(f[k])) errors.push(`${w}.${k}: required.`);
          if (!('example' in f)) errors.push(`${w}.example: required. Show one real value.`);
        });
      }
    }
  }

  // --- examples -----------------------------------------------------------
  if ('examples' in pkg && needList(errors, pkg, 'examples', label, 1)) {
    pkg.examples.forEach((ex, i) => {
      const w = `${label}.examples[${i}]`;
      if (!isObj(ex)) return errors.push(`${w}: must be an object { title, example_input, example_output }.`);
      for (const k of ['title', 'example_input', 'example_output']) {
        if (!(k in ex)) errors.push(`${w}.${k}: required.`);
      }
    });
  }

  // --- insight / money / reuse -------------------------------------------
  if ('non_obvious_insights' in pkg && needList(errors, pkg, 'non_obvious_insights', label, 3)) {
    if (!pkg.non_obvious_insights.every(isText)) errors.push(`${label}.non_obvious_insights: every item must be text.`);
  }
  if ('monetization_ideas' in pkg && needList(errors, pkg, 'monetization_ideas', label, 2)) {
    if (!pkg.monetization_ideas.every(isText)) errors.push(`${label}.monetization_ideas: every item must be text.`);
  }
  if ('reusability_notes' in pkg) needText(errors, pkg, 'reusability_notes', `${label}.reusability_notes`, 1200);

  // --- friendly extras ----------------------------------------------------
  const raw = JSON.stringify(pkg);
  if (raw.length > 24000) {
    warnings.push(`${label}: file is ${raw.length} characters. Keep packages lean; 6–9 KB is plenty.`);
  }

  return { ok: errors.length === 0, errors, warnings, package: pkg };
}

/**
 * Validate a memory file.
 * @returns {{ok:boolean, errors:string[], warnings:string[], memory:object|null}}
 */
export function validateMemory(input, label = 'memory') {
  const errors = [];
  const warnings = [];

  if (!isObj(input)) {
    return { ok: false, errors: [`${label}: file must contain a JSON object.`], warnings, memory: null };
  }
  needText(errors, input, 'memory_version', label, 20);
  if (!isObj(input.rules)) {
    errors.push(`${label}.rules: add { max_active_lessons, max_chars_per_lesson, promote_at, retire_below }.`);
  }
  if (!needList(errors, input, 'lessons', label, 0)) {
    return { ok: errors.length === 0, errors, warnings, memory: input };
  }

  const ids = new Set();
  const bodies = new Map();

  input.lessons.forEach((l, i) => {
    const w = `${label}.lessons[${i}]`;
    if (!isObj(l)) return errors.push(`${w}: must be an object.`);
    for (const k of ['id', 'title', 'instruction', 'status']) {
      if (!isText(l[k])) errors.push(`${w}.${k}: required.`);
    }
    if (isText(l.id)) {
      if (ids.has(l.id)) errors.push(`${w}.id: "${l.id}" is used twice. Ids must be unique.`);
      ids.add(l.id);
    }
    if (!isList(l.tags)) errors.push(`${w}.tags: must be a list, e.g. ["text", "poster"].`);
    if (typeof l.score !== 'number') errors.push(`${w}.score: must be a number.`);
    if (typeof l.wins !== 'number') errors.push(`${w}.wins: must be a number.`);
    if (typeof l.losses !== 'number') errors.push(`${w}.losses: must be a number.`);
    if (isText(l.status) && !MEMORY_STATUSES.includes(l.status)) {
      errors.push(`${w}.status: use one of ${MEMORY_STATUSES.join(', ')}.`);
    }
    if (l.scope !== undefined && !MEMORY_SCOPES.includes(l.scope)) {
      errors.push(`${w}.scope: use "prompt" (goes into the image prompt) or "workflow" (advice for the human).`);
    }
    if (isText(l.instruction)) {
      const max = input.rules?.max_chars_per_lesson ?? 240;
      if (l.instruction.length > max) {
        errors.push(`${w}.instruction: ${l.instruction.length} characters. Limit is ${max}. Split it into two lessons.`);
      }
      const key = l.instruction.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (bodies.has(key)) errors.push(`${w}: same instruction as ${bodies.get(key)}. Merge them.`);
      bodies.set(key, l.id ?? `#${i}`);
    }
  });

  const active = input.lessons.filter((l) => l.status === 'active');
  const cap = input.rules?.max_active_lessons ?? 24;
  if (active.length > cap) {
    warnings.push(`${label}: ${active.length} active lessons, cap is ${cap}. Retire the weakest ones.`);
  }
  const chars = active.reduce((n, l) => n + String(l.instruction ?? '').length, 0);
  if (chars > 4000) {
    warnings.push(`${label}: active lessons hold ${chars} characters (~${Math.round(chars / 4)} tokens). Trim to keep prompts fast.`);
  }

  return { ok: errors.length === 0, errors, warnings, memory: input };
}

/** Rough token estimate. Good enough for budgeting, not billing. */
export const estimateTokens = (text) => Math.ceil(String(text).length / 4);

/** Print errors and warnings in a calm, human order. */
export function report(result, label) {
  for (const e of result.errors) console.error(`  ✗ ${e}`);
  for (const w of result.warnings) console.warn(`  ! ${w}`);
  if (result.ok) console.log(`  ✓ ${label}: valid${result.warnings.length ? ` (${result.warnings.length} warning(s))` : ''}.`);
  else console.error(`  ✗ ${label}: ${result.errors.length} problem(s). Fix the lines marked ✗.`);
  return result.ok;
}
