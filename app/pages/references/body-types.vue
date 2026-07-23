<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { BodyType } from '~/types/spectre'

definePageMeta({ roles: ['OWNER', 'ADMIN'] })
useHead({ title: 'Типы кузова — Spectre' })

const referencesApi = useReferencesApi()
const toast = useToast()

const { data: bodyTypes, status, refresh } = useAsyncData('body-types', () => referencesApi.bodyTypes(), { lazy: true, default: () => [] })

const columns: TableColumn<BodyType>[] = [
  { accessorKey: 'name', header: 'Название' },
  { id: 'sort', header: 'Порядок' },
  { id: 'active', header: 'Активен' },
  { id: 'actions', header: '' }
]

const modalOpen = ref(false)
const editing = ref<BodyType | null>(null)
const form = reactive({ name: '', sortOrder: 0, isActive: true })
const saving = ref(false)

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', sortOrder: 0, isActive: true })
  modalOpen.value = true
}
function openEdit(b: BodyType) {
  editing.value = b
  Object.assign(form, { name: b.name, sortOrder: b.sortOrder ?? 0, isActive: b.isActive ?? true })
  modalOpen.value = true
}
async function save() {
  saving.value = true
  try {
    const payload = { name: form.name, sortOrder: form.sortOrder, isActive: form.isActive }
    if (editing.value) await referencesApi.updateBodyType(editing.value.id, payload)
    else await referencesApi.createBodyType(payload)
    toast.add({ title: 'Сохранено', color: 'success', icon: 'i-lucide-check' })
    modalOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

const confirmOpen = ref(false)
const deleteTarget = ref<BodyType | null>(null)
const deleting = ref(false)
function askDelete(b: BodyType) {
  deleteTarget.value = b
  confirmOpen.value = true
}
async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await referencesApi.deleteBodyType(deleteTarget.value.id)
    toast.add({ title: 'Удалено', color: 'success', icon: 'i-lucide-check' })
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
  <UDashboardPanel id="body-types">
    <template #header>
      <UDashboardNavbar title="Типы кузова" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Тип кузова" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UTable :data="bodyTypes" :columns="columns" :loading="status === 'pending'">
        <template #name-cell="{ row }">
          <span class="font-medium text-highlighted">{{ row.original.name }}</span>
        </template>
        <template #sort-cell="{ row }">
          {{ row.original.sortOrder ?? 0 }}
        </template>
        <template #active-cell="{ row }">
          <UBadge :color="row.original.isActive === false ? 'neutral' : 'success'" variant="subtle" :label="row.original.isActive === false ? 'Нет' : 'Да'" />
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(row.original)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="askDelete(row.original)" />
          </div>
        </template>
      </UTable>

      <UModal v-model:open="modalOpen" :title="editing ? 'Редактировать тип кузова' : 'Новый тип кузова'">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Название" required>
              <UInput v-model="form.name" class="w-full" />
            </UFormField>
            <UFormField label="Порядок сортировки">
              <UInput v-model.number="form.sortOrder" type="number" class="w-full" />
            </UFormField>
            <div class="flex items-center gap-2">
              <USwitch v-model="form.isActive" />
              <span class="text-sm text-muted">Активен</span>
            </div>
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
        title="Удалить тип кузова?"
        :description="`«${deleteTarget?.name}» будет удалён.`"
        :loading="deleting"
        @confirm="doDelete"
      />
    </template>
  </UDashboardPanel>
</template>
