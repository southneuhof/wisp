import type { MessageStatus, ThreadMessageLike } from '@assistant-ui/core'
interface NativeChatAttachmentHandle {
  oid: string
  mimeType: string
  name?: string
}

export type ConversationStatus =
  | { type: 'running' }
  | { type: 'complete' }
  | { type: 'incomplete'; reason: 'error' | 'cancelled' }

export type ConversationAttachmentSource =
  | { kind: 'uploaded'; file?: File; handle: NativeChatAttachmentHandle }
  | {
      kind: 'history'
      chatId: number
      attachmentId: string
      previewUrl?: string
    }

export interface ConversationAttachment {
  id: string
  name: string
  mimeType: string
  size: number
  source: ConversationAttachmentSource
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  status: ConversationStatus
  attachments: ConversationAttachment[]
  sequence?: number
  order: number
}

export interface NativeAttachmentDisplayData {
  kind: 'native'
  oid?: string
  chatId?: number
  attachmentId?: string
  mimeType: string
  name: string
  previewUrl?: string
}

export function toThreadMessage(
  message: ConversationMessage,
): ThreadMessageLike {
  const status: MessageStatus =
    message.status.type === 'incomplete'
      ? { type: 'incomplete', reason: message.status.reason }
      : message.status.type === 'complete'
        ? { type: 'complete', reason: 'stop' }
        : message.status
  return {
    id: message.id,
    role: message.role,
    content: message.text ? [{ type: 'text', text: message.text }] : [],
    ...(message.role === 'assistant' ? { status } : {}),
    attachments: message.attachments.map((attachment) => {
      const native: NativeAttachmentDisplayData =
        attachment.source.kind === 'history'
          ? {
              kind: 'native',
              chatId: attachment.source.chatId,
              attachmentId: attachment.source.attachmentId,
              mimeType: attachment.mimeType,
              name: attachment.name,
              previewUrl: attachment.source.previewUrl,
            }
          : {
              kind: 'native',
              oid: attachment.source.handle.oid,
              mimeType: attachment.mimeType,
              name: attachment.name,
            }
      const type = attachment.mimeType.startsWith('image/')
        ? 'image'
        : attachment.mimeType.startsWith('text/') ||
            attachment.mimeType === 'application/pdf'
          ? 'document'
          : 'file'
      return {
        id: attachment.id,
        type,
        name: attachment.name,
        contentType: attachment.mimeType,
        file:
          attachment.source.kind === 'uploaded'
            ? attachment.source.file
            : undefined,
        status: { type: 'complete' },
        content: [{ type: 'data', name: 'wisp-native', data: native }],
      }
    }),
  }
}

export function nativeAttachmentData(
  value: unknown,
): NativeAttachmentDisplayData | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('kind' in value) ||
    value.kind !== 'native'
  )
    return undefined
  if (!('mimeType' in value) || typeof value.mimeType !== 'string')
    return undefined
  if (!('name' in value) || typeof value.name !== 'string') return undefined

  const data: NativeAttachmentDisplayData = {
    kind: 'native',
    mimeType: value.mimeType,
    name: value.name,
  }
  if ('oid' in value && typeof value.oid === 'string') data.oid = value.oid
  if (
    'chatId' in value &&
    typeof value.chatId === 'number' &&
    Number.isSafeInteger(value.chatId)
  )
    data.chatId = value.chatId
  if ('attachmentId' in value && typeof value.attachmentId === 'string')
    data.attachmentId = value.attachmentId
  if ('previewUrl' in value && typeof value.previewUrl === 'string')
    data.previewUrl = value.previewUrl
  return data
}
