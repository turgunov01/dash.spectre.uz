<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import type { TableColumn } from '@nuxt/ui'
import type { Client } from '~/types/spectre'

useHead({ title: 'Клиенты — Spectre' })

const auth = useAuthStore()
const clientsApi = useClientsApi()
const toast = useToast()

const q = ref('')
const qDebounced = refDebounced(q, 300)

const { data: clients, status, refresh } = useAsyncData(
  'clients',
  () => clientsApi.list(qDebounced.value || undefined),
  { watch: [qDebounced], lazy: true, default: () => [] }
)

const canWrite = computed(() => auth.can('clients.write'))
const canDelete = computed(() => auth.can('clients.delete'))

const columns: TableColumn<Client>[] = [
  { accessorKey: 'name', header: 'Имя' },
  { accessorKey: 'phone', header: 'Телефон' },
  { id: 'cars', header: 'Авто' },
  { id: 'orders', header: 'Заказы' },
  { id: 'actions', header: '' }
]

// Create / edit
const modalOpen = ref(false)
const editing = ref<Client | null>(null)
const form = reactive({ name: '', phone: '', comment: '' })
const saving = ref(false)

function openCreate() {
  editing.value = null
  form.name = ''
  form.phone = ''
  form.comment = ''
  modalOpen.value = true
}

function openEdit(c: Client) {
  editing.value = c
  form.name = c.name
  form.phone = c.phone ?? ''
  form.comment = c.comment ?? ''
  modalOpen.value = true
}

async function save() {
  saving.value = true
  try {
    const payload = { name: form.name, phone: form.phone || undefined, comment: form.comment || undefined }
    if (editing.value) await clientsApi.update(editing.value.id, payload)
    else await clientsApi.create(payload)
    toast.add({ title: 'Сохранено', color: 'success', icon: 'i-lucide-check' })
    modalOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

// Delete
const confirmOpen = ref(false)
const deleteTarget = ref<Client | null>(null)
const deleting = ref(false)

function askDelete(c: Client) {
  deleteTarget.value = c
  confirmOpen.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await clientsApi.remove(deleteTarget.value.id)
    toast.add({ title: 'Клиент удалён', color: 'success', icon: 'i-lucide-check' })
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
  <UDashboardPanel id="clients">
    <template #header>
      <UDashboardNavbar title="Клиенты" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="canWrite" icon="i-lucide-plus" label="Клиент" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <UInput
          v-model="q"
          icon="i-lucide-search"
          placeholder="Поиск по имени или телефону"
          class="w-full sm:w-64"
        />
      </div>
      <UTable
        :data="clients"
        :columns="columns"
        :loading="status === 'pending'"
        class="shrink-0"
      >
        <template #name-cell="{ row }">
          <span class="font-medium text-highlighted">{{ row.original.name }}</span>
        </template>
        <template #phone-cell="{ row }">
          {{ row.original.phone || '—' }}
        </template>
        <template #cars-cell="{ row }">
          {{ row.original._count?.cars ?? row.original.cars?.length ?? 0 }}
        </template>
        <template #orders-cell="{ row }">
          {{ row.original._count?.orders ?? 0 }}
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton v-if="canWrite" icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(row.original)" />
            <UButton v-if="canDelete" icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="askDelete(row.original)" />
          </div>
        </template>
      </UTable>

      <div v-if="status !== 'pending' && !clients?.length" class="text-center text-muted py-12">
        Клиенты не найдены
      </div>

      <UModal v-model:open="modalOpen" :title="editing ? 'Редактировать клиента' : 'Новый клиент'">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Имя" required>
              <UInput v-model="form.name" class="w-full" />
            </UFormField>
            <UFormField label="Телефон">
              <UInput v-model="form.phone" class="w-full" placeholder="+998…" />
            </UFormField>
            <UFormField label="Комментарий">
              <UTextarea v-model="form.comment" class="w-full" :rows="3" />
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
        title="Удалить клиента?"
        :description="`Клиент «${deleteTarget?.name}» будет удалён без возможности восстановления.`"
        :loading="deleting"
        @confirm="doDelete"
      />
    </template>
  </UDashboardPanel>
</template>
