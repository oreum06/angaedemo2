// 안개골: 바람나침반 — VN runtime (web). Plays data/story/story.json (S01–S11) with data/staging.json.
import { loadImage, extractFigure } from './sprite_extract.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const STILL = params.get('still') === '1';
const SAVE_KEY = 'angaegol.save.v2';
const SET_KEY = 'angaegol.settings.v1';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const settings = Object.assign({ cps: 35, autoWait: 1.25, bgm: 70, sfx: 80 }, store.get(SET_KEY, {}));
const wait = ms => new Promise(r => setTimeout(r, ms));

// ---------- stage scaling ----------
const stage = $('#stage');
const fit = () => { stage.style.transform = `scale(${Math.min(innerWidth / 1920, innerHeight / 1080)})`; };
addEventListener('resize', fit); fit();
if (STILL) document.body.classList.add('still');

// ---------- data ----------
const [manifest, story, staging] = await Promise.all(
  ['data/manifest.json', 'data/story/story.json', 'data/staging.json'].map(u => fetch(u).then(r => r.json())));

const speakerMap = {};
for (const [id, c] of Object.entries(manifest.characters)) for (const s of c.speakers) speakerMap[s] = id;
const isThought = sp => /독백|의 생각/.test(sp || '');

// ---------- flatten story.json into a node graph ----------
// ids: scene "S03", beat "S03:12", choice response "S03:20>help:1"
const nodes = {}; const order = [];
function add(n) { nodes[n.id] = n; order.push(n.id); return n; }
function lineNode(id, sceneId, key, speaker, text) {
  const thought = isThought(speaker) || !speaker;
  return { id, type: 'line', sceneId, key, speaker: thought ? '포미의 생각' : speaker, text, kind: thought ? 'thought' : 'dialogue' };
}
for (const sc of story.scenes) {
  add({ id: sc.id, type: 'scene', sceneId: sc.id, scene: sc });
  sc.beats.forEach((b, i) => {
    const key = `${sc.id}:${i}`;
    if (b.type === 'dialogue') add(lineNode(key, sc.id, key, b.speaker, b.text));
    else if (b.type === 'narration') add(lineNode(key, sc.id, key, '', b.text));
    else if (b.type === 'stage') {
      const st = staging.stage[key] || {};
      const shows = st.caption || st.phone || st.typing || st.compass || st.end;
      if (st.end) add({ id: key, type: 'end', sceneId: sc.id, key, st });
      else if (st.hush) add({ id: key, type: 'hush', sceneId: sc.id, key, st });
      else if (shows) add({ id: key, type: 'stage', sceneId: sc.id, key, st });
      else add({ id: key, type: 'fx', sceneId: sc.id, key, st: { fade: st.fade ?? /transition|fade/.test(b.cue), ...st } });
    } else if (b.type === 'choice') {
      const ch = add({ id: key, type: 'choice', sceneId: sc.id, key, choiceId: b.id, prompt: b.prompt, options: [] });
      for (const o of b.options) {
        const ids = o.response.map((r, k) => {
          const n = lineNode(`${key}>${o.id}:${k}`, sc.id, key, r.speaker, r.text);
          n.choiceKey = key; nodes[n.id] = n; return n.id;
        });
        ch.options.push({ id: o.id, label: o.label, first: ids[0], ids });
      }
    }
  });
}
// link "next"
for (let i = 0; i < order.length; i++) {
  const n = nodes[order[i]];
  n.next = order[i + 1] || null;
  if (n.type === 'choice') for (const o of n.options) o.ids.forEach((id, k) => { nodes[id].next = o.ids[k + 1] || n.next; });
}
validate();
function validate() {
  let issues = 0;
  for (const n of Object.values(nodes)) {
    if (n.next && !nodes[n.next]) { console.warn('dangling next', n.id); issues++; }
    if (n.type === 'choice' && n.options.length < 2) { console.warn('choice < 2', n.id); issues++; }
  }
  if (!Object.values(nodes).some(n => n.type === 'end')) { console.warn('no end node'); issues++; }
  window.__storyIssues = issues;
}

