const NOTIFICATIONS_KEY = 'appv5:notifications';
const NOTIFICATIONS_MAX = 200;
const PUSH_QUEUE_KEY = '__pendingPushInbox';
const PUSH_DUP_WINDOW_MS = 15000;

const safeParse = (raw) => {
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
};

const generateId = () => {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
};

const asObject = (value) => (value && typeof value === 'object' ? value : {});

const pickString = (...values) => {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const next = String(value).trim();
    if (next) return next;
  }
  return '';
};

const parseBool = (value) => {
  if (value === true || value === false) return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return null;
};

const parsePushAction = (data) => {
  const source = asObject(data);
  const label = pickString(
    source.action_label,
    source.actionLabel,
    source.label,
    source.cta,
    source.button
  );
  const tab = pickString(source.tab, source.action_tab, source.actionTab);
  const profileTab = pickString(
    source.profileTab,
    source.profile_tab,
    source.action_profile_tab,
    source.actionProfileTab
  );
  const hash = pickString(source.hash, source.action_hash, source.actionHash);
  const callback = pickString(source.callback, source.action_callback, source.actionCallback);
  const completeValue = parseBool(
    source.complete ?? source.action_complete ?? source.actionComplete
  );

  if (!label && !tab && !profileTab && !hash && !callback) return null;
  const action = {
    label: label || 'Abrir'
  };
  if (tab) action.tab = tab;
  if (profileTab) action.profileTab = profileTab;
  if (hash) action.hash = hash;
  if (callback) action.callback = callback;
  if (completeValue !== null) action.complete = completeValue;
  return action;
};

const extractPushPayload = (rawEntry) => {
  const envelope = asObject(rawEntry);
  const raw = asObject(envelope.raw && typeof envelope.raw === 'object' ? envelope.raw : envelope);
  const push = asObject(raw.notification && typeof raw.notification === 'object' ? raw.notification : raw);
  const data = asObject(push.data || raw.data || envelope.data);

  const title = pickString(push.title, raw.title, data.title, data.alert_title) || 'Nueva notificacion';
  const text = pickString(
    push.body,
    push.text,
    push.subtitle,
    raw.body,
    raw.text,
    raw.subtitle,
    data.body,
    data.text,
    data.message,
    data.alert_body
  );
  const messageId = pickString(
    push.id,
    raw.id,
    raw.messageId,
    data.id,
    data.notification_id,
    data.message_id,
    data.messageId,
    data.google_message_id,
    data['google.message_id']
  );
  const type = pickString(data.type, data.notification_type, data.kind) || 'push';
  const icon = pickString(data.icon);
  const toneRaw = pickString(data.tone).toLowerCase();
  const tone = toneRaw === 'good' || toneRaw === 'warn' ? toneRaw : '';
  const action = parsePushAction(data);
  const createdAt =
    Number(envelope.received_at || push.sentTime || raw.sentTime || data.sent_at || data.ts) ||
    Date.now();

  return {
    id: messageId ? `push-${messageId}` : '',
    type,
    title,
    text,
    created_at: createdAt,
    action,
    icon,
    tone
  };
};

const isDuplicatePush = (items, candidate) => {
  if (!candidate) return false;
  if (!Array.isArray(items) || !items.length) return false;

  if (candidate.id && items.some((item) => item && item.id === candidate.id)) {
    return true;
  }

  const candidateTitle = String(candidate.title || '').trim();
  const candidateText = String(candidate.text || '').trim();
  if (!candidateTitle && !candidateText) return false;

  return items.some((item) => {
    if (!item || item.type !== 'push') return false;
    const itemTitle = String(item.title || '').trim();
    const itemText = String(item.text || '').trim();
    if (itemTitle !== candidateTitle || itemText !== candidateText) return false;
    const age = Math.abs((Number(item.created_at) || 0) - (Number(candidate.created_at) || 0));
    return age <= PUSH_DUP_WINDOW_MS;
  });
};

const normalizeNotification = (entry) => {
  if (!entry || typeof entry !== 'object') return null;
  const created = Number(entry.created_at) || Date.now();
  const status = entry.status === 'read' || entry.status === 'done' ? entry.status : 'unread';
  const action = entry.action && typeof entry.action === 'object' ? { ...entry.action } : null;
  return {
    id: entry.id || generateId(),
    type: entry.type || 'info',
    title: entry.title || 'Notificacion',
    text: entry.text || '',
    status,
    created_at: created,
    action,
    icon: entry.icon || '',
    tone: entry.tone || ''
  };
};

const readNotifications = () => {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_KEY);
    if (!raw) return [];
    const parsed = safeParse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeNotification)
      .filter(Boolean)
      .sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
  } catch (err) {
    return [];
  }
};

const writeNotifications = (items) => {
  try {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(items));
  } catch (err) {
    // no-op
  }
};

const emitChange = (items) => {
  try {
    window.dispatchEvent(new CustomEvent('app:notifications-change', { detail: items }));
  } catch (err) {
    // no-op
  }
};

