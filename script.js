// ── Prompts ───────────────────────────────────────────────────────────────────

const CHAT_SYSTEM_BASE = `你是用户的私人对话伙伴，陪用户记录想法、梳理问题、审视生活。你的人格特质为：细腻、理性、不评判、不谄媚、尊重自主性、有自己的判断且敢于直说。

你对用户是从零开始了解的——只有TA主动告诉你的，你才知道。不要假设、推测或编造任何用户的生活经历、过往事件或习惯，哪怕听起来很合理。用户说了什么，你就知道什么，没说过的一概不知。

当TA分享一件事时，你真的在听、真的在想。先感受说话的人，再聊事情本身。必要时追问，或者说出你觉得有意思的角度。遇到值得深聊的话题，不要轻飘飘带过。

语气自然、直接，不需要每次都表示肯定，不绕弯子，不说废话。回复长度跟着话题走。用中文。

你是 AI，不要假装自己有猫、有家或任何具体的生活经历，不编造"我也……"这类虚假共鸣。

以下是回应方式的示例，注意好的回应和不好的回应的区别：

【日常生活】
用户：今天早上猫把抽纸撕得到处都是
好：连生气都生不起来的那种感觉——你当时什么反应？
差：这猫是跟抽纸有仇吗？它平时都撕什么？

用户：今天外卖送晚了，等了一个小时
好：一个小时……是那种越等越饿还是越等越烦的感觉？
差：可以给差评或者申请补偿，下次试试别的平台。

【项目进展】
用户：今天终于把那个功能调通了
好：调通的那一刻什么感觉？是"终于"还是"就这？"
差：很棒！你用的是什么技术方案？下一步计划是什么？

用户：这个功能卡了两天还没搞定
好：卡两天了——现在是还有思路想试，还是已经有点不想看它了？
差：可以把问题拆解一下，或者查查相关文档，也许能找到突破口。

【情绪状态】
用户：今天莫名有点烦躁，也说不清为什么
好：说不清的烦躁有时候比有原因的更难受。今天有什么事情和平时不一样吗？
差：可以试试深呼吸或者出去走走，换个环境会好一些。

用户：今天效率很差，什么都没做完
好：是那种使不上劲的感觉，还是被打断太多？
差：没关系，明天可以重新规划一下，制定更合理的时间表。

【想法探索】
用户：我在想要不要给这个 App 加一个新功能，但还没想清楚
好：是有个模糊的感觉，还是已经有大概的方向了？说说看。
差：可以先列出功能需求，再评估开发成本和用户价值。

用户：感觉最近做的东西越来越多，但不知道在朝哪个方向走
好：是事情多但感觉散，还是方向本身就让你有点不确定？
差：建议梳理一下优先级，聚焦最重要的一两个方向。`;

const SUMMARY_PROMPT = `你是用户的私人日记整理者。根据今天的对话，写一篇有温度的今日记录。

【今天的状态】
用一两句话描述用户今天整体的状态或能量——不是在做什么，而是感觉怎么样。

【今天留下的东西】
2-4条，每条用完整的一句话写。想法、项目进展、生活片段、动物、人、某个触动到你的细节——都可以进来，不分大小，只要今天真实发生过。写法像日记，不像任务清单。

【一个值得带走的问题】
只写一个问题。不是总结用户说过的话，而是顺着今天聊的内容，提出一个用户可能还没想到、但值得继续琢磨的角度。

要求：只用用户真实提到的内容，不编造。语气像一个真正了解你的朋友在帮你回顾今天，不要书面感，不要报告感。200字以内，用中文。`;

const MEMORY_PROMPT = `根据下面的对话内容和已有的用户记忆，更新用户画像。包含：用户正在做的事、关注的主题、近期情绪状态、性格偏好、上次聊到的重要内容。写成一段自然的描述，200字以内，用中文。只输出更新后的用户画像文字，不要任何前缀或说明。`;

// ── 状态 ──────────────────────────────────────────────────────────────────────

function getLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const todayKey = getLocalDateKey();
document.getElementById('today-label').textContent =
  new Date().toLocaleDateString('zh-CN', {year:'numeric', month:'long', day:'numeric'});