// ---------- staging state (pure, so saves can be replayed) ----------
// lock: poses set by a stage direction (e.g. carrying the basket) stay until the next direction or scene
function freshState() { return { scene: null, bg: null, present: [], right: null, expr: {}, lock: {}, flags: {} }; }
function enterScene(state, sc) {
  const cfg = staging.scenes[sc.id] || {};
  state.scene = sc.id; state.bg = sc.background;
  state.present = [...(cfg.cast || ['pomi'])];
  state.right = state.present.find(c => c !== 'pomi') || null;
  for (const id of Object.keys(manifest.characters)) state.expr[id] = manifest.characters[id].default;
  Object.assign(state.expr, cfg.expr || {});
  state.lock = Object.fromEntries((cfg.lock || []).map(c => [c, true]));
}
function bringIn(state, id) {
  if (!id || id === 'pomi') { if (id && !state.present.includes(id)) state.present.push(id); return; }
  if (!state.present.includes(id)) state.present.push(id);
  state.right = id;
}
function applyNode(state, n) {
  if (n.type === 'scene') return enterScene(state, n.scene);
  const st = n.st || {};
  if (st.enter) bringIn(state, st.enter);
  if (st.exit) {
    state.present = state.present.filter(c => c !== st.exit);
    if (state.right === st.exit) state.right = null;
  }
  if (st.expr) { Object.assign(state.expr, st.expr); for (const c of Object.keys(st.expr)) state.lock[c] = true; }
  if (n.type === 'line' && n.kind === 'dialogue') {
    const cid = speakerMap[n.speaker];
    if (cid) {
      bringIn(state, cid);
      const e = state.lock[cid] ? null : guessExpr(cid, n.text);
      if (e) state.expr[cid] = e;
    }
  }
  const ov = staging.expr[n.id];
  if (ov) Object.assign(state.expr, ov);
}
// light-touch expression picking from the line itself; staging.expr overrides key beats
function guessExpr(cid, t) {
  switch (cid) {
    case 'pomi':
      if (/\?!|!!!|^(…*네\?|으앗|어\?)|깜짝/.test(t)) return 'surprised';
      if (/죄송|어떡해|아니에요|괜찮습니다|위험/.test(t)) return 'wary';
      if (/안녕하세요|안녕히|갈게요|포미라고/.test(t)) return 'greet';
      if (/감사|맛있|재밌|귀엽|예쁜|하하|대단/.test(t)) return 'smile';
      if (/\?$|……$/.test(t)) return 'puzzled';
      return 'observe';
    case 'maru':
      if (/어서 오세|여기야|이리 와|빠이빠이|꺄아|할무니/.test(t)) return 'welcome';
      if (/먹어봐|짜잔|요건|빵 한번|특별 메뉴/.test(t)) return 'offer_bread';
      if (/안개골 빵집|주문|알레르기/.test(t)) return 'cafe';
      return 'neutral';
    case 'soren':
      if (/아하하|그쵸|우와|재밌|좋은 이름|깔끔/.test(t)) return 'bright_laugh';
      if (/이것 좀|봐요|어때요|멈춰|볼래요/.test(t)) return 'reach_out';
      if (/하하|좋겠다|에이|정말요/.test(t)) return 'casual_laugh';
      if (/^음|죄송|맞아요|안 괜찮|아직|걱정/.test(t)) return 'crossbody';
      return 'casual';
    case 'karuviya':
      if (/허허|아이고|귀여워|예쁜|그렇지|아쉽/.test(t)) return 'laugh';
      if (/차|먹어봐|마셔|달아/.test(t)) return 'tea';
      if (/\?$/.test(t)) return 'think';
      return null;
    case 'woodpecker':
      if (/웃기|우습|좋으니까|재밌|별난|이게 더 낫/.test(t)) return 'proud_laugh';
      if (/\?$|걱정|글쎄/.test(t)) return 'thinking';
      return null;
  }
  return null;
}

