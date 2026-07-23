<script setup lang="ts">
import { QUEUE_STATUSES } from '~/types/spectre'

definePageMeta({ layout: false })
useHead({ title: 'Табло очереди — Spectre', htmlAttrs: { lang: 'ru' } })

const { rows, connected } = usePublicQueue()

const active = computed(() => rows.value
  .filter(r => QUEUE_STATUSES.includes(r.status))
  .sort((a, b) => a.position - b.position))
</script>

<template>
  <div class="min-h-screen bg-neutral-950 text-white p-6 sm:p-10">
    <header class="flex items-center justify-between mb-10">
      <div class="flex items-center gap-3">
        <span class="flex items-center justify-center size-10 rounded-xl bg-primary text-white">
          <UIcon name="i-lucide-droplets" class="size-6" />
        </span>
        <div>
          <h1 class="text-2xl font-bold tracking-tight">Spectre</h1>
          <p class="text-sm text-neutral-400">Очередь автомойки</p>
        </div>
      </div>
      <span
        class="inline-flex items-center gap-2 text-sm"
        :class="connected ? 'text-emerald-400' : 'text-neutral-500'"
      >
        <span class="size-2 rounded-full" :class="connected ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-600'" />
        {{ connected ? 'в эфире' : 'подключение…' }}
      </span>
    </header>

    <div v-if="active.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="row in active"
        :key="row.orderId"
        class="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 flex items-center gap-5"
      >
        <div class="flex items-center justify-center size-16 rounded-xl bg-neutral-800 text-3xl font-black text-primary shrink-0">
          {{ row.position }}
        </div>
        <div class="min-w-0">
          <div class="text-3xl font-bold font-mono tracking-wider truncate">{{ row.plate }}</div>
          <div class="mt-1 text-lg" :class="row.status === 'READY' ? 'text-emerald-400' : 'text-neutral-400'">
            {{ ORDER_STATUS_LABEL[row.status] }}
          </div>
        </div>
      </div>
    </div>

    <div v-else class="flex flex-col items-center justify-center py-40 text-neutral-500">
      <UIcon name="i-lucide-car-front" class="size-16 mb-4" />
      <p class="text-xl">Очередь пуста</p>
    </div>
  </div>
</template>
