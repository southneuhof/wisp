<script setup lang="ts">
import { FileDiff } from '@pierre/diffs'
import { onScopeDispose, ref, watch } from 'vue'
import type { ChatDraftFile } from '@southneuhof/wisp-core'

const props = defineProps<{ file: ChatDraftFile }>()
const host = ref<HTMLElement | null>(null)
const diff = new FileDiff({
  theme: 'pierre-light',
  diffStyle: 'split',
  diffIndicators: 'classic',
  lineDiffType: 'none',
  disableFileHeader: true,
  disableLineNumbers: true,
  overflow: 'wrap',
  unsafeCSS: `
    [data-disable-line-numbers] :is([data-column-number], [data-gutter-buffer]) {
      min-width: 0;
      border-right: 0;
    }

    [data-diff-type="split"][data-overflow="wrap"] [data-deletions] [data-content] {
      border-right: 0;
    }

    [data-diff-type="split"][data-overflow="wrap"] [data-additions] [data-gutter] {
      border-left: 0;
    }

    :is([data-line], [data-no-newline])[data-line-type="change-deletion"] {
      background-color: #f1c3c0;
    }

    :is([data-line], [data-no-newline])[data-line-type="change-addition"] {
      background-color: #d8edc9;
    }

    [data-indicators="classic"] :is([data-line], [data-no-newline]) {
      padding-inline-start: calc(2ch + 6px);
    }

    [data-indicators="classic"] :is([data-line], [data-no-newline])::before {
      left: 6px;
    }
  `,
})

watch(
  [host, () => props.file],
  ([containerWrapper, { path, before, after }]) => {
    if (!containerWrapper) return
    diff.render({
      containerWrapper,
      oldFile: { name: path, contents: before ?? '' },
      newFile: { name: path, contents: after ?? '' },
    })
  },
  { flush: 'post' },
)

onScopeDispose(() => diff.cleanUp())
</script>

<template>
  <div
    ref="host"
    class="wisp-file-diff"
    role="group"
    :aria-label="`Changes to ${file.path}`"
  />
</template>

<style scoped>
.wisp-file-diff {
  --diffs-font-family: var(--wisp-font-family);
  --diffs-font-size: 0.8125rem;
  --diffs-line-height: 24px;
  --diffs-gap-block: 2px;
  --diffs-deletion-color-override: var(--wisp-danger);
  --diffs-addition-color-override: #247526;
  margin-block: 2px 4px;
  overflow: hidden;
  border-radius: 6px;
}

.wisp-file-diff :deep(diffs-container) {
  --diffs-bg: color-mix(in srgb, var(--wisp-bg) 94%, var(--wisp-fg));
  background-color: var(--diffs-bg);
}
</style>
