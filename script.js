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

const L2_MEMORY_PROMPT = `根据刚才的对话，提炼3-5条值得长期记住的关键事件。每条用JSON格式输出，包含四个字段：date（日期，格式yyyy-mm-dd）、content（一句话描述）、emotion（high或normal）、tags（1-3个标签的数组）。只输出JSON数组，不要任何其他文字。`;

const TITLE_PROMPT = `请根据这段对话，生成一个适合作为聊天话题标题的短中文标题。

要求：
1. 最好 4 到 6 个字，最多 8 个字。
2. 只输出标题本身，不要引号、句号、解释或前缀。
3. 标题要自然，像人给一段聊天起的小标题。
4. 不要出现“话题”“聊天”“对话”“记录”这些词。`;

const RECORD_STYLE_PROMPT = `如果提供了“历史文风参考”，你只参考文字的语气、节奏、措辞和文字质感。
不要复用里面的具体事实、人物、项目、情绪、日期或事件，更不要把旧记录里的内容写进今天。`;

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

const AI_REQUEST_TIMEOUT_MS = 45000;
const AUTO_SUMMARIZE_STATE_KEY = 'auto-summarize-run';
const AUTO_SUMMARIZE_TOTAL_TIMEOUT_MS = AI_REQUEST_TIMEOUT_MS * 3 + 15000;
const AUTO_SUMMARIZE_STALE_MS = AUTO_SUMMARIZE_TOTAL_TIMEOUT_MS + 30000;
const EXPORT_APP_ID = 'elinswork-ai-daily-diary';
const EXPORT_VERSION = 1;
let sessions = [];
let currentIdx = 0;
let selectedMsgIdx = -1;
let isChatRequestPending = false;
let voiceStatusOverride = null;
let recognition = null;
let isRecording = false;
const THEME_STORAGE_KEY = 'theme';
let sessionTitlePendingId = null;
let sessionTitleEditingId = null;
let sessionTitleDraft = '';
let recordEditingDate = null;
let recordEditDraft = '';
let composerMenuOpen = false;
let isAutoSummarizeInProgress = false;
let toastTimer = null;
let sessionSwipeStartX = 0;
let sessionSwipeStartY = 0;
let sessionSwipeTracking = false;
function currentMsgs() { return sessions[currentIdx].messages; }

function formatDateLabel(dateKey) {
  return new Date(dateKey + 'T12:00:00')
    .toLocaleDateString('zh-CN', {year:'numeric', month:'long', day:'numeric'});
}

function isValidDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

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

function parseJSONArrayText(text) {
  const raw = String(text || '').trim();
  const start = raw.indexOf('[');
  const end = raw.lastIndexOf(']');
  if (start < 0 || end < start) throw new Error('AI 没有返回 JSON 数组');
  const parsed = JSON.parse(raw.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error('AI 返回的不是 JSON 数组');
  return parsed;
}

function normalizeL2MemoryEntries(entries) {
  return Array.isArray(entries)
    ? entries.map(entry => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
      const date = isValidDateKey(entry.date) ? entry.date : '';
      const content = typeof entry.content === 'string' ? entry.content.trim() : '';
      const emotion = entry.emotion === 'high' ? 'high' : 'normal';
      const tags = Array.isArray(entry.tags)
        ? entry.tags
          .filter(tag => typeof tag === 'string' && tag.trim())
          .map(tag => tag.trim())
          .slice(0, 3)
        : [];
      if (!date || !content || !tags.length) return null;
      return { date, content, emotion, tags };
    }).filter(Boolean)
    : [];
}

function appendL2MemoryEntries(entries) {
  const existing = normalizeL2MemoryEntries(readJSON('memory-l2', []));
  const next = [...existing, ...entries].slice(-200);
  localStorage.setItem('memory-l2', JSON.stringify(next));
}

function getAutoSummarizeRunState() {
  const state = readJSON(AUTO_SUMMARIZE_STATE_KEY, null);
  return state && typeof state === 'object' ? state : null;
}

function persistAutoSummarizeRunState(patch = {}) {
  const next = { ...(getAutoSummarizeRunState() || {}), ...patch };
  localStorage.setItem(AUTO_SUMMARIZE_STATE_KEY, JSON.stringify(next));
  return next;
}

function clearAutoSummarizeRunState() {
  localStorage.removeItem(AUTO_SUMMARIZE_STATE_KEY);
}

function isAutoSummarizeRunStateStale(state) {
  return !!state?.startedAt && (Date.now() - state.startedAt > AUTO_SUMMARIZE_STALE_MS);
}

function finalizeAutoSummarizeRunState(dateKey, tone, message) {
  return persistAutoSummarizeRunState({
    dateKey,
    status: tone,
    tone,
    message,
    startedAt: null,
    finishedAt: Date.now()
  });
}

function withPromiseTimeout(promise, timeoutMs, timeoutMessage, onTimeout = null) {
  let settled = false;
  let timer = null;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        onTimeout?.();
      } catch (error) {
        console.warn('Timeout cleanup failed:', error);
      }
      reject(new Error(timeoutMessage));
    }, timeoutMs);

    Promise.resolve(promise)
      .then((value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      });
  });
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
      title: typeof session.title === 'string' ? cleanSessionTitle(session.title) : '',
      titleMode: session.titleMode === 'manual' ? 'manual' : 'auto',
      messages: normalizeMessages(session.messages)
    }));
}

function normalizeRecords(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(record =>
      record &&
      typeof record.date === 'string' &&
      typeof record.label === 'string' &&
      typeof record.content === 'string'
    )
    .map(record => ({
      date: record.date,
      label: record.label,
      content: record.content,
      originalContent: typeof record.originalContent === 'string' ? record.originalContent : record.content,
      edited: record.edited === true,
      updatedAt: Number.isFinite(record.updatedAt) ? record.updatedAt : null
    }));
}

function createSession(messages = []) {
  return {
    id: Date.now() + Math.floor(Math.random() * 1000),
    title: '',
    titleMode: 'auto',
    messages: normalizeMessages(messages)
  };
}

