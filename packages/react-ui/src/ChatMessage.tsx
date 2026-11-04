import { createContext, useContext, useEffect, useState } from 'react'
import {
  AttachmentPrimitive,
  MessagePrimitive,
  useAuiState,
} from '@assistant-ui/react'
import { nativeAttachmentData } from './runtime/conversation.js'
import type { NativeAttachmentDisplayData } from './runtime/conversation.js'
import { renderSafeMarkdown } from './markdown.js'
import { ChatIcon } from './ChatIcon.js'
import { ChatIconButton } from './primitives.js'
export const DownloadContext = createContext<
  ((data: NativeAttachmentDisplayData) => void) | undefined
>(undefined)
export function ChatMarkdown() {
  const text = useAuiState((s) => (s.part.type === 'text' ? s.part.text : ''))
  return (
    <div
      className="wisp-markdown wisp-min-w-0 wisp-max-w-full wisp-break-words"
      dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(text) }}
    />
  )
}
export function ChatAttachmentPreview({
  removable = false,
  onDownload,
}: {
  removable?: boolean
  onDownload?: (data: NativeAttachmentDisplayData) => void
}) {
  const attachment = useAuiState((s) => s.attachment)
  const [source, setSource] = useState('')
  const part = attachment.content?.find(
    (p) => p.type === 'data' && p.name === 'wisp-native',
  )
  const native =
    part?.type === 'data' ? nativeAttachmentData(part.data) : undefined
  const mime = attachment.contentType || attachment.file?.type || ''
  const isImage = ['image/png', 'image/jpeg', 'image/webp'].includes(mime)
  useEffect(() => {
    if (!attachment.file || !isImage) {
      setSource('')
      return
    }
    const url = URL.createObjectURL(attachment.file)
    setSource(url)
    return () => URL.revokeObjectURL(url)
  }, [attachment.file, isImage])
  const preview = source || native?.previewUrl
  return (
    <div className="wisp-flex wisp-min-w-0 wisp-items-center wisp-gap-2">
      {isImage && preview ? (
        <img
          src={preview}
          alt={`Preview ${native?.name ?? attachment.name}`}
          className="wisp-h-12 wisp-w-12 wisp-shrink-0 wisp-rounded-lg wisp-object-cover"
        />
      ) : (
        <AttachmentPrimitive.unstable_Thumb className="wisp-flex wisp-h-10 wisp-min-w-10 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-lg wisp-bg-surface-container-high/70 wisp-px-2 wisp-text-[10px] wisp-font-semibold wisp-uppercase wisp-text-on-surface-variant" />
      )}
      <div className="wisp-min-w-0 wisp-flex-1">
        <div className="wisp-max-w-full wisp-truncate wisp-text-xs wisp-font-medium">
          <AttachmentPrimitive.Name />
        </div>
        {attachment.status.type === 'running' ? (
          <span
            role="status"
            className="wisp-block wisp-text-[10px] wisp-text-on-surface-variant"
          >
            Uploading attachment...
          </span>
        ) : attachment.status.type === 'incomplete' ? (
          <span className="wisp-block wisp-text-[10px] wisp-text-error">
            {attachment.status.message || 'Upload failed. Try again.'}
          </span>
        ) : null}
      </div>
      {native?.chatId !== undefined && native.attachmentId !== undefined && (
        <ChatIconButton
          icon="download"
          label={`Download ${native.name}`}
          onClick={() => onDownload?.(native)}
        />
      )}{' '}
      {removable && (
        <AttachmentPrimitive.Remove
          className="wisp-flex wisp-h-8 wisp-w-8 wisp-shrink-0 wisp-items-center wisp-justify-center wisp-rounded-full wisp-text-on-surface-variant hover:wisp-bg-on-surface/10"
          aria-label="Remove attachment"
        >
          <ChatIcon size={18} name="close" />
        </AttachmentPrimitive.Remove>
      )}
    </div>
  )
}
export function ChatMessage({
  onDownload,
}: {
  onDownload?: (data: NativeAttachmentDisplayData) => void
}) {
  const contextDownload = useContext(DownloadContext)
  const download = onDownload ?? contextDownload
  const message = useAuiState((s) => s.message)
  if (
    !message.content.some((p) => p.type === 'text' && p.text.trim()) &&
    !message.attachments?.length
  )
    return null
  const Attachment = () => (
    <div className="wisp-mb-1 wisp-min-w-0 wisp-max-w-full wisp-rounded-xl wisp-bg-surface-container/75 wisp-p-2 wisp-text-on-surface">
      <ChatAttachmentPreview onDownload={download} />
    </div>
  )
  return (
    <MessagePrimitive.Root
      className={`wisp-mb-2 last:wisp-mb-0 wisp-flex wisp-min-w-0 wisp-w-full ${message.role === 'user' ? 'wisp-justify-end' : 'wisp-justify-start'}`}
    >
      <article
        className={`wisp-w-fit wisp-min-w-0 wisp-max-w-full wisp-rounded-2xl wisp-px-4 wisp-py-3 wisp-text-sm wisp-leading-relaxed wisp-shadow-sm ${message.role === 'user' ? 'wisp-bg-chat-user/90 wisp-text-chat-user-foreground' : 'wisp-bg-surface-container-high/80 wisp-text-on-surface'}`}
      >
        {message.status?.type === 'incomplete' && (
          <div className="wisp-mb-1 wisp-text-xs wisp-text-error">
            Response did not finish.
          </div>
        )}
        <MessagePrimitive.Parts components={{ Text: ChatMarkdown }} />
        <div className="wisp-mt-2">
          <MessagePrimitive.Attachments components={{ Attachment }} />
        </div>
        {message.status?.type === 'running' && (
          <span className="wisp-sr-only" role="status">
            Assistant is thinking
          </span>
        )}
      </article>
    </MessagePrimitive.Root>
  )
}
