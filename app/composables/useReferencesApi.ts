import type { ApiItem, ApiList, BodyType, Service, ServiceCategory, ServicePackage } from '~/types/spectre'

// §6.1 — car-wash reference books: body types, service categories, services (+ price matrix), packages.
export function useReferencesApi() {
  const api = useApi()

  return {
    // Body types
    bodyTypes: async (activeOnly = false): Promise<BodyType[]> =>
      (await api<ApiList<BodyType>>('/body-types', { query: activeOnly ? { active: true } : {} })).data,
    createBodyType: (body: Partial<BodyType>) =>
      api<ApiItem<BodyType>>('/body-types', { method: 'POST', body }).then(r => r.data),
    updateBodyType: (id: number, body: Partial<BodyType>) =>
      api<ApiItem<BodyType>>(`/body-types/${id}`, { method: 'PATCH', body }).then(r => r.data),
    deleteBodyType: (id: number) => api(`/body-types/${id}`, { method: 'DELETE' }),

    // Service categories
    serviceCategories: async (): Promise<ServiceCategory[]> =>
      (await api<ApiList<ServiceCategory>>('/service-categories')).data,
    createServiceCategory: (body: Partial<ServiceCategory>) =>
      api<ApiItem<ServiceCategory>>('/service-categories', { method: 'POST', body }).then(r => r.data),
    updateServiceCategory: (id: number, body: Partial<ServiceCategory>) =>
      api<ApiItem<ServiceCategory>>(`/service-categories/${id}`, { method: 'PATCH', body }).then(r => r.data),
    deleteServiceCategory: (id: number) => api(`/service-categories/${id}`, { method: 'DELETE' }),

    // Services
    services: async (params?: { category_id?: number, active?: boolean }): Promise<Service[]> =>
      (await api<ApiList<Service>>('/services', { query: params })).data,
    service: (id: number) => api<ApiItem<Service>>(`/services/${id}`).then(r => r.data),
    servicePrice: (id: number, bodyTypeId: number) =>
      api<ApiItem<{ serviceId: number, bodyTypeId: number, price: number }>>(`/services/${id}/price`, { query: { bodyTypeId } }).then(r => r.data),
    createService: (body: Record<string, unknown>) =>
      api<ApiItem<Service>>('/services', { method: 'POST', body }).then(r => r.data),
    updateService: (id: number, body: Record<string, unknown>) =>
      api<ApiItem<Service>>(`/services/${id}`, { method: 'PATCH', body }).then(r => r.data),
    setServicePrices: (id: number, prices: Array<{ bodyTypeId: number, price: number }>) =>
      api<ApiItem<Service>>(`/services/${id}/prices`, { method: 'PUT', body: prices }).then(r => r.data),
    deleteService: (id: number) => api(`/services/${id}`, { method: 'DELETE' }),

    // Packages
    packages: async (activeOnly = false): Promise<ServicePackage[]> =>
      (await api<ApiList<ServicePackage>>('/packages', { query: activeOnly ? { active: true } : {} })).data,
    package: (id: number) => api<ApiItem<ServicePackage>>(`/packages/${id}`).then(r => r.data),
    packagePrice: (id: number, bodyTypeId: number) =>
      api<ApiItem<{ base: number, discountPercent: number, total: number }>>(`/packages/${id}/price`, { query: { bodyTypeId } }).then(r => r.data),
    createPackage: (body: Record<string, unknown>) =>
      api<ApiItem<ServicePackage>>('/packages', { method: 'POST', body }).then(r => r.data),
    updatePackage: (id: number, body: Record<string, unknown>) =>
      api<ApiItem<ServicePackage>>(`/packages/${id}`, { method: 'PATCH', body }).then(r => r.data),
    setPackageServices: (id: number, serviceIds: number[]) =>
      api<ApiItem<ServicePackage>>(`/packages/${id}/services`, { method: 'PUT', body: serviceIds }).then(r => r.data),
    setPackageDiscounts: (id: number, discounts: Array<{ bodyTypeId: number, discountPercent: number }>) =>
      api<ApiItem<ServicePackage>>(`/packages/${id}/discounts`, { method: 'PUT', body: discounts }).then(r => r.data),
    deletePackage: (id: number) => api(`/packages/${id}`, { method: 'DELETE' })
  }
}
