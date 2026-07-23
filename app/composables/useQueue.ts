import { io, type Socket } from 'socket.io-client'
import type { Order } from '~/types/spectre'

// Internal live queue (§4): authenticated Socket.IO `/internal` namespace delivering full orders
// with `position` and `waitSec`. REST fallback: GET /queue. Call from a page/component setup.
export function useQueue() {
  const config = useRuntimeConfig()
  const auth = useAuthStore()
  const api = useApi()

  const orders = ref<Order[]>([])
  const connected = ref(false)
  const error = ref<string | null>(null)
  let socket: Socket | null = null

  function connect(): void {
    if (socket) return
    socket = io(`${config.public.apiBase}/internal`, {
      transports: ['websocket'],
      auth: { token: auth.accessToken ?? '' }
    })
    socket.on('connect', () => {
      connected.value = true
      error.value = null
    })
    socket.on('disconnect', () => {
      connected.value = false
    })
    socket.on('queue:snapshot', (payload: Order[]) => {
      orders.value = Array.isArray(payload) ? payload : []
    })
    socket.on('connect_error', (e: Error) => {
      error.value = e.message
      connected.value = false
    })
  }

  function disconnect(): void {
    socket?.disconnect()
    socket = null
    connected.value = false
  }

  async function refreshSnapshot(): Promise<void> {
    try {
      const res = await api<{ data: Order[] }>('/queue')
      orders.value = res.data
    } catch (e) {
      error.value = apiErrorMessage(e)
    }
  }

  onMounted(() => {
    connect()
    refreshSnapshot()
  })
  onBeforeUnmount(disconnect)

  // Reconnect with the rotated access token.
  watch(() => auth.accessToken, () => {
    if (socket) {
      disconnect()
      connect()
    }
  })

  return {
    orders,
    connected,
    error,
    refreshSnapshot,
    reconnect: () => {
      disconnect()
      connect()
    }
  }
}
