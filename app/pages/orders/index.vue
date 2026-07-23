<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import type { TableColumn } from '@nuxt/ui'
import { ORDER_STATUSES } from '~/types/spectre'
import type { Order, OrderStatus } from '~/types/spectre'

useHead({ title: 'Заказы — Spectre' })

const auth = useAuthStore()
const ordersApi = useOrdersApi()
const route = useRoute()

const q = ref('')
const qd = refDebounced(q, 300)
const statusFilter = ref<OrderStatus | undefined>(undefined)

const { data: orders, status, refresh } = useAsyncData(
  'orders',
  () => ordersApi.list({ q: qd.value || undefined, status: statusFilter.value }),
  { watch: [qd, statusFilter], lazy: true, default: () => [] }
)

const statusItems = [
  { label: 'Все статусы', value: undefined as OrderStatus | undefined },
  ...ORDER_STATUSES.map(s => ({ label: ORDER_STATUS_LABEL[s], value: s as OrderStatus | undefined }))
]

const canCreate = computed(() => auth.can('orders.create'))
const createOpen = ref(false)

onMounted(() => {
  if (route.query.new && canCreate.value) createOpen.value = true
})

function onCreated(orderId: number) {
  refresh()
  navigateTo(`/orders/${orderId}`)
}

const columns: TableColumn<Order>[] = [
  { id: 'order', header: 'Заказ' },
  { id: 'client', header: 'Клиент' },
  { accessorKey: 'status', header: 'Статус' },
  { id: 'washer', header: 'Мойщик' },
  { id: 'total', header: 'Сумма' }
]
</script>

<template>
  <UDashboardPanel id="orders">
    <template #header>
      <UDashboardNavbar title="Заказы" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="canCreate" icon="i-lucide-plus" label="Заказ" @click="createOpen = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <UInput v-model="q" icon="i-lucide-search" placeholder="Номер, госномер, телефон, имя" class="w-full sm:w-64" />
        <USelect v-model="statusFilter" :items="statusItems" value-key="value" class="w-full sm:w-44" />
      </div>
      <UTable
        :data="orders"
        :columns="columns"
        :loading="status === 'pending'"
      >
        <template #order-cell="{ row }">
          <NuxtLink :to="`/orders/${row.original.id}`" class="flex flex-col hover:text-primary">
            <span class="font-medium text-highlighted">#{{ row.original.number || row.original.id }}</span>
            <span class="text-xs text-muted font-mono">{{ row.original.plate || row.original.car?.plate || '—' }}</span>
          </NuxtLink>
        </template>
        <template #client-cell="{ row }">
          {{ row.original.client?.name || row.original.clientName || '—' }}
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="ORDER_STATUS_COLOR[row.original.status]" variant="subtle" :label="ORDER_STATUS_LABEL[row.original.status]" />
        </template>
        <template #washer-cell="{ row }">
          {{ row.original.assignedWasher?.name || row.original.assignedWasher?.email || '—' }}
        </template>
        <template #total-cell="{ row }">
          <span class="font-medium text-highlighted">{{ formatMoney(row.original.total) }}</span>
        </template>
      </UTable>

      <div v-if="status !== 'pending' && !orders?.length" class="text-center text-muted py-12">
        Заказы не найдены
      </div>

      <OrderCreateModal v-model:open="createOpen" @created="onCreated" />
    </template>
  </UDashboardPanel>
</template>
