<script setup lang="ts">
// Minimal centered layout for the login screen.
</script>

<template>
  <div class="relative min-h-screen flex items-center justify-center overflow-hidden bg-muted px-4">
    <!-- atmospheric brand glow -->
    <div
      class="pointer-events-none absolute -top-40 -right-32 size-[32rem] rounded-full blur-3xl opacity-30 bg-primary"
      aria-hidden="true"
    />
    <div
      class="pointer-events-none absolute -bottom-48 -left-32 size-[36rem] rounded-full blur-3xl opacity-20 bg-primary"
      aria-hidden="true"
    />

    <div class="relative w-full max-w-sm">
      <slot />
    </div>
  </div>
</template>
