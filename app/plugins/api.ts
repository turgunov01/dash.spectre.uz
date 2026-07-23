import type { FetchOptions } from 'ofetch'
import type { ApiClient } from '~/composables/useApi'

// Provides `$api`: a $fetch instance bound to `${apiBase}/api/v1` with bearer auth and the
// §2 single-flight 401→refresh(rotate)→retry behaviour. On a failed refresh the session is
// cleared and the user is sent to /login.
export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const auth = useAuthStore()

  const raw = $fetch.create({
    baseURL: `${config.public.apiBase}/api/v1`,
    // Send the httpOnly auth cookies with every request (cross-site in prod).
    credentials: 'include',
    onRequest({ options }) {
      // Bearer is an optional fallback; the httpOnly cookie is the primary transport.
      if (auth.accessToken) {
        const headers = new Headers(options.headers)
        headers.set('Authorization', `Bearer ${auth.accessToken}`)
        options.headers = headers
      }
    }
  })

  let refreshing: Promise<boolean> | null = null
  function ensureRefreshed(): Promise<boolean> {
    if (!refreshing) {
      refreshing = auth.refresh().finally(() => {
        refreshing = null
      })
    }
    return refreshing
  }

  // `$fetch.create` returns Nuxt's typed $Fetch whose `method` is a strict verb union; our generic
  // FetchOptions widens it to string, so treat the created instance as our ApiClient shape.
  const send = raw as unknown as ApiClient

  async function apiFetch<T>(request: string, options: FetchOptions & { _retried?: boolean } = {}): Promise<T> {
    try {
      return await send<T>(request, options)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 401 && !options._retried) {
        const ok = await ensureRefreshed()
        if (ok) return apiFetch<T>(request, { ...options, _retried: true })
        await auth.clear()
        if (import.meta.client) await navigateTo('/login')
      }
      throw err
    }
  }

  return {
    provide: {
      api: apiFetch as ApiClient
    }
  }
})

declare module '#app' {
  interface NuxtApp {
    $api: ApiClient
  }
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $api: ApiClient
  }
}