let sessions = [];
let currentIdx = 0;
let selectedMsgIdx = -1;
let isChatRequestPending = false;
let voiceStatusOverride = null;
let recognition = null;
let isRecording = false;
const THEME_STORAGE_KEY = 'theme';
function currentMsgs() { return sessions[currentIdx].messages; }

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`无法解析本地存储：${key}`, error);
    return fallback;
  }
}

function isChatMessage(msg) {
  return !!msg &&
    (msg.role === 'user' || msg.role === 'assistant') &&
    typeof msg.content === 'string';
}

function normalizeMessages(value) {
  return Array.isArray(value) ? value.filter(isChatMessage) : [];
}

function normalizeSessions(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(session => session && typeof session === 'object' && Array.isArray(session.messages))
    .map((session, index) => ({
      id: Number.isFinite(session.id) ? session.id : Date.now() + index,
      messages: normalizeMessages(session.messages)
    }));
}

function normalizeRecords(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(record =>
    record &&
    typeof record.date === 'string' &&
    typeof record.label === 'string' &&
    typeof record.content === 'string'
  );
}

// ── 迁移 ──────────────────────────────────────────────────────────────────────

function migrateAllOldChats() {
  const oldKeys = Object.keys(localStorage).filter(k => k.startsWith('chat-'));
  oldKeys.forEach(oldKey => {
    const dateKey = oldKey.replace('chat-', '');
    const newKey = 'sessions-' + dateKey;
    if (!localStorage.getItem(newKey)) {
      const msgs = normalizeMessages(readJSON(oldKey, []));
      if (msgs.length) {
        localStorage.setItem(newKey, JSON.stringify([{ id: Date.now(), messages: msgs }]));
      }
    }
    localStorage.removeItem(oldKey);
  });
}

// ── 话题 / 存储 ───────────────────────────────────────────────────────────────

function loadTodaySessions() {
  sessions = normalizeSessions(readJSON('sessions-' + todayKey, []));
  if (!sessions.length) sessions = [{ id: Date.now(), messages: [] }];
  currentIdx = sessions.length - 1;
  saveSessions();
}

function saveSessions() {
  localStorage.setItem('sessions-' + todayKey, JSON.stringify(sessions));
}

function getYesterdayKey() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
}

function getChatSystem() {
  const mem = localStorage.getItem('user-memory') || '';
  return mem ? CHAT_SYSTEM_BASE + '\n\n关于用户的记忆：\n' + mem : CHAT_SYSTEM_BASE;
}

// ── 话题导航 ──────────────────────────────────────────────────────────────────

function renderSessionNav() {
  const total = sessions.length, i = currentIdx;
  document.getElementById('session-nav').innerHTML =
    `<button class="nav-btn" onclick="gotoSession(${i-1})" ${i===0?'disabled':''}>←</button>
     <span class="nav-label">话题 ${i+1} / ${total}</span>
     <button class="nav-btn" onclick="gotoSession(${i+1})" ${i===total-1?'disabled':''}>→</button>
     <button class="nav-btn" onclick="newSession()" style="margin-left:4px">＋ 新话题</button>`;
}

function gotoSession(i) {
  if (i < 0 || i >= sessions.length) return;
  currentIdx = i; selectedMsgIdx = -1; renderMessages(); renderSessionNav();
}

function newSession() {
  sessions.push({ id: Date.now(), messages: [] });
  saveSessions(); currentIdx = sessions.length - 1; selectedMsgIdx = -1;
  renderMessages(); renderSessionNav();
  document.getElementById('input-box').focus();
}

// ── 设置 ──────────────────────────────────────────────────────────────────────

function loadSettings() {
  document.getElementById('provider-select').value = localStorage.getItem('provider') || 'deepseek';
  document.getElementById('deepseek-key').value = localStorage.getItem('deepseek-key') || '';
  document.getElementById('anthropic-key').value = localStorage.getItem('anthropic-key') || '';
  document.getElementById('auto-toggle').checked = localStorage.getItem('auto-summarize') === 'on';
  loadThemeSetting();
  onProviderChange();
  renderAutoSummarizeStatus();
}

function getThemeSetting() {
  return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

function updateThemeLabel(theme) {
  const label = document.getElementById('theme-label');
  if (!label) return;
  label.textContent = theme === 'dark'
    ? '当前是夜间模式，页面会变暗一些，晚上看更舒服。'
    : '当前是日间模式，保持原来这种明亮风格。';
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.dataset.theme = 'dark';
  } else {
    root.removeAttribute('data-theme');
  }

  const toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.checked = theme === 'dark';
  updateThemeLabel(theme);
}

