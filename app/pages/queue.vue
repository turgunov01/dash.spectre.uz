<script setup lang="ts">
import { QUEUE_STATUSES, statusTransitions } from '~/types/spectre'
import type { Order, OrderStatus } from '~/types/spectre'
import type { Employee } from '~/composables/useFilesApi'

useHead({ title: 'Живая очередь — Spectre' })

const auth = useAuthStore()
const ordersApi = useOrdersApi()
const toast = useToast()
const { orders, connected, error } = useQueue()

const canWrite = computed(() => auth.can('orders.write'))
const isOwner = computed(() => auth.role === 'OWNER')
const canCreate = computed(() => auth.can('orders.create'))
const canAssign = computed(() => auth.can('orders.assign'))
const canTake = computed(() => auth.can('orders.take'))

const carLabel = (o: Order) =>
  [o.make ?? o.car?.make, o.model ?? o.car?.model].filter(Boolean).join(' ')

const search = ref('')

const matchesSearch = (o: Order) => {
  const q = search.value.trim().toLowerCase()
  if (!q) return true
  const plate = (o.plate || o.car?.plate || '').toLowerCase()
  const washer = (o.assignedWasher?.name || o.assignedWasher?.email || '').toLowerCase()
  const car = carLabel(o).toLowerCase()
  const num = String(o.number ?? o.id)
  return plate.includes(q) || washer.includes(q) || car.includes(q) || num.includes(q)
}

const columns = computed(() =>
  QUEUE_STATUSES.map(status => ({
    status,
    items: orders.value
      .filter(o => o.status === status && matchesSearch(o))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  })))

const busy = ref<number | null>(null)

async function run(order: Order, fn: () => Promise<unknown>, okTitle: string) {
  busy.value = order.id
  try {
    await fn()
    toast.add({ title: okTitle, color: 'success', icon: 'i-lucide-check' })
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    busy.value = null
  }
}

const changeStatus = (o: Order, status: OrderStatus) => run(o, () => ordersApi.setStatus(o.id, status), 'Статус обновлён')
const take = (o: Order) => run(o, () => ordersApi.take(o.id), 'Заказ взят')
const assignAuto = (o: Order) => run(o, () => ordersApi.assignAuto(o.id), 'Мойщик назначен')

// Manual assign from a dropdown of active washers (ADMIN/OWNER only)
const employeesApi = useEmployeesApi()
const washers = ref<Employee[]>([])
const washerItems = computed(() => washers.value.map(w => ({ label: w.name || w.email, value: w.id })))
const assignTo = (o: Order, washerId: unknown) =>
  typeof washerId === 'number' ? run(o, () => ordersApi.assign(o.id, washerId), 'Мойщик назначен') : undefined
onMounted(async () => {
  if (!canAssign.value) return
  try {
    washers.value = await employeesApi.list({ role: 'WASHER', active: true })
  } catch {
    // non-fatal: the dropdown just stays empty
  }
})
</script>

