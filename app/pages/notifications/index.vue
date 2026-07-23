<script setup lang="ts">
import type { ApiList, Notification } from '~/types/spectre'

useHead({ title: 'Уведомления — Spectre' })

const notificationsApi = useNotificationsApi()
const toast = useToast()

const unreadOnly = ref(false)

const { data: envelope, status, refresh } = useAsyncData(
  'notifications',
  () => notificationsApi.list({ unread: unreadOnly.value || undefined }),
  { watch: [unreadOnly], lazy: true, default: (): ApiList<Notification> => ({ data: [], unreadCount: 0 }) }
)

const notifications = computed(() => envelope.value?.data ?? [])
const unreadCount = computed(() => envelope.value?.unreadCount ?? 0)

const busy = ref(false)
async function markRead(id: number) {
  try {
    await notificationsApi.markRead(id)
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  }
}
async function markAll() {
  busy.value = true
  try {
    await notificationsApi.markAllRead()
    toast.add({ title: 'Все прочитано', color: 'success', icon: 'i-lucide-check' })
    await refresh()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    busy.value = false
  }
}

// Telegram registration
const tgOpen = ref(false)
const tgForm = reactive({ chatId: '', label: '' })
const tgSaving = ref(false)
async function registerTg() {
  tgSaving.value = true
  try {
    await notificationsApi.telegramRegister({ chatId: tgForm.chatId, label: tgForm.label || undefined })
    toast.add({ title: 'Telegram привязан', color: 'success', icon: 'i-lucide-check' })
    tgOpen.value = false
    tgForm.chatId = ''
    tgForm.label = ''
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    tgSaving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="notifications">
    <template #header>
      <UDashboardNavbar title="Уведомления" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UBadge v-if="unreadCount" color="error" variant="subtle" :label="`${unreadCount} новых`" />
          <UButton size="sm" color="neutral" variant="outline" icon="i-lucide-send" aria-label="Telegram" @click="tgOpen = true">
            <span class="hidden sm:inline">Telegram</span>
          </UButton>
          <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-check-check" aria-label="Прочитать всё" :loading="busy" @click="markAll">
            <span class="hidden sm:inline">Прочитать всё</span>
          </UButton>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex items-center gap-2 mb-4">
        <USwitch v-model="unreadOnly" />
        <span class="text-sm text-muted">Только непрочитанные</span>
      </div>

      <div v-if="status === 'pending'" class="space-y-2">
        <USkeleton v-for="n in 5" :key="n" class="h-16" />
      </div>

      <div v-else-if="notifications.length" class="flex flex-col gap-2">
        <div
          v-for="n in notifications"
          :key="n.id"
          class="flex items-start gap-3 rounded-lg border border-default bg-default p-3"
          :class="{ 'opacity-60': n.read }"
        >
          <UBadge :color="NOTIF_LEVEL_COLOR[n.level]" variant="subtle" size="sm" :label="NOTIF_LEVEL_LABEL[n.level]" />
          <div class="flex-1 min-w-0">
            <div v-if="n.title" class="font-medium text-highlighted text-sm">{{ n.title }}</div>
            <div class="text-sm text-muted">{{ n.message }}</div>
            <div class="text-xs text-dimmed mt-1">{{ formatDateTime(n.createdAt) }}</div>
          </div>
          <UButton v-if="!n.read" size="xs" color="neutral" variant="ghost" icon="i-lucide-check" @click="markRead(n.id)" />
        </div>
      </div>

      <div v-else class="text-center text-muted py-12">
        Уведомлений нет
      </div>

      <UModal v-model:open="tgOpen" title="Привязать Telegram">
        <template #body>
          <div class="space-y-4">
            <UFormField label="Chat ID" required>
              <UInput v-model="tgForm.chatId" class="w-full" placeholder="123456789" />
            </UFormField>
            <UFormField label="Метка">
              <UInput v-model="tgForm.label" class="w-full" placeholder="Например, «Владелец»" />
            </UFormField>
          </div>
        </template>
        <template #footer>
          <div class="flex justify-end gap-2 w-full">
            <UButton color="neutral" variant="ghost" label="Отмена" @click="tgOpen = false" />
            <UButton label="Привязать" :loading="tgSaving" :disabled="!tgForm.chatId" @click="registerTg" />
          </div>
        </template>
      </UModal>
    </template>
  </UDashboardPanel>
</template>
