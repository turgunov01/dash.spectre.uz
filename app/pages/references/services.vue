<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { Service } from '~/types/spectre'

definePageMeta({ roles: ['OWNER', 'ADMIN'] })
useHead({ title: 'Услуги и цены — Spectre' })

const referencesApi = useReferencesApi()
const toast = useToast()

const { data: services, status, refresh } = useAsyncData('services', () => referencesApi.services(), { lazy: true, default: () => [] })
const { data: categories, refresh: refreshCats } = useAsyncData('service-cats', () => referencesApi.serviceCategories(), { lazy: true, default: () => [] })
const { data: bodyTypes } = useAsyncData('svc-bodytypes', () => referencesApi.bodyTypes(), { lazy: true, default: () => [] })

const categoryItems = computed(() => [{ label: '— Без категории —', value: undefined as number | undefined }, ...(categories.value ?? []).map(c => ({ label: c.name, value: c.id }))])

const columns: TableColumn<Service>[] = [
  { accessorKey: 'name', header: 'Услуга' },
  { id: 'category', header: 'Категория' },
  { id: 'duration', header: 'Длительность' },
  { id: 'prices', header: 'Цены' },
  { id: 'actions', header: '' }
]

const modalOpen = ref(false)
const editing = ref<Service | null>(null)
const form = reactive({ name: '', categoryId: undefined as number | undefined, description: '', durationMin: undefined as number | undefined })
const priceMap = ref<Record<number, number>>({})
const saving = ref(false)

function openCreate() {
  editing.value = null
  Object.assign(form, { name: '', categoryId: undefined, description: '', durationMin: undefined })
  priceMap.value = {}
  modalOpen.value = true
}
function openEdit(s: Service) {
  editing.value = s
  Object.assign(form, { name: s.name, categoryId: s.categoryId ?? undefined, description: s.description ?? '', durationMin: s.durationMin ?? undefined })
  const map: Record<number, number> = {}
  for (const p of s.prices ?? []) map[p.bodyTypeId] = p.price
  priceMap.value = map
  modalOpen.value = true
}
async function save() {
  saving.value = true
  try {
    const prices = (bodyTypes.value ?? [])
      .map(bt => ({ bodyTypeId: bt.id, price: Number(priceMap.value[bt.id] || 0) }))
      .filter(p => p.price > 0)
    const base = { name: form.name, categoryId: form.categoryId, description: form.description || undefined, durationMin: form.durationMin }
    if (editing.value) {
      await referencesApi.updateService(editing.value.id, base)
      await referencesApi.setServicePrices(editing.value.id, prices)
    } else {
      await referencesApi.createService({ ...base, prices })
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
const deleteTarget = ref<Service | null>(null)
const deleting = ref(false)
function askDelete(s: Service) {
  deleteTarget.value = s
  confirmOpen.value = true
}
async function doDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await referencesApi.deleteService(deleteTarget.value.id)
    toast.add({ title: 'Услуга удалена', color: 'success', icon: 'i-lucide-check' })
    confirmOpen.value = false
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    deleting.value = false
  }
}

const catOpen = ref(false)
const catName = ref('')
const catBusy = ref(false)
async function addCategory() {
  if (!catName.value) return
  catBusy.value = true
  try {
    await referencesApi.createServiceCategory({ name: catName.value })
    catName.value = ''
    await refreshCats()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    catBusy.value = false
  }
}
async function removeCategory(id: number) {
  try {
    await referencesApi.deleteServiceCategory(id)
    await refreshCats()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  }
}
</script>

<template>
  <UDashboardPanel id="services">
    <template #header>
      <UDashboardNavbar title="Услуги и цены" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton color="neutral" variant="outline" icon="i-lucide-tags" aria-label="Категории" @click="catOpen = true">
            <span class="hidden sm:inline">Категории</span>
          </UButton>
          <UButton icon="i-lucide-plus" label="Услуга" @click="openCreate" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UTable :data="services" :columns="columns" :loading="status === 'pending'">
        <template #name-cell="{ row }">
          <span class="font-medium text-highlighted">{{ row.original.name }}</span>
        </template>
        <template #category-cell="{ row }">
          {{ row.original.category?.name || '—' }}
        </template>
        <template #duration-cell="{ row }">
          {{ row.original.durationMin ? row.original.durationMin + ' мин' : '—' }}
        </template>
        <template #prices-cell="{ row }">
          <UBadge color="neutral" variant="subtle" size="sm" :label="`${row.original.prices?.length ?? 0} цен`" />
        </template>
        <template #actions-cell="{ row }">
          <div class="flex justify-end gap-1">
            <UButton icon="i-lucide-pencil" color="neutral" variant="ghost" size="xs" @click="openEdit(row.original)" />
            <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="askDelete(row.original)" />
          </div>
        </template>
      </UTable>

      <UModal v-model:open="modalOpen" :title="editing ? 'Редактировать услугу' : 'Новая услуга'" :ui="{ content: 'max-w-lg' }">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Название" required>
              <UInput v-model="form.name" class="w-full" />
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Категория">
                <USelect v-model="form.categoryId" :items="categoryItems" value-key="value" class="w-full" />
              </UFormField>
              <UFormField label="Длительность, мин">
                <UInput v-model.number="form.durationMin" type="number" min="0" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Описание">
              <UTextarea v-model="form.description" class="w-full" :rows="2" />
            </UFormField>
            <div>
              <div class="text-sm font-medium text-highlighted mb-2">Цены по типам кузова</div>
              <div class="space-y-2">
                <div v-for="bt in bodyTypes" :key="bt.id" class="flex items-center gap-3">
                  <span class="w-40 text-sm text-muted truncate">{{ bt.name }}</span>
                  <UInput v-model.number="priceMap[bt.id]" type="number" min="0" placeholder="0" class="flex-1" />
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

      <UModal v-model:open="catOpen" title="Категории услуг">
        <template #body>
          <div class="space-y-4">
            <div class="flex gap-2">
              <UInput v-model="catName" placeholder="Новая категория" class="flex-1" @keyup.enter="addCategory" />
              <UButton icon="i-lucide-plus" :loading="catBusy" :disabled="!catName" @click="addCategory" />
            </div>
            <div class="divide-y divide-default rounded-lg border border-default">
              <div v-for="c in categories" :key="c.id" class="flex items-center justify-between px-3 py-2">
                <span class="text-sm text-highlighted">{{ c.name }}</span>
                <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" @click="removeCategory(c.id)" />
              </div>
              <p v-if="!categories?.length" class="px-3 py-4 text-center text-sm text-dimmed">Категорий нет</p>
            </div>
          </div>
        </template>
      </UModal>

      <ConfirmModal
        v-model:open="confirmOpen"
        title="Удалить услугу?"
        :description="`Услуга «${deleteTarget?.name}» будет удалена.`"
        :loading="deleting"
        @confirm="doDelete"
      />
    </template>
  </UDashboardPanel>
</template>
