<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { PURCHASE_ACTIONS, PURCHASE_STATUSES } from '~/types/spectre'
import type { Purchase, PurchaseAction, PurchaseStatus } from '~/types/spectre'
import type { PurchaseItemInput, PurchasePurchasedItem } from '~/composables/usePurchasesApi'

definePageMeta({ roles: ['OWNER', 'ADMIN', 'ACCOUNTANT'] })
useHead({ title: 'Закупки — Spectre' })

const auth = useAuthStore()
const purchasesApi = usePurchasesApi()
const suppliersApi = useSuppliersApi()
const stockApi = useStockApi()
const toast = useToast()

const statusFilter = ref<PurchaseStatus | undefined>()

const { data: purchases, status, refresh } = useAsyncData(
  'purchases',
  () => purchasesApi.list(statusFilter.value),
  { watch: [statusFilter], lazy: true, default: () => [] }
)
const { data: suppliers } = useAsyncData('purchase-suppliers', () => suppliersApi.list(), { lazy: true, default: () => [] })
const { data: stockItems } = useAsyncData('purchase-stock', () => stockApi.items(), { lazy: true, default: () => [] })

const canWrite = computed(() => auth.can('purchases.write'))
const canApprove = computed(() => auth.can('purchases.approve'))

const statusItems = [{ label: 'Все статусы', value: undefined as PurchaseStatus | undefined }, ...PURCHASE_STATUSES.map(s => ({ label: PURCHASE_STATUS_LABEL[s], value: s as PurchaseStatus | undefined }))]
const supplierItems = computed(() => [{ label: '— Без поставщика —', value: undefined as number | undefined }, ...(suppliers.value ?? []).map(s => ({ label: s.name, value: s.id }))])
const stockItemOptions = computed(() => [{ label: '— Не привязывать —', value: undefined as number | undefined }, ...(stockItems.value ?? []).map(s => ({ label: s.name, value: s.id }))])

const columns: TableColumn<Purchase>[] = [
  { accessorKey: 'id', header: '#' },
  { id: 'status', header: 'Статус' },
  { id: 'supplier', header: 'Поставщик' },
  { id: 'total', header: 'Сумма (оценка)' },
  { id: 'actions', header: 'Действия' }
]

function allowedActions(p: Purchase): PurchaseAction[] {
  const actions = PURCHASE_ACTIONS[p.status] ?? []
  return actions.filter((a) => {
    if (['approve', 'reject', 'fund', 'close'].includes(a)) return canApprove.value
    return canWrite.value
  })
}
function actionColor(a: PurchaseAction): BadgeColor {
  if (a === 'approve' || a === 'fund' || a === 'receive') return 'success'
  if (a === 'reject') return 'error'
  return 'neutral'
}