<template>
  <UDashboardPanel id="queue">
    <template #header>
      <UDashboardNavbar title="Живая очередь" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="Поиск по номеру машины…"
            size="sm"
            class="w-56"
            :ui="{ trailing: 'pe-1' }"
          >
            <template v-if="search" #trailing>
              <UButton
                color="neutral"
                variant="link"
                size="sm"
                icon="i-lucide-x"
                aria-label="Очистить"
                @click="search = ''"
              />
            </template>
          </UInput>
          <UBadge
            :color="connected ? 'success' : 'neutral'"
            variant="subtle"
            :label="connected ? 'В реальном времени' : 'Переподключение…'"
            :icon="connected ? 'i-lucide-wifi' : 'i-lucide-wifi-off'"
          />
          <UButton v-if="canCreate" to="/orders?new=1" icon="i-lucide-plus" label="Заказ" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        title="Ошибка подключения к очереди"
        :description="error"
        class="mb-4"
      />

      <div class="flex gap-4 overflow-x-auto pb-4 min-h-[60vh]">
        <div
          v-for="col in columns"
          :key="col.status"
          class="w-72 shrink-0 flex flex-col gap-3"
        >
          <div class="flex items-center justify-between px-1">
            <div class="flex items-center gap-2">
              <UBadge :color="ORDER_STATUS_COLOR[col.status]" variant="subtle" :label="ORDER_STATUS_LABEL[col.status]" />
            </div>
            <span class="text-xs text-muted">{{ col.items.length }}</span>
          </div>

          <div class="flex flex-col gap-2">
            <div
              v-for="o in col.items"
              :key="o.id"
              class="rounded-lg border border-default bg-default p-3 flex flex-col gap-2"
            >
              <div class="flex items-center justify-between gap-2">
                <NuxtLink :to="`/orders/${o.id}`" class="font-semibold text-highlighted hover:text-primary truncate">
                  {{ o.plate || o.car?.plate || `#${o.number || o.id}` }}
                  <span v-if="carLabel(o)" class="font-normal text-muted">· {{ carLabel(o) }}</span>
                </NuxtLink>
                <UBadge v-if="o.position" color="neutral" variant="soft" size="sm" :label="`№${o.position}`" />
              </div>

              <div class="flex items-center gap-3 text-xs text-muted">
                <span class="inline-flex items-center gap-1">
                  <UIcon name="i-lucide-clock" class="size-3.5" />
                  {{ formatWait(o.waitSec) }}
                </span>
                <span v-if="o.assignedWasher" class="inline-flex items-center gap-1 truncate">
                  <UIcon name="i-lucide-user" class="size-3.5" />
                  {{ o.assignedWasher.name || o.assignedWasher.email }}
                </span>
              </div>

              <div class="text-sm font-medium text-highlighted">
                {{ formatMoney(o.total) }}
              </div>

              <div v-if="canWrite || canTake || canAssign" class="flex flex-wrap gap-1 pt-1 border-t border-default">
                <UButton
                  v-if="canTake && (o.status === 'QUEUED' || o.status === 'NEW')"
                  size="xs"
                  color="primary"
                  variant="soft"
                  label="Взять"
                  :loading="busy === o.id"
                  @click="take(o)"
                />
                <UButton
                  v-if="canAssign && !o.assignedWasherId && ['NEW', 'QUEUED', 'ASSIGNED'].includes(o.status)"
                  size="xs"
                  color="neutral"
                  variant="soft"
                  label="Авто"
                  icon="i-lucide-wand-2"
                  :loading="busy === o.id"
                  @click="assignAuto(o)"
                />
                <USelectMenu
                  v-if="canAssign && !o.assignedWasherId && ['NEW', 'QUEUED', 'ASSIGNED'].includes(o.status)"
                  :items="washerItems"
                  value-key="value"
                  :model-value="undefined"
                  placeholder="Мойщик"
                  icon="i-lucide-user"
                  size="xs"
                  class="w-32"
                  :disabled="busy === o.id"
                  @update:model-value="(v) => assignTo(o, v)"
                />
                <UButton
                  v-for="next in (canWrite ? statusTransitions(o.status).filter(s => isOwner || s !== 'IN_PROGRESS') : [])"
                  :key="next"
                  size="xs"
                  :color="next === 'CANCELLED' ? 'error' : 'neutral'"
                  variant="outline"
                  :label="ORDER_STATUS_LABEL[next]"
                  :loading="busy === o.id"
                  @click="changeStatus(o, next)"
                />
                <UButton
                  v-if="o.status === 'AWAITING_PAYMENT'"
                  size="xs"
                  color="success"
                  variant="soft"
                  label="Оплата"
                  icon="i-lucide-banknote"
                  :to="`/orders/${o.id}`"
                />
              </div>
            </div>

            <p v-if="!col.items.length" class="text-xs text-dimmed text-center py-4">
              Пусто
            </p>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
