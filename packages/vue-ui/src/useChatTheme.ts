import { computed } from 'vue'
import type { CSSProperties } from 'vue'
import type { WispChatTheme } from './theme.js'
export function useChatTheme(theme: () => Partial<WispChatTheme> | undefined) {
  return computed(() => {
    const colors = theme()
    return {
      '--wisp-font-family': colors?.fontFamily ?? 'system-ui, sans-serif',
      '--wisp-danger': colors?.danger ?? '#b42318',
      '--wisp-accent': colors?.accent ?? '#000000',
      '--wisp-bg': colors?.background ?? '#ffffff',
      '--wisp-fg': colors?.foreground ?? '#000000',
      '--wisp-muted': colors?.muted ?? '#666666',
      '--wisp-border': colors?.border ?? '#dedede',
      '--wisp-user': colors?.userMessage ?? colors?.accent ?? '#000000',
      '--wisp-user-fg':
        colors?.userMessageForeground ?? colors?.primaryForeground ?? '#ffffff',
      '--wisp-primary-fg': colors?.primaryForeground ?? '#ffffff',
      '--wisp-menu-bg':
        colors?.menuBackground ?? colors?.background ?? '#ffffff',
      '--wisp-menu-hover': colors?.menuHover ?? 'rgb(0 0 0 / 6%)',
    } satisfies CSSProperties
  })
}
