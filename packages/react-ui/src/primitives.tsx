import {
  cloneElement,
  forwardRef,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ButtonHTMLAttributes, ReactElement, SVGProps } from 'react'
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
export function Transition({
  show,
  name = 'wisp-foreground',
  children,
}: {
  show: boolean
  name?: string
  children: ReactElement<{ className?: string }>
}) {
  const [phase, setPhase] = useState(show ? 'enter-from' : 'hidden')
  const current = useRef(show)
  current.current = show
  useEffect(() => {
    let frame = 0,
      next = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    if (show) {
      setPhase('enter-from')
      frame = requestAnimationFrame(() => {
        next = requestAnimationFrame(() => {
          setPhase('enter-to')
          timer = setTimeout(() => {
            if (current.current) setPhase('shown')
          }, 280)
        })
      })
    } else {
      setPhase((previous) => (previous === 'hidden' ? 'hidden' : 'leave-to'))
      timer = setTimeout(() => {
        if (!current.current) setPhase('hidden')
      }, 280)
    }
    return () => {
      cancelAnimationFrame(frame)
      cancelAnimationFrame(next)
      clearTimeout(timer)
    }
  }, [show])
  if (phase === 'hidden') return null
  if (phase === 'shown') return children
  return cloneElement(children, {
    className: `${children.props.className ?? ''} ${name}-${phase} ${name}-${phase.startsWith('enter') ? 'enter' : 'leave'}-active`,
  })
}
