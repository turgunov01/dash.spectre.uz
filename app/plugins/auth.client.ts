// Restore the session from the persisted refresh token before the first route resolves,
// so the global auth middleware sees an authenticated user on a hard reload.
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  await auth.init()
})
