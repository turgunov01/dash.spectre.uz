import type {
  ApiItem,
  ApiList,
  CashCurrent,
  CashOperation,
  CashSession,
  PaymentMethod,
  Payment,
  Refund
} from '~/types/spectre'

// §6.4 — cash register sessions and money movements. Payments/refunds/operations are immutable by design.
export function useCashApi() {
  const api = useApi()

  return {
    open: () => api<ApiItem<CashSession>>('/cash/open', { method: 'POST' }).then(r => r.data),
    close: () => api<ApiItem<CashSession>>('/cash/close', { method: 'POST' }).then(r => r.data),
    // Returns { session, totals } or null when the register is closed.
    current: async (): Promise<CashCurrent | null> =>
      (await api<ApiItem<CashCurrent | null>>('/cash/current')).data,
    sessions: async (): Promise<CashSession[]> => (await api<ApiList<CashSession>>('/cash/sessions')).data,
    session: (id: number) =>
      api<ApiItem<CashSession & { operations?: CashOperation[], payments?: Payment[], refunds?: Refund[] }>>(`/cash/sessions/${id}`).then(r => r.data),
    deposit: (body: { amount: number, method?: PaymentMethod, comment?: string }) =>
      api<ApiItem<CashOperation>>('/cash/deposit', { method: 'POST', body }).then(r => r.data),
    withdraw: (body: { amount: number, method?: PaymentMethod, comment: string }) =>
      api<ApiItem<CashOperation>>('/cash/withdraw', { method: 'POST', body }).then(r => r.data)
  }
}
