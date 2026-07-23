<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { CashSession } from '~/types/spectre'

definePageMeta({ roles: ['OWNER', 'CASHIER', 'ACCOUNTANT'] })
useHead({ title: 'Касса — Spectre' })

const auth = useAuthStore()
const cashApi = useCashApi()
const toast = useToast()

const canSession = computed(() => auth.can('cash.session'))
const canMoney = computed(() => auth.can('cash.money'))

const { data: current, status, refresh } = useAsyncData('cash-current', () => cashApi.current(), { lazy: true, default: () => null })
const { data: sessions, refresh: refreshSessions } = useAsyncData('cash-sessions', () => cashApi.sessions(), { lazy: true, default: () => [] })

const isOpen = computed(() => !!current.value?.session && current.value.session.status !== 'CLOSED')
const totals = computed(() => current.value?.totals)
const busy = ref(false)

async function openCash() {
  busy.value = true
  try {
    await cashApi.open()
    toast.add({ title: 'Касса открыта', color: 'success', icon: 'i-lucide-check' })
    await refresh(); await refreshSessions()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function closeCash() {
  busy.value = true
  try {
    await cashApi.close()
    toast.add({ title: 'Касса закрыта', color: 'success', icon: 'i-lucide-check' })
    await refresh(); await refreshSessions()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}

// Deposit / withdraw
const opOpen = ref(false)
const opType = ref<'deposit' | 'withdraw'>('deposit')
const opForm = reactive({ amount: 0, comment: '' })
const opSaving = ref(false)

function openOp(type: 'deposit' | 'withdraw') {
  opType.value = type
  opForm.amount = 0
  opForm.comment = ''
  opOpen.value = true
}

async function submitOp() {
  opSaving.value = true
  try {
    if (opType.value === 'deposit') await cashApi.deposit({ amount: opForm.amount, comment: opForm.comment || undefined })
    else await cashApi.withdraw({ amount: opForm.amount, comment: opForm.comment })
    toast.add({ title: 'Операция выполнена', color: 'success', icon: 'i-lucide-check' })
    opOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    opSaving.value = false
  }
}

const totalTiles = computed(() => {
  const t = totals.value
  if (!t) return []
  return [
    { label: 'Наличные в кассе', value: t.cashBalance },
    { label: 'Продажи', value: t.salesTotal },
    { label: 'Мойка', value: t.washTotal },
    { label: 'Возвраты', value: t.refundsTotal },
    { label: 'Закупки', value: t.purchasesTotal }
  ]
})

const sessionColumns: TableColumn<CashSession>[] = [
  { accessorKey: 'id', header: '#' },
  { id: 'opened', header: 'Открыта' },
  { id: 'closed', header: 'Закрыта' },
  { id: 'opening', header: 'Начало' },
  { id: 'closing', header: 'Конец' }
]
</script>

<template>
  <UDashboardPanel id="cash">
    <template #header>
      <UDashboardNavbar title="Касса" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <template v-if="canSession">
            <UButton v-if="!isOpen" label="Открыть кассу" icon="i-lucide-unlock" color="primary" :loading="busy" @click="openCash" />
            <UButton v-else label="Закрыть кассу" icon="i-lucide-lock" color="neutral" variant="outline" :loading="busy" @click="closeCash" />
          </template>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-8">
        <section>
          <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div class="flex items-center gap-2">
              <h2 class="font-semibold text-highlighted">Текущая смена</h2>
              <UBadge :color="isOpen ? 'success' : 'neutral'" variant="subtle" :label="isOpen ? 'Открыта' : 'Закрыта'" />
            </div>
            <div v-if="isOpen && canMoney" class="flex gap-2">
              <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-plus" label="Внести" @click="openOp('deposit')" />
              <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-minus" label="Изъять" @click="openOp('withdraw')" />
            </div>
          </div>

          <div v-if="status === 'pending'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <USkeleton v-for="n in 6" :key="n" class="h-24" />
          </div>
          <div v-else-if="isOpen && totals" class="space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="tile in totalTiles" :key="tile.label" class="rounded-xl border border-default bg-default p-4">
                <div class="text-xs text-muted mb-1">{{ tile.label }}</div>
                <div class="text-lg font-bold text-highlighted">{{ formatMoney(tile.value) }}</div>
              </div>
            </div>
            <div v-if="totals.breakdown?.length" class="flex flex-wrap gap-2">
              <UBadge
                v-for="b in totals.breakdown"
                :key="b.method"
                color="neutral"
                variant="subtle"
                :label="`${PAYMENT_METHOD_LABEL[b.method]}: ${formatMoney(b.amount)}`"
              />
            </div>
          </div>
          <UAlert
            v-else
            color="neutral"
            variant="subtle"
            icon="i-lucide-lock"
            title="Касса закрыта"
            description="Откройте смену, чтобы принимать оплаты и вести операции."
          />
        </section>

        <section>
          <h2 class="font-semibold text-highlighted mb-3">История смен</h2>
          <UTable :data="sessions" :columns="sessionColumns">
            <template #opened-cell="{ row }">{{ formatDateTime(row.original.openedAt) }}</template>
            <template #closed-cell="{ row }">{{ row.original.closedAt ? formatDateTime(row.original.closedAt) : '—' }}</template>
            <template #opening-cell="{ row }">{{ formatMoney(row.original.openingBalance) }}</template>
            <template #closing-cell="{ row }">{{ row.original.closingBalance != null ? formatMoney(row.original.closingBalance) : '—' }}</template>
          </UTable>
        </section>
      </div>

      <UModal v-model:open="opOpen" :title="opType === 'deposit' ? 'Внести деньги' : 'Изъять деньги'">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Сумма" required>
              <UInput v-model.number="opForm.amount" type="number" min="0" class="w-full" />
            </UFormField>
            <UFormField label="Комментарий" :required="opType === 'withdraw'">
              <UTextarea v-model="opForm.comment" class="w-full" :rows="2" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="opOpen = false" />
            <UButton
              label="Подтвердить"
              :loading="opSaving"
              :disabled="opForm.amount <= 0 || (opType === 'withdraw' && !opForm.comment)"
              @click="submitOp"
            />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
