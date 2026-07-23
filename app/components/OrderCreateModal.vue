<script setup lang="ts">
import type { OrderItemInput } from '~/composables/useOrdersApi'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ created: [orderId: number] }>()

const auth = useAuthStore()
const ordersApi = useOrdersApi()
const carsApi = useCarsApi()
const clientsApi = useClientsApi()

// Only the admin/owner may persist a car. Others take the order as a walk-in (no car saved).
const canCreateCar = computed(() => auth.can('cars.create'))
const referencesApi = useReferencesApi()
const discountsApi = useDiscountsApi()
const filesApi = useFilesApi()
const assetUrl = useAssetUrl()
const toast = useToast()

const MAX_PHOTOS = 10

// На телефоне/планшете (coarse pointer) показываем плитку прямой съёмки с камеры.
const isTouch = ref(false)
onMounted(() => {
  isTouch.value = import.meta.client && window.matchMedia('(pointer: coarse)').matches
})

// false → выбрать существующий автомобиль; true → создать нового клиента + авто
const newClient = ref(false)

const { data: cars } = useAsyncData('oc-cars', () => carsApi.list(), { lazy: true, default: () => [] })
const { data: services } = useAsyncData('oc-services', () => referencesApi.services({ active: true }), { lazy: true, default: () => [] })
const { data: packages } = useAsyncData('oc-packages', () => referencesApi.packages(true), { lazy: true, default: () => [] })
const { data: bodyTypes } = useAsyncData('oc-bodytypes', () => referencesApi.bodyTypes(true), { lazy: true, default: () => [] })
const { data: discounts } = useAsyncData('oc-discounts', () => discountsApi.list({ status: 'ACTIVE' }), { lazy: true, default: () => [] })

const carItems = computed(() => (cars.value ?? []).map(c => ({ label: `${c.plate}${c.bodyType?.name ? ' · ' + c.bodyType.name : ''}`, value: c.id })))
const bodyTypeItems = computed(() => (bodyTypes.value ?? []).map(b => ({ label: b.name, value: b.id })))
const serviceItems = computed(() => (services.value ?? []).map(s => ({ label: s.name, value: s.id })))
const packageItems = computed(() => (packages.value ?? []).map(p => ({ label: p.name, value: p.id })))
const discountItems = computed(() => [
  { label: 'Без скидки', value: undefined as number | undefined },
  ...(discounts.value ?? []).map(d => ({ label: `${d.name} · ${d.type === 'FIXED' ? formatMoney(d.value) : d.value + '%'}`, value: d.id as number | undefined }))
])

const carId = ref<number | undefined>()
const nc = reactive({ name: '', phone: '', plate: '', bodyTypeId: undefined as number | undefined, make: '', model: '' })
const items = ref<Array<OrderItemInput & { name: string }>>([])
const comment = ref('')
const discountId = ref<number | undefined>()
const photos = ref<string[]>([])
const uploading = ref(false)
const saving = ref(false)

const addService = ref<number | undefined>()
const addPackage = ref<number | undefined>()

watch(addService, (id) => {
  if (!id) return
  const s = services.value?.find(x => x.id === id)
  if (s) items.value.push({ type: 'SERVICE', refId: id, qty: 1, name: s.name })
  nextTick(() => { addService.value = undefined })
})
watch(addPackage, (id) => {
  if (!id) return
  const p = packages.value?.find(x => x.id === id)
  if (p) items.value.push({ type: 'PACKAGE', refId: id, qty: 1, name: p.name })
  nextTick(() => { addPackage.value = undefined })
})

function removeItem(i: number) {
  items.value.splice(i, 1)
}

// Госномер — всегда в верхнем регистре, даже без Caps Lock.
watch(() => nc.plate, (v) => {
  if (typeof v === 'string' && v !== v.toUpperCase()) nc.plate = v.toUpperCase()
})

async function onPhotos(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  const room = MAX_PHOTOS - photos.value.length
  if (room <= 0) return
  uploading.value = true
  try {
    for (const file of files.slice(0, room)) {
      const { url } = await filesApi.upload(file)
      photos.value.push(url)
    }
  } catch (e) {
    toast.add({ title: 'Не удалось загрузить фото', description: apiErrorMessage(e), color: 'error' })
  } finally {
    uploading.value = false
  }
}

function removePhoto(i: number) {
  photos.value.splice(i, 1)
}

const canSubmit = computed(() => {
  if (items.value.length === 0) return false
  return newClient.value
    ? !!nc.name && !!nc.plate && !!nc.bodyTypeId
    : !!carId.value
})

function reset() {
  carId.value = undefined
  Object.assign(nc, { name: '', phone: '', plate: '', bodyTypeId: undefined, make: '', model: '' })
  items.value = []
  comment.value = ''
  discountId.value = undefined
  photos.value = []
  newClient.value = false
}

