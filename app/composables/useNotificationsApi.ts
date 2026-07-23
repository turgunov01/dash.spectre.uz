import type { ApiList, Notification, TelegramUser } from '~/types/spectre'

// §6.10 — notifications and Telegram registration.
export function useNotificationsApi() {
  const api = useApi()

  return {
    // Returns the full envelope so callers can read `unreadCount`.
    list: (params?: { unread?: boolean, type?: string }) =>
      api<ApiList<Notification>>('/notifications', { query: params }),
    markRead: (id: number) => api(`/notifications/${id}/read`, { method: 'POST' }),
    markAllRead: () => api('/notifications/read-all', { method: 'POST' }),

    telegramRegister: (body: { chatId: string, label?: string }) =>
      api('/telegram/register', { method: 'POST', body }),
    telegramUsers: async (): Promise<TelegramUser[]> => (await api<ApiList<TelegramUser>>('/telegram/users')).data
  }
}
