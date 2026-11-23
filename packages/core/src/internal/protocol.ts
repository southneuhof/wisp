import { z } from 'zod'
import type { RpcStub } from 'capnweb'
export const profileSchema = z.object({ id: z.string(), name: z.string() })
export const workspaceSchema = z.object({
  id: z.string(),
  title: z.string(),
  role: z.enum(['build', 'use']).default('build'),
})
export const chatSchema = z
  .object({
    id: z.number(),
    title: z.string(),
    activeAgent: z.unknown().optional(),
  })
  .passthrough()
export const attachmentSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  mimeType: z.string(),
  size: z.number(),
})
export const messageSchema = z
  .object({
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
  .passthrough()
export const historySchema = z.object({
  messages: z.array(messageSchema),
  compacted: z
    .object({ to: z.number(), summary: z.string() })
    .passthrough()
    .optional(),
})
export type NativeMessage = z.infer<typeof messageSchema>
export type NativeChat = z.infer<typeof chatSchema>
export type History = z.infer<typeof historySchema>
export interface UploadHandle {
  oid: string
  mimeType: string
  name?: string
}
export const streamEventSchema = z
  .object({
    type: z.string(),
    delta: z.string().optional(),
  })
  .passthrough()
export type NativeStreamEvent = z.infer<typeof streamEventSchema>
export type Event =
  | { type: 'generation'; generation: number }
  | { type: 'metadata'; chat: NativeChat }
  | { type: 'deleted'; chatId: number }
  | { type: 'message'; message: NativeMessage }
  | { type: 'stream'; chatId: number; event: NativeStreamEvent }
  | {
      type: 'change'
      chatId: number
      generation: number
      revision: number
      author: unknown
      change: unknown
    }
  | { type: 'action'; chatId?: number; action: Record<string, unknown> }
export interface Subscriber {
  streamGeneration(generation: number): void
  metadata(chat: unknown): void
  deleted(chatId: number): void
  message(message: unknown): void
  changeApplied(
    chatId: number,
    generation: number,
    revision: number,
    author: unknown,
    change: unknown,
  ): void
  stream(chatId: number, event: unknown): void
}
export interface ActionsSubscriber {
  entry(action: unknown): void
  ready(): void
}
export interface NativeWorkspace {
  getMetadata(): Promise<unknown>
  setTitle(title: string): Promise<void>
  listChats(): Promise<unknown>
  listModels(): Promise<unknown>
  getChatHistory(id: number, before?: number): Promise<unknown>
  subscribeToChat(subscriber: RpcStub<Subscriber>): Promise<RpcStub<object>>
  subscribeToActions(
    subscriber: RpcStub<ActionsSubscriber>,
  ): Promise<RpcStub<object>>
  approveAction(id: number): Promise<void>
  rejectAction(id: number): Promise<void>
  denyConnectionRequest(id: string): Promise<void>
  approveWebFetchRequest(id: string): Promise<void>
  denyWebFetchRequest(id: string): Promise<void>
  readFilesAtCommit(commitId: string, paths: string[]): Promise<unknown>
  listChangedPaths(fromCommit: string, toCommit: string): Promise<unknown>
  mergeChanges(chatId: number): Promise<unknown>
  revertChanges(chatId: number, revertFrom: number): Promise<void>
  retryAgent(chatId: number, modelId: string): Promise<void>
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
