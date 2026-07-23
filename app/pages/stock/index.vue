<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import type { TableColumn } from '@nuxt/ui'
import { STOCK_REASONS } from '~/types/spectre'
import type { StockItem, StockReason } from '~/types/spectre'

definePageMeta({ roles: ['OWNER', 'ACCOUNTANT'] })
useHead({ title: 'Склад — Spectre' })

const auth = useAuthStore()
const stockApi = useStockApi()
const toast = useToast()

const q = ref('')
const qd = refDebounced(q, 300)
const lowOnly = ref(false)

const { data: items, status, refresh } = useAsyncData(
  'stock-items',
  () => stockApi.items({ q: qd.value || undefined, low: lowOnly.value || undefined }),
  { watch: [qd, lowOnly], lazy: true, default: () => [] }
)
const { data: categories, refresh: refreshCats } = useAsyncData('stock-cats', () => stockApi.categories(), { lazy: true, default: () => [] })
const { data: expiring } = useAsyncData('stock-expiring', () => stockApi.expiring(7), { lazy: true, default: () => [] })

const canWrite = computed(() => auth.can('stock.write'))

const categoryItems = computed(() => [{ label: '— Без категории —', value: undefined as number | undefined }, ...(categories.value ?? []).map(c => ({ label: c.name, value: c.id }))])

const columns: TableColumn<StockItem>[] = [
  { accessorKey: 'name', header: 'Позиция' },
  { id: 'category', header: 'Категория' },
  { id: 'qty', header: 'Остаток' },
  { id: 'min', header: 'Мин.' },
  { id: 'actions', header: '' }
]

const itemModal = ref(false)
const itemForm = reactive({ name: '', categoryId: undefined as number | undefined, unit: '', minQty: undefined as number | undefined })
const editingItem = ref<StockItem | null>(null)
const savingItem = ref(false)
function openCreateItem() {
  editingItem.value = null
  Object.assign(itemForm, { name: '', categoryId: undefined, unit: '', minQty: undefined })
  itemModal.value = true
}
function openEditItem(it: StockItem) {
  editingItem.value = it
  Object.assign(itemForm, { name: it.name, categoryId: it.categoryId ?? undefined, unit: it.unit ?? '', minQty: it.minQty ?? undefined })
  itemModal.value = true
}
async function saveItem() {
  savingItem.value = true
  try {
    const payload = { name: itemForm.name, categoryId: itemForm.categoryId, unit: itemForm.unit || undefined, minQty: itemForm.minQty }
    if (editingItem.value) await stockApi.updateItem(editingItem.value.id, payload)
    else await stockApi.createItem(payload)
    toast.add({ title: 'Сохранено', color: 'success', icon: 'i-lucide-check' })
    itemModal.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    savingItem.value = false
  }
}

const receiveModal = ref(false)
const receiveTarget = ref<StockItem | null>(null)
const receiveForm = reactive({ qty: 0, expiresAt: '', note: '' })
const receiving = ref(false)
function openReceive(it: StockItem) {
  receiveTarget.value = it
  Object.assign(receiveForm, { qty: 0, expiresAt: '', note: '' })
  receiveModal.value = true
}
async function doReceive() {
  if (!receiveTarget.value) return
  receiving.value = true
  try {
    await stockApi.receive(receiveTarget.value.id, { qty: receiveForm.qty, expiresAt: receiveForm.expiresAt || undefined, note: receiveForm.note || undefined })
    toast.add({ title: 'Партия оприходована', color: 'success', icon: 'i-lucide-check' })
    receiveModal.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    receiving.value = false
  }
}

const writeoffModal = ref(false)
const writeoffTarget = ref<StockItem | null>(null)
const writeoffForm = reactive({ qty: 0, reason: 'SPOILAGE' as StockReason, comment: '' })
const writingOff = ref(false)
const reasonItems = STOCK_REASONS.map(r => ({ label: STOCK_REASON_LABEL[r], value: r }))
function openWriteoff(it: StockItem) {
  writeoffTarget.value = it
  Object.assign(writeoffForm, { qty: 0, reason: 'SPOILAGE', comment: '' })
  writeoffModal.value = true
}
async function doWriteoff() {
  if (!writeoffTarget.value) return
  writingOff.value = true
  try {
    await stockApi.writeoff(writeoffTarget.value.id, { qty: writeoffForm.qty, reason: writeoffForm.reason, comment: writeoffForm.comment || undefined })
    toast.add({ title: 'Списано', color: 'success', icon: 'i-lucide-check' })
    writeoffModal.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    writingOff.value = false
  }
}

