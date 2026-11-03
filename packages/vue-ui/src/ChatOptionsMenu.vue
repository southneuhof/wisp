<script setup lang="ts">
import { useChatMessages } from './useChatMessages.js'
import type { CSSProperties } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuPortal,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from 'reka-ui'
import ChatIcon from './ChatIcon.vue'
import ChatIconButton from './ChatIconButton.vue'
import { computed, nextTick, ref } from 'vue'
import type { Account, Workspace } from '@southneuhof/wisp-core'
const props = defineProps<{
  account: Account | null
  workspaces: readonly Workspace[]
  workspaceId: string
  busy: boolean
  endpoint: string
  themeStyle: CSSProperties
  createWorkspace: (title: string) => Promise<boolean>
}>()
const emit = defineEmits<{ workspace: [id: string]; signOut: [] }>()
const selectedWorkspaceName = computed(
  () =>
    props.workspaces.find((workspace) => workspace.id === props.workspaceId)
      ?.title || t.value.workspaces,
)
const workspaceName = ref('')
const workspaceNameInput = ref<HTMLInputElement | null>(null)
const isCreatingWorkspace = ref(false)
async function openWorkspaceCreator(event: Event) {
  event.preventDefault()
  isCreatingWorkspace.value = !isCreatingWorkspace.value
  await nextTick()
  if (isCreatingWorkspace.value) workspaceNameInput.value?.focus()
}
async function createWorkspace() {
  if (await props.createWorkspace(workspaceName.value)) {
    workspaceName.value = ''
    isCreatingWorkspace.value = false
  }
}

