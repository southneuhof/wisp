<script setup lang="ts">
import type { CSSProperties } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
} from 'reka-ui'
import ChatIcon from './ChatIcon.vue'
import type { Model } from '@southneuhof/wisp-core'
defineProps<{
  models: readonly Model[]
  selectedId: string
  name: string
  busy: boolean
  themeStyle: CSSProperties
}>()
const emit = defineEmits<{ select: [id: string] }>()
</script>
<template>
  <DropdownMenuRoot v-if="models.length">
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        aria-label="Model"
        class="wisp-model-trigger wisp-flex wisp-max-w-48 wisp-items-center wisp-gap-1 wisp-rounded-full wisp-px-2 wisp-py-2 wisp-text-xs wisp-text-on-surface-variant wisp-transition-colors hover:wisp-text-on-surface focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary disabled:wisp-opacity-50"
        :disabled="busy"
      >
        <span class="wisp-truncate">{{ name }}</span>
        <ChatIcon :size="16" name="expand_more" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :style="themeStyle"
        class="wisp-ui wisp-menu-content wisp-z-[60] wisp-min-w-48 wisp-max-w-[calc(100vw-2rem)] wisp-rounded-2xl wisp-border wisp-border-outline-variant wisp-bg-surface-container-high wisp-p-2 wisp-text-on-surface wisp-shadow-xl"
        align="start"
        :side-offset="8"
        aria-label="Select model"
      >
        <DropdownMenuItem
          v-for="model in models"
          :key="model.id"
          class="wisp-menu-item wisp-flex wisp-min-h-10 wisp-items-center wisp-justify-between wisp-gap-3 wisp-rounded-xl wisp-px-3 wisp-py-2 wisp-text-sm wisp-outline-none"
          :class="
            selectedId === model.id
              ? 'wisp-bg-primary/10 wisp-text-primary'
              : 'wisp-text-on-surface'
          "
          @select="emit('select', model.id)"
        >
          <span class="wisp-min-w-0 wisp-flex-1 wisp-truncate">{{
            model.name
          }}</span>
          <ChatIcon v-if="selectedId === model.id" :size="16" name="check" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
