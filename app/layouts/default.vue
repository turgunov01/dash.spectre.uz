<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'
import type { Role } from '~/types/spectre'

// show:false скрывает пункт навигации, show:true (или без флага) — показывает.
// roles — если задан, пункт виден только этим ролям (OWNER проходит всегда).
type NavItem = NavigationMenuItem & { show?: boolean, roles?: Role[] }

const auth = useAuthStore()
// Перегонщик видит только «Живую очередь» — остальные пункты скрыты.
const valetOnly = computed(() => auth.role === 'VALET')

const open = ref(false)

const close = () => {
  open.value = false
}

// Пока показываем только этот набор. Чтобы вернуть пункт — поставь show:true.
const primarySource: NavItem[] = [
  { label: 'Дашборд', icon: 'i-lucide-layout-dashboard', to: '/', onSelect: close, show: false },
  { label: 'Живая очередь', icon: 'i-lucide-list-ordered', to: '/queue', onSelect: close, show: true },
  { label: 'Заказы', icon: 'i-lucide-clipboard-list', to: '/orders', onSelect: close, show: true },
  { label: 'Клиенты', icon: 'i-lucide-users', to: '/clients', onSelect: close, show: true },
  { label: 'Автомобили', icon: 'i-lucide-car', to: '/cars', onSelect: close, show: true },
  { label: 'Касса', icon: 'i-lucide-wallet', to: '/cash', onSelect: close, show: true, roles: ['CASHIER', 'ACCOUNTANT'] },
  { label: 'Склад', icon: 'i-lucide-package', to: '/stock', onSelect: close, show: true, roles: ['ACCOUNTANT'] },
  { label: 'Закупки', icon: 'i-lucide-shopping-cart', to: '/purchases', onSelect: close, show: false },
  { label: 'Скидки', icon: 'i-lucide-badge-percent', to: '/discounts', onSelect: close, show: true }
]

const referenceChildren: NavItem[] = [
  { label: 'Типы кузова', to: '/references/body-types', onSelect: close, show: false },
  { label: 'Услуги и цены', to: '/references/services', onSelect: close, show: true },
  { label: 'Пакеты', to: '/references/packages', onSelect: close, show: true },
  { label: 'Поставщики', to: '/suppliers', onSelect: close, show: false }
]

const manageSource: NavItem[] = [
  { label: 'Отчёты', icon: 'i-lucide-chart-column', to: '/reports', onSelect: close, show: true, roles: ['ACCOUNTANT', 'FINANCIER'] },
  { label: 'Зарплата', icon: 'i-lucide-banknote', to: '/salary', onSelect: close, show: true, roles: ['ACCOUNTANT', 'FINANCIER'] },
  { label: 'Сотрудники', icon: 'i-lucide-user-cog', to: '/employees', onSelect: close, show: true, roles: ['ACCOUNTANT'] },
  { label: 'Уведомления', icon: 'i-lucide-bell', to: '/notifications', onSelect: close, show: true },
  { label: 'Журнал действий', icon: 'i-lucide-scroll-text', to: '/logs', onSelect: close, show: true, roles: ['ACCOUNTANT'] }
]

const visible = (items: NavItem[]): NavigationMenuItem[] =>
  items.filter(i => i.show !== false && (!i.roles || auth.hasAnyRole(i.roles)))

const primaryLinks = computed<NavigationMenuItem[]>(() => {
  const items = visible(primarySource)
  return valetOnly.value ? items.filter(i => i.to === '/queue') : items
})

const manageLinks = computed<NavigationMenuItem[]>(() => {
  if (valetOnly.value) return []
  const items: NavigationMenuItem[] = []
  const refs = visible(referenceChildren)
  if (refs.length) {
    items.push({ label: 'Справочники', icon: 'i-lucide-book-open', type: 'trigger', children: refs })
  }
  items.push(...visible(manageSource))
  return items
})

const externalSource: NavItem[] = [
  { label: 'Публичное табло', icon: 'i-lucide-monitor', to: '/board', target: '_blank', show: false }
]
const externalLinks = computed<NavigationMenuItem[]>(() => valetOnly.value ? [] : visible(externalSource))

const groups = computed(() => [{
  id: 'links',
  label: 'Навигация',
  items: [...primaryLinks.value, ...manageLinks.value]
    .flatMap(item => item.children ?? [item])
    .map(item => ({ label: item.label, to: item.to, icon: item.icon }))
}])
</script>

<template>
  <UDashboardGroup unit="rem">
    <UDashboardSidebar
      id="default"
      v-model:open="open"
      collapsible
      resizable
      class="bg-elevated/25"
      :ui="{ footer: 'lg:border-t lg:border-default' }"
    >
      <template #header="{ collapsed }">
        <NuxtLink to="/" class="flex items-center gap-2.5 px-1 py-1 overflow-hidden">
          <span class="flex items-center justify-center size-8 shrink-0 rounded-lg bg-primary text-inverted">
            <UIcon name="i-lucide-droplets" class="size-5" />
          </span>
          <span v-if="!collapsed" class="font-bold text-highlighted tracking-tight truncate">Spectre</span>
        </NuxtLink>
      </template>

      <template #default="{ collapsed }">
        <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="primaryLinks"
          orientation="vertical"
          tooltip
          popover
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="manageLinks"
          orientation="vertical"
          tooltip
          popover
          class="mt-4"
        />

        <UNavigationMenu
          :collapsed="collapsed"
          :items="externalLinks"
          orientation="vertical"
          tooltip
          class="mt-auto"
        />
      </template>

      <template #footer="{ collapsed }">
        <UserMenu :collapsed="collapsed" />
      </template>
    </UDashboardSidebar>

    <UDashboardSearch :groups="groups" />

    <slot />

    <AppBottomNav :items="primaryLinks" />
  </UDashboardGroup>
</template>
