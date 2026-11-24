import {
  forwardRef,
  createContext,
  useContext,
  useLayoutEffect,
  useState,
} from 'react'
import type { ButtonHTMLAttributes, ReactNode, SVGProps } from 'react'
import { defaultMessages } from './messages.js'
import { ChatIcon } from './ChatIcon.js'
export const MessagesContext = createContext(defaultMessages)
export const useChatMessages = () => useContext(MessagesContext)
export const ChatIconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: string
    label: string
    size?: number
    danger?: boolean
  }
>(function ChatIconButton(
  { icon, label, size = 18, danger = false, className = '', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      aria-label={label}
      title={label}
      className={`wisp-icon-button ${danger ? 'wisp-icon-button-danger' : ''} ${className}`}
    >
      <ChatIcon name={icon} size={size} />
    </button>
  )
})
export function ChatSpinner(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      className={`wisp-spinner ${props.className ?? ''}`}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="2"
        opacity=".2"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
export function ChatPresence({
  show,
  children,
}: {
  show: boolean
  children: ReactNode
}) {
  const [retained, setRetained] = useState(show)
  useLayoutEffect(() => {
    if (show || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRetained(show)
      return
    }
    const timer = window.setTimeout(() => setRetained(false), 280)
    return () => window.clearTimeout(timer)
  }, [show])
  return show || retained ? children : null
}
