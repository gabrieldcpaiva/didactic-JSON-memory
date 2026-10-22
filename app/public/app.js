/* Prompt Foundry — client. Vanilla JS, no build step.
   One rule: the browser never invents data. It renders what the server returns. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  templates: [],
  activeId: null,
  lastPrompt: '',
  prices: {},
};

/* ------------------------------------------------------------------ util */

function toast(message, ms = 2400) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('is-on'), ms);
}

function setStatus(text, kind = '') {
  const el = $('#footStatus');
  el.textContent = text;
  el.className = `status ${kind}`;
}

async function api(path, body) {
  const res = await fetch(path, body
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
    : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status}).`);
    err.data = data;
    throw err;
  }
  return data;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/* --------------------------------------------------------------- routing */

function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('is-on', v.id === `view-${name}`));
  $$('.tab').forEach((t) => {
    const on = t.dataset.view === name;
    t.classList.toggle('is-on', on);
    t.setAttribute('aria-selected', String(on));
  });
  if (name === 'memory') loadMemory();
  if (location.hash.slice(1) !== name) history.replaceState(null, '', `#${name}`);
}

$$('.tab').forEach((tab) => tab.addEventListener('click', () => showView(tab.dataset.view)));

/* ------------------------------------------------------------- bootstrap */

async function boot() {
  setStatus('loading', 'busy');
  try {
    const data = await api('/api/bootstrap');
    state.templates = data.templates;
    state.prices = data.prices ?? {};
    $('#memCount').textContent = data.memory.stats.total;
    $('#factLessons').textContent = data.memory.stats.total;
    renderList();
    if (state.templates.length) selectTemplate(state.templates[0].id);
    setStatus('ready');
  } catch (e) {
    setStatus('offline', 'err');
    toast(`Cannot reach the engine: ${e.message}`);
  }
}

function renderList() {
  const ul = $('#tplList');
  ul.innerHTML = state.templates.map((t) => `
    <li>
      <button type="button" data-id="${esc(t.id)}" class="${t.id === state.activeId ? 'is-on' : ''}">
        ${esc(t.title)}
        <small>${esc(t.tags.slice(0, 2).join(' · ') || t.id)}</small>
      </button>
    </li>`).join('');

  $$('#tplList button').forEach((b) => {
    b.addEventListener('click', () => selectTemplate(b.dataset.id));
  });
}

/* --------------------------------------------------------------- the form */

function selectTemplate(id) {
  const t = state.templates.find((x) => x.id === id);
  if (!t) return;
  state.activeId = id;
  renderList();

  $('#tplTitle').textContent = t.title.replace(/-/g, ' ');
  $('#tplGoal').textContent = t.goal;

  const s = t.settings ?? {};
  $('#tplMeta').innerHTML = [
    s.aspect_ratio ? `<span class="chip">${esc(s.aspect_ratio)}</span>` : '',
    s.resolution ? `<span class="chip">${esc(s.resolution)}</span>` : '',
    s.reference_images ? `<span class="chip quiet">${s.reference_images} reference image${s.reference_images === 1 ? '' : 's'}</span>` : '',
    `<span class="chip quiet">${t.fields.length} blanks</span>`,
  ].join('');

  $('#form').innerHTML = t.fields.map((f) => {
    const hint = f.description ? ` <code>${esc(f.description)}</code>` : '';
    const req = f.required ? '<span class="req">*</span>' : '';
    const val = f.default ?? f.example ?? '';
    const wide = String(val).length > 46 || f.type === 'object' || f.type === 'array';
    const tag = wide ? 'textarea' : 'input';

    return `
      <div class="field">
        <label for="f-${esc(f.name)}">${esc(f.name.replace(/_/g, ' '))}${req}${hint}</label>
        ${tag === 'textarea'
          ? `<textarea id="f-${esc(f.name)}" name="${esc(f.name)}" rows="2">${esc(val)}</textarea>`
          : `<input id="f-${esc(f.name)}" name="${esc(f.name)}" value="${esc(val)}">`}
      </div>`;
  }).join('');

  $('#formHint').textContent = t.has_text
    ? 'Text fields are the risky ones. Keep each string short and check every letter before you send it.'
    : 'Values are pre-filled with real examples. Replace them with yours.';

  $('#outBody').hidden = true;
  $('#outEmpty').hidden = false;
  $('#copyBtn').disabled = true;
  $('#outEmpty').innerHTML = `
    <p>Ready when you are.</p>
    <p class="small">${esc(t.title.replace(/-/g, ' '))} · ${t.fields.length} blanks · ${esc((t.settings?.aspect_ratio ?? '') + ' ' + (t.settings?.resolution ?? ''))}. Hit <b>Render prompt</b>.</p>`;

  $$('#form input, #form textarea').forEach((el) => el.classList.remove('is-missing'));
}

function collectVars() {
  const out = {};
  $$('#form [name]').forEach((el) => { out[el.name] = el.value.trim(); });
  return out;
}

/* ----------------------------------------------------------------- render */

