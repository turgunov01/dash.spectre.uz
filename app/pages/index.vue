<script setup lang="ts">
useHead({ title: 'Дашборд — Spectre' })

const auth = useAuthStore()
const cashApi = useCashApi()
const reportsApi = useReportsApi()
const toast = useToast()

const canDash = computed(() => auth.can('dashboard.view'))
const canCash = computed(() => auth.can('cash.session'))

const { data: stats, status: statsStatus } = useAsyncData(
  'dashboard-stats',
  () => (canDash.value ? reportsApi.dashboard() : Promise.resolve(null)),
  { lazy: true, default: () => null }
)

const { data: cash, refresh: refreshCash } = useAsyncData(
  'dashboard-cash',
  () => (canCash.value ? cashApi.current() : Promise.resolve(null)),
  { lazy: true, default: () => null }
)

interface StatCard {
  label: string
  value: string
  icon: string
  color: BadgeColor
}

const cards = computed<StatCard[]>(() => {
  const s = stats.value
  const out: StatCard[] = []
  const balance = s?.cash?.cashBalance ?? cash.value?.totals.cashBalance
  if (balance !== undefined) out.push({ label: 'Баланс кассы', value: formatMoney(balance), icon: 'i-lucide-wallet', color: 'primary' })
  if (s?.turnover !== undefined) out.push({ label: 'Оборот за день', value: formatMoney(s.turnover), icon: 'i-lucide-trending-up', color: 'success' })
  if (s?.queue?.total !== undefined) out.push({ label: 'В очереди', value: String(s.queue.total), icon: 'i-lucide-list-ordered', color: 'info' })
  if (s?.lowStock !== undefined) out.push({ label: 'Мало на складе', value: String(s.lowStock), icon: 'i-lucide-package-x', color: 'warning' })
  if (s?.activePurchases !== undefined) out.push({ label: 'Активные закупки', value: String(s.activePurchases), icon: 'i-lucide-shopping-cart', color: 'neutral' })
  return out
})

const cashOpen = computed(() => !!cash.value?.session && cash.value.session.status !== 'CLOSED')

async function openCash() {
  try {
    await cashApi.open()
    toast.add({ title: 'Касса открыта', color: 'success', icon: 'i-lucide-check' })
    await refreshCash()
  } catch (err) {
    toast.add({ title: 'Не удалось открыть кассу', description: apiErrorMessage(err), color: 'error' })
  }
}

interface QuickAction {
  label: string
  to: string
  icon: string
}

const quickActions = computed<QuickAction[]>(() => {
  const role = auth.role
  const actions: QuickAction[] = [
    { label: 'Живая очередь', to: '/queue', icon: 'i-lucide-list-ordered' }
  ]
  if (auth.can('orders.create')) actions.push({ label: 'Новый заказ', to: '/orders?new=1', icon: 'i-lucide-plus' })
  if (role && ['OWNER', 'CASHIER'].includes(role)) actions.push({ label: 'Касса', to: '/cash', icon: 'i-lucide-wallet' })
  if (role && ['OWNER', 'ACCOUNTANT'].includes(role)) actions.push({ label: 'Склад', to: '/stock', icon: 'i-lucide-package' })
  return actions
})
</script>

<template>
  <UDashboardPanel id="dashboard">
    <template #header>
      <UDashboardNavbar title="Дашборд" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UBadge
            v-if="canCash"
            :color="cashOpen ? 'success' : 'neutral'"
            variant="subtle"
            :label="cashOpen ? 'Касса открыта' : 'Касса закрыта'"
            :icon="cashOpen ? 'i-lucide-lock-open' : 'i-lucide-lock'"
          />
          <UButton
            v-if="canCash && !cashOpen"
            label="Открыть кассу"
            icon="i-lucide-unlock"
            color="primary"
            @click="openCash"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-8">
        <div>
          <h2 class="text-lg font-semibold text-highlighted">
            Здравствуйте, {{ auth.displayName }}
          </h2>
          <p class="text-sm text-muted">
            {{ auth.role ? ROLE_LABEL[auth.role] : '' }}
          </p>
        </div>

        <div v-if="canDash">
          <div v-if="statsStatus === 'pending'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <USkeleton v-for="n in 4" :key="n" class="h-28" />
          </div>
          <div v-else-if="cards.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              v-for="card in cards"
              :key="card.label"
              class="rounded-xl border border-default bg-default p-5 flex flex-col gap-3"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm text-muted">{{ card.label }}</span>
                <span class="flex items-center justify-center size-9 rounded-lg bg-elevated text-primary">
                  <UIcon :name="card.icon" class="size-5" />
                </span>
              </div>
              <span class="text-2xl font-bold tracking-tight text-highlighted">{{ card.value }}</span>
            </div>
          </div>
          <UAlert
            v-else
            color="neutral"
            variant="subtle"
            title="Нет данных дашборда"
            description="Сводка появится, как только начнётся работа за день."
            icon="i-lucide-info"
          />
        </div>

        <div>
          <h3 class="text-sm font-semibold text-highlighted mb-3">
            Быстрые действия
          </h3>
          <div class="flex flex-wrap gap-3">
            <UButton
              v-for="action in quickActions"
              :key="action.to"
              :to="action.to"
              :icon="action.icon"
              :label="action.label"
              color="neutral"
              variant="outline"
              size="lg"
            />
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
