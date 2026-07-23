import type { FetchOptions } from 'ofetch'

/** The authenticated Spectre API client provided by plugins/api.ts. */
export type ApiClient = <T = unknown>(request: string, options?: FetchOptions) => Promise<T>

/** Access the shared `$api` client (baseURL `${apiBase}/api/v1`, bearer auth, 401-rotation refresh). */
export function useApi(): ApiClient {
  return useNuxtApp().$api
}

/** Build an absolute URL for a backend-relative asset path such as `/uploads/<uuid>.png` (§7). */
export function useAssetUrl() {
  const base = useRuntimeConfig().public.apiBase
  return (path?: string | null): string | undefined => {
    if (!path) return undefined
    if (/^https?:\/\//.test(path)) return path
    return `${base}${path.startsWith('/') ? '' : '/'}${path}`
  }
}
