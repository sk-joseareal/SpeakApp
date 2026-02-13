const NOTIFICATIONS_KEY = 'appv5:notifications';
const NOTIFICATIONS_MAX = 200;

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
    action: { label: 'Practicar', tab: 'speak', complete: true }
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
    action: { label: 'Ir a Training', tab: 'listas', complete: true }
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

if (typeof window !== 'undefined') {
  window.getAppNotifications = getNotifications;
  window.addAppNotification = addNotification;
  window.clearAppNotifications = clearNotifications;
  window.removeAppNotification = removeNotification;
  window.generateDemoNotifications = generateDemoNotifications;
}
