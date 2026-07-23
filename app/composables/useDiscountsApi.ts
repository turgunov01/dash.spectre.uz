import type { ApiItem, ApiList, Discount, DiscountStatus, DiscountType } from '~/types/spectre'

export interface DiscountInput {
  name: string
  type: DiscountType
  value: number
  code?: string
  clientId?: number
  startsAt?: string
  endsAt?: string
  oneTime?: boolean
  reason?: string
  status?: DiscountStatus
}

// §6.5 — discount catalogue (CRUD). Applying to an order lives in useOrdersApi.
export function useDiscountsApi() {
  const api = useApi()

  return {
    list: async (params?: { type?: DiscountType, status?: DiscountStatus, client_id?: number, code?: string }): Promise<Discount[]> =>
      (await api<ApiList<Discount>>('/discounts', { query: params })).data,
    get: (id: number) => api<ApiItem<Discount>>(`/discounts/${id}`).then(r => r.data),
    create: (body: DiscountInput) => api<ApiItem<Discount>>('/discounts', { method: 'POST', body }).then(r => r.data),
    update: (id: number, body: Partial<DiscountInput>) =>
      api<ApiItem<Discount>>(`/discounts/${id}`, { method: 'PATCH', body }).then(r => r.data),
    remove: (id: number) => api(`/discounts/${id}`, { method: 'DELETE' })
  }
}