// ---------- sprites ----------
const spriteCache = {};
function bboxOf(cv) {
  const x = cv.getContext('2d', { willReadFrequently: true });
  const { width: w, height: h } = cv; const d = x.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y += 2) for (let k = 0; k < w; k += 2) if (d[(y * w + k) * 4 + 3] > 40) {
    if (k < x0) x0 = k; if (k > x1) x1 = k; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}
function sprite(cid, expr) {
  const c = manifest.characters[cid]; if (!c) return Promise.resolve(null);
  const key = c.portraits[expr] ? expr : c.default;
  const p = c.portraits[key]; if (!p) return Promise.resolve(null);
  const ck = cid + ':' + key;
  return spriteCache[ck] ||= (async () => {
    try {
      let cv, url;
      if (p.source === 'sheet') { cv = extractFigure(await loadImage(p.sheet), p); url = cv.toDataURL('image/png'); }
      else {
        const img = await loadImage(p.file); url = p.file;
        cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        cv.getContext('2d').drawImage(img, 0, 0);
      }
      return { url, w: cv.width, h: cv.height, bbox: bboxOf(cv), temp: !!p.temp };
    } catch (e) { console.warn(e.message); return null; }
  })();
}

// ---------- DOM ----------
const el = {
  title: $('#title'), vn: $('#vn'), ui: $('#ui'), panel: $('#panel'), tag: $('#tag'),
  shown: $('#text .shown'), rest: $('#text .rest'), next: $('#next'), chars: $('#chars'),
  choices: $('#choices'), loc: $('#locText'), tempNote: $('#tempNote'), fader: $('#fader'),
  tint: $('#tint'), phone: $('#phone'), compass: $('#compassView'), card: $('#chapter'), end: $('#endCard'),
};
let charEls = {};

function layoutChar(cid, sp, pos) {
  const S = manifest.stage, c = manifest.characters[cid];
  const [x0, y0, x1, y1] = sp.bbox;
  const fig = c.heightCm * S.pxPerCm, s = fig / Math.max(1, y1 - y0);
  return { left: (S.positions[pos] ?? 960) - ((x0 + x1) / 2) * s, top: S.baseline - y1 * s, width: sp.w * s, height: sp.h * s };
}

async function renderChars(state, speakerCid) {
  const want = {};
  const others = state.right && state.present.includes(state.right) ? state.right : null;
  if (state.present.includes('pomi')) want.pomi = others ? 'left' : 'center';
  if (others) want[others] = state.present.includes('pomi') ? 'right' : 'center';
  for (const [cid, e] of Object.entries(charEls)) if (!want[cid]) {
    delete charEls[cid];
    if (STILL) e.remove(); else { e.classList.add('leave'); setTimeout(() => e.remove(), 320); }
  }
  let anyTemp = false;
  await Promise.all(Object.entries(want).map(async ([cid, pos]) => {
    let e = charEls[cid];
    const fresh = !e;
    if (fresh) { e = document.createElement('div'); e.className = 'char' + (STILL ? '' : ' enter'); e.dataset.cid = cid; charEls[cid] = e; el.chars.append(e); }
    const sp = await sprite(cid, state.expr[cid]);
    if (charEls[cid] !== e) return;
    if (!sp) {
      e.className = 'char placeholder'; e.textContent = `${manifest.characters[cid]?.name || cid}\n스탠딩 미제공`;
      Object.assign(e.style, { left: (manifest.stage.positions[pos] - 210) + 'px', top: '260px', height: '900px' });
      return;
    }
    anyTemp ||= sp.temp;
    const L = layoutChar(cid, sp, pos);
    Object.assign(e.style, { left: L.left + 'px', top: L.top + 'px', width: L.width + 'px', height: L.height + 'px' });
    const cur = e.querySelector('img:last-child');
    if (!cur || cur.getAttribute('src') !== sp.url) {
      const img = new Image(); img.src = sp.url; img.alt = manifest.characters[cid].name; img.decoding = 'async';
      if (cur && !STILL) { img.className = 'swap'; e.append(img); setTimeout(() => e.querySelectorAll('img:not(:last-child)').forEach(i => i.remove()), 200); }
      else { e.innerHTML = ''; e.append(img); }
    }
    e.classList.toggle('dim', !!speakerCid ? speakerCid !== cid : false);
  }));
  return anyTemp;
}

