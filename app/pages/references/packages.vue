<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { ServicePackage } from '~/types/spectre'

definePageMeta({ roles: ['OWNER', 'ADMIN'] })
useHead({ title: 'Пакеты — Spectre' })

const referencesApi = useReferencesApi()
const toast = useToast()

const { data: packages, status, refresh } = useAsyncData('packages', () => referencesApi.packages(), { lazy: true, default: () => [] })
const { data: services } = useAsyncData('pkg-services', () => referencesApi.services({ active: true }), { lazy: true, default: () => [] })
const { data: bodyTypes } = useAsyncData('pkg-bodytypes', () => referencesApi.bodyTypes(), { lazy: true, default: () => [] })

const serviceItems = computed(() => (services.value ?? []).map(s => ({ label: s.name, value: s.id })))

const columns: TableColumn<ServicePackage>[] = [
  { accessorKey: 'name', header: 'Пакет' },
  { id: 'services', header: 'Услуги' },
  { id: 'actions', header: '' }
]

const modalOpen = ref(false)
const editing = ref<ServicePackage | null>(null)
const form = reactive({ name: '', description: '', serviceIds: [] as number[] })
const discountMap = ref<Record<number, number>>({})
const saving = ref(false)

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', description: '', serviceIds: [] })
  discountMap.value = {}
  modalOpen.value = true
}
function openEdit(p: ServicePackage) {
  editing.value = p
  Object.assign(form, {
    name: p.name,
    description: p.description ?? '',
    serviceIds: p.serviceIds ?? (p.services ?? []).map(s => s.id)
  })
  const map: Record<number, number> = {}
  for (const d of p.discounts ?? []) map[d.bodyTypeId] = d.discountPercent
  discountMap.value = map
  modalOpen.value = true
}
async function save() {
  saving.value = true
  try {
    const discounts = (bodyTypes.value ?? [])
      .map(bt => ({ bodyTypeId: bt.id, discountPercent: Number(discountMap.value[bt.id] || 0) }))
      .filter(d => d.discountPercent > 0)
    if (editing.value) {
      await referencesApi.updatePackage(editing.value.id, { name: form.name, description: form.description || undefined })
      await referencesApi.setPackageServices(editing.value.id, form.serviceIds)
      await referencesApi.setPackageDiscounts(editing.value.id, discounts)
    } else {
      await referencesApi.createPackage({ name: form.name, description: form.description || undefined, serviceIds: form.serviceIds, discounts })
    }
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
const deleteTarget = ref<ServicePackage | null>(null)
const deleting = ref(false)
function askDelete(p: ServicePackage) {
  deleteTarget.value = p
  confirmOpen.value = true
}
async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await referencesApi.deletePackage(deleteTarget.value.id)
    toast.add({ title: 'Пакет удалён', color: 'success', icon: 'i-lucide-check' })
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
  <UDashboardPanel id="packages">
    <template #header>
      <UDashboardNavbar title="Пакеты" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton icon="i-lucide-plus" label="Пакет" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UTable :data="packages" :columns="columns" :loading="status === 'pending'">
        <template #name-cell="{ row }">
          <div>
            <div class="font-medium text-highlighted">{{ row.original.name }}</div>
            <div v-if="row.original.description" class="text-xs text-muted truncate max-w-md">{{ row.original.description }}</div>
          </div>
        </template>
        <template #services-cell="{ row }">
          <UBadge color="neutral" variant="subtle" size="sm" :label="`${row.original.services?.length ?? row.original.serviceIds?.length ?? 0} услуг`" />
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(row.original)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="askDelete(row.original)" />
          </div>
        </template>
      </UTable>

      <UModal v-model:open="modalOpen" :title="editing ? 'Редактировать пакет' : 'Новый пакет'" :ui="{ content: 'max-w-lg' }">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Название" required>
              <UInput v-model="form.name" class="w-full" />
            </UFormField>
            <UFormField label="Описание">
              <UTextarea v-model="form.description" class="w-full" :rows="2" />
            </UFormField>
            <UFormField label="Услуги в пакете">
              <USelectMenu v-model="form.serviceIds" :items="serviceItems" value-key="value" multiple class="w-full" placeholder="Выберите услуги" searchable />
            </UFormField>
            <div>
              <div class="text-sm font-medium text-highlighted mb-2">Скидка по типам кузова, %</div>
              <div class="space-y-2">
                <div v-for="bt in bodyTypes" :key="bt.id" class="flex items-center gap-3">
                  <span class="w-40 text-sm text-muted truncate">{{ bt.name }}</span>
                  <UInput v-model.number="discountMap[bt.id]" type="number" min="0" max="100" placeholder="0" class="flex-1" />
                </div>
                <p v-if="!bodyTypes?.length" class="text-xs text-dimmed">Сначала добавьте типы кузова.</p>
              </div>
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
        title="Удалить пакет?"
        :description="`Пакет «${deleteTarget?.name}» будет удалён.`"
        :loading="deleting"
        @confirm="doDelete"
      />
    </template>
  </UDashboardPanel>
</template>