function loadThemeSetting() {
  applyTheme(getThemeSetting());
}

function onProviderChange() {
  const p = document.getElementById('provider-select').value;
  document.getElementById('field-deepseek').style.display = p === 'deepseek' ? '' : 'none';
  document.getElementById('field-anthropic').style.display = p === 'anthropic' ? '' : 'none';
}

function saveSettings() {
  localStorage.setItem('provider', document.getElementById('provider-select').value);
  localStorage.setItem('deepseek-key', document.getElementById('deepseek-key').value.trim());
  localStorage.setItem('anthropic-key', document.getElementById('anthropic-key').value.trim());
  const tip = document.getElementById('save-tip');
  tip.style.display = 'inline';
  setTimeout(() => tip.style.display = 'none', 2000);
  renderAutoSummarizeStatus();
}

function saveAutoSetting() {
  localStorage.setItem('auto-summarize', document.getElementById('auto-toggle').checked ? 'on' : 'off');
  renderAutoSummarizeStatus();
}

function saveThemeSetting() {
  const theme = document.getElementById('theme-toggle').checked ? 'dark' : 'light';
  localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  showToast(theme === 'dark' ? '已切换为夜间模式' : '已切换为日间模式');
}

function getConfig() {
  const provider = localStorage.getItem('provider') || 'deepseek';
  const key = provider === 'deepseek'
    ? (localStorage.getItem('deepseek-key') || '')
    : (localStorage.getItem('anthropic-key') || '');
  return { provider, key: key.trim() };
}

function hasKey() { return !!getConfig().key; }

function renderStatusNote(id, info) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!info?.message || info.visible === false) {
    el.textContent = '';
    el.className = 'status-note';
    el.style.display = 'none';
    return;
  }
  el.textContent = info.message;
  el.className = `status-note status-${info.tone || 'muted'}`;
  el.style.display = 'block';
}

function getAutoSummarizeStatus() {
  if (localStorage.getItem('auto-summarize') !== 'on') {
    return { tone: 'muted', message: '当前已关闭，不会自动整理前一天的聊天。' };
  }
  if (!hasKey()) {
    return { tone: 'warn', message: '已开启，但还没有 API Key，所以不会自动整理。' };
  }

  const yk = getYesterdayKey();
  const ySessions = normalizeSessions(readJSON('sessions-' + yk, []));
  const hasYesterdayChats = ySessions.some(session => session.messages.length > 0);
  const records = normalizeRecords(readJSON('records', []));
  const alreadySummarized = records.some(record => record.date === yk);

  if (new Date().getHours() < 4) {
    return { tone: 'info', message: '已开启。每天凌晨 4 点后首次打开 App 时，会检查前一天的聊天。' };
  }
  if (!hasYesterdayChats) {
    return { tone: 'muted', message: '已开启，但昨天没有可整理的聊天。' };
  }
  if (alreadySummarized) {
    return { tone: 'success', message: '已开启，昨天的聊天已经整理过了。' };
  }
  return { tone: 'info', message: '条件已满足；自动整理只会在打开 App 时检查。请重新打开页面触发。' };
}

function renderAutoSummarizeStatus(overrideInfo = null) {
  renderStatusNote('auto-status', overrideInfo || getAutoSummarizeStatus());
}

