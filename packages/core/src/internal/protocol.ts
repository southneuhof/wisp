import { z } from 'zod'
import type { RpcStub } from 'capnweb'
export const profileSchema = z.object({ id: z.string(), name: z.string() })
export const workspaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  role: z.enum(['build', 'use']).default('build'),
})
export const chatSchema = z.object({
  id: z.number(),
  title: z.string(),
  activeAgent: z.unknown().optional(),
})
export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  mimeType: z.string(),
  size: z.number(),
})
export const messageSchema = z.object({
  chatId: z.number(),
  sequence: z.number(),
  type: z.string(),
  author: z
    .object({
      type: z.string(),
      id: z.string().optional(),
      name: z.string().optional(),
    })
    .optional(),
  message: z.string().optional(),
  attachments: z.array(attachmentSchema).optional(),
})
export const historySchema = z.object({
  messages: z.array(messageSchema),
  compacted: z.object({ to: z.number(), summary: z.string() }).optional(),
})
export type NativeMessage = z.infer<typeof messageSchema>
export type NativeChat = z.infer<typeof chatSchema>
export type History = z.infer<typeof historySchema>
export interface UploadHandle {
  oid: string
  mimeType: string
  name?: string
}
export type Event =
  | { type: 'generation' }
  | { type: 'metadata'; chat: NativeChat }
  | { type: 'deleted'; chatId: number }
  | { type: 'message'; message: NativeMessage }
  | { type: 'stream'; chatId: number; event: { type: string; delta?: string } }
export interface Subscriber {
  streamGeneration(generation: number): void
  metadata(chat: unknown): void
  deleted(chatId: number): void
  message(message: unknown): void
  changeApplied(...args: unknown[]): void
  stream(chatId: number, event: unknown): void
}
export interface NativeWorkspace {
  getMetadata(): Promise<unknown>
  setTitle(title: string): Promise<void>
  listChats(): Promise<unknown>
  listModels(): Promise<unknown>
  getChatHistory(id: number, before?: number): Promise<unknown>
  subscribeToChat(subscriber: RpcStub<Subscriber>): Promise<RpcStub<object>>
  newChat(
    text: string,
    model: string | null,
    capsules: undefined,
    attachments: UploadHandle[],
  ): Promise<number>
  sendChatMessage(
    id: number,
    text: string,
    model: string | null,
    capsules: undefined,
    attachments: UploadHandle[],
  ): Promise<void>
  stopAgent(id: number): Promise<void>
  uploadBlob(bytes: Uint8Array): Promise<string>
  getChatAttachmentContent(
    id: number,
    attachmentId: string,
  ): Promise<Uint8Array>
}
export interface NativeAccount {
  whoami(): Promise<unknown>
  listWorkspaces(): Promise<unknown>
  newWorkspace(): Promise<RpcStub<NativeWorkspace>>
  openWorkspace(id: string): Promise<RpcStub<NativeWorkspace>>
}
export interface NativePublic {
  getServerConfig(): Promise<unknown>
  login(username: string, hash: Uint8Array): Promise<string | null>
  authenticate(token: string): Promise<RpcStub<NativeAccount>>
}
