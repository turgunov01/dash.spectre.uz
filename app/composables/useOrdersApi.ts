import type { ApiItem, ApiList, Order, OrderItemType, OrderStatus, PaymentMethod } from '~/types/spectre'

export interface OrderItemInput {
  type: OrderItemType
  refId: number
  qty?: number
}

export interface CreateOrderByCar {
  carId: number
  items: OrderItemInput[]
  comment?: string
  discountAmount?: number
  photos?: string[]
}

export interface CreateOrderWalkIn {
  bodyTypeId: number
  plate: string
  clientName?: string
  phone?: string
  make?: string
  model?: string
  items: OrderItemInput[]
  comment?: string
  photos?: string[]
}

export interface RefundInput {
  amount: number
  method: PaymentMethod
  reason: string
  items?: Array<{ orderItemId: number, amount: number }>
}

// §6.3 / §6.4 / §6.5 — orders and their order-scoped payment / refund / discount actions.
export function useOrdersApi() {
  const api = useApi()

  return {
    list: async (params?: { q?: string, status?: OrderStatus, washer_id?: number, client_id?: number }): Promise<Order[]> =>
      (await api<ApiList<Order>>('/orders', { query: params })).data,
    get: (id: number) => api<ApiItem<Order>>(`/orders/${id}`).then(r => r.data),
    create: (body: CreateOrderByCar | CreateOrderWalkIn) =>
      api<ApiItem<Order>>('/orders', { method: 'POST', body }).then(r => r.data),

    setStatus: (id: number, status: OrderStatus, comment?: string) =>
      api<ApiItem<Order>>(`/orders/${id}/status`, { method: 'POST', body: { status, comment } }).then(r => r.data),
    assign: (id: number, washerId: number) =>
      api<ApiItem<Order>>(`/orders/${id}/assign`, { method: 'POST', body: { washerId } }).then(r => r.data),
    take: (id: number) => api<ApiItem<Order>>(`/orders/${id}/take`, { method: 'POST' }).then(r => r.data),
    assignAuto: (id: number) => api<ApiItem<Order>>(`/orders/${id}/assign-auto`, { method: 'POST' }).then(r => r.data),

    addItems: (id: number, items: OrderItemInput[]) =>
      api<ApiItem<Order>>(`/orders/${id}/items`, { method: 'POST', body: items }).then(r => r.data),
    removeItem: (id: number, itemId: number) =>
      api<ApiItem<Order>>(`/orders/${id}/items/${itemId}`, { method: 'DELETE' }).then(r => r.data),

    // Payment / refund (§6.4) — needs an open cash session; pay only from AWAITING_PAYMENT.
    pay: (id: number, method: PaymentMethod) =>
      api<ApiItem<Order>>(`/orders/${id}/pay`, { method: 'POST', body: { method } }).then(r => r.data),
    refund: (id: number, body: RefundInput) =>
      api<ApiItem<Order>>(`/orders/${id}/refund`, { method: 'POST', body }).then(r => r.data),

    // Discounts (§6.5) — applying replaces any previous discount.
    applyDiscount: (id: number, body: { discountId?: number, code?: string }) =>
      api<ApiItem<Order>>(`/orders/${id}/discount`, { method: 'POST', body }).then(r => r.data),
    removeDiscount: (id: number) =>
      api<ApiItem<Order>>(`/orders/${id}/discount`, { method: 'DELETE' }).then(r => r.data),

    // Car photos (приёмка) — URLs come from POST /files. POST adds, DELETE removes one.
    addPhotos: (id: number, photos: string[]) =>
      api<ApiItem<Order>>(`/orders/${id}/photos`, { method: 'POST', body: { photos } }).then(r => r.data),
    removePhoto: (id: number, photoId: number) =>
      api<ApiItem<Order>>(`/orders/${id}/photos/${photoId}`, { method: 'DELETE' }).then(r => r.data),

    // REST queue snapshot (§4 fallback)
    queue: async (): Promise<Order[]> => (await api<ApiList<Order>>('/queue')).data
  }
}
