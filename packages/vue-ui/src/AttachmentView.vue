<script setup lang="ts">
import { onScopeDispose, ref, watch } from 'vue'
import type { Attachment } from '@southneuhof/wisp-core'
import type { WispChatBinding } from '@southneuhof/wisp-vue'
const props = defineProps<{
  attachment: Attachment
  chat: WispChatBinding
  downloadLabel: string
  failedLabel?: string
}>()
const image = ref('')
const failed = ref(false)
let epoch = 0
const downloads = new Map<string, ReturnType<typeof setTimeout>>()
function releaseDownload(url: string) {
  const timer = downloads.get(url)
  if (timer !== undefined) clearTimeout(timer)
  downloads.delete(url)
  URL.revokeObjectURL(url)
}
function release() {
  if (image.value) URL.revokeObjectURL(image.value)
  image.value = ''
  for (const url of downloads.keys()) releaseDownload(url)
}
watch(
  () => props.attachment,
  async (attachment) => {
    const current = ++epoch
    release()
    failed.value = false
    if (!attachment.mimeType.startsWith('image/')) return
    try {
      const blob = await props.chat.client.attachments.download(attachment)
      if (epoch !== current) return
      image.value = URL.createObjectURL(blob)
    } catch {
      if (epoch === current) failed.value = true
    }
  },
  { immediate: true },
)
onScopeDispose(() => {
  epoch++
  release()
})
async function download() {
  const current = epoch
  const attachment = props.attachment
  try {
    const blob = await props.chat.client.attachments.download(attachment)
    if (current !== epoch) return
    const url = URL.createObjectURL(blob)
    downloads.set(
      url,
      setTimeout(() => releaseDownload(url), 1000),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = attachment.name
    a.click()
  } catch {
    if (current === epoch) failed.value = true
  }
}
</script>
<template>
  <div class="wisp-attachment">
    <img v-if="image" :src="image" :alt="attachment.name" /><button
      type="button"
      @click="download"
    >
      {{ downloadLabel }} {{ attachment.name }}</button
    ><span v-if="failed" role="status"
      >{{ failedLabel ?? 'Failed' }}: {{ attachment.name }}</span
    >
  </div>
</template>

<style scoped>
.wisp-attachment {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.wisp-attachment img {
  max-width: 100%;
  max-height: 240px;
  border-radius: 8px;
}
.wisp-attachment button {
  border: 1px solid var(--wisp-border, #dbe1eb);
  border-radius: 8px;
  padding: 6px 10px;
  background: var(--wisp-menu-bg, #f1f4f6);
  color: var(--wisp-fg, #172033);
  font: inherit;
}
</style>