const busyId = ref<number | null>(null)
async function runAction(p: Purchase, action: PurchaseAction) {
  if (action === 'purchased') {
    openPurchased(p)
    return
  }
  busyId.value = p.id
  try {
    await purchasesApi.act(p.id, action)
    toast.add({ title: 'Готово', color: 'success', icon: 'i-lucide-check' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    busyId.value = null
  }
}

const createOpen = ref(false)
const createForm = reactive({ supplierId: undefined as number | undefined, reason: '', comment: '' })
const createItems = ref<Array<PurchaseItemInput>>([])
const creating = ref(false)
function openCreate() {
  Object.assign(createForm, { supplierId: undefined, reason: '', comment: '' })
  createItems.value = [{ name: '', qty: 1, estPrice: 0 }]
  createOpen.value = true
}
function addCreateItem() {
  createItems.value.push({ name: '', qty: 1, estPrice: 0 })
}
function removeCreateItem(i: number) {
  createItems.value.splice(i, 1)
}
const createValid = computed(() => createItems.value.length > 0 && createItems.value.every(i => i.name && i.qty > 0))
async function submitCreate() {
  creating.value = true
  try {
    await purchasesApi.create({
      supplierId: createForm.supplierId,
      reason: createForm.reason || undefined,
      comment: createForm.comment || undefined,
      items: createItems.value.map(i => ({ name: i.name, stockItemId: i.stockItemId, unit: i.unit || undefined, qty: i.qty, estPrice: i.estPrice }))
    })
    toast.add({ title: 'Закупка создана', color: 'success', icon: 'i-lucide-check' })
    createOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    creating.value = false
  }
}

const purchasedOpen = ref(false)
const purchasedPurchase = ref<Purchase | null>(null)
const purchasedItems = ref<Array<PurchasePurchasedItem & { name: string }>>([])
const purchasedBusy = ref(false)
function openPurchased(p: Purchase) {
  purchasedPurchase.value = p
  purchasedItems.value = (p.items ?? []).map(it => ({ purchaseItemId: it.id, actualPrice: it.estPrice, actualQty: it.qty, expiresAt: '', name: it.name }))
  purchasedOpen.value = true
}
async function submitPurchased() {
  if (!purchasedPurchase.value) return
  purchasedBusy.value = true
  try {
    await purchasesApi.act(purchasedPurchase.value.id, 'purchased', {
      items: purchasedItems.value.map(i => ({ purchaseItemId: i.purchaseItemId, actualPrice: i.actualPrice, actualQty: i.actualQty, expiresAt: i.expiresAt || undefined }))
    })
    toast.add({ title: 'Закупка отмечена', color: 'success', icon: 'i-lucide-check' })
    purchasedOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    purchasedBusy.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="purchases">
    <template #header>
      <UDashboardNavbar title="Закупки" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="canWrite" icon="i-lucide-plus" label="Закупка" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <USelect v-model="statusFilter" :items="statusItems" value-key="value" class="w-full sm:w-44" />
      </div>
      <UTable :data="purchases" :columns="columns" :loading="status === 'pending'">
        <template #id-cell="{ row }">
          <span class="font-medium text-highlighted">#{{ row.original.id }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="PURCHASE_STATUS_COLOR[row.original.status]" variant="subtle" :label="PURCHASE_STATUS_LABEL[row.original.status]" />
        </template>
        <template #supplier-cell="{ row }">
          {{ row.original.supplier?.name || '—' }}
        </template>
        <template #total-cell="{ row }">
          {{ formatMoney(row.original.estimatedTotal ?? 0) }}
        </template>
        <template #actions-cell="{ row }">
          <div class="flex flex-wrap justify-end gap-1">
            <UButton
              v-for="a in allowedActions(row.original)"
              :key="a"
              size="xs"
              :color="actionColor(a)"
              variant="soft"
              :label="PURCHASE_ACTION_LABEL[a]"
              :loading="busyId === row.original.id"
              @click="runAction(row.original, a)"
            />
            <span v-if="!allowedActions(row.original).length" class="text-xs text-dimmed">—</span>
          </div>
        </template>
      </UTable>

      <div v-if="status !== 'pending' && !purchases?.length" class="text-center text-muted py-12">
        Закупки не найдены
      </div>

      <UModal v-model:open="createOpen" title="Новая закупка" :ui="{ content: 'max-w-2xl' }">
        <template #body>
          <div class="space-y-4">
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Поставщик">
                <USelectMenu v-model="createForm.supplierId" :items="supplierItems" value-key="value" class="w-full" searchable />
              </UFormField>
              <UFormField label="Причина">
                <UInput v-model="createForm.reason" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Комментарий">
              <UInput v-model="createForm.comment" class="w-full" />
            </UFormField>

            <div>
              <div class="flex items-center justify-between mb-2">
                <div class="text-sm font-medium text-highlighted">Позиции</div>
                <UButton size="xs" color="neutral" variant="outline" icon="i-lucide-plus" label="Строка" @click="addCreateItem" />
              </div>
              <div class="mb-1 hidden grid-cols-12 gap-2 px-1 text-xs font-medium text-muted sm:grid">
                <span class="col-span-4">Название</span>
                <span class="col-span-3">Склад</span>
                <span class="col-span-2">Кол-во</span>
                <span class="col-span-2">Цена за ед.</span>
                <span class="col-span-1" />
              </div>
              <div class="space-y-3 sm:space-y-2">
                <div
                  v-for="(it, i) in createItems"
                  :key="i"
                  class="grid grid-cols-1 gap-2 rounded-lg border border-default p-3 sm:grid-cols-12 sm:items-center sm:gap-2 sm:rounded-none sm:border-0 sm:p-0"
                >
                  <div class="sm:col-span-4">
                    <span class="mb-1 block text-xs font-medium text-muted sm:hidden">Название</span>
                    <UInput v-model="it.name" placeholder="Название" class="w-full" size="sm" />
                  </div>
                  <div class="sm:col-span-3">
                    <span class="mb-1 block text-xs font-medium text-muted sm:hidden">Позиция склада (необязательно)</span>
                    <USelectMenu v-model="it.stockItemId" :items="stockItemOptions" value-key="value" placeholder="Склад" class="w-full" size="sm" searchable />
                  </div>
                  <div class="grid grid-cols-2 gap-2 sm:col-span-4">
                    <div>
                      <span class="mb-1 block text-xs font-medium text-muted sm:hidden">Кол-во</span>
                      <UInput v-model.number="it.qty" type="number" min="0" placeholder="Кол-во" class="w-full" size="sm" />
                    </div>
                    <div>
                      <span class="mb-1 block text-xs font-medium text-muted sm:hidden">Цена за ед.</span>
                      <UInput v-model.number="it.estPrice" type="number" min="0" placeholder="Цена" class="w-full" size="sm" />
                    </div>
                  </div>
                  <div class="flex justify-end sm:col-span-1">
                    <UButton icon="i-lucide-x" color="error" variant="ghost" size="xs" :aria-label="`Удалить строку ${i + 1}`" @click="removeCreateItem(i)" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="createOpen = false" />
            <UButton label="Создать" :loading="creating" :disabled="!createValid" @click="submitCreate" />
          </div>
        </template>
      </UModal>

      <UModal v-model:open="purchasedOpen" title="Фактическая закупка" :ui="{ content: 'max-w-2xl' }">
        <template #body>
          <div class="space-y-2">
            <div class="grid grid-cols-12 gap-2 text-xs text-muted px-1">
              <span class="col-span-4">Позиция</span>
              <span class="col-span-3">Факт. цена</span>
              <span class="col-span-2">Факт. кол-во</span>
              <span class="col-span-3">Годен до</span>
            </div>
            <div v-for="(it, i) in purchasedItems" :key="i" class="grid grid-cols-12 gap-2 items-center">
              <span class="col-span-4 text-sm text-highlighted truncate">{{ it.name }}</span>
              <UInput v-model.number="it.actualPrice" type="number" min="0" class="col-span-3" size="sm" />
              <UInput v-model.number="it.actualQty" type="number" min="0" class="col-span-2" size="sm" />
              <UInput v-model="it.expiresAt" type="date" class="col-span-3" size="sm" />
            </div>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="purchasedOpen = false" />
            <UButton label="Подтвердить закупку" :loading="purchasedBusy" @click="submitPurchased" />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