function cleanSessionTitle(raw) {
  if (typeof raw !== 'string') return '';
  let title = raw.replace(/\r?\n+/g, ' ').trim();
  title = title.replace(/^标题[:：]\s*/, '').trim();
  title = title.replace(/^["'“”‘’《〈「『【\[\(]+/, '').trim();
  title = title.replace(/["'“”‘’》〉」』】\]\)!！?？,，。；;、:：]+$/, '').trim();
  if (!title) return '';
  if (title.length > 8) title = title.slice(0, 8).trim();
  return title;
}

function getSessionById(sessionId) {
  return sessions.find(session => session.id === sessionId) || null;
}

function getSessionDisplayTitle(session, index) {
  return session?.title?.trim() || `话题 ${index + 1}`;
}

function getSessionMetaLabel(session, index, total) {
  const modeLabel = session?.titleMode === 'manual' && session?.title ? '手动命名' : '自动命名';
  return `${modeLabel} · ${index + 1} / ${total}`;
}

function getSessionTitleMessages(messages) {
  if (messages.length <= 10) return messages;
  return [...messages.slice(0, 2), ...messages.slice(-8)];
}

function buildSessionTitleContext(messages) {
  return getSessionTitleMessages(messages)
    .map(msg => `${msg.role === 'user' ? '我' : '助手'}：${msg.content}`)
    .join('\n');
}

function canAutoNameSession(session) {
  return !!session && session.messages.length >= 2;
}

function clearAutoTitleIfNeeded(session) {
  if (!session || session.titleMode === 'manual') return;
  if (!session.messages.length) session.title = '';
}

function getRecordByDate(records, dateKey) {
  return records.find(record => record.date === dateKey) || null;
}

function canRestoreRecord(record) {
  return !!record &&
    record.edited === true &&
    typeof record.originalContent === 'string' &&
    record.originalContent.trim() &&
    record.originalContent !== record.content;
}

function getRecordStyleReferenceText(dateKey, records) {
  const history = records.filter(record => record.date !== dateKey && record.content.trim());
  if (!history.length) return '';

  const prioritized = [
    ...history.filter(record => record.edited),
    ...history.filter(record => !record.edited)
  ].slice(0, 3);

  if (!prioritized.length) return '';

  const samples = prioritized.map((record, index) =>
    `示例 ${index + 1}（${record.label}${record.edited ? '，用户改过' : ''}）\n${record.content}`
  ).join('\n\n');

  return `\n\n【历史文风参考】\n${RECORD_STYLE_PROMPT}\n\n${samples}`;
}

function escapeAttr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function listDiaryStorageKeys() {
  return Object.keys(localStorage)
    .filter(key => key.startsWith('chat-') || key.startsWith('sessions-') || key === 'records' || key === 'user-memory');
}

function clearStoredDiaryData() {
  listDiaryStorageKeys().forEach(key => localStorage.removeItem(key));
}

function resetTransientUiState() {
  selectedMsgIdx = -1;
  sessionTitlePendingId = null;
  sessionTitleEditingId = null;
  sessionTitleDraft = '';
  recordEditingDate = null;
  recordEditDraft = '';
}

function collectStoredSessionsByDate() {
  return Object.keys(localStorage)
    .filter(key => key.startsWith('sessions-'))
    .sort()
    .reduce((result, storageKey) => {
      const dateKey = storageKey.slice('sessions-'.length);
      if (!isValidDateKey(dateKey)) return result;
      result[dateKey] = normalizeSessions(readJSON(storageKey, []));
      return result;
    }, {});
}

function sortRecordsByDate(records) {
  records.sort((a, b) => b.date.localeCompare(a.date));
  return records;
}

function createExportPayload(type, data, extra = {}) {
  return {
    app: EXPORT_APP_ID,
    version: EXPORT_VERSION,
    type,
    exportedAt: new Date().toISOString(),
    ...extra,
    data
  };
}

function downloadJSON(filename, payload) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function syncDataManagementDateInput(dateKey = todayKey) {
  const input = document.getElementById('data-date-input');
  if (!input) return;
  input.value = isValidDateKey(dateKey) ? dateKey : todayKey;
}

function getSelectedDataManagementDate() {
  const input = document.getElementById('data-date-input');
  const value = input?.value || todayKey;
  if (isValidDateKey(value)) return value;
  syncDataManagementDateInput(todayKey);
  return todayKey;
}

function getFullDataSnapshot() {
  return createExportPayload('full', {
    sessionsByDate: collectStoredSessionsByDate(),
    records: sortRecordsByDate(normalizeRecords(readJSON('records', []))),
    userMemory: localStorage.getItem('user-memory') || ''
  });
}

function getDayDataSnapshot(dateKey) {
  const records = normalizeRecords(readJSON('records', []));
  return createExportPayload('day', {
    sessions: normalizeSessions(readJSON('sessions-' + dateKey, [])),
    record: getRecordByDate(records, dateKey)
  }, {
    date: dateKey
  });
}

function exportAllData() {
  const payload = getFullDataSnapshot();
  downloadJSON(`AiDailyDiary-backup-${todayKey}.json`, payload);
  showToast('已导出全部数据');
}

function exportDayData() {
  const dateKey = getSelectedDataManagementDate();
  const payload = getDayDataSnapshot(dateKey);
  const hasChats = payload.data.sessions.some(session => session.messages.length > 0);
  if (!hasChats && !payload.data.record) {
    showToast('这一天还没有可导出的聊天或记录');
    return;
  }
  downloadJSON(`AiDailyDiary-${dateKey}.json`, payload);
  showToast('已导出这一天的数据');
}

function openImportAllDialog() {
  if (isChatRequestPending) {
    showToast('请先等待当前回复完成');
    return;
  }
  const input = document.getElementById('import-all-input');
  if (!input) return;
  input.value = '';
  input.click();
}

function openImportDayDialog() {
  if (isChatRequestPending) {
    showToast('请先等待当前回复完成');
    return;
  }
  const input = document.getElementById('import-day-input');
  if (!input) return;
  input.value = '';
  input.click();
}

function ensureImportEnvelope(payload, expectedType) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('文件内容不是有效的 JSON 备份');
  }
  if (payload.app !== EXPORT_APP_ID) {
    throw new Error('这不是这个网页导出的备份文件');
  }
  if (payload.version !== EXPORT_VERSION) {
    throw new Error(`暂不支持版本 ${payload.version} 的备份文件`);
  }
  if (payload.type !== expectedType) {
    throw new Error(expectedType === 'full' ? '请选择“导出全部”生成的备份文件' : '请选择“导出某天”生成的备份文件');
  }
  if (!payload.data || typeof payload.data !== 'object' || Array.isArray(payload.data)) {
    throw new Error('备份文件缺少可导入的数据');
  }
  return payload;
}

function normalizeImportedFullData(payload) {
  const source = ensureImportEnvelope(payload, 'full').data;
  const sessionsSource = source.sessionsByDate;
  if (sessionsSource != null && (typeof sessionsSource !== 'object' || Array.isArray(sessionsSource))) {
    throw new Error('整体备份里的聊天数据格式不对');
  }

  const sessionsByDate = {};
  Object.entries(sessionsSource || {}).forEach(([dateKey, daySessions]) => {
    if (!isValidDateKey(dateKey)) return;
    sessionsByDate[dateKey] = normalizeSessions(daySessions);
  });

  const records = sortRecordsByDate(normalizeRecords(Array.isArray(source.records) ? source.records : []));
  const userMemory = typeof source.userMemory === 'string' ? source.userMemory : '';
  return { sessionsByDate, records, userMemory };
}

function normalizeImportedDayData(payload) {
  ensureImportEnvelope(payload, 'day');
  if (!isValidDateKey(payload.date)) {
    throw new Error('按天备份里缺少有效日期');
  }

  const sessions = normalizeSessions(payload.data.sessions);
  const rawRecord = payload.data.record;
  let record = null;
  if (rawRecord != null) {
    const normalized = normalizeRecords([{
      ...rawRecord,
      date: payload.date,
      label: typeof rawRecord.label === 'string' && rawRecord.label.trim()
        ? rawRecord.label
        : formatDateLabel(payload.date)
    }]);
    if (!normalized.length) throw new Error('按天备份里的记录格式不对');
    record = normalized[0];
  }

  return { dateKey: payload.date, sessions, record };
}

async function readImportPayloadFromFile(file) {
  try {
    return JSON.parse(await file.text());
  } catch (error) {
    throw new Error('文件内容不是合法的 JSON');
  }
}

function refreshAppAfterImport({ reloadToday = false } = {}) {
  resetTransientUiState();
  if (reloadToday) {
    loadTodaySessions();
  }
  renderMessages();
  renderSessionNav();
  renderRecords();
  renderMemoryPreview();
  renderAutoSummarizeStatus();
  maybeAutoNameSession(sessions[currentIdx]?.id);
}

function applyFullImport(imported) {
  clearStoredDiaryData();
  Object.entries(imported.sessionsByDate).forEach(([dateKey, daySessions]) => {
    localStorage.setItem('sessions-' + dateKey, JSON.stringify(daySessions));
  });
  localStorage.setItem('records', JSON.stringify(imported.records));
  if (imported.userMemory.trim()) {
    localStorage.setItem('user-memory', imported.userMemory);
  } else {
    localStorage.removeItem('user-memory');
  }
  refreshAppAfterImport({ reloadToday: true });
}

function applyDayImport(imported) {
  const storageKey = 'sessions-' + imported.dateKey;
  if (imported.sessions.length) {
    localStorage.setItem(storageKey, JSON.stringify(imported.sessions));
  } else {
    localStorage.removeItem(storageKey);
  }

  const records = normalizeRecords(readJSON('records', []))
    .filter(record => record.date !== imported.dateKey);
  if (imported.record) records.unshift(imported.record);
  localStorage.setItem('records', JSON.stringify(sortRecordsByDate(records)));
  refreshAppAfterImport({ reloadToday: imported.dateKey === todayKey });
}

async function handleImportAllFile(event) {
  const input = event.target;
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const imported = normalizeImportedFullData(await readImportPayloadFromFile(file));
    const dayCount = Object.keys(imported.sessionsByDate).length;
    const recordCount = imported.records.length;
    const confirmText =
      `确定导入这个整体备份吗？\n\n` +
      `当前全部聊天、灵感记录和 AI 记忆会被覆盖。\n` +
      `备份里有 ${dayCount} 天聊天、${recordCount} 条记录。`;
    if (!confirm(confirmText)) return;
    applyFullImport(imported);
    showToast('已导入全部数据');
  } catch (error) {
    alert('导入失败：' + error.message);
  } finally {
    input.value = '';
  }
}

async function handleImportDayFile(event) {
  const input = event.target;
  const file = input?.files?.[0];
  if (!file) return;

  try {
    const imported = normalizeImportedDayData(await readImportPayloadFromFile(file));
    const activeSessionCount = imported.sessions.filter(session => session.messages.length > 0).length;
    const confirmText =
      `确定导入 ${formatDateLabel(imported.dateKey)} 这一天的数据吗？\n\n` +
      `本地这一天的聊天和灵感记录会被覆盖。\n` +
      `备份里有 ${activeSessionCount} 个有内容的话题，` +
      `${imported.record ? '并且包含 1 条灵感记录。' : '但不包含灵感记录。'}`;
    if (!confirm(confirmText)) return;
    applyDayImport(imported);
    syncDataManagementDateInput(imported.dateKey);
    showToast('已导入这一天的数据');
  } catch (error) {
    alert('导入失败：' + error.message);
  } finally {
    input.value = '';
  }
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
  if (!sessions.length) sessions = [createSession()];
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
  const l2Memories = normalizeL2MemoryEntries(readJSON('memory-l2', []))
    .slice(-20)
    .map(entry => `- [${entry.date}] ${entry.content}`);
  let system = CHAT_SYSTEM_BASE;
  if (mem) system += '\n\n关于用户的记忆：\n' + mem;
  if (l2Memories.length) system += '\n\n近期关键记忆：\n' + l2Memories.join('\n');
  return system;
}

// ── 话题导航 ──────────────────────────────────────────────────────────────────

function renderSessionNav() {
  const total = sessions.length, i = currentIdx;
  const current = sessions[i];
  const canAiRename = !isChatRequestPending && canAutoNameSession(current) && hasKey();
  const isTitlePending = current?.id === sessionTitlePendingId;
  const isEditingTitle = current?.id === sessionTitleEditingId;
  const swipeHint = total > 1
    ? '左右滑动切换话题'
    : '需要时可以新建话题';
  document.getElementById('session-nav').innerHTML =
    `<div class="session-nav-main ${isEditingTitle ? 'editing' : ''}">
        <button class="nav-btn" onclick="gotoSession(${i-1})" ${i===0?'disabled':''}>←</button>
        <div class="nav-label ${isEditingTitle ? 'editing' : ''}">
          ${isEditingTitle ? `
            <input
              id="session-title-input"
              class="nav-title-input"
              type="text"
              value="${escapeAttr(sessionTitleDraft)}"
              maxlength="12"
              placeholder="给这个话题起个名字"
              oninput="updateSessionTitleDraft(this.value)"
              onkeydown="handleSessionTitleInputKey(event)"
            >
            <div class="nav-edit-hint">留空后保存，会恢复自动命名</div>
          ` : `
            <div class="nav-title">${esc(getSessionDisplayTitle(current, i))}</div>
            <div class="nav-meta">${esc(getSessionMetaLabel(current, i, total))}</div>
            <div class="nav-swipe-tip">${esc(swipeHint)}</div>
          `}
        </div>
        <button class="nav-btn" onclick="gotoSession(${i+1})" ${i===total-1?'disabled':''}>→</button>
      </div>
      <div class="session-nav-actions">
        ${isEditingTitle ? `
          <button class="nav-btn nav-btn-light" onclick="saveCurrentSessionTitle()">保存</button>
          <button class="nav-btn nav-btn-light" onclick="cancelRenameCurrentSession()">取消</button>
        ` : `
          <button class="nav-btn nav-btn-light" onclick="startRenameCurrentSession()">改名</button>
          <button class="nav-btn nav-btn-light" onclick="requestCurrentSessionTitle(true)" ${(canAiRename && !isTitlePending) ? '' : 'disabled'}>
            ${isTitlePending ? '命名中…' : 'AI 命名'}
          </button>
        `}
        <button class="nav-btn" onclick="newSession()">＋ 新话题</button>
      </div>`;

  renderCurrentSessionSubtitle();

  if (isEditingTitle) {
    setTimeout(() => {
      const input = document.getElementById('session-title-input');
      if (!input) return;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    }, 0);
  }
}

function gotoSession(i) {
  if (i < 0 || i >= sessions.length) return;
  cancelRenameCurrentSession(true);
  currentIdx = i; selectedMsgIdx = -1; renderMessages(); renderSessionNav();
  maybeAutoNameSession(sessions[i]?.id);
}

function newSession() {
  cancelRenameCurrentSession(true);
  sessions.push(createSession());
  saveSessions(); currentIdx = sessions.length - 1; selectedMsgIdx = -1;
  renderMessages(); renderSessionNav();
  document.getElementById('input-box').focus();
}

function startRenameCurrentSession() {
  const session = sessions[currentIdx];
  if (!session) return;
  sessionTitleEditingId = session.id;
  sessionTitleDraft = session.title || '';
  renderSessionNav();
}

function updateSessionTitleDraft(value) {
  sessionTitleDraft = value;
}

function handleSessionTitleInputKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    saveCurrentSessionTitle();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelRenameCurrentSession();
  }
}

