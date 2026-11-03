<script setup lang="ts">
import { useChatMessages } from './useChatMessages.js'
defineProps<{ busy: boolean; error: string }>()
const username = defineModel<string>('username', { default: '' })
const password = defineModel<string>('password', { default: '' })
const emit = defineEmits<{ submit: [] }>()
const t = useChatMessages()
</script>
<template>
  <form
    class="wisp-pointer-events-auto wisp-relative wisp-z-10 wisp-mx-auto wisp-flex wisp-min-h-[320px] wisp-w-full wisp-max-w-[680px] wisp-items-center wisp-justify-center wisp-px-4 wisp-py-6"
    @submit.prevent="emit('submit')"
  >
    <div class="wisp-grid wisp-w-full wisp-max-w-sm wisp-gap-4 wisp-p-6">
      <div class="wisp-grid wisp-gap-1">
        <h2 class="wisp-text-lg wisp-font-semibold wisp-text-on-surface">
          {{ t.signIn }}
        </h2>
        <p class="wisp-text-sm wisp-text-on-surface-variant">
          {{ t.signInDescription }}
        </p>
      </div>
      <label
        class="wisp-grid wisp-gap-1.5 wisp-text-sm wisp-text-on-surface-variant"
      >
        {{ t.username }}
        <input
          name="username"
          v-model="username"
          autocomplete="username"
          required
          class="wisp-min-h-11 wisp-rounded-xl wisp-border wisp-border-outline-variant wisp-bg-transparent wisp-px-3 wisp-text-sm wisp-text-on-surface"
          :disabled="busy"
        />
      </label>
      <label
        class="wisp-grid wisp-gap-1.5 wisp-text-sm wisp-text-on-surface-variant"
      >
        {{ t.password }}
        <input
          name="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          required
          class="wisp-min-h-11 wisp-rounded-xl wisp-border wisp-border-outline-variant wisp-bg-transparent wisp-px-3 wisp-text-sm wisp-text-on-surface"
          :disabled="busy"
        />
      </label>
      <p v-if="error" class="wisp-text-sm wisp-text-error" role="alert">
        {{ error }}
      </p>
      <button
        type="submit"
        class="wisp-min-h-11 wisp-rounded-xl wisp-bg-primary wisp-px-4 wisp-text-sm wisp-font-semibold wisp-text-on-primary wisp-transition hover:wisp-brightness-110 disabled:wisp-opacity-50"
        :disabled="busy"
      >
        {{ busy ? t.signingIn : t.signIn }}
      </button>
    </div>
  </form>
</template>