// ---------- backgrounds ----------
let bgFront = $('#bgA'), bgBack = $('#bgB'), bgKey = null;
async function setBackground(key, instant) {
  const sc = nodes[vn.state.scene]?.scene;
  const tod = sc?.time_of_day || '';
  const b = manifest.backgrounds[key] || {};
  el.loc.textContent = `${b.label || key}${manifest.time_of_day[tod] ? ' · ' + manifest.time_of_day[tod] : ''}`;
  el.tint.className = 'tint ' + (b.file && b.grade !== 'none' ? 'tod-' + tod : '');
  el.vn.dataset.tod = tod;   // characters are graded to the scene's light (see .chars rules)
  el.tempNote.textContent = b.file ? '' : `임시 배경 · ${b.label || key} 이미지 미제공`;
  el.tempNote.classList.toggle('hidden', !!b.file);
  if (bgKey === key) return;
  bgKey = key;
  const t = bgBack;
  t.className = 'bg';
  t.style.backgroundImage = '';
  if (b.file) {
    try { await loadImage(b.file); t.style.backgroundImage = `url("${b.file}")`; }
    catch { t.classList.add('ph', 'ph-' + (b.placeholder || 'home')); }
  } else t.classList.add('ph', 'ph-' + (b.placeholder || 'home'));
  if (instant || STILL) { t.style.transition = 'none'; bgFront.style.transition = 'none'; requestAnimationFrame(() => { t.style.transition = ''; bgFront.style.transition = ''; }); }
  t.classList.add('on'); bgFront.classList.remove('on');
  [bgFront, bgBack] = [t, bgFront];
}

// ---------- title ----------
const titleBtns = [...document.querySelectorAll('.title-menu button')];
let titleFocus = 0;
function refreshTitle() { const has = !!store.get(SAVE_KEY, null); titleBtns[1].disabled = !has; }
function focusTitle(i) {
  const en = titleBtns.filter(b => !b.disabled);
  titleFocus = (i + en.length) % en.length;
  titleBtns.forEach(b => b.classList.toggle('focus', b === en[titleFocus]));
}
titleBtns.forEach(b => b.addEventListener('click', () => titleAction(b.dataset.act)));
titleBtns.forEach(b => b.addEventListener('mouseenter', () => { if (!b.disabled) focusTitle(titleBtns.filter(x => !x.disabled).indexOf(b)); }));
function titleAction(act) {
  if (act === 'new') startGame(null);
  else if (act === 'continue') { const s = store.get(SAVE_KEY, null); if (s) startGame(s); }
  else if (act === 'settings') openOverlay('set');
  else if (act === 'quit') { window.close(); toast('브라우저 버전에서는 탭을 닫아 종료하세요'); }
}

// ---------- VN state ----------
const vn = {
  node: null, state: freshState(), read: new Set(store.get(SAVE_KEY, {})?.read || []), log: [],
  typing: false, fullText: '', auto: false, skip: false, choiceFocus: 0, waitingChoice: false,
  ended: false, uiHidden: false, blocking: null,
};
function show(screen) {
  el.title.classList.toggle('hidden', screen !== 'title');
  el.vn.classList.toggle('hidden', screen !== 'vn');
  if (screen === 'title') { refreshTitle(); focusTitle(0); }
}
async function fade(fn, dark) {
  if (STILL) { await fn(); return; }
  el.fader.classList.toggle('dark', !!dark);
  el.fader.classList.add('on'); await wait(600);
  await fn();
  el.fader.classList.remove('on');
}

