<script setup lang="ts">
definePageMeta({ roles: ['OWNER', 'ACCOUNTANT', 'FINANCIER'] })
useHead({ title: 'Отчёты — Spectre' })

const reportsApi = useReportsApi()

const today = new Date().toISOString().slice(0, 10)
const date = ref(today)

const { data: report, status } = useAsyncData(
  'report-daily',
  () => reportsApi.daily(date.value),
  { watch: [date], lazy: true, default: () => null }
)

interface Section {
  title: string
  icon: string
  money: boolean
  data: Record<string, number>
}

const sections = computed<Section[]>(() => {
  const r = report.value
  if (!r) return []
  const out: Section[] = []
  if (r.financial) out.push({ title: 'Финансы', icon: 'i-lucide-wallet', money: true, data: r.financial })
  if (r.wash) out.push({ title: 'Мойка', icon: 'i-lucide-droplets', money: false, data: r.wash })
  if (r.warehouse) out.push({ title: 'Склад', icon: 'i-lucide-package', money: false, data: r.warehouse })
  return out
})
</script>

<template>
  <UDashboardPanel id="reports">
    <template #header>
      <UDashboardNavbar title="Отчёты" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UInput v-model="date" type="date" class="w-36 sm:w-44" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <USkeleton v-for="n in 4" :key="n" class="h-40" />
      </div>

      <div v-else-if="sections.length" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div v-for="sec in sections" :key="sec.title" class="rounded-xl border border-default bg-default overflow-hidden">
          <div class="flex items-center gap-2 px-5 py-3 border-b border-default">
            <UIcon :name="sec.icon" class="size-4 text-primary" />
            <h3 class="font-semibold text-highlighted">{{ sec.title }}</h3>
          </div>
          <div class="divide-y divide-default">
            <div v-for="(value, key) in sec.data" :key="key" class="flex items-center justify-between px-5 py-2.5 text-sm">
              <span class="text-muted">{{ key }}</span>
              <span class="font-medium text-highlighted">{{ sec.money ? formatMoney(value) : formatNumber(value) }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center text-muted py-12">
        Нет данных за {{ formatDate(date) }}
      </div>
    </template>
  </UDashboardPanel>
</template>