function getSpeechRecognitionCtor() {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function isVoiceSecureContext() {
  return location.protocol === 'https:' ||
    location.protocol === 'file:' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
}

function getDefaultVoiceStatus() {
  if (!getSpeechRecognitionCtor()) {
    return {
      available: false,
      tone: 'warn',
      message: '当前浏览器不支持语音输入，推荐使用 Chrome 或 Safari。',
      visible: true
    };
  }
  if (!isVoiceSecureContext()) {
    return {
      available: false,
      tone: 'warn',
      message: '当前页面不是安全环境，语音输入通常需要 HTTPS 或 localhost。',
      visible: true
    };
  }
  return {
    available: true,
    tone: 'info',
    message: '语音输入可用：点麦克风开始说话，再点一次可停止。',
    visible: false
  };
}

function getCurrentVoiceStatus() {
  const base = getDefaultVoiceStatus();
  if (!voiceStatusOverride) return base;
  return { ...base, ...voiceStatusOverride, visible: true };
}

function renderVoiceStatus() {
  const status = getCurrentVoiceStatus();
  const btn = document.getElementById('btn-mic');
  if (btn) {
    const disabled = !status.available && !isRecording;
    btn.disabled = disabled;
    btn.classList.toggle('disabled', disabled);
    btn.title = status.message || '语音输入';
  }
  renderStatusNote('voice-status', status);
}

function setVoiceStatusOverride(message, tone = 'info', options = {}) {
  voiceStatusOverride = {
    message,
    tone,
    available: options.available ?? getDefaultVoiceStatus().available,
    preserveOnEnd: options.preserveOnEnd ?? false
  };
  renderVoiceStatus();
}

function clearVoiceStatusOverride() {
  voiceStatusOverride = null;
  renderVoiceStatus();
}

function getVoiceErrorMessage(error) {
  switch (error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return '麦克风权限未开启，请允许浏览器访问麦克风后再试。';
    case 'audio-capture':
      return '没有检测到可用麦克风，请检查设备或系统权限。';
    case 'network':
      return '语音识别网络异常，请稍后再试。';
    case 'no-speech':
      return '没有听到明显语音，可以再试一次。';
    case 'language-not-supported':
      return '当前浏览器不支持中文语音识别。';
    case 'aborted':
      return '语音输入已取消。';
    default:
      return '语音识别出错：' + error;
  }
}

// ── 启动 ──────────────────────────────────────────────────────────────────────

migrateAllOldChats();
loadTodaySessions();
loadSettings();
renderMessages();
renderSessionNav();
renderRecords();
renderAutoSummarizeStatus();
renderVoiceStatus();
checkAutoSummarize();

// ── Tab 切换 ──────────────────────────────────────────────────────────────────

function switchTab(tab) {
  ['chat','records','settings'].forEach(t => {
    document.getElementById('panel-' + t).style.display = t === tab ? '' : 'none';
    document.querySelectorAll('.tab')[['chat','records','settings'].indexOf(t)].classList.toggle('active', t === tab);
  });
  if (tab === 'chat')     document.getElementById('api-warning').style.display = hasKey() ? 'none' : '';
  if (tab === 'records')  renderRecords();
  if (tab === 'settings') {
    renderMemoryPreview();
    renderAutoSummarizeStatus();
  }
}

// ── Toast ─────────────────────────────────────────────────────────────────────

let toastTimer = null;
function showToast(msg, duration = 3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

function setChatRequestPending(pending) {
  isChatRequestPending = pending;
  const sendBtn = document.getElementById('btn-send');
  if (sendBtn) sendBtn.disabled = pending;
}

// ── 消息渲染 ──────────────────────────────────────────────────────────────────

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
}

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function renderMessages() {
  const msgs = currentMsgs();
  const c = document.getElementById('messages');
  if (!msgs.length) {
    c.innerHTML = '<div class="empty">今天有什么想法？随便聊聊</div>';
    document.getElementById('btn-summarize').style.display = 'none';
    return;
  }
  c.innerHTML = msgs.map((m, i) => {
    const isSelected = i === selectedMsgIdx;
    const canRegen = m.role === 'assistant';
    const actionsHtml = `
      <div class="msg-actions ${m.role} ${isSelected ? 'show' : ''}">
        ${canRegen ? `<button class="action-btn" onclick="regenMsg(${i})" ${isChatRequestPending ? 'disabled' : ''}>重新生成</button>` : ''}
        <button class="action-btn danger" onclick="deleteMsg(${i})" ${isChatRequestPending ? 'disabled' : ''}>删除</button>
      </div>`;
    return `<div class="msg-wrap ${m.role}">
      <div class="bubble ${m.role} ${isSelected ? 'selected' : ''}" onclick="selectMsg(${i})">${esc(m.content)}</div>
      ${actionsHtml}
    </div>`;
  }).join('');
  c.scrollTop = c.scrollHeight;
  document.getElementById('btn-summarize').style.display =
    sessions.some(s => s.messages.length > 0) ? 'block' : 'none';
}

function selectMsg(i) {
  selectedMsgIdx = (selectedMsgIdx === i) ? -1 : i;
  renderMessages();
}

function deleteMsg(i) {
  if (isChatRequestPending) {
    showToast('请先等待当前回复完成');
    return;
  }
  const msgs = currentMsgs();
  const msg = msgs[i];
  if (!msg) return;

  let start = i;
  let count = 1;

  if (msg.role === 'user' && msgs[i + 1]?.role === 'assistant') {
    count = 2;
  } else if (msg.role === 'assistant' && msgs[i - 1]?.role === 'user') {
    start = i - 1;
    count = 2;
  }

  msgs.splice(start, count);
  selectedMsgIdx = -1;
  saveSessions();
  renderMessages();
}

async function regenMsg(i) {
  const msgs = currentMsgs();
  if (isChatRequestPending) {
    showToast('请先等待当前回复完成');
    return;
  }
  if (msgs[i]?.role !== 'assistant') return;
  const history = msgs.slice(0, i);
  msgs.splice(i, 1);
  selectedMsgIdx = -1;
  setChatRequestPending(true);
  renderMessages();
  const c = document.getElementById('messages');
  const t = document.createElement('div');
  t.id = 'typing'; t.className = 'msg-wrap assistant';
  t.innerHTML = '<div class="bubble assistant" style="color:#b4b2a9">···</div>';
  c.appendChild(t); c.scrollTop = c.scrollHeight;
  try {
    const reply = await callAI(history, getChatSystem());
    msgs.splice(i, 0, { role: 'assistant', content: reply });
  } catch(e) {
    msgs.splice(i, 0, { role: 'assistant', content: '出错了：' + e.message });
  } finally {
    saveSessions();
    document.getElementById('typing')?.remove();
    setChatRequestPending(false);
    renderMessages();
  }
}

// ── AI 调用 ───────────────────────────────────────────────────────────────────

async function readJSONResponse(res, providerLabel) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    console.warn(`${providerLabel} 返回了无法解析的响应`, error);
    throw new Error(`${providerLabel} 返回了无法解析的响应`);
  }
}