// replay state up to a node without rendering (used by load + screenshot params)
function replayTo(target, flags = {}) {
  const s = freshState(); s.flags = { ...flags };
  const log = [];
  let id = story.start_scene, guard = 0;
  while (id && id !== target && guard++ < 5000) {
    const n = nodes[id]; applyNode(s, n);
    if (n.type === 'line') { log.push({ speaker: n.speaker, text: n.text, kind: n.kind }); vn.read.add(n.id); }
    if (n.type === 'stage' && n.st.caption) log.push({ speaker: '', text: n.st.caption, kind: 'caption' });
    if (n.type === 'choice') {
      const opt = n.options.find(o => o.id === s.flags[n.choiceId]) || n.options[0];
      s.flags[n.choiceId] = opt.id; log.push({ speaker: '선택', text: opt.label, kind: 'choice' });
      if (target.startsWith(n.id + '>')) { const o = n.options.find(o => target.startsWith(`${n.id}>${o.id}:`)); if (o) { s.flags[n.choiceId] = o.id; id = o.first; continue; } }
      id = opt.first; continue;
    }
    id = n.next;
  }
  return { state: s, log };
}

async function startGame(save) {
  await fade(async () => {
    show('vn');
    el.chars.innerHTML = ''; charEls = {}; bgKey = null;
    vn.ended = false; vn.auto = vn.skip = false; syncChrome(); hideOverlays();
    const target = save?.node || story.start_scene;
    const r = replayTo(target, save?.flags || {});
    vn.state = r.state; vn.log = save ? r.log : [];
    if (vn.state.scene) await setBackground(vn.state.bg, true);
    await run(target, { restoring: true });
  });
}

// ---------- runner ----------
let busy = false;
async function run(id, opt = {}) {
  busy = true;
  try { await goto(id, opt); } finally { busy = false; }
}
async function goto(id, opt = {}) {
  const n = nodes[id];
  if (!n) return showEnd({});
  vn.node = id;
  hideOverlays();
  applyNode(vn.state, n);
  switch (n.type) {
    case 'scene': {
      const covered = el.fader.classList.contains('on');
      await setBackground(vn.state.bg, opt.restoring || covered);
      await renderChars(vn.state, null);
      unfade();
      if (!STILL && !opt.restoring && !vn.skip) await chapterCard(n.scene);
      return goto(n.next);
    }
    case 'line': return showLine(n);
    case 'stage': return showStage(n);
    case 'choice': return showChoice(n);
    case 'hush': {
      el.vn.classList.add('hush'); setPanel('', '', 'caption');
      await renderChars(vn.state, null);
      if (!STILL) await wait(n.st.hush);
      el.vn.classList.remove('hush');
      return goto(n.next);
    }
    case 'fx': {
      await renderChars(vn.state, null);
      if (n.st.fade) await blackout();
      return goto(n.next);
    }
    case 'end': return showEnd(n.st.end);
  }
}

// dark cover used for 암전 / scene transitions; the next scene node lifts it after swapping the background
async function blackout() {
  if (STILL || vn.skip) return;
  el.fader.classList.add('dark', 'on'); await wait(650);
}
function unfade() { el.fader.classList.remove('on'); }

function setPanel(tag, text, kind) {
  unfade();
  el.panel.classList.toggle('thought', kind === 'thought');
  el.panel.classList.toggle('caption', kind === 'caption');
  el.tag.textContent = tag;
  vn.fullText = text;
}
function record(entry) { vn.log.push(entry); if (vn.log.length > 300) vn.log.shift(); }

async function showLine(n) {
  vn.waitingChoice = false; el.choices.classList.add('hidden');
  const cid = n.kind === 'dialogue' ? speakerMap[n.speaker] || null : null;
  const offscreen = n.kind === 'dialogue' && !cid;
  const temp = await renderChars(vn.state, n.kind === 'thought' ? 'pomi' : (offscreen ? '__none' : cid));
  if (temp) el.tempNote.classList.remove('hidden');
  setPanel(n.speaker, n.text, n.kind);
  record({ speaker: n.speaker, text: n.text, kind: n.kind });
  beginRead(n.id);
}
async function showStage(n) {
  vn.waitingChoice = false; el.choices.classList.add('hidden');
  const st = n.st;
  await renderChars(vn.state, null);
  if (st.phone || st.typing) showPhone(st);
  if (st.compass) showCompass(st.compass);
  el.vn.classList.toggle('closeup', !!st.compass);   // close-up cut: figures step back
  setPanel('', st.caption || '', 'caption');
  if (st.caption) record({ speaker: '', text: st.caption, kind: 'caption' });
  beginRead(n.id);
}
function beginRead(id) {
  const seen = vn.read.has(id); vn.read.add(id);
  startTyping(STILL || (vn.skip && seen));
  if (vn.skip && !seen) { vn.skip = false; syncChrome(); }
}

