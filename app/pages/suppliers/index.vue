<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Supplier } from '~/types/spectre'

definePageMeta({ roles: ['OWNER', 'ADMIN'] })
useHead({ title: 'Поставщики — Spectre' })

const auth = useAuthStore()
const suppliersApi = useSuppliersApi()
const toast = useToast()

const { data: suppliers, status, refresh } = useAsyncData('suppliers', () => suppliersApi.list(), { lazy: true, default: () => [] })

const canWrite = computed(() => auth.can('purchases.write'))

const columns: TableColumn<Supplier>[] = [
  { accessorKey: 'name', header: 'Название' },
  { accessorKey: 'phone', header: 'Телефон' },
  { accessorKey: 'comment', header: 'Комментарий' },
  { id: 'actions', header: '' }
]

const modalOpen = ref(false)
const editing = ref<Supplier | null>(null)
const form = reactive({ name: '', phone: '', comment: '' })
const saving = ref(false)

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', phone: '', comment: '' })
  modalOpen.value = true
}
function openEdit(s: Supplier) {
  editing.value = s
  Object.assign(form, { name: s.name, phone: s.phone ?? '', comment: s.comment ?? '' })
  modalOpen.value = true
}
async function save() {
  saving.value = true
  try {
    const payload = { name: form.name, phone: form.phone || undefined, comment: form.comment || undefined }
    if (editing.value) await suppliersApi.update(editing.value.id, payload)
    else await suppliersApi.create(payload)
    toast.add({ title: 'Сохранено', color: 'success', icon: 'i-lucide-check' })
    modalOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="suppliers">
    <template #header>
      <UDashboardNavbar title="Поставщики" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="canWrite" icon="i-lucide-plus" label="Поставщик" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UTable :data="suppliers" :columns="columns" :loading="status === 'pending'">
        <template #name-cell="{ row }">
          <span class="font-medium text-highlighted">{{ row.original.name }}</span>
        </template>
        <template #phone-cell="{ row }">
          {{ row.original.phone || '—' }}
        </template>
        <template #comment-cell="{ row }">
          <span class="text-muted">{{ row.original.comment || '—' }}</span>
        </template>
        <template #actions-cell="{ row }">
          <div v-if="canWrite" class="flex justify-end gap-1">
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(row.original)" />
          </div>
        </template>
      </UTable>

      <div v-if="status !== 'pending' && !suppliers?.length" class="text-center text-muted py-12">
        Поставщики не найдены
      </div>

      <UModal v-model:open="modalOpen" :title="editing ? 'Редактировать поставщика' : 'Новый поставщик'">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Название" required>
              <UInput v-model="form.name" class="w-full" />
            </UFormField>
            <UFormField label="Телефон">
              <UInput v-model="form.phone" class="w-full" />
            </UFormField>
            <UFormField label="Комментарий">
              <UTextarea v-model="form.comment" class="w-full" :rows="2" />
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
    </template>
  </UDashboardPanel>
</template>