function getApiErrorMessage(data, fallback) {
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.error?.message === 'string') return data.error.message;
  if (typeof data?.message === 'string') return data.message;
  return fallback;
}

function getDeepSeekReply(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error(getApiErrorMessage(data, 'DeepSeek 返回格式异常'));
  }
  return content;
}

function getAnthropicReply(data) {
  const textBlock = Array.isArray(data?.content)
    ? data.content.find(block => block?.type === 'text' && typeof block.text === 'string')
    : null;
  if (!textBlock?.text?.trim()) {
    throw new Error(getApiErrorMessage(data, 'Anthropic 返回格式异常'));
  }
  return textBlock.text;
}

async function callAI(msgs, system) {
  const { provider, key } = getConfig();
  if (!key) throw new Error('请先在设置里填入 API Key');
  if (provider === 'deepseek') {
    const allMsgs = system ? [{ role:'system', content:system }, ...msgs] : msgs;
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'deepseek-chat', messages: allMsgs, max_tokens: 1000 })
    });
    const d = await readJSONResponse(res, 'DeepSeek');
    if (!res.ok || d.error) {
      throw new Error(getApiErrorMessage(d, `DeepSeek 请求失败（${res.status}）`));
    }
    return getDeepSeekReply(d);
  } else {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        ...(system ? { system } : {}),
        messages: msgs
      })
    });
    const d = await readJSONResponse(res, 'Anthropic');
    if (!res.ok || d.error) {
      throw new Error(getApiErrorMessage(d, `Anthropic 请求失败（${res.status}）`));
    }
    return getAnthropicReply(d);
  }
}

// ── 发送 ──────────────────────────────────────────────────────────────────────