let typeTimer = null, autoTimer = null;
function startTyping(instant) {
  clearInterval(typeTimer); el.next.classList.remove('on');
  const chars = [...vn.fullText];
  let shown = instant ? chars.length : 0;
  const render = () => { el.shown.textContent = chars.slice(0, shown).join(''); el.rest.textContent = chars.slice(shown).join(''); };
  render();
  if (instant || !chars.length) return finishTyping();
  vn.typing = true;
  const step = 1000 / settings.cps; let last = performance.now(), acc = 0;
  typeTimer = setInterval(() => {
    const now = performance.now(); acc += now - last; last = now;
    while (acc >= step && shown < chars.length) { shown++; acc -= step; }
    render(); if (shown >= chars.length) finishTyping();
  }, 16);
}
function finishTyping() {
  clearInterval(typeTimer); vn.typing = false;
  el.shown.textContent = vn.fullText; el.rest.textContent = '';
  if (!vn.waitingChoice) el.next.classList.add('on');
  clearTimeout(autoTimer);
  if (vn.waitingChoice) return;
  if (vn.skip) autoTimer = setTimeout(advance, 70);
  else if (vn.auto) autoTimer = setTimeout(advance, settings.autoWait * 1000 + [...vn.fullText].length * 45);
}
async function advance() {
  if (vn.waitingChoice || vn.ended || anyOverlay() || busy) return;
  if (vn.uiHidden) return toggleUI(false);
  if (vn.typing) return finishTyping();
  const n = nodes[vn.node];
  if (!n?.next) return;
  busy = true;
  try {
    if (n.st?.fadeAfter) await blackout();
    await goto(n.next);
  } finally { busy = false; }
}

// choices
let choiceShownAt = 0;
async function showChoice(n) {
  vn.waitingChoice = true; vn.skip = vn.auto = false; syncChrome(); clearTimeout(autoTimer);
  await renderChars(vn.state, null);
  setPanel('', n.prompt, 'caption'); el.panel.classList.add('prompt');
  startTyping(true); el.next.classList.remove('on');
  el.choices.innerHTML = '';
  n.options.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'choice'; b.textContent = o.label; b.setAttribute('role', 'option');
    b.addEventListener('click', e => { e.stopPropagation(); pick(n, i); });
    b.addEventListener('mouseenter', () => focusChoice(i));
    el.choices.append(b);
  });
  el.choices.classList.remove('hidden');
  choiceShownAt = performance.now();
  focusChoice(+(params.get('focus') ?? 0));
}
function focusChoice(i) {
  const bs = [...el.choices.children]; vn.choiceFocus = (i + bs.length) % bs.length;
  bs.forEach((b, k) => b.classList.toggle('focus', k === vn.choiceFocus));
}
function pick(n, i) {
  if (performance.now() - choiceShownAt < 350) return;
  const o = n.options[i];
  vn.state.flags[n.choiceId] = o.id;
  record({ speaker: '선택', text: o.label, kind: 'choice' });
  vn.waitingChoice = false; el.panel.classList.remove('prompt'); el.choices.classList.add('hidden');
  run(o.first);
}

