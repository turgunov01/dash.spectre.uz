import type { AuthTokens, AuthUser, PermissionAction, Role } from '~/types/spectre'
import { PERMISSIONS } from '~/types/spectre'

// Auth transport is httpOnly cookies (set by the backend on login/pin/refresh).
// The refresh token is NEVER stored in JS/localStorage — it lives only in the httpOnly
// cookie, so the session survives reloads and rotates on refresh. The access token is
// kept in memory purely as a Bearer fallback; the cookie is the primary transport.

/** Minimal user shape for the public PIN-login picker (GET /auth/pin-users). */
export interface PinUser {
  id: number
  name: string | null
  email: string
  role: Role
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const user = ref<AuthUser | null>(null)
  const ready = ref(false)

  const isAuthenticated = computed(() => !!user.value)
  const role = computed<Role | null>(() => user.value?.role ?? null)
  const displayName = computed(() => user.value?.name || user.value?.email || '')

  function apiV1(): string {
    return `${useRuntimeConfig().public.apiBase}/api/v1`
  }

  function setSession(tokens: AuthTokens): void {
    accessToken.value = tokens.accessToken
    user.value = tokens.user
  }

  function clear(): void {
    accessToken.value = null
    user.value = null
  }

  async function login(email: string, password: string): Promise<AuthUser> {
    const tokens = await $fetch<AuthTokens>(`${apiV1()}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      body: { email, password }
    })
    setSession(tokens)
    return tokens.user
  }

  async function loginPin(userId: number, pin: string): Promise<AuthUser> {
    const tokens = await $fetch<AuthTokens>(`${apiV1()}/auth/pin`, {
      method: 'POST',
      credentials: 'include',
      body: { userId, pin }
    })
    setSession(tokens)
    return tokens.user
  }

  async function pinUsers(): Promise<PinUser[]> {
    const res = await $fetch<{ data: PinUser[] }>(`${apiV1()}/auth/pin-users`, { credentials: 'include' })
    return res.data
  }

  // Restore/rotate the session from the httpOnly refresh cookie. Single source of rotation.
  async function refresh(): Promise<boolean> {
    try {
      const tokens = await $fetch<AuthTokens>(`${apiV1()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        body: {}
      })
      setSession(tokens)
      return true
    } catch {
      clear()
      return false
    }
  }

  async function logout(): Promise<void> {
    try {
      await $fetch(`${apiV1()}/auth/logout`, { method: 'POST', credentials: 'include', body: {} })
    } catch {
      // ignore — clear the local session regardless
    }
    clear()
  }

  // Restore the session on app boot from the httpOnly refresh cookie (no-op if none).
  async function init(): Promise<void> {
    if (ready.value) return
    await refresh()
    ready.value = true
  }

  function hasAnyRole(roles: Role[]): boolean {
    if (!role.value) return false
    if (role.value === 'OWNER') return true
    return roles.includes(role.value)
  }

  function can(action: PermissionAction): boolean {
    if (!role.value) return false
    if (role.value === 'OWNER') return true
    return PERMISSIONS[action]?.includes(role.value) ?? false
  }

  return {
    accessToken,
    user,
    ready,
    isAuthenticated,
    role,
    displayName,
    login,
    loginPin,
    pinUsers,
    refresh,
    logout,
    clear,
    init,
    hasAnyRole,
    can
  }
})
