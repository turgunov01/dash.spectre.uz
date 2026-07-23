import type { ApiItem, ApiList, Purchase, PurchaseAction, Supplier } from '~/types/spectre'

export interface PurchaseItemInput {
  name: string
  stockItemId?: number
  unit?: string
  qty: number
  estPrice: number
}

export interface PurchasePurchasedItem {
  purchaseItemId: number
  actualPrice: number
  actualQty: number
  expiresAt?: string
  photoUrl?: string
}

// §6.9 — suppliers and the purchase lifecycle.
export function useSuppliersApi() {
  const api = useApi()

  return {
    list: async (): Promise<Supplier[]> => (await api<ApiList<Supplier>>('/suppliers')).data,
    create: (body: { name: string, phone?: string, comment?: string }) =>
      api<ApiItem<Supplier>>('/suppliers', { method: 'POST', body }).then(r => r.data),
    update: (id: number, body: Partial<{ name: string, phone: string, comment: string }>) =>
      api<ApiItem<Supplier>>(`/suppliers/${id}`, { method: 'PATCH', body }).then(r => r.data)
  }
}

export function usePurchasesApi() {
  const api = useApi()

  return {
    list: async (status?: string): Promise<Purchase[]> =>
      (await api<ApiList<Purchase>>('/purchases', { query: status ? { status } : {} })).data,
    get: (id: number) => api<ApiItem<Purchase>>(`/purchases/${id}`).then(r => r.data),
    create: (body: { supplierId?: number, reason?: string, comment?: string, items: PurchaseItemInput[] }) =>
      api<ApiItem<Purchase>>('/purchases', { method: 'POST', body }).then(r => r.data),

    // Lifecycle transitions. `purchased` carries the actual line items.
    act: (id: number, action: PurchaseAction, body?: { items?: PurchasePurchasedItem[] }) =>
      api<ApiItem<Purchase>>(`/purchases/${id}/${action}`, { method: 'POST', body }).then(r => r.data)
  }
}
