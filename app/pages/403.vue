<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'Доступ запрещён — Spectre' })

const auth = useAuthStore()
const roleLabel = computed(() => (auth.role ? ROLE_LABEL[auth.role] : ''))
</script>

<template>
  <div class="relative flex min-h-screen items-center justify-center overflow-hidden bg-elevated/30 px-4">
    <div class="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-primary/10 blur-3xl" />
    <div class="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-primary/5 blur-3xl" />

    <div class="relative w-full max-w-md text-center">
      <div class="mx-auto mb-6 flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
        <UIcon name="i-lucide-shield-x" class="size-10" />
      </div>
      <p class="text-7xl font-black tracking-tight text-highlighted">403</p>
      <h1 class="mt-2 text-xl font-semibold text-highlighted">Доступ запрещён</h1>
      <p class="mt-2 text-sm text-muted">
        У вашей роли<template v-if="roleLabel"> «{{ roleLabel }}»</template> нет доступа к этой странице.
      </p>

      <div class="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <UButton to="/" icon="i-lucide-layout-dashboard" label="На главную" size="lg" class="w-full justify-center sm:w-auto" />
        <UButton to="/queue" color="neutral" variant="outline" icon="i-lucide-list-ordered" label="Живая очередь" size="lg" class="w-full justify-center sm:w-auto" />
      </div>
    </div>
  </div>
</template>