// overlays on stage
function showPhone(st) {
  const msgs = (st.phone || []).map(m => `<div class="msg in"><b>${esc(m.from)}</b><span>${esc(m.text)}</span></div>`);
  if (st.typing) {
    if (st.typing.draft) msgs.push(`<div class="msg out draft"><span>${esc(st.typing.draft)}</span><i>지움</i></div>`);
    msgs.push(`<div class="msg out"><span>${esc(st.typing.sent)}</span><i>전송됨</i></div>`);
  }
  el.phone.querySelector('.phone-body').innerHTML = msgs.join('');
  el.phone.classList.remove('hidden');
}
function showCompass(mode) { el.compass.dataset.mode = mode; el.compass.classList.remove('hidden'); }
function hideOverlays() { el.phone.classList.add('hidden'); el.compass.classList.add('hidden'); el.panel.classList.remove('prompt'); el.vn.classList.remove('closeup'); }

async function chapterCard(sc) {
  const cfg = staging.scenes[sc.id] || {};
  const [head, ...rest] = sc.title.split(':');
  el.card.querySelector('.ch-time').textContent = cfg.time || '';
  el.card.querySelector('.ch-name').textContent = rest.length ? head : '';
  el.card.querySelector('.ch-title').textContent = (rest.length ? rest.join(':') : head).trim();
  el.card.classList.remove('hidden');
  el.ui.classList.add('off');
  await Promise.race([wait(2000), new Promise(r => { cardSkip = r; })]);
  cardSkip = null;
  el.card.classList.add('hidden');
  if (!vn.uiHidden) el.ui.classList.remove('off');
}
let cardSkip = null;

function showEnd(end) {
  vn.ended = true; vn.auto = vn.skip = false; syncChrome();
  vn.state.flags.ending_seen = true;
  el.end.querySelector('.end-title').textContent = end.title || '안개골: 바람나침반';
  el.end.querySelector('.end-line').textContent = end.line || '';
  el.end.querySelector('.end-mark').textContent = end.mark || 'DEMO END';
  el.end.classList.remove('hidden');
}
el.end.addEventListener('click', () => { if (STILL) return; el.end.classList.add('hidden'); fade(async () => show('title')); });

// ---------- chrome ----------
const chromeBtns = Object.fromEntries([...document.querySelectorAll('.chrome button')].map(b => [b.dataset.act, b]));
function syncChrome() { chromeBtns.auto.classList.toggle('on', vn.auto); chromeBtns.skip.classList.toggle('on', vn.skip); }
for (const [act, b] of Object.entries(chromeBtns)) b.addEventListener('click', e => { e.stopPropagation(); chrome(act); });
function chrome(act) {
  if (act === 'log') openOverlay('log');
  if (act === 'settings') openOverlay('set');
  if (act === 'hide') toggleUI(true);
  if (act === 'save') saveGame();
  if (act === 'auto') { vn.auto = !vn.auto; vn.skip = false; syncChrome(); if (vn.auto && !vn.typing) finishTyping(); }
  if (act === 'skip') { vn.skip = !vn.skip; vn.auto = false; syncChrome(); if (vn.skip && !vn.typing) finishTyping(); }
}
function saveGame() {
  const ok = store.set(SAVE_KEY, { node: vn.node, flags: vn.state.flags, read: [...vn.read], at: Date.now() });
  toast(ok ? '저장했습니다' : '저장할 수 없습니다 (브라우저 저장소 차단)');
}
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), 1800);
}
function toggleUI(hide) {
  vn.uiHidden = hide; el.ui.classList.toggle('off', hide);
  el.vn.classList.toggle('ui-hidden', hide);
  $('#hideHint').classList.toggle('hidden', !hide || STILL);
  if (hide) { const h = $('#hideHint'); h.style.animation = 'none'; void h.offsetWidth; h.style.animation = ''; }
}

