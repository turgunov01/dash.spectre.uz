<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { WasherSalaryRow, WasherCar } from '~/types/spectre'

definePageMeta({ roles: ['OWNER', 'ACCOUNTANT', 'FINANCIER'] })
useHead({ title: 'Зарплата мойщиков — Spectre' })

const auth = useAuthStore()
const toast = useToast()
const reportsApi = useReportsApi()
// Live queue socket — assignments happen there, so we refetch on every change (real-time payroll).
const { orders, connected } = useQueue()

// Период учёта — календарные дни от сегодня назад. 1 = сегодня.
const period = ref(1)
const periodItems = [
  { label: 'Сегодня', value: 1 },
  { label: '2 дня', value: 2 },
  { label: '3 дня', value: 3 },
  { label: '5 дней', value: 5 },
  { label: '7 дней', value: 7 },
  { label: '14 дней', value: 14 },
  { label: '30 дней', value: 30 }
]
const periodLabel = computed(() => periodItems.find(p => p.value === period.value)?.label ?? '')

function rangeParams(): { from: string, to: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (period.value - 1))
  return { from: start.toISOString(), to: now.toISOString() }
}

const { data: report, status, refresh } = useAsyncData(
  'washer-salary',
  () => reportsApi.washers(rangeParams()),
  { lazy: true, default: () => null, watch: [period] }
)

watch(orders, () => refresh())

const columns: TableColumn<WasherSalaryRow>[] = [
  { accessorKey: 'name', header: 'Мойщик' },
  { id: 'cars', header: 'Помыто машин' },
  { id: 'rate', header: 'Ставка за мойку' },
  { id: 'salary', header: 'Зарплата' },
  { id: 'actions', header: '' }
]

// Add a washer by name — owner/accountant only.
const canAdd = computed(() => auth.can('washers.create'))
const addOpen = ref(false)
const newName = ref('')
const adding = ref(false)

async function addWasher() {
  const name = newName.value.trim()
  if (!name) return
  adding.value = true
  try {
    await reportsApi.addWasher(name)
    toast.add({ title: 'Мойщик добавлен', color: 'success', icon: 'i-lucide-check' })
    newName.value = ''
    addOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    adding.value = false
  }
}

// Delete (dismiss) a washer — owner/accountant only.
const canDelete = computed(() => auth.can('washers.delete'))
const confirmOpen = ref(false)
const deleteTarget = ref<WasherSalaryRow | null>(null)
const deleting = ref(false)

function askDelete(row: WasherSalaryRow) {
  deleteTarget.value = row
  confirmOpen.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await reportsApi.deleteWasher(deleteTarget.value.washerId)
    toast.add({ title: 'Мойщик удалён', color: 'success', icon: 'i-lucide-check' })
    confirmOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    deleting.value = false
  }
}

// Edit pay-per-wash rate — owner/accountant (same gate as adding washers).
const rateOpen = ref(false)
const rateInput = ref(0)
const savingRate = ref(false)

function openRateEdit() {
  rateInput.value = report.value?.rate ?? 60000
  rateOpen.value = true
}

async function saveRate() {
  savingRate.value = true
  try {
    await reportsApi.setWashRate(Number(rateInput.value))
    toast.add({ title: 'Ставка обновлена', color: 'success', icon: 'i-lucide-check' })
    rateOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    savingRate.value = false
  }
}

// Audit: which cars a washer actually did (plate + time) — proof for payroll.
const carsOpen = ref(false)
const carsTarget = ref<WasherSalaryRow | null>(null)
const carsList = ref<WasherCar[]>([])
const loadingCars = ref(false)