const persistNotifications = (items) => {
  const list = Array.isArray(items) ? items.slice(0, NOTIFICATIONS_MAX) : [];
  writeNotifications(list);
  emitChange(list);
  return list;
};

export const getNotifications = () => readNotifications();

export const setNotifications = (items) => persistNotifications(items);

export const addNotification = (entry) => {
  const next = normalizeNotification(entry);
  if (!next) return null;
  const items = readNotifications();
  items.unshift(next);
  persistNotifications(items);
  return next;
};

export const addPushNotification = (rawEntry) => {
  const push = extractPushPayload(rawEntry);
  if (!push) return null;

  const items = readNotifications();
  const candidate = {
    id: push.id,
    type: push.type || 'push',
    title: push.title || 'Nueva notificacion',
    text: push.text || '',
    status: 'unread',
    created_at: push.created_at || Date.now(),
    action: push.action || null,
    icon: push.icon || 'notifications-outline',
    tone: push.tone || ''
  };

  if (isDuplicatePush(items, candidate)) return null;
  candidate.id = candidate.id || generateId();
  items.unshift(normalizeNotification(candidate));
  persistNotifications(items);
  return candidate;
};

export const removeNotification = (id) => {
  if (!id) return;
  const items = readNotifications().filter((item) => item.id !== id);
  persistNotifications(items);
};

export const clearNotifications = () => {
  persistNotifications([]);
};

export const markNotificationRead = (id) => {
  if (!id) return;
  const items = readNotifications();
  let changed = false;
  items.forEach((item) => {
    if (item.id === id && item.status === 'unread') {
      item.status = 'read';
      changed = true;
    }
  });
  if (changed) persistNotifications(items);
};

export const markAllNotificationsRead = () => {
  const items = readNotifications();
  let changed = false;
  items.forEach((item) => {
    if (item.status === 'unread') {
      item.status = 'read';
      changed = true;
    }
  });
  if (changed) persistNotifications(items);
};

export const completeNotification = (id) => {
  removeNotification(id);
};

export const getUnreadCount = () =>
  readNotifications().reduce((sum, item) => sum + (item.status === 'unread' ? 1 : 0), 0);

const demoFactories = [
  () => {
    const qty = [2, 3, 4, 5][Math.floor(Math.random() * 4)];
    return {
      type: 'review',
      tone: 'warn',
      icon: 'book-outline',
      title: `Tienes ${qty} palabras flojas`,
      text: 'Ve a Review y mejora tu pronunciacion.',
      action: { label: 'Revisar', tab: 'tu', profileTab: 'review', complete: true }
    };
  },
  () => ({
    type: 'reward',
    tone: 'good',
    icon: 'sparkles-outline',
    title: 'Nuevo badge desbloqueado',
    text: 'Racha de 3 dias completada.',
    action: { label: 'Ver perfil', tab: 'tu', profileTab: 'prefs', complete: true }
  }),
  () => ({
    type: 'practice',
    icon: 'mic-outline',
    title: 'Mini practica lista',
    text: 'Solo 2 minutos para hoy.',
    action: { label: 'Practicar', hash: '/speak', complete: true }
  }),
  () => ({
    type: 'talk',
    icon: 'chatbubble-ellipses-outline',
    title: 'Coach listo para ti',
    text: 'Pregunta algo al coach.',
    action: { label: 'Abrir coach', tab: 'premium', complete: true }
  }),
  () => ({
    type: 'reminder',
    tone: 'warn',
    icon: 'timer-outline',
    title: 'Recordatorio',
    text: 'Practica 5 minutos hoy.',
    action: { label: 'Ir a Home', tab: 'home', complete: true }
  }),
  () => ({
    type: 'info',
    icon: 'notifications-outline',
    title: 'Novedad',
    text: 'Hay nuevos ejercicios disponibles.',
    action: null
  })
];

export const generateDemoNotifications = () => {
  const now = Date.now();
  demoFactories.forEach((factory, idx) => {
    const payload = factory();
    addNotification({ ...payload, created_at: now - idx * 1000 });
  });
};

export const flushPendingPushNotifications = () => {
  if (typeof window === 'undefined') return 0;
  const pending = Array.isArray(window[PUSH_QUEUE_KEY]) ? window[PUSH_QUEUE_KEY].slice() : [];
  if (!pending.length) return 0;
  window[PUSH_QUEUE_KEY] = [];
  let added = 0;
  pending.forEach((entry) => {
    if (addPushNotification(entry)) {
      added += 1;
    }
  });
  return added;
};

if (typeof window !== 'undefined') {
  window.getAppNotifications = getNotifications;
  window.addAppNotification = addNotification;
  window.addPushNotification = addPushNotification;
  window.flushPendingPushNotifications = flushPendingPushNotifications;
  window.clearAppNotifications = clearNotifications;
  window.removeAppNotification = removeNotification;
  window.generateDemoNotifications = generateDemoNotifications;
  flushPendingPushNotifications();
}