async function submit() {
  if (!canSubmit.value) return
  saving.value = true
  try {
    const payloadItems: OrderItemInput[] = items.value.map(i => ({ type: i.type, refId: i.refId, qty: i.qty }))
    const orderPhotos = photos.value.length ? [...photos.value] : undefined

    // New-client mode (creates the client + car) is admin/owner only; others pick an existing car.
    let orderCarId: number
    if (newClient.value) {
      const client = await clientsApi.create({ name: nc.name, phone: nc.phone || undefined })
      const car = await carsApi.create({
        plate: nc.plate,
        bodyTypeId: nc.bodyTypeId as number,
        make: nc.make || undefined,
        model: nc.model || undefined,
        clientId: client.id
      })
      orderCarId = car.id
    } else {
      orderCarId = carId.value as number
    }

    const order = await ordersApi.create({ carId: orderCarId, items: payloadItems, comment: comment.value || undefined, photos: orderPhotos })

    if (discountId.value) {
      try {
        await ordersApi.applyDiscount(order.id, { discountId: discountId.value })
      } catch (err) {
        toast.add({ title: 'Заказ создан, но скидку применить не удалось', description: apiErrorMessage(err), color: 'warning' })
      }
    }

    toast.add({ title: 'Заказ создан', color: 'success', icon: 'i-lucide-check' })
    reset()
    open.value = false
    emit('created', order.id)
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Новый заказ" :ui="{ content: 'max-w-xl' }">
    <template #body>
      <div class="space-y-5">
        <div v-if="canCreateCar" class="flex items-center justify-between rounded-lg border border-default bg-elevated/40 px-3 py-2">
          <div class="flex items-center gap-2">
            <UIcon :name="newClient ? 'i-lucide-user-plus' : 'i-lucide-car'" class="size-4 text-primary" />
            <span class="text-sm font-medium text-highlighted">{{ newClient ? 'Новый клиент' : 'Автомобиль из базы' }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="hidden text-sm text-muted sm:inline">Новый клиент</span>
            <USwitch v-model="newClient" />
          </div>
        </div>

        <UFormField v-if="!newClient" label="Автомобиль" required>
          <USelectMenu v-model="carId" :items="carItems" value-key="value" class="w-full" placeholder="Выберите авто" searchable />
        </UFormField>

        <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="Имя клиента" required>
            <UInput v-model="nc.name" class="w-full" />
          </UFormField>
          <UFormField label="Телефон">
            <UInput v-model="nc.phone" class="w-full" placeholder="+998…" />
          </UFormField>
          <UFormField label="Госномер" required>
            <UInput v-model="nc.plate" class="w-full uppercase" placeholder="01A123BC" />
          </UFormField>
          <UFormField label="Тип кузова" required>
            <USelect v-model="nc.bodyTypeId" :items="bodyTypeItems" value-key="value" class="w-full" placeholder="Кузов" />
          </UFormField>
          <UFormField label="Марка">
            <UInput v-model="nc.make" class="w-full" />
          </UFormField>
          <UFormField label="Модель">
            <UInput v-model="nc.model" class="w-full" />
          </UFormField>
        </div>

        <div class="space-y-2">
          <div class="text-sm font-medium text-highlighted">Позиции</div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <USelectMenu v-model="addService" :items="serviceItems" value-key="value" placeholder="+ Услуга" searchable class="w-full" />
            <USelectMenu v-model="addPackage" :items="packageItems" value-key="value" placeholder="+ Пакет" searchable class="w-full" />
          </div>

          <div v-if="items.length" class="rounded-lg border border-default divide-y divide-default">
            <div v-for="(it, i) in items" :key="i" class="flex items-center gap-3 p-2">
              <UBadge :color="it.type === 'PACKAGE' ? 'info' : 'neutral'" variant="subtle" size="sm" :label="it.type === 'PACKAGE' ? 'Пакет' : 'Услуга'" />
              <span class="flex-1 text-sm text-highlighted truncate">{{ it.name }}</span>
              <UInput v-model.number="it.qty" type="number" min="1" size="xs" class="w-16" />
              <UButton icon="i-lucide-x" color="error" variant="ghost" size="xs" @click="removeItem(i)" />
            </div>
          </div>
          <p v-else class="text-xs text-dimmed">Добавьте хотя бы одну услугу или пакет.</p>
        </div>

        <UFormField label="Скидка">
          <USelectMenu
            v-model="discountId"
            :items="discountItems"
            value-key="value"
            class="w-full"
            searchable
          />
        </UFormField>

        <div class="space-y-2">
          <div class="text-sm font-medium text-highlighted">
            Фото машины <span class="text-xs text-dimmed">({{ photos.length }}/{{ MAX_PHOTOS }})</span>
          </div>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="(url, i) in photos"
              :key="url"
              class="relative size-20 overflow-hidden rounded-lg border border-default"
            >
              <img :src="assetUrl(url)" class="size-full object-cover" alt="">
              <UButton
                icon="i-lucide-x"
                color="error"
                variant="solid"
                size="xs"
                class="absolute right-0.5 top-0.5"
                @click="removePhoto(i)"
              />
            </div>
            <template v-if="photos.length < MAX_PHOTOS">
              <label
                v-if="isTouch"
                class="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-default text-muted transition-colors hover:border-primary hover:text-primary"
              >
                <UIcon :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-camera'" class="size-5" :class="{ 'animate-spin': uploading }" />
                <span class="text-[10px]">Камера</span>
                <input type="file" accept="image/*" capture="environment" class="hidden" :disabled="uploading" @change="onPhotos">
              </label>
              <label
                class="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-default text-muted transition-colors hover:border-primary hover:text-primary"
              >
                <UIcon :name="uploading ? 'i-lucide-loader-circle' : 'i-lucide-image'" class="size-5" :class="{ 'animate-spin': uploading }" />
                <span class="text-[10px]">{{ isTouch ? 'Галерея' : 'Добавить' }}</span>
                <input type="file" accept="image/*" multiple class="hidden" :disabled="uploading" @change="onPhotos">
              </label>
            </template>
          </div>
          <p class="text-xs text-dimmed">Фиксация состояния на приёмке — до {{ MAX_PHOTOS }} фото, необязательно.</p>
        </div>

        <UFormField label="Комментарий">
          <UTextarea v-model="comment" class="w-full" :rows="2" />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" label="Отмена" @click="open = false" />
        <UButton label="Создать заказ" icon="i-lucide-check" :loading="saving" :disabled="!canSubmit" @click="submit" />
      </div>
    </template>
  </UModal>
</template>