function cancelRenameCurrentSession(silent = false) {
  if (sessionTitleEditingId == null) return;
  sessionTitleEditingId = null;
  sessionTitleDraft = '';
  if (!silent) renderSessionNav();
}

function saveCurrentSessionTitle() {
  const session = getSessionById(sessionTitleEditingId);
  if (!session) {
    cancelRenameCurrentSession();
    return;
  }
  const cleaned = cleanSessionTitle(sessionTitleDraft);
  if (!cleaned) {
    session.title = '';
    session.titleMode = 'auto';
    sessionTitleEditingId = null;
    sessionTitleDraft = '';
    saveSessions();
    renderSessionNav();
    showToast('已恢复自动命名');
    requestSessionTitleById(session.id, { forceRename: false, silent: true });
    return;
  }

  session.title = cleaned;
  session.titleMode = 'manual';
  sessionTitleEditingId = null;
  sessionTitleDraft = '';
  saveSessions();
  renderSessionNav();
  showToast('已保存话题名称');
}

async function requestCurrentSessionTitle(forceRename = false) {
  const session = sessions[currentIdx];
  if (!session) return;
  return requestSessionTitleById(session.id, { forceRename, silent: false });
}

function maybeAutoNameSession(sessionId) {
  const session = getSessionById(sessionId);
  if (!session) return;
  if (session.titleMode === 'manual' || session.title) return;
  if (sessionTitlePendingId === sessionId) return;
  if (sessionTitleEditingId === sessionId) return;
  if (isChatRequestPending || !hasKey() || !canAutoNameSession(session)) return;
  requestSessionTitleById(sessionId, { forceRename: false, silent: true });
}

