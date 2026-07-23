<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import type { TableColumn } from '@nuxt/ui'
import type { Car } from '~/types/spectre'

useHead({ title: 'Автомобили — Spectre' })

const auth = useAuthStore()
const carsApi = useCarsApi()
const clientsApi = useClientsApi()
const referencesApi = useReferencesApi()
const toast = useToast()

const q = ref('')
const qDebounced = refDebounced(q, 300)

const { data: cars, status, refresh } = useAsyncData(
  'cars',
  () => carsApi.list({ q: qDebounced.value || undefined }),
  { watch: [qDebounced], lazy: true, default: () => [] }
)

const { data: bodyTypes } = useAsyncData('body-types-select', () => referencesApi.bodyTypes(true), { lazy: true, default: () => [] })
const { data: clients } = useAsyncData('clients-select', () => clientsApi.list(), { lazy: true, default: () => [] })

const bodyTypeItems = computed(() => (bodyTypes.value ?? []).map(b => ({ label: b.name, value: b.id })))
const clientItems = computed(() => [{ label: '— Без клиента —', value: undefined as number | undefined }, ...(clients.value ?? []).map(c => ({ label: c.name, value: c.id }))])

const canWrite = computed(() => auth.can('clients.write'))
const canCreate = computed(() => auth.can('cars.create'))
const canDelete = computed(() => auth.can('clients.delete'))

const columns: TableColumn<Car>[] = [
  { accessorKey: 'plate', header: 'Госномер' },
  { id: 'model', header: 'Марка / модель' },
  { id: 'body', header: 'Кузов' },
  { id: 'client', header: 'Клиент' },
  { id: 'actions', header: '' }
]

const modalOpen = ref(false)
const editing = ref<Car | null>(null)
const form = reactive({
  plate: '',
  bodyTypeId: undefined as number | undefined,
  make: '',
  model: '',
  clientId: undefined as number | undefined,
  comment: ''
})
const saving = ref(false)

// Госномер — всегда в верхнем регистре, даже без Caps Lock.
watch(() => form.plate, (v) => {
  if (typeof v === 'string' && v !== v.toUpperCase()) form.plate = v.toUpperCase()
})

function openCreate() {
  editing.value = null
  Object.assign(form, { plate: '', bodyTypeId: bodyTypeItems.value[0]?.value, make: '', model: '', clientId: undefined, comment: '' })
  modalOpen.value = true
}

function openEdit(c: Car) {
  editing.value = c
  Object.assign(form, {
    plate: c.plate,
    bodyTypeId: c.bodyTypeId,
    make: c.make ?? '',
    model: c.model ?? '',
    clientId: c.clientId ?? undefined,
    comment: c.comment ?? ''
  })
  modalOpen.value = true
}

async function save() {
  if (!form.bodyTypeId) return
  saving.value = true
  try {
    const payload = {
      plate: form.plate,
      bodyTypeId: form.bodyTypeId,
      make: form.make || undefined,
      model: form.model || undefined,
      clientId: form.clientId,
      comment: form.comment || undefined
    }
    if (editing.value) await carsApi.update(editing.value.id, payload)
    else await carsApi.create(payload)
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
const deleteTarget = ref<Car | null>(null)
const deleting = ref(false)

function askDelete(c: Car) {
  deleteTarget.value = c
  confirmOpen.value = true
}

async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await carsApi.remove(deleteTarget.value.id)
    toast.add({ title: 'Автомобиль удалён', color: 'success', icon: 'i-lucide-check' })
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
  <UDashboardPanel id="cars">
    <template #header>
      <UDashboardNavbar title="Автомобили" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton v-if="canCreate" icon="i-lucide-plus" label="Авто" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <UInput v-model="q" icon="i-lucide-search" placeholder="Поиск по госномеру" class="w-full sm:w-56" />
      </div>
      <UTable :data="cars" :columns="columns" :loading="status === 'pending'">
        <template #plate-cell="{ row }">
          <span class="font-mono font-medium text-highlighted">{{ row.original.plate }}</span>
        </template>
        <template #model-cell="{ row }">
          {{ [row.original.make, row.original.model].filter(Boolean).join(' ') || '—' }}
        </template>
        <template #body-cell="{ row }">
          {{ row.original.bodyType?.name || '—' }}
        </template>
        <template #client-cell="{ row }">
          {{ row.original.client?.name || '—' }}
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton v-if="canWrite" icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(row.original)" />
            <UButton v-if="canDelete" icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="askDelete(row.original)" />
          </div>
        </template>
      </UTable>

      <div v-if="status !== 'pending' && !cars?.length" class="text-center text-muted py-12">
        Автомобили не найдены
      </div>

      <UModal v-model:open="modalOpen" :title="editing ? 'Редактировать авто' : 'Новый автомобиль'">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Госномер" required>
              <UInput v-model="form.plate" class="w-full uppercase" placeholder="01A123BC" />
            </UFormField>
            <UFormField label="Тип кузова" required>
              <USelect v-model="form.bodyTypeId" :items="bodyTypeItems" value-key="value" class="w-full" placeholder="Выберите кузов" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Марка">
                <UInput v-model="form.make" class="w-full" />
              </UFormField>
              <UFormField label="Модель">
                <UInput v-model="form.model" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Клиент">
              <USelectMenu v-model="form.clientId" :items="clientItems" value-key="value" class="w-full" placeholder="Привязать клиента" />
            </UFormField>
            <UFormField label="Комментарий">
              <UTextarea v-model="form.comment" class="w-full" :rows="2" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="modalOpen = false" />
            <UButton label="Сохранить" :loading="saving" :disabled="!form.plate || !form.bodyTypeId" @click="save" />
          </div>
        </template>
      </UModal>

      <ConfirmModal
        v-model:open="confirmOpen"
        title="Удалить автомобиль?"
        :description="`Автомобиль «${deleteTarget?.plate}» будет удалён.`"
        :loading="deleting"
        @confirm="doDelete"
      />
    </template>
  </UDashboardPanel>
</template>