async function render() {
  if (!state.activeId) { toast('Pick a template first.'); return; }
  const btn = $('#renderBtn');
  btn.disabled = true;
  btn.textContent = 'Rendering…';
  setStatus('rendering', 'busy');

  try {
    const data = await api('/api/render', {
      id: state.activeId,
      vars: collectVars(),
      use_memory: $('#useMemory').checked,
    });

    state.lastPrompt = data.prompt;
    $('#outEmpty').hidden = true;
    $('#outBody').hidden = false;
    $('#promptBox').textContent = data.prompt;
    $('#copyBtn').disabled = false;

    const cost = data.cost ? `$${data.cost.toFixed(3)}` : '—';
    $('#outChips').innerHTML = [
      `<span class="chip">${esc(data.settings.aspect_ratio)}</span>`,
      `<span class="chip">${esc(data.settings.resolution)}</span>`,
      `<span class="chip quiet">${data.tokens} tokens</span>`,
      `<span class="chip quiet">${data.chars} chars</span>`,
      `<span class="chip quiet">${cost} / image</span>`,
    ].join('');

    $('#outLessons').innerHTML = data.lessons.length
      ? `<p class="eyebrow" style="margin-top:16px">Lessons inside this prompt — score them after you look</p>` +
        data.lessons.map((l) => `
          <div class="lrow" data-id="${esc(l.id)}">
            <span class="id">${esc(l.id)}</span>
            <span class="txt">${esc(l.title)}</span>
            <span class="vote">
              <button class="win" data-outcome="win" title="This lesson helped">✓</button>
              <button class="loss" data-outcome="loss" title="This lesson hurt">✕</button>
            </span>
          </div>`).join('')
      : `<p class="hint">No memory lessons matched. That is fine — the template already carries the craft.</p>`;

    bindVotes($('#outLessons'));
    setStatus('rendered');
    if (window.innerWidth < 1080) $('.out')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (e) {
    setStatus('needs values', 'err');
    const missing = e.data?.missing ?? [];
    $$('#form [name]').forEach((el) => el.classList.remove('is-missing'));
    if (missing.length) {
      const first = [];
      for (const name of missing) {
        const el = $(`#form [name="${CSS.escape(name)}"]`);
        if (!el) continue;
        el.classList.add('is-missing');
        if (!first.length) first.push(el);
      }
      const names = missing.map((m) => m.replace(/_/g, ' ')).slice(0, 4).join(', ');
      toast(`Fill these first: ${names}${missing.length > 4 ? '…' : ''}`, 4200);
      first[0]?.focus();
      first[0]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      toast(e.message, 4200);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Render prompt';
  }
}

$('#renderBtn').addEventListener('click', render);

$('#copyBtn').addEventListener('click', async () => {
  if (!state.lastPrompt) return;
  try {
    await navigator.clipboard.writeText(state.lastPrompt);
    toast('Prompt copied. Paste it into Nano Banana Pro.');
  } catch {
    const box = $('#promptBox');
    const range = document.createRange();
    range.selectNodeContents(box);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    toast('Selected. Press Ctrl/Cmd + C.');
  }
});

/* ------------------------------------------------------------------ votes */

function bindVotes(root) {
  $$('.vote button', root).forEach((b) => {
    b.addEventListener('click', async () => {
      const row = b.closest('[data-id]');
      const id = row?.dataset.id;
      if (!id) return;
      b.disabled = true;
      try {
        const data = await api('/api/score', { id, outcome: b.dataset.outcome });
        toast(`${id} is now ${data.lesson.score} — ${data.lesson.status}.`);
        row.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        row.style.opacity = '.55';
      } catch (e) {
        b.disabled = false;
        toast(e.message);
      }
    });
  });
}

/* ----------------------------------------------------------------- memory */

async function loadMemory() {
  try {
    const data = await api('/api/memory');
    const s = data.stats;
    $('#memFacts').innerHTML = `
      <div><b>${s.active}</b><span>active</span></div>
      <div><b>${s.trial}</b><span>trial</span></div>
      <div><b>${s.retired}</b><span>retired</span></div>
      <div><b>${s.approx_active_tokens}</b><span>tokens of rules</span></div>`;

    $('#promptCount').textContent = `${data.lessons.length} selected for a typical prompt`;

    $('#promptLessons').innerHTML = data.lessons.map((l) => `
      <li>
        <span class="id">${esc(l.id)}</span>
        <span class="body">
          <b>${esc(l.title)}</b>
          <p>${esc(l.instruction)}</p>
          <span class="tags">${esc((l.tags ?? []).join(' · '))}</span>
        </span>
        <span class="score">
          <span class="${l.score >= 0 ? 'pos' : 'neg'}">${l.score > 0 ? '+' : ''}${l.score}</span><br>
          <span class="status ${esc(l.status)}">${esc(l.status)}</span>
        </span>
      </li>`).join('') || '<li>The prompt scope is empty. Add a lesson on the right.</li>';

    $('#workflowLessons').innerHTML = data.workflow.map((l) => `
      <li><span>${esc(l.instruction)}</span></li>`).join('')
      || '<li><span>No workflow lessons yet.</span></li>';
  } catch (e) {
    toast(`Memory unavailable: ${e.message}`);
  }
}

$('#lessonForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  if (!data.instruction?.trim()) { toast('Write one sentence.'); return; }

  try {
    const res = await api('/api/lesson', data);
    toast(res.duplicate
      ? `Already known. ${res.lesson.id} scored again.`
      : `Added ${res.lesson.id}. It starts as a trial.`);
    form.reset();
    $('#memCount').textContent = res.stats.total;
    $('#factLessons').textContent = res.stats.total;
    loadMemory();
  } catch (e) {
    toast(e.message);
  }
});

/* ------------------------------------------------------------------- boot */

const startView = ['build', 'memory', 'about'].includes(location.hash.slice(1))
  ? location.hash.slice(1)
  : 'build';
showView(startView);
boot();