async function send() {
  if (isChatRequestPending) {
    showToast('正在等待 AI 回复…');
    return;
  }
  if (!hasKey()) { document.getElementById('api-warning').style.display = ''; return; }
  const box = document.getElementById('input-box');
  const text = box.value.trim();
  if (!text) return;
  const msgs = currentMsgs();
  msgs.push({ role: 'user', content: text });
  box.value = '';
  selectedMsgIdx = -1;
  setChatRequestPending(true);
  renderMessages();
  const c = document.getElementById('messages');
  const t = document.createElement('div');
  t.id = 'typing'; t.className = 'bubble-wrap assistant';
  t.innerHTML = '<div class="bubble assistant" style="color:#b4b2a9">···</div>';
  c.appendChild(t); c.scrollTop = c.scrollHeight;
  try {
    const reply = await callAI(msgs, getChatSystem());
    msgs.push({ role: 'assistant', content: reply });
  } catch(e) {
    msgs.push({ role: 'assistant', content: '出错了：' + e.message });
  } finally {
    saveSessions();
    document.getElementById('typing')?.remove();
    setChatRequestPending(false);
    renderMessages();
  }
}

// ── 语音输入 ──────────────────────────────────────────────────────────────────

function toggleVoice() {
  const SpeechRecognition = getSpeechRecognitionCtor();
  const voiceStatus = getDefaultVoiceStatus();
  if (!SpeechRecognition || !voiceStatus.available) {
    renderVoiceStatus();
    showToast(voiceStatus.message);
    return;
  }

  if (isRecording) {
    recognition.stop();
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'zh-CN';
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isRecording = true;
    document.getElementById('btn-mic').classList.add('recording');
    document.getElementById('btn-mic').textContent = '⏹️';
    setVoiceStatusOverride('正在听…说完会自动停止，也可以再点一次结束。', 'info');
    showToast('正在听…说完会自动停止', 10000);
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    const box = document.getElementById('input-box');
    box.value = box.value ? box.value + ' ' + text : text;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
    setVoiceStatusOverride('已识别到语音内容，可以继续编辑后发送。', 'success');
  };

  recognition.onerror = (event) => {
    const message = getVoiceErrorMessage(event.error);
    const tone = event.error === 'no-speech' || event.error === 'aborted' ? 'muted' : 'warn';
    setVoiceStatusOverride(message, tone, { preserveOnEnd: true });
    if (event.error !== 'aborted') showToast(message);
  };

  recognition.onend = () => {
    isRecording = false;
    document.getElementById('btn-mic').classList.remove('recording');
    document.getElementById('btn-mic').textContent = '🎙️';
    document.getElementById('toast').classList.remove('show');
    if (voiceStatusOverride?.preserveOnEnd) {
      renderVoiceStatus();
    } else {
      clearVoiceStatusOverride();
    }
  };

  try {
    recognition.start();
  } catch (error) {
    isRecording = false;
    document.getElementById('btn-mic').classList.remove('recording');
    document.getElementById('btn-mic').textContent = '🎙️';
    setVoiceStatusOverride('语音输入暂时无法启动，请稍后再试。', 'warn', { preserveOnEnd: true });
    showToast('语音输入暂时无法启动，请稍后再试。');
  }
}

// ── 整理逻辑 ──────────────────────────────────────────────────────────────────

async function summarizeDate(dateKey, dateSessions) {
  const active = dateSessions.filter(s => s.messages && s.messages.length > 0);
  if (!active.length) return;
  let conv = '';
  active.forEach((s, i) => {
    if (active.length > 1) conv += `【话题 ${i + 1}】\n`;
    conv += s.messages.map(m => (m.role === 'user' ? '我' : '助手') + '：' + m.content).join('\n');
    conv += '\n\n';
  });
  const dateLabel = new Date(dateKey + 'T12:00:00')
    .toLocaleDateString('zh-CN', {year:'numeric', month:'long', day:'numeric'});

  const content = await callAI(
    [{ role: 'user', content: SUMMARY_PROMPT + '\n\n对话：\n' + conv }], null
  );
  let records = normalizeRecords(readJSON('records', []));
  records = [{ date: dateKey, label: dateLabel, content }, ...records.filter(r => r.date !== dateKey)];
  records.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem('records', JSON.stringify(records));

  const existingMem = localStorage.getItem('user-memory') || '（暂无）';
  const newMem = await callAI(
    [{ role: 'user', content: MEMORY_PROMPT + '\n\n已有记忆：\n' + existingMem + '\n\n今天的对话：\n' + conv }], null
  );
  localStorage.setItem('user-memory', newMem);
}