const t = useChatMessages()
</script>
<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger as-child>
      <ChatIconButton
        class="wisp-flex wisp-items-center wisp-justify-center wisp-text-on-surface-variant wisp-transition-colors hover:wisp-text-on-surface focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary"
        label="Chat settings"
        icon="more_vert"
      />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent
        :style="themeStyle"
        class="wisp-ui wisp-menu-content wisp-z-[60] wisp-max-h-[75dvh] wisp-w-64 wisp-max-w-[calc(100vw-2rem)] wisp-overflow-y-auto wisp-rounded-2xl wisp-border wisp-border-outline-variant wisp-bg-surface-container-high wisp-p-2 wisp-text-on-surface wisp-shadow-xl"
        align="end"
        :side-offset="8"
        aria-label="Chat options"
      >
        <div
          v-if="account"
          class="wisp-menu-header wisp-flex wisp-items-center wisp-justify-between wisp-gap-2 wisp-px-1 wisp-py-1"
        >
          <DropdownMenuItem as-child @select="emit('signOut')">
            <ChatIconButton
              class="wisp-menu-signout wisp-order-last wisp-flex wisp-items-center wisp-justify-center wisp-text-error wisp-transition-colors hover:wisp-bg-error/10 focus-visible:wisp-bg-error/10"
              label="Sign out"
              icon="logout"
              danger
            />
          </DropdownMenuItem>
          <span
            class="wisp-min-w-0 wisp-flex-1 wisp-truncate wisp-px-1 wisp-text-sm wisp-font-semibold"
            >{{ account.name }}</span
          >
        </div>
        <DropdownMenuSeparator
          v-if="account"
          class="wisp-my-1 wisp-h-px wisp-bg-outline-variant"
        />
        <template v-if="account">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              class="wisp-menu-item wisp-flex wisp-min-h-10 wisp-items-center wisp-justify-between wisp-gap-3 wisp-rounded-xl wisp-px-3 wisp-py-2 wisp-text-sm wisp-outline-none"
            >
              <span
                class="wisp-flex wisp-min-w-0 wisp-flex-1 wisp-items-center wisp-gap-2"
                ><ChatIcon :size="17" name="workspaces" />{{
                  selectedWorkspaceName
                }}</span
              ><ChatIcon :size="17" name="chevron_right" />
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                :style="themeStyle"
                class="wisp-ui wisp-menu-content wisp-menu-with-footer wisp-workspace-menu wisp-z-[61] wisp-max-h-[70dvh] wisp-w-72 wisp-max-w-[calc(100vw-2rem)] wisp-overflow-hidden wisp-rounded-2xl wisp-border wisp-border-outline-variant wisp-bg-surface-container-high wisp-p-2 wisp-text-on-surface wisp-shadow-xl"
                side="right"
                :side-offset="6"
                :align-offset="-4"
              >
                <div class="wisp-menu-list">
                  <DropdownMenuItem
                    v-for="item in workspaces"
                    :key="item.id"
                    class="wisp-menu-item wisp-flex wisp-min-h-10 wisp-items-center wisp-justify-between wisp-gap-3 wisp-rounded-xl wisp-px-3 wisp-py-2 wisp-text-sm wisp-outline-none"
                    :class="
                      workspaceId === item.id
                        ? 'wisp-bg-primary/10 wisp-text-primary'
                        : 'wisp-text-on-surface'
                    "
                    :disabled="busy"
                    @select="emit('workspace', item.id)"
                  >
                    <span class="wisp-min-w-0 wisp-flex-1 wisp-truncate"
                      >{{ item.title }}{{ item.provisional ? ' · new' : ''
                      }}{{ item.role === 'use' ? ' · use' : '' }}</span
                    >
                    <ChatIcon
                      v-if="workspaceId === item.id"
                      :size="16"
                      name="check"
                    />
                  </DropdownMenuItem>
                </div>
                <div class="wisp-menu-footer">
                  <DropdownMenuSeparator
                    class="wisp-my-2 wisp-h-px wisp-bg-outline-variant"
                  />
                  <DropdownMenuItem
                    class="wisp-menu-item wisp-menu-action wisp-flex wisp-min-h-10 wisp-items-center wisp-gap-2 wisp-rounded-xl wisp-px-3 wisp-py-2 wisp-text-sm wisp-outline-none"
                    :disabled="busy"
                    @select="openWorkspaceCreator"
                  >
                    <ChatIcon :size="17" name="add" /><span>{{
                      t.newWorkspace
                    }}</span>
                  </DropdownMenuItem>
                  <form
                    v-if="isCreatingWorkspace"
                    class="wisp-grid wisp-gap-2 wisp-border-t wisp-border-outline-variant wisp-px-2 wisp-py-3"
                    @submit.prevent="createWorkspace"
                  >
                    <input
                      ref="workspaceNameInput"
                      v-model="workspaceName"
                      class="wisp-min-w-0 wisp-rounded-xl wisp-border wisp-border-outline-variant wisp-bg-surface wisp-px-3 wisp-py-2 wisp-text-sm"
                      :placeholder="t.workspaceName"
                      :aria-label="t.workspaceName"
                      required
                    />
                    <button
                      type="submit"
                      class="wisp-justify-self-end wisp-rounded-xl wisp-bg-primary wisp-px-3 wisp-py-2 wisp-text-sm wisp-text-on-primary wisp-transition hover:wisp-brightness-110 disabled:wisp-opacity-50"
                      :disabled="busy"
                    >
                      {{ t.create }}
                    </button>
                  </form>
                </div>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
          <DropdownMenuItem
            as-child
            class="wisp-menu-item wisp-flex wisp-min-h-10 wisp-items-center wisp-rounded-xl wisp-px-3 wisp-py-2 wisp-text-sm wisp-outline-none"
          >
            <a
              class="wisp-flex wisp-items-center wisp-gap-2"
              :href="endpoint"
              target="_blank"
              rel="noopener noreferrer"
              ><ChatIcon :size="17" name="cloud" />{{ t.openCloudflare }}</a
            >
          </DropdownMenuItem>
        </template>
        <DropdownMenuItem
          v-else
          as-child
          class="wisp-menu-item wisp-flex wisp-min-h-10 wisp-items-center wisp-rounded-xl wisp-px-3 wisp-py-2 wisp-text-sm wisp-outline-none"
        >
          <a
            class="wisp-flex wisp-items-center wisp-gap-2"
            :href="endpoint"
            target="_blank"
            rel="noopener noreferrer"
            ><ChatIcon :size="17" name="cloud" />{{ t.openCloudflare }}</a
          >
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
