<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { DISCOUNT_STATUSES, DISCOUNT_TYPES } from '~/types/spectre'
import type { Discount, DiscountStatus, DiscountType } from '~/types/spectre'
import type { DiscountInput } from '~/composables/useDiscountsApi'

definePageMeta({ roles: ['OWNER', 'ADMIN', 'CASHIER'] })
useHead({ title: 'Скидки — Spectre' })

const auth = useAuthStore()
const discountsApi = useDiscountsApi()
const toast = useToast()

const typeFilter = ref<DiscountType | undefined>()
const statusFilter = ref<DiscountStatus | undefined>()

const { data: discounts, status, refresh } = useAsyncData(
  'discounts',
  () => discountsApi.list({ type: typeFilter.value, status: statusFilter.value }),
  { watch: [typeFilter, statusFilter], lazy: true, default: () => [] }
)

const canCrud = computed(() => auth.can('discounts.crud'))

const typeItems = [{ label: 'Все типы', value: undefined as DiscountType | undefined }, ...DISCOUNT_TYPES.map(t => ({ label: DISCOUNT_TYPE_LABEL[t], value: t as DiscountType | undefined }))]
const statusItems = [{ label: 'Все статусы', value: undefined as DiscountStatus | undefined }, ...DISCOUNT_STATUSES.map(s => ({ label: DISCOUNT_STATUS_LABEL[s], value: s as DiscountStatus | undefined }))]
const typeFormItems = DISCOUNT_TYPES.map(t => ({ label: DISCOUNT_TYPE_LABEL[t], value: t }))
const statusFormItems = DISCOUNT_STATUSES.map(s => ({ label: DISCOUNT_STATUS_LABEL[s], value: s }))

const columns: TableColumn<Discount>[] = [
  { accessorKey: 'name', header: 'Название' },
  { id: 'type', header: 'Тип' },
  { id: 'value', header: 'Значение' },
  { accessorKey: 'code', header: 'Код' },
  { id: 'status', header: 'Статус' },
  { id: 'actions', header: '' }
]

function displayValue(d: Discount): string {
  return d.type === 'FIXED' ? formatMoney(d.value) : `${d.value}%`
}

// <input type="date"> yields YYYY-MM-DD, but the backend validates startsAt/endsAt
// with z.string().datetime() which requires a full ISO datetime — convert before sending.
function toIso(d?: string): string | undefined {
  return d ? new Date(d).toISOString() : undefined
}

const modalOpen = ref(false)
const editing = ref<Discount | null>(null)
const form = reactive<DiscountInput>({ name: '', type: 'PERCENT', value: 0, code: '', oneTime: false, reason: '', startsAt: '', endsAt: '', status: 'ACTIVE' })
const saving = ref(false)

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', type: 'PERCENT', value: 0, code: '', oneTime: false, reason: '', startsAt: '', endsAt: '', status: 'ACTIVE' })
  modalOpen.value = true
}

function openEdit(d: Discount) {
  editing.value = d
  Object.assign(form, {
    name: d.name, type: d.type, value: d.value, code: d.code ?? '', oneTime: !!d.oneTime,
    reason: d.reason ?? '', startsAt: d.startsAt?.slice(0, 10) ?? '', endsAt: d.endsAt?.slice(0, 10) ?? '', status: d.status
  })
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    const payload: DiscountInput = {
      name: form.name,
      type: form.type,
      value: form.value,
      code: form.code || undefined,
      oneTime: form.oneTime,
      reason: form.reason || undefined,
      startsAt: toIso(form.startsAt),
      endsAt: toIso(form.endsAt)
    }
    if (editing.value) await discountsApi.update(editing.value.id, { ...payload, status: form.status })
    else await discountsApi.create(payload)
    toast.add({ title: 'Сохранено', color: 'success', icon: 'i-lucide-check' })
    modalOpen.value = false
    await refresh()
  } catch (e) {
    const details = apiErrorDetails(e)
    toast.add({
      title: 'Ошибка',
      description: details.length ? details.map(d => `${d.path}: ${d.message}`).join('; ') : apiErrorMessage(e),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

const confirmOpen = ref(false)
const deleteTarget = ref<Discount | null>(null)
const deleting = ref(false)
function askDelete(d: Discount) {
  deleteTarget.value = d
  confirmOpen.value = true
}
async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await discountsApi.remove(deleteTarget.value.id)
    toast.add({ title: 'Скидка удалена', color: 'success', icon: 'i-lucide-check' })
    confirmOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="discounts">
    <template #header>
      <UDashboardNavbar title="Скидки" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="canCrud" icon="i-lucide-plus" label="Скидка" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <USelect v-model="typeFilter" :items="typeItems" value-key="value" class="w-full sm:w-40" />
        <USelect v-model="statusFilter" :items="statusItems" value-key="value" class="w-full sm:w-40" />
      </div>
      <UTable :data="discounts" :columns="columns" :loading="status === 'pending'">
        <template #name-cell="{ row }">
          <span class="font-medium text-highlighted">{{ row.original.name }}</span>
        </template>
        <template #type-cell="{ row }">
          {{ DISCOUNT_TYPE_LABEL[row.original.type] }}
        </template>
        <template #value-cell="{ row }">
          {{ displayValue(row.original) }}
        </template>
        <template #code-cell="{ row }">
          <span class="font-mono text-sm">{{ row.original.code || '—' }}</span>
        </template>
        <template #status-cell="{ row }">
          <UBadge :color="DISCOUNT_STATUS_COLOR[row.original.status]" variant="subtle" :label="DISCOUNT_STATUS_LABEL[row.original.status]" />
        </template>
        <template #actions-cell="{ row }">
          <div v-if="canCrud" class="flex justify-end gap-1">
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(row.original)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="askDelete(row.original)" />
          </div>
        </template>
      </UTable>

      <div v-if="status !== 'pending' && !discounts?.length" class="text-center text-muted py-12">
        Скидки не найдены
      </div>

      <UModal v-model:open="modalOpen" :title="editing ? 'Редактировать скидку' : 'Новая скидка'">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Название" required>
              <UInput v-model="form.name" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Тип">
                <USelect v-model="form.type" :items="typeFormItems" value-key="value" class="w-full" />
              </UFormField>
              <UFormField :label="form.type === 'FIXED' ? 'Сумма' : 'Процент (0–100)'" required>
                <UInput v-model.number="form.value" type="number" min="0" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Промокод">
              <UInput v-model="form.code" class="w-full" placeholder="SPRING" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Действует с">
                <UInput v-model="form.startsAt" type="date" class="w-full" />
              </UFormField>
              <UFormField label="Действует до">
                <UInput v-model="form.endsAt" type="date" class="w-full" />
              </UFormField>
            </div>
            <UFormField v-if="editing" label="Статус">
              <USelect v-model="form.status" :items="statusFormItems" value-key="value" class="w-full" />
            </UFormField>
            <div class="flex items-center gap-2">
              <USwitch v-model="form.oneTime" />
              <span class="text-sm text-muted">Одноразовая</span>
            </div>
            <UFormField label="Причина / примечание">
              <UTextarea v-model="form.reason" class="w-full" :rows="2" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="modalOpen = false" />
            <UButton label="Сохранить" :loading="saving" :disabled="!form.name" @click="save" />
          </div>
        </template>
      </UModal>

      <ConfirmModal
        v-model:open="confirmOpen"
        title="Удалить скидку?"
        :description="`Скидка «${deleteTarget?.name}» будет удалена.`"
        :loading="deleting"
        @confirm="doDelete"
      />
    </template>
  </UDashboardPanel>
</template>
