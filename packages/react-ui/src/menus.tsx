import { Menu } from '@base-ui/react/menu'
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import type {
  Account,
  Conversation,
  Model,
  Workspace,
} from '@southneuhof/wisp-core'
import { ChatIcon } from './ChatIcon.js'
import { ChatIconButton, ChatSpinner, useChatMessages } from './primitives.js'
const itemClass =
  'wisp-menu-item wisp-flex wisp-min-h-10 wisp-items-center wisp-justify-between wisp-gap-3 wisp-rounded-xl wisp-px-3 wisp-py-2 wisp-text-sm wisp-outline-none'
const popupClass =
  'wisp-ui wisp-menu-content wisp-rounded-2xl wisp-border wisp-border-outline-variant wisp-bg-surface-container-high wisp-p-2 wisp-text-on-surface wisp-shadow-xl wisp-max-w-[calc(100vw-2rem)]'
function Popup({
  children,
  themeStyle,
  className = '',
  align = 'start',
  submenu = false,
  label,
}: {
  children: ReactNode
  themeStyle: CSSProperties
  className?: string
  align?: 'start' | 'end'
  submenu?: boolean
  label?: string
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        style={{ zIndex: submenu ? 61 : 60 }}
        align={align}
        side={submenu ? 'right' : 'bottom'}
        sideOffset={submenu ? 6 : 8}
        alignOffset={submenu ? -4 : 0}
      >
        <Menu.Popup
          aria-label={label}
          style={themeStyle}
          className={`${popupClass} ${className}`}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}
export function ChatConversationPicker(p: {
  title: string
  conversations: readonly Conversation[]
  selectedId: number | null
  loading: boolean
  busy: boolean
  error: string
  loadingList: boolean
  themeStyle: CSSProperties
  onOpen?: (open: boolean) => void
  onSelect: (conversation: Conversation) => void
  onNew: () => void
  onRetry: () => void
}) {
  const t = useChatMessages()
  return (
    <Menu.Root modal={false} onOpenChange={p.onOpen}>
      <Menu.Trigger
        className="wisp-conversation-trigger wisp-flex wisp-h-9 wisp-min-w-0 wisp-max-w-72 wisp-items-center wisp-gap-2 wisp-rounded-full wisp-px-3 wisp-text-left wisp-text-sm wisp-text-on-surface focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary"
        aria-label="Select conversation"
        disabled={p.loading}
      >
        <ChatIcon name="chat_bubble_outline" size={18} />
        {p.loading && <ChatSpinner />}
        <span className="wisp-conversation-title wisp-truncate">{p.title}</span>
        {!p.loading && (
          <ChatIcon
            className="wisp-conversation-chevron"
            name="expand_more"
            size={17}
          />
        )}
      </Menu.Trigger>
      <Popup
        themeStyle={p.themeStyle}
        label="Conversations"
        className="wisp-menu-with-footer wisp-max-h-[60dvh] wisp-w-80 wisp-overflow-hidden"
      >
        <div className="wisp-menu-list">
          {p.conversations.length === 0 ? (
            p.loadingList ? (
              <div
                role="status"
                className="wisp-px-3 wisp-py-4 wisp-text-sm wisp-text-on-surface-variant"
              >
                <ChatSpinner /> Loading conversations...
              </div>
            ) : p.error ? (
              <div
                role="alert"
                className="wisp-px-3 wisp-py-3 wisp-text-sm wisp-text-error"
              >
                <p>{p.error}</p>
                <button
                  type="button"
                  onClick={p.onRetry}
                  className="wisp-mt-2 wisp-font-semibold wisp-underline"
                >
                  Try again
                </button>
              </div>
            ) : (
              <p className="wisp-px-3 wisp-py-4 wisp-text-sm wisp-text-on-surface-variant">
                No previous conversations.
              </p>
            )
          ) : (
            <>
              {p.error && (
                <p
                  role="status"
                  className="wisp-px-3 wisp-py-2 wisp-text-xs wisp-text-error"
                >
                  {p.error}
                </p>
              )}
              {p.conversations.map((c) => (
                <Menu.Item
                  key={c.id}
                  className={`${itemClass} ${p.selectedId === c.id ? 'wisp-bg-primary/10 wisp-text-primary' : 'wisp-text-on-surface'}`}
                  disabled={p.busy || p.loading}
                  onClick={() => p.onSelect(c)}
                >
                  <span className="wisp-min-w-0 wisp-flex-1 wisp-truncate">
                    {c.title || `Conversation ${c.id}`}
                  </span>
                  {p.selectedId === c.id && <ChatIcon name="check" size={16} />}
                </Menu.Item>
              ))}
            </>
          )}
        </div>
        <div className="wisp-menu-footer">
          <Menu.Separator className="wisp-my-2 wisp-h-px wisp-bg-outline-variant" />
          <Menu.Item
            className="wisp-menu-item wisp-menu-item-primary wisp-flex wisp-h-11 wisp-items-center wisp-gap-2 wisp-rounded-xl wisp-bg-primary wisp-px-3 wisp-text-sm wisp-font-semibold wisp-text-on-primary wisp-outline-none wisp-transition hover:wisp-brightness-110"
            disabled={p.busy || p.loading}
            onClick={p.onNew}
          >
            <ChatIcon name="add" size={18} />
            <span>{t.newConversation}</span>
          </Menu.Item>
        </div>
      </Popup>
    </Menu.Root>
  )
}
export function ChatModelPicker(p: {
  models: readonly Model[]
  selectedId: string
  name: string
  busy: boolean
  themeStyle: CSSProperties
  onSelect: (id: string) => void
}) {
  if (!p.models.length) return null
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        aria-label="Model"
        disabled={p.busy}
        className="wisp-model-trigger wisp-flex wisp-max-w-48 wisp-items-center wisp-gap-1 wisp-rounded-full wisp-px-2 wisp-py-2 wisp-text-xs wisp-text-on-surface-variant wisp-transition-colors hover:wisp-text-on-surface focus-visible:wisp-outline-none focus-visible:wisp-ring-2 focus-visible:wisp-ring-primary disabled:wisp-opacity-50"
      >
        <span className="wisp-truncate">{p.name}</span>
        <ChatIcon size={16} name="expand_more" />
      </Menu.Trigger>
      <Popup
        themeStyle={p.themeStyle}
        className="wisp-min-w-48"
        label="Select model"
      >
        {p.models.map((m) => (
          <Menu.Item
            key={m.id}
            className={`${itemClass} ${m.id === p.selectedId ? 'wisp-bg-primary/10 wisp-text-primary' : 'wisp-text-on-surface'}`}
            onClick={() => p.onSelect(m.id)}
          >
            <span className="wisp-min-w-0 wisp-flex-1 wisp-truncate">
              {m.name}
            </span>
            {p.selectedId === m.id && <ChatIcon size={16} name="check" />}
          </Menu.Item>
        ))}
      </Popup>
    </Menu.Root>
  )
}
export function ChatOptionsMenu(p: {
  account: Account | null
  workspaces: readonly Workspace[]
  workspaceId: string
  busy: boolean
  endpoint: string
  themeStyle: CSSProperties
  createWorkspace: (title: string) => Promise<boolean>
  onWorkspace: (id: string) => void
  onSignOut: () => void
}) {
  const t = useChatMessages()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger
        render={<ChatIconButton label="Chat settings" icon="more_vert" />}
      />
      <Popup
        themeStyle={p.themeStyle}
        align="end"
        label="Chat options"
        className="wisp-max-h-[75dvh] wisp-w-64 wisp-overflow-y-auto"
      >
        {p.account && (
          <>
            <div className="wisp-menu-header wisp-flex wisp-items-center wisp-justify-between wisp-gap-2 wisp-px-1 wisp-py-1">
              <Menu.Item
                nativeButton
                disabled={p.busy}
                onClick={p.onSignOut}
                render={
                  <ChatIconButton
                    className="wisp-menu-signout wisp-order-last"
                    label={t.signOut}
                    icon="logout"
                    danger
                  />
                }
              />
              <span className="wisp-min-w-0 wisp-flex-1 wisp-truncate wisp-px-1 wisp-text-sm wisp-font-semibold">
                {p.account.name}
              </span>
            </div>
            <Menu.Separator className="wisp-my-1 wisp-h-px wisp-bg-outline-variant" />
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger className={itemClass}>
                <span className="wisp-flex wisp-min-w-0 wisp-flex-1 wisp-items-center wisp-gap-2">
                  <ChatIcon size={17} name="workspaces" />
                  {p.workspaces.find((w) => w.id === p.workspaceId)?.title ||
                    t.workspaces}
                </span>
                <ChatIcon size={17} name="chevron_right" />
              </Menu.SubmenuTrigger>
              <Popup
                submenu
                themeStyle={p.themeStyle}
                className="wisp-menu-with-footer wisp-workspace-menu wisp-max-h-[70dvh] wisp-w-72 wisp-overflow-hidden"
              >
                <div className="wisp-menu-list">
                  {p.workspaces.map((w) => (
                    <Menu.Item
                      key={w.id}
                      className={`${itemClass} ${w.id === p.workspaceId ? 'wisp-bg-primary/10 wisp-text-primary' : 'wisp-text-on-surface'}`}
                      disabled={p.busy}
                      onClick={() => p.onWorkspace(w.id)}
                    >
                      <span className="wisp-min-w-0 wisp-flex-1 wisp-truncate">
                        {w.title}
                        {w.provisional ? ' · new' : ''}
                        {w.role === 'use' ? ' · use' : ''}
                      </span>
                      {w.id === p.workspaceId && (
                        <ChatIcon size={16} name="check" />
                      )}
                    </Menu.Item>
                  ))}
                </div>
                <div className="wisp-menu-footer">
                  <Menu.Separator className="wisp-my-2 wisp-h-px wisp-bg-outline-variant" />
                  <Menu.Item
                    closeOnClick={false}
                    className={`${itemClass} wisp-menu-action`}
                    disabled={p.busy}
                    onClick={() => setCreating(!creating)}
                  >
                    <span className="wisp-flex wisp-items-center wisp-gap-2">
                      <ChatIcon size={17} name="add" />
                      {t.newWorkspace}
                    </span>
                  </Menu.Item>
                  {creating && (
                    <form
                      className="wisp-grid wisp-gap-2 wisp-border-t wisp-border-outline-variant wisp-px-2 wisp-py-3"
                      onKeyDown={(e) => {
                        if (e.key !== 'Escape' && e.key !== 'Tab')
                          e.stopPropagation()
                      }}
                      onSubmit={(e) => {
                        e.preventDefault()
                        void p.createWorkspace(name).then((ok) => {
                          if (ok) {
                            setName('')
                            setCreating(false)
                          }
                        })
                      }}
                    >
                      <input
                        autoFocus
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        aria-label={t.workspaceName}
                        placeholder={t.workspaceName}
                        className="wisp-min-w-0 wisp-rounded-xl wisp-border wisp-border-outline-variant wisp-bg-surface wisp-px-3 wisp-py-2 wisp-text-sm"
                      />
                      <button
                        type="submit"
                        disabled={p.busy}
                        className="wisp-justify-self-end wisp-rounded-xl wisp-bg-primary wisp-px-3 wisp-py-2 wisp-text-sm wisp-text-on-primary wisp-transition hover:wisp-brightness-110 disabled:wisp-opacity-50"
                      >
                        {t.create}
                      </button>
                    </form>
                  )}
                </div>
              </Popup>
            </Menu.SubmenuRoot>
          </>
        )}
        <Menu.LinkItem
          className="wisp-menu-item wisp-flex wisp-min-h-10 wisp-items-center wisp-gap-2 wisp-rounded-xl wisp-px-3 wisp-py-2 wisp-text-sm wisp-outline-none"
          href={p.endpoint}
          target="_blank"
          rel="noopener noreferrer"
        >
          <ChatIcon size={17} name="cloud" />
          {t.openCloudflare}
        </Menu.LinkItem>
      </Popup>
    </Menu.Root>
  )
}