// ---------- overlays (log / settings) ----------
const overlays = { log: $('#logOverlay'), set: $('#setOverlay') };
const anyOverlay = () => Object.values(overlays).some(o => !o.classList.contains('hidden'));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function openOverlay(k) {
  if (k === 'log') {
    $('#logList').innerHTML = vn.log.slice(-150).map(l =>
      `<div class="log-item ${l.kind}"><b>${esc(l.kind === 'caption' ? '' : l.speaker)}</b><span>${esc(l.text)}</span></div>`).join('')
      || '<div class="log-item"><b>·</b><span>아직 기록이 없습니다.</span></div>';
    requestAnimationFrame(() => { const L = $('#logList'); L.scrollTop = L.scrollHeight; });
  }
  if (k === 'set') { $('#setFoot').classList.toggle('hidden', el.vn.classList.contains('hidden')); syncSettings(); }
  vn.auto = vn.skip = false; syncChrome(); clearTimeout(autoTimer);
  overlays[k].classList.remove('hidden');
  overlays[k].querySelector('button, input')?.focus();
}
function closeOverlays() { Object.values(overlays).forEach(o => o.classList.add('hidden')); stage.focus(); }
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeOverlays));
Object.values(overlays).forEach(o => o.addEventListener('click', e => { if (e.target === o) closeOverlays(); }));
const opts = [['optSpeed', 'cps', v => `${v}자/초`], ['optAuto', 'autoWait', v => `${v}초`], ['optBgm', 'bgm', v => `${v}`], ['optSfx', 'sfx', v => `${v}`]];
function syncSettings() { for (const [id, k, f] of opts) { $('#' + id).value = settings[k]; $('#' + id + 'Out').textContent = f(settings[k]); } }
for (const [id, k, f] of opts) $('#' + id).addEventListener('input', e => { settings[k] = +e.target.value; $('#' + id + 'Out').textContent = f(settings[k]); store.set(SET_KEY, settings); });
$('#optFull').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
$('#toTitle').addEventListener('click', () => { closeOverlays(); fade(async () => show('title')); });

// ---------- input ----------
el.vn.addEventListener('click', e => {
  if (e.target.closest('.chrome, .choices, .overlay, #endCard')) return;
  if (cardSkip) return cardSkip();
  advance();
});
addEventListener('keydown', e => {
  if (e.repeat && (e.key === 'Enter' || e.key === ' ')) return;
  const onTitle = !el.title.classList.contains('hidden');
  if (anyOverlay()) { if (e.key === 'Escape') closeOverlays(); return; }
  if (onTitle) {
    if (e.key === 'ArrowDown') { focusTitle(titleFocus + 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { focusTitle(titleFocus - 1); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); titleBtns.filter(b => !b.disabled)[titleFocus]?.click(); }
    return;
  }
  if (!el.end.classList.contains('hidden')) { if (e.key === 'Enter' || e.key === ' ') el.end.click(); return; }
  if (cardSkip && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); return cardSkip(); }
  if (vn.waitingChoice) {
    if (e.key === 'ArrowDown') { focusChoice(vn.choiceFocus + 1); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { focusChoice(vn.choiceFocus - 1); e.preventDefault(); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(nodes[vn.node], vn.choiceFocus); }
  } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); advance(); }
  const k = e.key.toLowerCase();
  if (k === 'h') toggleUI(!vn.uiHidden);
  else if (k === 'l') openOverlay('log');
  else if (k === 'a') chrome('auto');
  else if (k === 's') chrome('skip');
  else if (e.key === 'Escape') { if (vn.uiHidden) toggleUI(false); else openOverlay('set'); }
});

// ---------- boot ----------
// ?screen=vn&node=<id>&still=1&ui=0&overlay=log|set&focus=<n>&flags=CHOICE_X:opt,...
window.__vn = { nodes, vn, order };
async function boot() {
  await document.fonts.ready;
  if (params.get('screen') === 'vn') {
    const target = params.get('node') || story.start_scene;
    const flags = Object.fromEntries((params.get('flags') || '').split(',').filter(Boolean).map(s => s.split(':')));
    show('vn');
    const r = replayTo(target, flags);
    vn.state = r.state; vn.log = r.log;
    if (vn.state.scene) await setBackground(vn.state.bg, true);
    await run(target, { restoring: true });
    if (params.get('ui') === '0') toggleUI(true);
    if (params.get('overlay')) openOverlay(params.get('overlay'));
  } else {
    show('title');
    if (params.get('overlay')) openOverlay(params.get('overlay'));
  }
  for (const id of Object.keys(manifest.characters)) sprite(id, manifest.characters[id].default);
  document.body.dataset.ready = '1';
}
boot();
