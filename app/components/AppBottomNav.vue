<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

// Мобильная нижняя таб-навигация (как в мобильном приложении). Показывается только на телефоне/планшете.
defineProps<{ items: NavigationMenuItem[] }>()

const route = useRoute()

function isActive(to: NavigationMenuItem['to']): boolean {
  if (typeof to !== 'string') return false
  return route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 border-t border-default bg-default/90 backdrop-blur lg:hidden"
    style="padding-bottom: env(safe-area-inset-bottom)"
    aria-label="Основная навигация"
  >
    <ul class="mx-auto flex max-w-lg items-stretch">
      <li v-for="item in items" :key="String(item.to)" class="min-w-0 flex-1">
        <NuxtLink
          :to="item.to"
          class="flex h-full flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2 transition-colors"
          :class="isActive(item.to) ? 'text-primary' : 'text-muted active:text-highlighted'"
        >
          <span
            class="flex size-8 items-center justify-center rounded-full transition-colors"
            :class="isActive(item.to) ? 'bg-primary/10' : ''"
          >
            <UIcon v-if="item.icon" :name="item.icon" class="size-5 shrink-0" />
          </span>
          <span class="w-full truncate text-center text-[10px] font-medium leading-none">{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