async function openCars(row: WasherSalaryRow) {
  if (!row.cars) return
  carsTarget.value = row
  carsList.value = []
  carsOpen.value = true
  loadingCars.value = true
  try {
    carsList.value = await reportsApi.washerCars(row.washerId, rangeParams())
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    loadingCars.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="salary">
    <template #header>
      <UDashboardNavbar title="Зарплата мойщиков" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <USelect v-model="period" :items="periodItems" value-key="value" class="w-40" />
          <UButton v-if="canAdd" icon="i-lucide-user-plus" label="Мойщик" @click="addOpen = true" />
          <UBadge
            :color="connected ? 'success' : 'neutral'"
            variant="subtle"
            :label="connected ? 'В реальном времени' : 'Переподключение…'"
            :icon="connected ? 'i-lucide-wifi' : 'i-lucide-wifi-off'"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="status === 'pending'"
            aria-label="Обновить"
            @click="refresh"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="report" class="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <UBadge color="neutral" variant="subtle" :label="`Период: ${formatDate(report.from)} — ${formatDate(report.to)}`" />
        <UBadge color="primary" variant="subtle" :label="`Ставка: ${formatMoney(report.rate)} / мойка`" />
        <UButton
          v-if="canAdd"
          icon="i-lucide-pencil"
          size="xs"
          color="neutral"
          variant="ghost"
          label="Изменить ставку"
          @click="openRateEdit"
        />
      </div>

      <UTable :data="report?.washers ?? []" :columns="columns" :loading="status === 'pending'">
        <template #name-cell="{ row }">
          <span class="font-medium text-highlighted">{{ row.original.name }}</span>
        </template>
        <template #cars-cell="{ row }">
          <UButton
            v-if="row.original.cars"
            :label="String(row.original.cars)"
            color="neutral"
            variant="link"
            class="tabular-nums px-0 font-medium"
            trailing-icon="i-lucide-list"
            @click="openCars(row.original)"
          />
          <span v-else class="tabular-nums text-muted">0</span>
        </template>
        <template #rate-cell="{ row }">
          <span class="text-muted">{{ formatMoney(row.original.rate) }}</span>
        </template>
        <template #salary-cell="{ row }">
          <span class="font-semibold text-highlighted tabular-nums">{{ formatMoney(row.original.salary) }}</span>
        </template>
        <template #actions-cell="{ row }">
          <div v-if="canDelete" class="flex justify-end">
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              aria-label="Удалить мойщика"
              @click="askDelete(row.original)"
            />
          </div>
        </template>
      </UTable>

      <div v-if="report && report.washers.length" class="mt-4 flex items-center justify-between rounded-xl border border-default bg-elevated/40 px-5 py-3">
        <span class="text-sm font-medium text-highlighted">Помыто за {{ periodLabel.toLowerCase() }}</span>
        <div class="flex items-center gap-6">
          <span class="text-sm text-muted">Машин: <b class="text-highlighted tabular-nums">{{ report.totals.cars }}</b></span>
          <span class="text-base font-bold text-highlighted tabular-nums">{{ formatMoney(report.totals.salary) }}</span>
        </div>
      </div>

      <div v-if="status !== 'pending' && !report?.washers.length" class="text-center text-muted py-12">
        Нет активных мойщиков
      </div>

      <UModal v-model:open="addOpen" title="Новый мойщик">
        <template #body>
          <UFormField label="Имя мойщика" required>
            <UInput
              v-model="newName"
              class="w-full"
              placeholder="Фамилия Имя"
              autofocus
              @keydown.enter.prevent="addWasher"
            />
          </UFormField>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="addOpen = false" />
            <UButton label="Добавить" icon="i-lucide-check" :loading="adding" :disabled="!newName.trim()" @click="addWasher" />
          </div>
        </template>
      </UModal>

      <ConfirmModal
        v-model:open="confirmOpen"
        title="Удалить мойщика?"
        :description="`Мойщик «${deleteTarget?.name}» будет удалён из списка (при увольнении).`"
        :loading="deleting"
        @confirm="doDelete"
      />

      <UModal v-model:open="carsOpen" :title="`Машины мойщика — ${carsTarget?.name || ''}`">
        <template #body>
          <div v-if="loadingCars" class="py-6 text-center text-muted">Загрузка…</div>
          <div v-else-if="carsList.length" class="space-y-2">
            <p class="text-xs text-muted">Всего за период: {{ carsList.length }} — записано системой при назначении.</p>
            <div class="rounded-lg border border-default divide-y divide-default max-h-96 overflow-y-auto">
              <div v-for="c in carsList" :key="c.assignmentId" class="flex items-center gap-3 px-3 py-2 text-sm">
                <span class="font-mono font-medium text-highlighted">{{ c.plate }}</span>
                <UBadge :color="ORDER_STATUS_COLOR[c.status]" variant="subtle" size="sm" :label="ORDER_STATUS_LABEL[c.status]" />
                <span class="ml-auto text-xs text-muted tabular-nums">{{ formatDateTime(c.assignedAt) }}</span>
              </div>
            </div>
          </div>
          <div v-else class="py-6 text-center text-muted">Нет машин за период</div>
        </template>
      </UModal>

      <UModal v-model:open="rateOpen" title="Ставка за мойку">
        <template #body>
          <UFormField label="Сумма за одну мойку (сум)" required>
            <UInput v-model.number="rateInput" type="number" min="0" step="1000" class="w-full" autofocus />
          </UFormField>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="rateOpen = false" />
            <UButton label="Сохранить" icon="i-lucide-check" :loading="savingRate" :disabled="rateInput < 0" @click="saveRate" />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