function getCurrentSessionSubtitleText() {
  const session = sessions[currentIdx];
  if (!session) return '';
  if (sessions.length === 1 && !session.title && !session.messages.length) return '';
  return getSessionDisplayTitle(session, currentIdx);
}

function renderCurrentSessionSubtitle() {
  const el = document.getElementById('current-session-subtitle');
  if (!el) return;
  const subtitle = getCurrentSessionSubtitleText();
  el.textContent = subtitle;
  el.style.display = subtitle ? '' : 'none';
  if (subtitle) {
    el.setAttribute('title', subtitle);
  } else {
    el.removeAttribute('title');
  }
}

function isChatPanelVisible() {
  return document.getElementById('panel-chat')?.style.display !== 'none';
}

function shouldIgnoreSessionSwipeTarget(target) {
  if (!target) return true;
  if (!isChatPanelVisible()) return true;
  if (sessionTitleEditingId != null) return true;
  return !!target.closest('.session-nav, .composer-shell, button, input, textarea, select, label, a');
}

function handleSessionSwipeStart(event) {
  if (event.touches.length !== 1) {
    sessionSwipeTracking = false;
    return;
  }
  if (sessions.length <= 1 || shouldIgnoreSessionSwipeTarget(event.target)) {
    sessionSwipeTracking = false;
    return;
  }
  const touch = event.touches[0];
  sessionSwipeStartX = touch.clientX;
  sessionSwipeStartY = touch.clientY;
  sessionSwipeTracking = true;
}

