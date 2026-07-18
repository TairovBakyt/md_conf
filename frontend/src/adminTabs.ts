export type AdminTabId =
  | 'scan'
  | 'prizeBooth'
  | 'redemptions'
  | 'achievements'
  | 'games'
  | 'admins'
  | 'docs'
  | 'chat'
  | 'adminChat'
  | 'recovery';

export interface AdminTabDef {
  id: AdminTabId;
  label: string;
  icon: string;
}

export const ADMIN_TAB_DEFS: AdminTabDef[] = [
  { id: 'scan', label: 'Сканирование', icon: '📷' },
  { id: 'prizeBooth', label: 'Стойка призов', icon: '🎟️' },
  { id: 'redemptions', label: 'История выдач', icon: '🎁' },
  { id: 'achievements', label: 'Достижения', icon: '🏆' },
  { id: 'games', label: 'Игры', icon: '🎮' },
  { id: 'admins', label: 'Администраторы', icon: '👥' },
  { id: 'docs', label: 'Документация', icon: '📖' },
  { id: 'chat', label: 'Сообщения', icon: '💬' },
  { id: 'adminChat', label: 'Чат админов', icon: '🗨️' },
  { id: 'recovery', label: 'Восстановление доступа', icon: '🔑' },
];

// null (или отсутствие поля) = полный доступ ко всем вкладкам.
// Массив id — только перечисленные вкладки доступны.
export function isTabAllowed(permissions: AdminTabId[] | null | undefined, tabId: AdminTabId): boolean {
  if (!permissions) return true;
  return permissions.includes(tabId);
}

export function getAccessLabel(permissions: AdminTabId[] | null | undefined): string {
  if (!permissions) return 'Полный доступ';
  if (permissions.length === 0) return 'Частичный доступ (нет вкладок)';
  const labels = permissions
    .map((id) => ADMIN_TAB_DEFS.find((t) => t.id === id)?.label ?? id)
    .join(', ');
  return `Частичный: ${labels}`;
}