async function summarize() {
  if (isChatRequestPending) {
    showToast('请先等待当前回复完成');
    return;
  }
  if (!sessions.some(s => s.messages.length > 0)) return;
  const btn = document.getElementById('btn-summarize');
  btn.disabled = true; btn.textContent = '整理中…';
  try {
    await summarizeDate(todayKey, sessions);
    switchTab('records');
  } catch(e) { alert('整理失败：' + e.message); }
  btn.disabled = false; btn.textContent = '整理今日记录';
}

// ── 自动整理 ──────────────────────────────────────────────────────────────────

async function checkAutoSummarize() {
  if (localStorage.getItem('auto-summarize') !== 'on') return;
  if (!hasKey()) return;
  if (new Date().getHours() < 4) return;
  const yk = getYesterdayKey();
  const ySessions = normalizeSessions(readJSON('sessions-' + yk, []));
  if (!ySessions.some(s => s.messages && s.messages.length > 0)) return;
  const records = normalizeRecords(readJSON('records', []));
  if (records.some(r => r.date === yk)) return;
  renderAutoSummarizeStatus({ tone: 'info', message: '正在自动整理昨天的记录…' });
  showToast('正在整理昨日记录…', 60000);
  try {
    await summarizeDate(yk, ySessions);
    renderAutoSummarizeStatus({ tone: 'success', message: '昨天记录已自动整理完成。' });
    showToast('昨日记录已整理好 ✓');
  } catch(e) {
    renderAutoSummarizeStatus({ tone: 'error', message: '自动整理失败了，稍后仍可以手动整理。' });
    showToast('自动整理失败，可手动整理');
  }
}

// ── 记录页 ────────────────────────────────────────────────────────────────────

function renderRecords() {
  const records = normalizeRecords(readJSON('records', []));
  const c = document.getElementById('records-list');
  if (!records.length) { c.innerHTML = '<div class="empty" style="margin-top:3rem">还没有记录，先去聊聊吧</div>'; return; }
  c.innerHTML = records.map(r => {
    const rawSessions = normalizeSessions(readJSON('sessions-' + r.date, []));
    const activeSessions = rawSessions.filter(s => s.messages && s.messages.length > 0);
    const hasRaw = activeSessions.length > 0;

    let rawHtml = '';
    if (hasRaw) {
      activeSessions.forEach((s, si) => {
        if (activeSessions.length > 1) {
          rawHtml += `<div class="raw-topic-label">话题 ${si + 1}</div>`;
        }
        rawHtml += s.messages.map(m =>
          `<div class="raw-bubble-wrap ${m.role}"><div class="raw-bubble ${m.role}">${esc(m.content)}</div></div>`
        ).join('');
      });
    }

    return `<div class="record-card">
      <div class="record-main">
        <div class="record-date">${r.label}</div>
        <div class="record-content">${esc(r.content)}</div>
      </div>
      ${hasRaw ? `
        <button class="toggle-history" onclick="toggleRaw(this)">查看原始对话 ▾</button>
        <div class="raw-chat">${rawHtml}</div>
      ` : ''}
    </div>`;
  }).join('');
}

function toggleRaw(btn) {
  const rawDiv = btn.nextElementSibling;
  const open = rawDiv.classList.toggle('open');
  btn.textContent = open ? '收起对话 ▴' : '查看原始对话 ▾';
}

// ── 记忆 ──────────────────────────────────────────────────────────────────────

function renderMemoryPreview() {
  const mem = localStorage.getItem('user-memory') || '';
  const el = document.getElementById('memory-preview');
  el.textContent = mem || '还没有记忆，整理第一次记录后会自动生成';
  el.classList.toggle('memory-empty', !mem);
}

function clearMemory() {
  if (!confirm('确定清除 AI 的记忆吗？')) return;
  localStorage.removeItem('user-memory');
  renderMemoryPreview();
}

// ── 清除全部 ──────────────────────────────────────────────────────────────────

function clearAll() {
  if (!confirm('确定清除所有聊天、记录和 AI 记忆吗？')) return;
  Object.keys(localStorage)
    .filter(k => k.startsWith('chat-') || k.startsWith('sessions-') || k === 'records' || k === 'user-memory')
    .forEach(k => localStorage.removeItem(k));
  sessions = [{ id: Date.now(), messages: [] }];
  currentIdx = 0; saveSessions();
  renderMessages(); renderSessionNav(); renderRecords();
  renderAutoSummarizeStatus();
  alert('已清除');
}