function handleSessionSwipeEnd(event) {
  if (!sessionSwipeTracking) return;
  sessionSwipeTracking = false;
  const touch = event.changedTouches?.[0];
  if (!touch) return;

  const deltaX = touch.clientX - sessionSwipeStartX;
  const deltaY = touch.clientY - sessionSwipeStartY;
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);

  if (absX < 70) return;
  if (absX < absY * 1.35) return;

  if (deltaX < 0) {
    gotoSession(currentIdx + 1);
  } else {
    gotoSession(currentIdx - 1);
  }
}

function cancelSessionSwipeTracking() {
  sessionSwipeTracking = false;
}

async function requestSessionTitleById(sessionId, options = {}) {
  const { forceRename = false, silent = true } = options;
  const session = getSessionById(sessionId);
  if (!session) return '';
  if (sessionTitlePendingId === sessionId) return session.title || '';
  if (!canAutoNameSession(session)) {
    if (!silent) showToast('先聊几句，再让 AI 帮你起标题');
    return '';
  }
  if (!hasKey()) {
    if (!silent) showToast('请先在设置里填入 API Key');
    return '';
  }
  if (session.titleMode === 'manual' && !forceRename) return session.title || '';

  sessionTitlePendingId = sessionId;
  renderSessionNav();
  try {
    const title = cleanSessionTitle(await callAI(
      [{ role: 'user', content: TITLE_PROMPT + '\n\n对话：\n' + buildSessionTitleContext(session.messages) }],
      null
    ));
    if (!title) throw new Error('AI 没有生成可用标题');

    const target = getSessionById(sessionId);
    if (!target) return '';
    target.title = title;
    target.titleMode = 'auto';
    saveSessions();
    renderSessionNav();
    if (!silent) showToast('已更新话题名称');
    return title;
  } catch (error) {
    if (!silent) showToast('AI 命名失败，请稍后再试');
    return '';
  } finally {
    if (sessionTitlePendingId === sessionId) sessionTitlePendingId = null;
    renderSessionNav();
  }
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
  syncDataManagementDateInput();
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
  const enabled = document.getElementById('auto-toggle').checked;
  localStorage.setItem('auto-summarize', enabled ? 'on' : 'off');
  if (!enabled) clearAutoSummarizeRunState();
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

function hasTodayChats() {
  return sessions.some(session => session.messages.length > 0);
}

function renderSummarizeAction() {
  const hasChats = hasTodayChats();
  const yk = getYesterdayKey();
  const ySessions = normalizeSessions(readJSON('sessions-' + yk, []));
  const hasYesterdayChats = ySessions.some(s => s.messages.length > 0);
  const records = normalizeRecords(readJSON('records', []));
  const hasYesterdayRecord = records.some(r => r.date === yk);
  const showYesterdayBtn = hasYesterdayChats && !hasYesterdayRecord;

  const bar = document.getElementById('records-topbar');
  const btn = document.getElementById('btn-summarize');
  const btnY = document.getElementById('btn-summarize-yesterday');
  if (bar) bar.style.display = (hasChats || showYesterdayBtn) ? '' : 'none';
  if (btn) { btn.style.display = hasChats ? '' : 'none'; btn.disabled = isChatRequestPending || !hasChats; }
  if (btnY) { btnY.style.display = showYesterdayBtn ? '' : 'none'; btnY.disabled = isChatRequestPending; }
}

function renderComposerState() {
  const shell = document.getElementById('composer-shell');
  const box = document.getElementById('input-box');
  const menuBtn = document.getElementById('btn-mic');
  const sendBtn = document.getElementById('btn-send');
  const menu = document.getElementById('composer-menu');
  const hasText = !!box?.value.trim();
  const isMenuVisible = composerMenuOpen && !isRecording;

  if (shell) {
    shell.classList.toggle('has-text', hasText);
    shell.classList.toggle('menu-open', isMenuVisible);
  }
  if (sendBtn) {
    sendBtn.classList.toggle('visible', hasText);
    sendBtn.disabled = isChatRequestPending || !hasText;
    sendBtn.setAttribute('aria-hidden', hasText ? 'false' : 'true');
  }
  if (menuBtn) {
    menuBtn.classList.toggle('recording', isRecording);
    menuBtn.classList.toggle('menu-open', isMenuVisible);
    menuBtn.textContent = isRecording ? '⏹️' : '···';
    menuBtn.setAttribute('aria-label', isRecording ? '停止语音输入' : '更多操作');
    menuBtn.setAttribute('aria-expanded', isMenuVisible ? 'true' : 'false');
  }
  if (menu) {
    menu.hidden = !isMenuVisible;
    menu.setAttribute('aria-hidden', isMenuVisible ? 'false' : 'true');
  }
}

function handleComposerInput() {
  renderComposerState();
}

function closeComposerMenu() {
  if (!composerMenuOpen) return;
  composerMenuOpen = false;
  renderComposerState();
}

function toggleComposerMenu() {
  if (isRecording) {
    toggleVoice();
    return;
  }
  composerMenuOpen = !composerMenuOpen;
  renderComposerState();
}

function triggerVoiceFromComposer() {
  composerMenuOpen = false;
  renderComposerState();
  toggleVoice();
}

function handleDocumentClick(event) {
  if (event.target.closest('.composer-shell')) return;
  closeComposerMenu();
}

function handleDocumentKeydown(event) {
  if (event.key === 'Escape' && composerMenuOpen && !isRecording) {
    closeComposerMenu();
  }
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
  const runState = getAutoSummarizeRunState();

  if (runState?.dateKey === yk) {
    if (runState.status === 'running') {
      if (isAutoSummarizeRunStateStale(runState)) {
        finalizeAutoSummarizeRunState(yk, 'warn', '上次自动整理似乎卡住了，重新打开页面后会再试一次，也可以手动整理。');
        return { tone: 'warn', message: '上次自动整理似乎卡住了，重新打开页面后会再试一次，也可以手动整理。' };
      }
      return { tone: runState.tone || 'info', message: runState.message || '正在自动整理昨天的记录…' };
    }
    if (runState.status === 'warn') {
      return { tone: 'warn', message: runState.message };
    }
    if (runState.status === 'error' && !alreadySummarized) {
      return { tone: 'error', message: runState.message };
    }
    if (runState.status === 'success' && alreadySummarized) {
      return { tone: 'success', message: runState.message };
    }
  }

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
    message: '语音输入可用：点输入框里的更多按钮，再选语音输入开始说话。',
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
    btn.title = disabled
      ? (status.message || '语音输入')
      : (isRecording ? '停止语音输入' : '更多操作');
  }
  renderComposerState();
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
document.addEventListener('click', handleDocumentClick);
document.addEventListener('keydown', handleDocumentKeydown);
document.getElementById('panel-chat')?.addEventListener('touchstart', handleSessionSwipeStart, { passive: true });
document.getElementById('panel-chat')?.addEventListener('touchend', handleSessionSwipeEnd, { passive: true });
document.getElementById('panel-chat')?.addEventListener('touchcancel', cancelSessionSwipeTracking, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkAutoSummarize();
});
checkAutoSummarize();
maybeAutoNameSession(sessions[currentIdx]?.id);

