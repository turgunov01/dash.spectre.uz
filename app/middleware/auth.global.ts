import type { Role } from '~/types/spectre'

// Global route gate. `/login` and `/board` are public; every other route requires a session,
// and pages may declare `meta.roles` to require one of a set of roles (OWNER always passes).
export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore()

  if (to.path === '/login') {
    return auth.isAuthenticated ? navigateTo('/') : undefined
  }

  if (to.path === '/board') return

  if (!auth.isAuthenticated) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }

  // Перегонщик (VALET) работает только с живой очередью — остальные экраны недоступны даже по прямому URL.
  if (auth.role === 'VALET') {
    const VALET_ALLOWED = ['/queue', '/403']
    return VALET_ALLOWED.includes(to.path) ? undefined : navigateTo('/queue')
  }

  const roles = to.meta.roles as Role[] | undefined
  if (roles?.length && !auth.hasAnyRole(roles)) {
    return navigateTo('/403')
  }
})
