import { io, type Socket } from 'socket.io-client'
import type { PublicQueueRow } from '~/types/spectre'

// Public board (§4): unauthenticated Socket.IO `/public` namespace. Rows carry only
// orderId/plate/status/position. REST fallback: GET /public/queue.
export function usePublicQueue() {
  const config = useRuntimeConfig()

  const rows = ref<PublicQueueRow[]>([])
  const connected = ref(false)
  let socket: Socket | null = null

  function connect(): void {
    if (socket) return
    socket = io(`${config.public.apiBase}/public`, { transports: ['websocket'] })
    socket.on('connect', () => {
      connected.value = true
    })
    socket.on('disconnect', () => {
      connected.value = false
    })
    socket.on('queue:snapshot', (payload: PublicQueueRow[]) => {
      rows.value = Array.isArray(payload) ? payload : []
    })
  }

  function disconnect(): void {
    socket?.disconnect()
    socket = null
    connected.value = false
  }

  async function refreshSnapshot(): Promise<void> {
    try {
      const res = await $fetch<{ data: PublicQueueRow[] }>(`${config.public.apiBase}/api/v1/public/queue`)
      rows.value = res.data
    } catch {
      // board keeps last snapshot if the fallback fails
    }
  }

  onMounted(() => {
    connect()
    refreshSnapshot()
  })
  onBeforeUnmount(disconnect)

  return { rows, connected }
}
