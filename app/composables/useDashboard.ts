import { createSharedComposable } from '@vueuse/core'

const _useDashboard = () => {
  const router = useRouter()

  defineShortcuts({
    'g-h': () => router.push('/'),
    'g-q': () => router.push('/queue'),
    'g-o': () => router.push('/orders'),
    'g-c': () => router.push('/clients'),
    'g-k': () => router.push('/cash'),
    'g-n': () => router.push('/notifications')
  })

  return {}
}

export const useDashboard = createSharedComposable(_useDashboard)