const catOpen = ref(false)
const catName = ref('')
const catBusy = ref(false)
async function addCategory() {
  if (!catName.value) return
  catBusy.value = true
  try {
    await stockApi.createCategory({ name: catName.value })
    catName.value = ''
    await refreshCats()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    catBusy.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="stock">
    <template #header>
      <UDashboardNavbar title="Склад" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="canWrite" color="neutral" variant="outline" icon="i-lucide-tags" aria-label="Категории" @click="catOpen = true">
            <span class="hidden sm:inline">Категории</span>
          </UButton>
          <UButton v-if="canWrite" icon="i-lucide-plus" label="Позиция" @click="openCreateItem" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="space-y-6">
        <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <UInput v-model="q" icon="i-lucide-search" placeholder="Поиск" class="w-full sm:w-48" />
        </div>
        <UAlert
          v-if="expiring?.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-clock-alert"
          :title="`Истекает срок: ${expiring.length} партий`"
          :description="expiring.slice(0, 4).map(e => `${e.stockItemName || '#' + e.stockItemId} — до ${formatDate(e.expiresAt)}`).join('; ')"
        />

        <div class="flex items-center gap-2">
          <USwitch v-model="lowOnly" />
          <span class="text-sm text-muted">Только с низким остатком</span>
        </div>

        <UTable :data="items" :columns="columns" :loading="status === 'pending'">
          <template #name-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="font-medium text-highlighted">{{ row.original.name }}</span>
              <UBadge v-if="row.original.lowStock" color="warning" variant="subtle" size="sm" label="мало" />
            </div>
          </template>
          <template #category-cell="{ row }">
            {{ row.original.category?.name || '—' }}
          </template>
          <template #qty-cell="{ row }">
            <span class="font-medium text-highlighted">{{ row.original.qty ?? 0 }}</span>
            <span class="text-muted text-xs"> {{ row.original.unit || '' }}</span>
          </template>
          <template #min-cell="{ row }">
            {{ row.original.minQty ?? '—' }}
          </template>
          <template #actions-cell="{ row }">
            <div v-if="canWrite" class="flex justify-end gap-1">
              <UButton icon="i-lucide-arrow-down-to-line" color="success" variant="ghost" size="xs" @click="openReceive(row.original)" />
              <UButton icon="i-lucide-arrow-up-from-line" color="warning" variant="ghost" size="xs" @click="openWriteoff(row.original)" />
              <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEditItem(row.original)" />
            </div>
          </template>
        </UTable>

        <div v-if="status !== 'pending' && !items?.length" class="text-center text-muted py-12">
          Позиции не найдены
        </div>
      </div>

      <UModal v-model:open="itemModal" :title="editingItem ? 'Редактировать позицию' : 'Новая позиция'">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Название" required>
              <UInput v-model="itemForm.name" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Категория">
                <USelect v-model="itemForm.categoryId" :items="categoryItems" value-key="value" class="w-full" />
              </UFormField>
              <UFormField label="Единица">
                <UInput v-model="itemForm.unit" class="w-full" placeholder="шт, л, кг" />
              </UFormField>
            </div>
            <UFormField label="Минимальный остаток">
              <UInput v-model.number="itemForm.minQty" type="number" min="0" class="w-full" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="itemModal = false" />
            <UButton label="Сохранить" :loading="savingItem" :disabled="!itemForm.name" @click="saveItem" />
          </div>
        </template>
      </UModal>

      <UModal v-model:open="receiveModal" :title="`Приход: ${receiveTarget?.name || ''}`">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Количество" required>
              <UInput v-model.number="receiveForm.qty" type="number" min="0" class="w-full" />
            </UFormField>
            <UFormField label="Годен до">
              <UInput v-model="receiveForm.expiresAt" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Примечание">
              <UInput v-model="receiveForm.note" class="w-full" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="receiveModal = false" />
            <UButton color="success" label="Оприходовать" :loading="receiving" :disabled="receiveForm.qty <= 0" @click="doReceive" />
          </div>
        </template>
      </UModal>

      <UModal v-model:open="writeoffModal" :title="`Списание: ${writeoffTarget?.name || ''}`">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Количество" required>
              <UInput v-model.number="writeoffForm.qty" type="number" min="0" class="w-full" />
            </UFormField>
            <UFormField label="Причина">
              <USelect v-model="writeoffForm.reason" :items="reasonItems" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="Комментарий">
              <UTextarea v-model="writeoffForm.comment" class="w-full" :rows="2" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="writeoffModal = false" />
            <UButton color="warning" label="Списать" :loading="writingOff" :disabled="writeoffForm.qty <= 0" @click="doWriteoff" />
          </div>
        </template>
      </UModal>

      <UModal v-model:open="catOpen" title="Категории склада">
        <template #body>
          <div class="space-y-4">
            <div class="flex gap-2">
              <UInput v-model="catName" placeholder="Новая категория" class="flex-1" @keyup.enter="addCategory" />
              <UButton icon="i-lucide-plus" :loading="catBusy" :disabled="!catName" @click="addCategory" />
            </div>
            <div class="divide-y divide-default rounded-lg border border-default">
              <div v-for="c in categories" :key="c.id" class="px-3 py-2 text-sm text-highlighted">{{ c.name }}</div>
              <p v-if="!categories?.length" class="px-3 py-4 text-center text-sm text-dimmed">Категорий нет</p>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