// ── Tab 切换 ──────────────────────────────────────────────────────────────────

function switchTab(tab) {
  if (tab !== 'chat') closeComposerMenu();
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

function showToast(msg, duration = 3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

function setChatRequestPending(pending) {
  isChatRequestPending = pending;
  renderComposerState();
  renderSummarizeAction();
  renderSessionNav();
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
    renderSummarizeAction();
    renderComposerState();
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
  renderSummarizeAction();
  renderComposerState();
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
  const session = sessions[currentIdx];
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
  clearAutoTitleIfNeeded(session);
  selectedMsgIdx = -1;
  saveSessions();
  renderSessionNav();
  renderMessages();
  maybeAutoNameSession(session?.id);
}

async function regenMsg(i) {
  const sessionId = sessions[currentIdx]?.id;
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
    requestSessionTitleById(sessionId, { forceRename: false, silent: true });
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

async function fetchWithTimeout(url, options, requestLabel, timeoutMs = AI_REQUEST_TIMEOUT_MS) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  try {
    return await withPromiseTimeout(
      fetch(url, controller ? { ...options, signal: controller.signal } : options),
      timeoutMs,
      `${requestLabel}超时了，请检查网络或稍后再试`,
      () => controller?.abort()
    );
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`${requestLabel}超时了，请检查网络或稍后再试`);
    }
    throw error;
  }
}

async function callAI(msgs, system, options = {}) {
  const { requestLabel = 'AI 请求', timeoutMs = AI_REQUEST_TIMEOUT_MS } = options;
  const { provider, key } = getConfig();
  if (!key) throw new Error('请先在设置里填入 API Key');
  if (provider === 'deepseek') {
    const allMsgs = system ? [{ role:'system', content:system }, ...msgs] : msgs;
    const res = await fetchWithTimeout('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: 'deepseek-chat', messages: allMsgs, max_tokens: 1000 })
    }, requestLabel, timeoutMs);
    const d = await readJSONResponse(res, 'DeepSeek');
    if (!res.ok || d.error) {
      throw new Error(getApiErrorMessage(d, `DeepSeek 请求失败（${res.status}）`));
    }
    return getDeepSeekReply(d);
  } else {
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
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
    }, requestLabel, timeoutMs);
    const d = await readJSONResponse(res, 'Anthropic');
    if (!res.ok || d.error) {
      throw new Error(getApiErrorMessage(d, `Anthropic 请求失败（${res.status}）`));
    }
    return getAnthropicReply(d);
  }
}

// ── 发送 ──────────────────────────────────────────────────────────────────────

async function send() {
  const sessionId = sessions[currentIdx]?.id;
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
  composerMenuOpen = false;
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
    requestSessionTitleById(sessionId, { forceRename: false, silent: true });
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
    composerMenuOpen = false;
    setVoiceStatusOverride('正在听…说完会自动停止，也可以再点一次结束。', 'info');
    showToast('正在听…说完会自动停止', 10000);
  };

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    const box = document.getElementById('input-box');
    box.value = box.value ? box.value + ' ' + text : text;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
    renderComposerState();
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
    setVoiceStatusOverride('语音输入暂时无法启动，请稍后再试。', 'warn', { preserveOnEnd: true });
    showToast('语音输入暂时无法启动，请稍后再试。');
  }
}

// ── 整理逻辑 ──────────────────────────────────────────────────────────────────

