import type {
  ApiItem,
  ApiList,
  StockCategory,
  StockItem,
  StockMovement,
  StockReason
} from '~/types/spectre'

export interface StockBatchExpiring {
  id: number
  stockItemId: number
  stockItemName?: string
  qty: number
  expiresAt: string
}

// §6.7 (stock, FEFO batches).
export function useStockApi() {
  const api = useApi()

  return {
    categories: async (): Promise<StockCategory[]> => (await api<ApiList<StockCategory>>('/stock-categories')).data,
    createCategory: (body: { name: string }) =>
      api<ApiItem<StockCategory>>('/stock-categories', { method: 'POST', body }).then(r => r.data),

    items: async (params?: { q?: string, low?: boolean }): Promise<StockItem[]> =>
      (await api<ApiList<StockItem>>('/stock-items', { query: params })).data,
    item: (id: number) => api<ApiItem<StockItem>>(`/stock-items/${id}`).then(r => r.data),
    createItem: (body: { name: string, categoryId?: number, unit?: string, minQty?: number }) =>
      api<ApiItem<StockItem>>('/stock-items', { method: 'POST', body }).then(r => r.data),
    updateItem: (id: number, body: Partial<{ name: string, categoryId: number, unit: string, minQty: number }>) =>
      api<ApiItem<StockItem>>(`/stock-items/${id}`, { method: 'PATCH', body }).then(r => r.data),

    // FEFO: new batch (IN) / write-off (OUT)
    receive: (id: number, body: { qty: number, expiresAt?: string, note?: string }) =>
      api<ApiItem<StockItem>>(`/stock-items/${id}/receive`, { method: 'POST', body }).then(r => r.data),
    writeoff: (id: number, body: { qty: number, reason: StockReason, comment?: string, photoUrl?: string }) =>
      api<ApiItem<StockItem>>(`/stock-items/${id}/writeoff`, { method: 'POST', body }).then(r => r.data),

    low: async (): Promise<StockItem[]> => (await api<ApiList<StockItem>>('/stock/low')).data,
    expiring: async (days = 7): Promise<StockBatchExpiring[]> =>
      (await api<ApiList<StockBatchExpiring>>('/stock/expiring', { query: { days } })).data,
    movements: async (stockItemId?: number): Promise<StockMovement[]> =>
      (await api<ApiList<StockMovement>>('/stock/movements', { query: stockItemId ? { stock_item_id: stockItemId } : {} })).data
  }
}
