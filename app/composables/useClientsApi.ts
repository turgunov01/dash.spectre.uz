import type { ApiItem, ApiList, Car, Client } from '~/types/spectre'

export interface ClientInput {
  name: string
  phone?: string
  comment?: string
}

export interface CarInput {
  plate: string
  bodyTypeId: number
  make?: string
  model?: string
  clientId?: number
  comment?: string
}

// §6.2 — clients & cars.
export function useClientsApi() {
  const api = useApi()

  return {
    list: async (q?: string): Promise<Client[]> =>
      (await api<ApiList<Client>>('/clients', { query: q ? { q } : {} })).data,
    get: (id: number) => api<ApiItem<Client>>(`/clients/${id}`).then(r => r.data),
    create: (body: ClientInput) => api<ApiItem<Client>>('/clients', { method: 'POST', body }).then(r => r.data),
    update: (id: number, body: Partial<ClientInput>) =>
      api<ApiItem<Client>>(`/clients/${id}`, { method: 'PATCH', body }).then(r => r.data),
    remove: (id: number) => api(`/clients/${id}`, { method: 'DELETE' })
  }
}

export function useCarsApi() {
  const api = useApi()

  return {
    list: async (params?: { q?: string, client_id?: number }): Promise<Car[]> =>
      (await api<ApiList<Car>>('/cars', { query: params })).data,
    get: (id: number) => api<ApiItem<Car>>(`/cars/${id}`).then(r => r.data),
    create: (body: CarInput) => api<ApiItem<Car>>('/cars', { method: 'POST', body }).then(r => r.data),
    update: (id: number, body: Partial<CarInput>) =>
      api<ApiItem<Car>>(`/cars/${id}`, { method: 'PATCH', body }).then(r => r.data),
    remove: (id: number) => api(`/cars/${id}`, { method: 'DELETE' })
  }
}