async function summarizeDate(dateKey, dateSessions, options = {}) {
  const { onProgress = null, continueOnMemoryError = false } = options;
  const reportProgress = (step) => {
    onProgress?.(step);
  };
  const active = dateSessions.filter(s => s.messages && s.messages.length > 0);
  if (!active.length) return;
  let conv = '';
  active.forEach((s, i) => {
    if (active.length > 1) conv += `【${getSessionDisplayTitle(s, i)}】\n`;
    conv += s.messages.map(m => (m.role === 'user' ? '我' : '助手') + '：' + m.content).join('\n');
    conv += '\n\n';
  });
  const dateLabel = formatDateLabel(dateKey);

  let records = normalizeRecords(readJSON('records', []));
  const styleReference = getRecordStyleReferenceText(dateKey, records);
  reportProgress('record_start');
  const content = await callAI(
    [{ role: 'user', content: SUMMARY_PROMPT + styleReference + '\n\n对话：\n' + conv }], null,
    { requestLabel: '生成记录' }
  );
  records = [{
    date: dateKey,
    label: dateLabel,
    content,
    originalContent: content,
    edited: false,
    updatedAt: null
  }, ...records.filter(r => r.date !== dateKey)];
  records.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem('records', JSON.stringify(records));
  renderRecords();

  reportProgress('memory_start');
  const existingMem = localStorage.getItem('user-memory') || '（暂无）';
  let memoryUpdated = false;
  let memoryError = null;
  try {
    const newMem = await callAI(
      [{ role: 'user', content: MEMORY_PROMPT + '\n\n已有记忆：\n' + existingMem + '\n\n今天的对话：\n' + conv }], null,
      { requestLabel: '更新 AI 记忆' }
    );
    localStorage.setItem('user-memory', newMem);
    renderMemoryPreview();
    memoryUpdated = true;
  } catch (error) {
    console.warn('更新 AI 记忆失败：', error);
    reportProgress('memory_failed');
    if (!continueOnMemoryError) throw error;
    memoryError = error;
  }

  try {
    const rawL2Memories = await callAI(
      [{ role: 'user', content: L2_MEMORY_PROMPT + '\n\n刚才的对话：\n' + conv }], null,
      { requestLabel: '提炼关键记忆' }
    );
    const l2Memories = normalizeL2MemoryEntries(parseJSONArrayText(rawL2Memories));
    if (l2Memories.length) appendL2MemoryEntries(l2Memories);
  } catch (error) {
    console.warn('提炼 L2 关键记忆失败：', error);
  }

  reportProgress('done');
  return memoryError
    ? { content, memoryUpdated, memoryError }
    : { content, memoryUpdated };
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
    const result = await summarizeDate(todayKey, sessions, {
      continueOnMemoryError: true,
      onProgress: (step) => {
        btn.textContent = step === 'memory_start' ? '更新记忆中…' : '整理中…';
      }
    });
    switchTab('records');
    showToast(result.memoryUpdated ? '今日记录已整理好 ✓' : '今日记录已生成，AI 记忆更新失败');
  } catch(e) { alert('整理失败：' + e.message); }
  btn.disabled = false; btn.textContent = '整理今日记录';
}

async function summarizeYesterday() {
  if (isChatRequestPending) { showToast('请先等待当前回复完成'); return; }
  const yk = getYesterdayKey();
  const ySessions = normalizeSessions(readJSON('sessions-' + yk, []));
  if (!ySessions.some(s => s.messages.length > 0)) return;
  const btn = document.getElementById('btn-summarize-yesterday');
  if (btn) { btn.disabled = true; btn.textContent = '整理中…'; }
  try {
    const result = await summarizeDate(yk, ySessions, {
      continueOnMemoryError: true,
      onProgress: (step) => {
        if (btn) btn.textContent = step === 'memory_start' ? '更新记忆中…' : '整理中…';
      }
    });
    renderRecords();
    showToast(result.memoryUpdated ? '昨日记录已整理好 ✓' : '昨日记录已生成，AI 记忆更新失败');
  } catch(e) { alert('整理失败：' + e.message); }
  if (btn) { btn.disabled = false; btn.textContent = '整理昨天记录'; }
}

// ── 自动整理 ──────────────────────────────────────────────────────────────────

async function checkAutoSummarize() {
  if (isAutoSummarizeInProgress) return;
  if (localStorage.getItem('auto-summarize') !== 'on') return;
  if (!hasKey()) return;
  if (new Date().getHours() < 4) return;
  const yk = getYesterdayKey();
  const existingRun = getAutoSummarizeRunState();
  if (existingRun?.dateKey === yk && existingRun.status === 'running') {
    // 页面刷新后上一次请求已终止，直接重试
    finalizeAutoSummarizeRunState(yk, 'warn', '上次自动整理没有完成，这次会重新试一次。');
  }
  const ySessions = normalizeSessions(readJSON('sessions-' + yk, []));
  if (!ySessions.some(s => s.messages && s.messages.length > 0)) return;
  const records = normalizeRecords(readJSON('records', []));
  if (records.some(r => r.date === yk)) {
    if (existingRun?.dateKey === yk && existingRun.status === 'running') {
      finalizeAutoSummarizeRunState(yk, 'success', '昨天的聊天已经整理过了。');
    }
    return;
  }
  const runStartedAt = Date.now();
  isAutoSummarizeInProgress = true;
  persistAutoSummarizeRunState({
    dateKey: yk,
    status: 'running',
    tone: 'info',
    message: '正在生成昨天的记录…',
    startedAt: runStartedAt,
    finishedAt: null
  });
  renderAutoSummarizeStatus({ tone: 'info', message: '正在生成昨天的记录…' });
  showToast('正在整理昨日记录…', 60000);
  try {
    const result = await withPromiseTimeout(
      summarizeDate(yk, ySessions, {
        continueOnMemoryError: true,
        onProgress: (step) => {
          if (step === 'record_start') {
            persistAutoSummarizeRunState({
              dateKey: yk,
              status: 'running',
              tone: 'info',
              message: '正在生成昨天的记录…',
              startedAt: runStartedAt,
              finishedAt: null
            });
            renderAutoSummarizeStatus({ tone: 'info', message: '正在生成昨天的记录…' });
            return;
          }
          if (step === 'memory_start') {
            persistAutoSummarizeRunState({
              dateKey: yk,
              status: 'running',
              tone: 'info',
              message: '昨天记录已生成，正在更新 AI 记忆…',
              startedAt: runStartedAt,
              finishedAt: null
            });
            renderAutoSummarizeStatus({ tone: 'info', message: '昨天记录已生成，正在更新 AI 记忆…' });
          }
        }
      }),
      AUTO_SUMMARIZE_TOTAL_TIMEOUT_MS,
      '自动整理超时了，稍后可以重试，或者手动整理。'
    );
    if (result.memoryUpdated) {
      finalizeAutoSummarizeRunState(yk, 'success', '昨天记录已自动整理完成。');
      renderAutoSummarizeStatus({ tone: 'success', message: '昨天记录已自动整理完成。' });
      showToast('昨日记录已整理好 ✓');
    } else {
      finalizeAutoSummarizeRunState(yk, 'warn', '昨天记录已生成，但更新 AI 记忆失败了。');
      renderAutoSummarizeStatus({ tone: 'warn', message: '昨天记录已生成，但更新 AI 记忆失败了。' });
      showToast('昨日记录已生成，AI 记忆更新失败');
    }
  } catch(e) {
    const timeoutMessage = /超时/.test(e.message || '')
      ? '自动整理超时了，稍后可以重试，或者手动整理。'
      : '自动整理失败了，稍后仍可以手动整理。';
    finalizeAutoSummarizeRunState(yk, 'error', timeoutMessage);
    renderAutoSummarizeStatus({ tone: 'error', message: timeoutMessage });
    showToast(/超时/.test(e.message || '') ? '自动整理超时了，可稍后重试' : '自动整理失败，可手动整理');
  } finally {
    isAutoSummarizeInProgress = false;
  }
}
// ── 记录页 ────────────────────────────────────────────────────────────────────

