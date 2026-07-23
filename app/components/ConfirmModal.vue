<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
  confirmLabel?: string
  confirmColor?: BadgeColor
  loading?: boolean
}>(), {
  title: 'Подтверждение',
  confirmLabel: 'Удалить',
  confirmColor: 'error'
})

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <UModal v-model:open="open" :title="title">
    <template #body>
      <p class="text-sm text-muted">
        {{ description }}
      </p>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
        <UButton color="neutral" variant="ghost" label="Отмена" @click="open = false" />
        <UButton :color="confirmColor" :label="confirmLabel" :loading="loading" @click="emit('confirm')" />
      </div>
    </template>
  </UModal>
</template>
