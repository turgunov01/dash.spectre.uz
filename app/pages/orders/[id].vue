<script setup lang="ts">
import { statusTransitions } from '~/types/spectre'
import { PAYMENT_METHODS } from '~/types/spectre'
import type { OrderStatus, PaymentMethod } from '~/types/spectre'
import type { Employee } from '~/composables/useFilesApi'

const route = useRoute()
const id = Number(route.params.id)

const auth = useAuthStore()
const ordersApi = useOrdersApi()
const discountsApi = useDiscountsApi()
const referencesApi = useReferencesApi()
const toast = useToast()

const { data: order, status, refresh } = useAsyncData(`order-${id}`, () => ordersApi.get(id), { lazy: true })

useHead({ title: () => `Заказ #${order.value?.number || id} — Spectre` })

const canWrite = computed(() => auth.can('orders.write'))
const canPay = computed(() => auth.can('cash.session'))
const canRefund = computed(() => auth.can('orders.refund'))
const canDiscount = computed(() => auth.can('discounts.apply'))
const canAssign = computed(() => auth.can('orders.assign'))
const canTake = computed(() => auth.can('orders.take'))

const busy = ref(false)
async function run(fn: () => Promise<unknown>, ok: string) {
  busy.value = true
  try {
    await fn()
    toast.add({ title: ok, color: 'success', icon: 'i-lucide-check' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}

const changeStatus = (s: OrderStatus) => run(() => ordersApi.setStatus(id, s), 'Статус обновлён')
const take = () => run(() => ordersApi.take(id), 'Заказ взят')
const assignAuto = () => run(() => ordersApi.assignAuto(id), 'Мойщик назначен')

// Manual assign — pick from the list of active washers (ADMIN/OWNER only)
const employeesApi = useEmployeesApi()
const washers = ref<Employee[]>([])
const washerItems = computed(() => washers.value.map(w => ({ label: w.name || w.email, value: w.id })))
const washerId = ref<number | undefined>()
const assignManual = () => washerId.value ? run(() => ordersApi.assign(id, washerId.value as number), 'Мойщик назначен') : undefined
async function loadWashers() {
  if (!canAssign.value) return
  try {
    washers.value = await employeesApi.list({ role: 'WASHER', active: true })
  } catch {
    // non-fatal: the dropdown just stays empty
  }
}
onMounted(loadWashers)

// Pay
const payOpen = ref(false)
const payMethod = ref<PaymentMethod>('CASH')
const methodItems = PAYMENT_METHODS.map(m => ({ label: PAYMENT_METHOD_LABEL[m], value: m }))
async function pay() {
  await run(() => ordersApi.pay(id, payMethod.value), 'Заказ оплачен')
  payOpen.value = false
}

// Discount
const discountOpen = ref(false)
const discountCode = ref('')
const discountId = ref<number | undefined>()
const { data: discounts } = useAsyncData('order-discounts', () => discountsApi.list({ status: 'ACTIVE' }), { lazy: true, default: () => [] })
const discountItems = computed(() => [{ label: '— По коду —', value: undefined as number | undefined }, ...(discounts.value ?? []).map(d => ({ label: `${d.name}${d.code ? ' (' + d.code + ')' : ''}`, value: d.id }))])
async function applyDiscount() {
  const body = discountId.value ? { discountId: discountId.value } : { code: discountCode.value }
  await run(() => ordersApi.applyDiscount(id, body), 'Скидка применена')
  discountOpen.value = false
  discountCode.value = ''
  discountId.value = undefined
}
const removeDiscount = () => run(() => ordersApi.removeDiscount(id), 'Скидка снята')

// Refund
const refundOpen = ref(false)
const refundForm = reactive({ amount: 0, method: 'CASH' as PaymentMethod, reason: '' })
async function refund() {
  await run(() => ordersApi.refund(id, { amount: refundForm.amount, method: refundForm.method, reason: refundForm.reason }), 'Возврат оформлен')
  refundOpen.value = false
}

// Add items
const { data: services } = useAsyncData('order-add-services', () => referencesApi.services({ active: true }), { lazy: true, default: () => [] })
const { data: packages } = useAsyncData('order-add-packages', () => referencesApi.packages(true), { lazy: true, default: () => [] })
const serviceItems = computed(() => (services.value ?? []).map(s => ({ label: s.name, value: s.id })))
const packageItems = computed(() => (packages.value ?? []).map(p => ({ label: p.name, value: p.id })))
const addService = ref<number | undefined>()
const addPackage = ref<number | undefined>()
async function addServiceItem() {
  if (!addService.value) return
  await run(() => ordersApi.addItems(id, [{ type: 'SERVICE', refId: addService.value as number, qty: 1 }]), 'Позиция добавлена')
  addService.value = undefined
}
async function addPackageItem() {
  if (!addPackage.value) return
  await run(() => ordersApi.addItems(id, [{ type: 'PACKAGE', refId: addPackage.value as number, qty: 1 }]), 'Позиция добавлена')
  addPackage.value = undefined
}
const removeItem = (itemId: number) => run(() => ordersApi.removeItem(id, itemId), 'Позиция удалена')

// Car photos (приёмка) — view gallery + lightbox; writers can add / remove
const filesApi = useFilesApi()
const assetUrl = useAssetUrl()
const MAX_PHOTOS = 10
const photos = computed(() => order.value?.photos ?? [])

const isTouch = ref(false)
onMounted(() => {
  isTouch.value = import.meta.client && window.matchMedia('(pointer: coarse)').matches
})

const lightboxOpen = ref(false)
const lightboxIndex = ref(0)
const currentPhoto = computed(() => photos.value[lightboxIndex.value])
function openLightbox(i: number) {
  lightboxIndex.value = i
  lightboxOpen.value = true
}
function stepPhoto(delta: number) {
  const n = photos.value.length
  if (!n) return
  lightboxIndex.value = (lightboxIndex.value + delta + n) % n
}

const photoUploading = ref(false)
async function onAddPhotos(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? [])
  input.value = ''
  if (!files.length) return
  const room = MAX_PHOTOS - photos.value.length
  if (room <= 0) {
    toast.add({ title: `Максимум ${MAX_PHOTOS} фото`, color: 'warning' })
    return
  }
  photoUploading.value = true
  try {
    const urls: string[] = []
    for (const file of files.slice(0, room)) {
      const { url } = await filesApi.upload(file)
      urls.push(url)
    }
    await ordersApi.addPhotos(id, urls)
    toast.add({ title: 'Фото добавлены', color: 'success', icon: 'i-lucide-check' })
    await refresh()
  } catch (err) {
    toast.add({ title: 'Не удалось загрузить фото', description: apiErrorMessage(err), color: 'error' })
  } finally {
    photoUploading.value = false
  }
}
const deletePhoto = (photoId: number) => run(() => ordersApi.removePhoto(id, photoId), 'Фото удалено')

const transitions = computed(() => order.value ? statusTransitions(order.value.status) : [])
const editable = computed(() => order.value && !['COMPLETED', 'CANCELLED'].includes(order.value.status))
</script>

<template>
  <UDashboardPanel id="order-detail">
    <template #header>
      <UDashboardNavbar :title="`Заказ #${order?.number || id}`" :ui="{ right: 'gap-2' }">
        <template #leading>
          <UButton icon="i-lucide-arrow-left" color="neutral" variant="ghost" to="/orders" />
        </template>
        <template #right>
          <UBadge v-if="order" :color="ORDER_STATUS_COLOR[order.status]" variant="subtle" size="lg" :label="ORDER_STATUS_LABEL[order.status]" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="status === 'pending'" class="space-y-4">
        <USkeleton class="h-32" />
        <USkeleton class="h-48" />
      </div>

      <div v-else-if="order" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2 space-y-6">
          <div class="rounded-xl border border-default bg-default p-5 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div class="text-muted text-xs">Госномер</div>
              <div class="font-mono font-medium text-highlighted">{{ order.plate || order.car?.plate || '—' }}</div>
            </div>
            <div>
              <div class="text-muted text-xs">Клиент</div>
              <div class="text-highlighted">{{ order.client?.name || order.clientName || '—' }}</div>
            </div>
            <div>
              <div class="text-muted text-xs">Телефон</div>
              <div class="text-highlighted">{{ order.phone || order.client?.phone || '—' }}</div>
            </div>
            <div>
              <div class="text-muted text-xs">Мойщик</div>
              <div class="text-highlighted">{{ order.assignedWasher?.name || order.assignedWasher?.email || '—' }}</div>
            </div>
            <div v-if="order.comment" class="sm:col-span-2">
              <div class="text-muted text-xs">Комментарий</div>
              <div class="text-highlighted">{{ order.comment }}</div>
            </div>
          </div>

          <div class="rounded-xl border border-default bg-default overflow-hidden">
            <div class="flex items-center justify-between px-5 py-3 border-b border-default">
              <h3 class="font-semibold text-highlighted">
                Фото машины <span class="text-muted text-xs font-normal">({{ photos.length }})</span>
              </h3>
              <div v-if="canWrite && editable && photos.length < MAX_PHOTOS" class="flex items-center gap-3">
                <label
                  v-if="isTouch"
                  class="inline-flex items-center gap-1 cursor-pointer text-sm text-primary hover:text-primary/80"
                >
                  <UIcon name="i-lucide-camera" class="size-4" />
                  <span>Снять</span>
                  <input type="file" accept="image/*" capture="environment" class="hidden" :disabled="photoUploading" @change="onAddPhotos">
                </label>
                <label class="inline-flex items-center gap-1 cursor-pointer text-sm text-primary hover:text-primary/80">
                  <UIcon :name="photoUploading ? 'i-lucide-loader-circle' : 'i-lucide-image-plus'" class="size-4" :class="{ 'animate-spin': photoUploading }" />
                  <span>{{ isTouch ? 'Галерея' : 'Добавить' }}</span>
                  <input type="file" accept="image/*" multiple class="hidden" :disabled="photoUploading" @change="onAddPhotos">
                </label>
              </div>
            </div>
            <div v-if="photos.length" class="p-4 grid grid-cols-3 sm:grid-cols-4 gap-2">
              <div
                v-for="(p, i) in photos"
                :key="p.id"
                class="group relative aspect-square overflow-hidden rounded-lg border border-default bg-elevated cursor-pointer"
                @click="openLightbox(i)"
              >
                <img :src="assetUrl(p.url)" class="size-full object-cover transition-transform group-hover:scale-105" alt="Фото машины" loading="lazy">
                <div class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/20">
                  <UIcon name="i-lucide-maximize-2" class="size-5 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <UButton
                  v-if="canWrite && editable"
                  icon="i-lucide-trash-2"
                  color="error"
                  variant="solid"
                  size="xs"
                  class="absolute right-1 top-1"
                  :loading="busy"
                  @click.stop="deletePhoto(p.id)"
                />
              </div>
            </div>
            <p v-else class="px-5 py-6 text-center text-muted text-sm">Фото не прикреплены</p>
          </div>

          <div class="rounded-xl border border-default bg-default overflow-hidden">
            <div class="flex items-center justify-between px-5 py-3 border-b border-default">
              <h3 class="font-semibold text-highlighted">Позиции</h3>
            </div>
            <div class="divide-y divide-default">
              <div v-for="it in order.items" :key="it.id" class="flex items-center gap-3 px-5 py-3">
                <UBadge :color="it.type === 'PACKAGE' ? 'info' : 'neutral'" variant="subtle" size="sm" :label="it.type === 'PACKAGE' ? 'Пакет' : 'Услуга'" />
                <span class="flex-1 text-sm text-highlighted">{{ it.name || `#${it.refId}` }}</span>
                <span class="text-xs text-muted">×{{ it.qty }}</span>
                <span class="text-sm font-medium text-highlighted w-28 text-right">{{ formatMoney(it.total) }}</span>
                <UButton
                  v-if="canWrite && editable"
                  icon="i-lucide-x"
                  color="error"
                  variant="ghost"
                  size="xs"
                  :loading="busy"
                  @click="removeItem(it.id)"
                />
              </div>
              <p v-if="!order.items?.length" class="px-5 py-6 text-center text-muted text-sm">Нет позиций</p>
            </div>
            <div class="px-5 py-3 border-t border-default space-y-1 text-sm">
              <div class="flex justify-between text-muted">
                <span>Подытог</span><span>{{ formatMoney(order.subtotal ?? order.total) }}</span>
              </div>
              <div v-if="order.discountAmount" class="flex justify-between text-primary">
                <span>Скидка</span><span>−{{ formatMoney(order.discountAmount) }}</span>
              </div>
              <div class="flex justify-between font-bold text-highlighted text-base pt-1">
                <span>Итого</span><span>{{ formatMoney(order.total) }}</span>
              </div>
            </div>
          </div>

          <div v-if="canWrite && editable" class="rounded-xl border border-default bg-default p-4">
            <h3 class="font-semibold text-highlighted text-sm mb-3">Добавить позицию</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div class="flex gap-2">
                <USelectMenu v-model="addService" :items="serviceItems" value-key="value" placeholder="Услуга" searchable class="flex-1" />
                <UButton icon="i-lucide-plus" color="neutral" variant="outline" :disabled="!addService" @click="addServiceItem" />
              </div>
              <div class="flex gap-2">
                <USelectMenu v-model="addPackage" :items="packageItems" value-key="value" placeholder="Пакет" searchable class="flex-1" />
                <UButton icon="i-lucide-plus" color="neutral" variant="outline" :disabled="!addPackage" @click="addPackageItem" />
              </div>
            </div>
          </div>
        </div>

        <div class="space-y-4">
          <div class="rounded-xl border border-default bg-default p-4 space-y-3">
            <h3 class="font-semibold text-highlighted text-sm">Действия</h3>

            <div v-if="canWrite && transitions.length" class="flex flex-wrap gap-2">
              <UButton
                v-for="s in transitions"
                :key="s"
                size="sm"
                :color="s === 'CANCELLED' ? 'error' : 'neutral'"
                :variant="s === 'CANCELLED' ? 'soft' : 'outline'"
                :label="ORDER_STATUS_LABEL[s]"
                :loading="busy"
                @click="changeStatus(s)"
              />
            </div>

            <UButton
              v-if="canPay && order.status === 'AWAITING_PAYMENT'"
              block
              color="success"
              icon="i-lucide-banknote"
              label="Принять оплату"
              @click="payOpen = true"
            />

            <div class="flex flex-wrap gap-2">
              <UButton v-if="canTake && (order.status === 'QUEUED' || order.status === 'NEW')" size="sm" color="primary" variant="soft" label="Взять себе" :loading="busy" @click="take" />
              <UButton v-if="canAssign && ['NEW', 'QUEUED', 'ASSIGNED'].includes(order.status)" size="sm" color="neutral" variant="soft" icon="i-lucide-wand-2" label="Авто-назначение" :loading="busy" @click="assignAuto" />
            </div>

            <div v-if="canAssign && editable" class="flex gap-2">
              <USelectMenu v-model="washerId" :items="washerItems" value-key="value" placeholder="Выберите мойщика" size="sm" class="flex-1" />
              <UButton size="sm" color="neutral" variant="outline" label="Назначить" :disabled="!washerId" :loading="busy" @click="assignManual" />
            </div>
          </div>

          <div v-if="canDiscount && editable" class="rounded-xl border border-default bg-default p-4 space-y-2">
            <h3 class="font-semibold text-highlighted text-sm">Скидка</h3>
            <div class="flex gap-2">
              <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-badge-percent" label="Применить" class="flex-1" @click="discountOpen = true" />
              <UButton v-if="order.discountAmount" size="sm" color="error" variant="ghost" icon="i-lucide-x" :loading="busy" @click="removeDiscount" />
            </div>
          </div>

          <div v-if="canRefund" class="rounded-xl border border-default bg-default p-4">
            <UButton block size="sm" color="error" variant="soft" icon="i-lucide-undo-2" label="Оформить возврат" @click="refundOpen = true" />
          </div>
        </div>
      </div>

      <UAlert v-else color="error" variant="subtle" icon="i-lucide-triangle-alert" title="Заказ не найден" />

      <UModal v-model:open="payOpen" title="Приём оплаты">
        <template #body>
          <UFormField label="Способ оплаты">
            <USelect v-model="payMethod" :items="methodItems" value-key="value" class="w-full" />
          </UFormField>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="payOpen = false" />
            <UButton color="success" label="Оплатить" :loading="busy" @click="pay" />
          </div>
        </template>
      </UModal>

      <UModal v-model:open="discountOpen" title="Применить скидку">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Из списка">
              <USelectMenu v-model="discountId" :items="discountItems" value-key="value" class="w-full" searchable />
            </UFormField>
            <UFormField v-if="!discountId" label="Или промокод">
              <UInput v-model="discountCode" class="w-full" placeholder="SPRING" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="discountOpen = false" />
            <UButton label="Применить" :loading="busy" :disabled="!discountId && !discountCode" @click="applyDiscount" />
          </div>
        </template>
      </UModal>

      <UModal v-model:open="refundOpen" title="Возврат по заказу">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Сумма" required>
              <UInput v-model.number="refundForm.amount" type="number" min="0" class="w-full" />
            </UFormField>
            <UFormField label="Способ" required>
              <USelect v-model="refundForm.method" :items="methodItems" value-key="value" class="w-full" />
            </UFormField>
            <UFormField label="Причина" required>
              <UTextarea v-model="refundForm.reason" class="w-full" :rows="2" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="refundOpen = false" />
            <UButton color="error" label="Оформить возврат" :loading="busy" :disabled="refundForm.amount <= 0 || !refundForm.reason" @click="refund" />
          </div>
        </template>
      </UModal>

      <UModal v-model:open="lightboxOpen" :ui="{ content: 'max-w-3xl' }">
        <template #content>
          <div v-if="currentPhoto" class="relative overflow-hidden rounded-lg bg-black">
            <img :src="assetUrl(currentPhoto.url)" class="max-h-[80vh] w-full object-contain" alt="Фото машины">
            <UButton icon="i-lucide-x" color="neutral" variant="solid" class="absolute right-2 top-2" @click="lightboxOpen = false" />
            <template v-if="photos.length > 1">
              <UButton icon="i-lucide-chevron-left" color="neutral" variant="solid" class="absolute left-2 top-1/2 -translate-y-1/2" @click="stepPhoto(-1)" />
              <UButton icon="i-lucide-chevron-right" color="neutral" variant="solid" class="absolute right-2 top-1/2 -translate-y-1/2" @click="stepPhoto(1)" />
              <div class="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
                {{ lightboxIndex + 1 }} / {{ photos.length }}
              </div>
            </template>
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
