<script setup lang="ts">
import { onScopeDispose, watch } from 'vue'
import { useAui } from '@assistant-ui/vue'

const props = defineProps<{ modelId: string }>()
const aui = useAui()
const unregister = aui.modelContext.register({
  getModelContext: () => ({
    config: { modelName: props.modelId || undefined },
  }),
  subscribe: (notify: () => void) =>
    watch(() => props.modelId, notify, { flush: 'sync' }),
})

onScopeDispose(unregister)
</script>

<template>
  <slot />
</template>
