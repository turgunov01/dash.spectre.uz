<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { ROLES } from '~/types/spectre'
import type { Role } from '~/types/spectre'
import type { Employee } from '~/composables/useFilesApi'

definePageMeta({ roles: ['OWNER', 'ACCOUNTANT'] })
useHead({ title: 'Сотрудники — Spectre' })

const employeesApi = useEmployeesApi()
const toast = useToast()

// Washers don't log in (managed on the salary page), so they're not platform employees.
const roleItems = ROLES.filter(r => r !== 'WASHER').map(r => ({ label: ROLE_LABEL[r], value: r }))

const schema = z.object({
  email: z.string().email('Введите корректный email'),
  password: z.string().min(8, 'Минимум 8 символов'),
  name: z.string().optional(),
  role: z.string()
})
type Schema = z.output<typeof schema>

const state = reactive<{ email: string, password: string, name: string, role: Role }>({
  email: '',
  password: '',
  name: '',
  role: 'CASHIER'
})
const saving = ref(false)

const employees = ref<Employee[]>([])
const loadingList = ref(false)

async function loadEmployees() {
  loadingList.value = true
  try {
    employees.value = (await employeesApi.list()).filter(u => u.role !== 'WASHER')
  } catch (e) {
    toast.add({ title: 'Не удалось загрузить список', description: apiErrorMessage(e), color: 'error' })
  } finally {
    loadingList.value = false
  }
}
onMounted(loadEmployees)

async function onSubmit(_event: FormSubmitEvent<Schema>) {
  saving.value = true
  try {
    await employeesApi.register({
      email: state.email,
      password: state.password,
      name: state.name || undefined,
      role: state.role
    })
    toast.add({ title: 'Сотрудник создан', color: 'success', icon: 'i-lucide-check' })
    state.email = ''
    state.password = ''
    state.name = ''
    await loadEmployees()
  } catch (e) {
    toast.add({ title: 'Ошибка', description: apiErrorMessage(e), color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="employees">
    <template #header>
      <UDashboardNavbar title="Сотрудники">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="loadingList"
            aria-label="Обновить список"
            @click="loadEmployees"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="max-w-xl space-y-6">
        <div class="rounded-xl border border-default bg-default p-5">
          <h3 class="text-sm font-semibold text-highlighted mb-4">Новый сотрудник</h3>
          <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
            <UFormField label="Email" name="email" required>
              <UInput v-model="state.email" type="email" class="w-full" placeholder="employee@spectre.uz" />
            </UFormField>
            <UFormField label="Пароль" name="password" required>
              <UInput v-model="state.password" type="password" class="w-full" placeholder="минимум 8 символов" />
            </UFormField>
            <UFormField label="Имя" name="name">
              <UInput v-model="state.name" class="w-full" />
            </UFormField>
            <UFormField label="Роль" name="role" required>
              <USelect v-model="state.role" :items="roleItems" value-key="value" class="w-full" />
            </UFormField>
            <UButton type="submit" label="Создать сотрудника" icon="i-lucide-user-plus" :loading="saving" />
          </UForm>
        </div>

        <div>
          <div class="flex items-center justify-between mb-2">
            <h3 class="text-sm font-semibold text-highlighted">Все сотрудники</h3>
            <span class="text-xs text-muted">{{ employees.length }}</span>
          </div>

          <div v-if="loadingList && !employees.length" class="text-sm text-muted py-6 text-center">
            Загрузка…
          </div>
          <div v-else-if="!employees.length" class="text-sm text-muted py-6 text-center">
            Список пуст
          </div>
          <div v-else class="flex flex-col gap-2">
            <div
              v-for="u in employees"
              :key="u.id"
              class="flex items-center gap-3 rounded-lg border border-default bg-default p-3"
            >
              <UIcon
                :name="u.isActive ? 'i-lucide-user-check' : 'i-lucide-user-x'"
                class="size-5 shrink-0"
                :class="u.isActive ? 'text-primary' : 'text-muted'"
              />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-highlighted truncate">{{ u.name || u.email }}</div>
                <div class="text-xs text-muted truncate">{{ u.email }}</div>
              </div>
              <UBadge v-if="!u.isActive" color="neutral" variant="subtle" label="Отключён" />
              <UBadge color="neutral" variant="subtle" :label="ROLE_LABEL[u.role]" />
            </div>
          </div>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
