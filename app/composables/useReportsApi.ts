import type { ApiItem, ApiList, DailyReport, DashboardStats, LogEntry, WasherCar, WasherSalaryReport } from '~/types/spectre'

// §6.10 — daily financial report, dashboard aggregate, and the action log.
export function useReportsApi() {
  const api = useApi()

  return {
    daily: (date?: string) =>
      api<ApiItem<DailyReport>>('/reports/daily', { query: date ? { date } : {} }).then(r => r.data),
    dashboard: () => api<ApiItem<DashboardStats>>('/stats/dashboard').then(r => r.data),
    washers: (params?: { from?: string, to?: string }) =>
      api<ApiItem<WasherSalaryReport>>('/reports/washers', { query: params }).then(r => r.data),
    addWasher: (name: string) =>
      api<ApiItem<{ id: number, name: string }>>('/washers', { method: 'POST', body: { name } }).then(r => r.data),
    deleteWasher: (id: number) =>
      api(`/washers/${id}`, { method: 'DELETE' }),
    setWashRate: (rate: number) =>
      api('/reports/wash-rate', { method: 'PUT', body: { rate } }),
    washerCars: (id: number, params?: { from?: string, to?: string }): Promise<WasherCar[]> =>
      api<ApiList<WasherCar>>(`/reports/washers/${id}/cars`, { query: params }).then(r => r.data),
    logs: async (params?: { entity?: string, action?: string, level?: string, limit?: number }): Promise<LogEntry[]> =>
      (await api<ApiList<LogEntry>>('/logs', { query: params })).data
  }
}
