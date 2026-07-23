<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import type { AuthUser, Role } from '~/types/spectre'
import type { PinUser } from '~/stores/auth'

definePageMeta({
  layout: 'auth'
})

useHead({ title: 'Вход — Spectre' })

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const toast = useToast()

// Where each role lands after login (unless a ?redirect target is present).
function roleHome(role?: Role | null): string {
  switch (role) {
    case 'CASHIER': return '/cash'
    case 'WASHER': return '/queue'
    case 'VALET': return '/queue'
    case 'ACCOUNTANT': return '/reports'
    case 'FINANCIER': return '/salary'
    default: return '/'
  }
}

async function redirectAfterLogin(u: AuthUser): Promise<void> {
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : roleHome(u.role)
  await router.replace(redirect)
}

const mode = ref<'password' | 'pin'>('password')

/* ---------- password mode ---------- */
const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(1, 'Введите пароль')
})
type Schema = z.output<typeof schema>

const state = reactive<Partial<Schema>>({ email: '', password: '' })
const loading = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    const u = await auth.login(event.data.email, event.data.password)
    await redirectAfterLogin(u)
  } catch (err) {
    toast.add({
      title: 'Не удалось войти',
      description: apiErrorMessage(err, 'Проверьте email и пароль'),
      color: 'error',
      icon: 'i-lucide-triangle-alert'
    })
  } finally {
    loading.value = false
  }
}

/* ---------- PIN mode ---------- */
const pinUsersList = ref<PinUser[]>([])
const pinUserItems = computed(() =>
  pinUsersList.value.map(u => ({ label: `${u.name || u.email} · ${ROLE_LABEL[u.role]}`, value: u.id })))
const pinState = reactive<{ userId: number | undefined, pin: string }>({ userId: undefined, pin: '' })
const pinLoading = ref(false)
const pinUsersLoading = ref(false)

async function loadPinUsers() {
  pinUsersLoading.value = true
  try {
    pinUsersList.value = await auth.pinUsers()
  } catch (err) {
    toast.add({ title: 'Не удалось загрузить сотрудников', description: apiErrorMessage(err), color: 'error' })
  } finally {
    pinUsersLoading.value = false
  }
}

watch(mode, (m) => {
  if (m === 'pin' && !pinUsersList.value.length) loadPinUsers()
})

async function onPinSubmit() {
  if (!pinState.userId || !pinState.pin) return
  pinLoading.value = true
  try {
    const u = await auth.loginPin(pinState.userId, pinState.pin)
    await redirectAfterLogin(u)
  } catch (err) {
    toast.add({
      title: 'Не удалось войти',
      description: apiErrorMessage(err, 'Неверный PIN'),
      color: 'error',
      icon: 'i-lucide-triangle-alert'
    })
  } finally {
    pinLoading.value = false
  }
}
</script>

<template>
  <div class="rounded-2xl border border-default bg-default/80 backdrop-blur shadow-xl p-6 sm:p-8">
    <div class="flex flex-col items-center text-center mb-8">
      <div class="flex items-center justify-center size-12 rounded-xl bg-primary text-inverted mb-4">
        <UIcon name="i-lucide-droplets" class="size-7" />
      </div>
      <h1 class="text-2xl font-bold tracking-tight text-highlighted">
        Spectre
      </h1>
      <p class="text-sm text-muted mt-1">
        Панель управления автомойкой и баром
      </p>
    </div>

    <!-- mode switch -->
    <div class="flex gap-1 p-1 mb-6 rounded-lg bg-elevated/50 border border-default">
      <UButton
        :variant="mode === 'password' ? 'solid' : 'ghost'"
        :color="mode === 'password' ? 'primary' : 'neutral'"
        block
        size="sm"
        label="Пароль"
        icon="i-lucide-lock"
        @click="mode = 'password'"
      />
      <UButton
        :variant="mode === 'pin' ? 'solid' : 'ghost'"
        :color="mode === 'pin' ? 'primary' : 'neutral'"
        block
        size="sm"
        label="PIN-код"
        icon="i-lucide-grid-2x2"
        @click="mode = 'pin'"
      />
    </div>

    <!-- password mode -->
    <UForm
      v-if="mode === 'password'"
      :schema="schema"
      :state="state"
      class="space-y-4"
      autocomplete="off"
      @submit="onSubmit"
    >
      <UFormField label="Email" name="email">
        <UInput
          v-model="state.email"
          type="email"
          autocomplete="off"
          placeholder="Email"
          icon="i-lucide-mail"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Пароль" name="password">
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="off"
          placeholder="••••••••"
          icon="i-lucide-lock"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UButton
        type="submit"
        block
        size="lg"
        :loading="loading"
        label="Войти"
        class="mt-2"
      />
    </UForm>

    <!-- PIN mode -->
    <form v-else class="space-y-4" @submit.prevent="onPinSubmit">
      <UFormField label="Сотрудник" name="user">
        <USelectMenu
          v-model="pinState.userId"
          :items="pinUserItems"
          value-key="value"
          :loading="pinUsersLoading"
          placeholder="Выберите сотрудника"
          icon="i-lucide-user"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="PIN-код" name="pin">
        <UInput
          v-model="pinState.pin"
          type="password"
          inputmode="numeric"
          autocomplete="off"
          placeholder="••••"
          icon="i-lucide-key-round"
          size="lg"
          class="w-full"
          maxlength="6"
        />
      </UFormField>

      <UButton
        type="submit"
        block
        size="lg"
        :loading="pinLoading"
        :disabled="!pinState.userId || !pinState.pin"
        label="Войти"
        class="mt-2"
      />
    </form>
  </div>
</template>