function renderRecords() {
  const records = normalizeRecords(readJSON('records', []));
  const c = document.getElementById('records-list');
  renderSummarizeAction();
  if (!records.length) { c.innerHTML = '<div class="empty" style="margin-top:3rem">还没有记录，先去聊聊吧</div>'; return; }
  c.innerHTML = records.map(r => {
    const isEditing = recordEditingDate === r.date;
    const canRestore = canRestoreRecord(r);
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
        <div class="record-head">
          <div class="record-date">${r.label}</div>
          <div class="record-tools">
            ${r.edited ? '<span class="record-badge">已修改</span>' : ''}
            ${isEditing ? '' : `
              ${canRestore ? `<button class="record-link-btn" onclick="restoreRecordToOriginal('${r.date}')">恢复原稿</button>` : ''}
              <button class="record-link-btn" onclick="startEditRecord('${r.date}')">编辑</button>
            `}
          </div>
        </div>
        ${isEditing ? `
          <div class="record-edit-area">
            <textarea
              id="record-editor"
              class="record-editor"
              rows="7"
              oninput="updateRecordEditDraft(this.value)"
              onkeydown="handleRecordEditorKey(event)"
            >${escapeAttr(recordEditDraft)}</textarea>
            <div class="record-edit-footer">
              <span class="record-edit-hint">Ctrl / Cmd + Enter 保存，Esc 取消</span>
              <div class="record-edit-actions">
                ${canRestore ? `<button class="action-btn" onclick="restoreRecordToOriginal('${r.date}', true)">恢复 AI 原稿</button>` : ''}
                <button class="action-btn" onclick="saveEditingRecord()">保存</button>
                <button class="action-btn" onclick="cancelEditingRecord()">取消</button>
              </div>
            </div>
          </div>
        ` : `
          <div class="record-content">${esc(r.content)}</div>
        `}
      </div>
      ${hasRaw ? `
        <button class="toggle-history" onclick="toggleRaw(this)">查看原始对话 ▾</button>
        <div class="raw-chat">${rawHtml}</div>
      ` : ''}
    </div>`;
  }).join('');

  if (recordEditingDate) {
    setTimeout(() => {
      const editor = document.getElementById('record-editor');
      if (!editor) return;
      editor.focus();
      editor.setSelectionRange(editor.value.length, editor.value.length);
    }, 0);
  }
}

function toggleRaw(btn) {
  const rawDiv = btn.nextElementSibling;
  const open = rawDiv.classList.toggle('open');
  btn.textContent = open ? '收起对话 ▴' : '查看原始对话 ▾';
}

function startEditRecord(dateKey) {
  const records = normalizeRecords(readJSON('records', []));
  const record = getRecordByDate(records, dateKey);
  if (!record) return;
  recordEditingDate = dateKey;
  recordEditDraft = record.content;
  renderRecords();
}

function updateRecordEditDraft(value) {
  recordEditDraft = value;
}

function handleRecordEditorKey(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    cancelEditingRecord();
    return;
  }
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    saveEditingRecord();
  }
}

function cancelEditingRecord(silent = false) {
  if (recordEditingDate == null) return;
  recordEditingDate = null;
  recordEditDraft = '';
  if (!silent) renderRecords();
}

function saveEditingRecord() {
  if (!recordEditingDate) return;
  const nextContent = recordEditDraft.trim();
  if (!nextContent) {
    showToast('记录内容不能为空');
    return;
  }

  const records = normalizeRecords(readJSON('records', []));
  const record = getRecordByDate(records, recordEditingDate);
  if (!record) {
    cancelEditingRecord();
    return;
  }

  record.content = nextContent;
  record.edited = true;
  record.updatedAt = Date.now();
  localStorage.setItem('records', JSON.stringify(records));
  recordEditingDate = null;
  recordEditDraft = '';
  renderRecords();
  showToast('已保存记录修改');
}

function restoreRecordToOriginal(dateKey, fromEditing = false) {
  const records = normalizeRecords(readJSON('records', []));
  const record = getRecordByDate(records, dateKey);
  if (!canRestoreRecord(record)) return;
  if (!confirm('确定恢复到 AI 最初整理出来的原稿吗？你后面手动改过的内容会被撤销。')) return;

  record.content = record.originalContent;
  record.edited = false;
  record.updatedAt = null;
  localStorage.setItem('records', JSON.stringify(records));

  if (recordEditingDate === dateKey || fromEditing) {
    recordEditingDate = null;
    recordEditDraft = '';
  }

  renderRecords();
  showToast('已恢复到 AI 原稿');
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
  clearStoredDiaryData();
  resetTransientUiState();
  sessions = [createSession()];
  currentIdx = 0; saveSessions();
  renderMessages(); renderSessionNav(); renderRecords();
  renderMemoryPreview();
  renderAutoSummarizeStatus();
  alert('已清除');
}
