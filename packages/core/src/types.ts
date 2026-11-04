export interface Account {
  readonly id: string
  readonly name: string
}
export interface Workspace {
  readonly id: string
  readonly title: string
  readonly role: 'build' | 'use'
  readonly provisional?: boolean
}
export interface Model {
  readonly id: string
  readonly name: string
}
export interface Conversation {
  readonly id: number
  readonly title: string
  readonly running: boolean
}
export interface Attachment {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  readonly size: number
  readonly endpoint: string
  readonly accountId: string
  readonly workspaceId: string
  readonly chatId: number
}
export interface Message {
  readonly id: string
  readonly role: 'user' | 'assistant'
  readonly text: string
  readonly status: 'complete' | 'running' | 'cancelled' | 'error'
  readonly attachments: readonly Attachment[]
  readonly sequence?: number
}
export interface ChatError {
  readonly code:
    | 'connection'
    | 'credentials'
    | 'unsupported-auth'
    | 'workspace'
    | 'model'
    | 'validation'
    | 'cancelled'
    | 'uncertain'
    | 'disposed'
    | 'operation'
  readonly message: string
}
export type ConversationView =
  | { readonly status: 'draft'; readonly messages: readonly Message[] }
  | {
      readonly status: 'loading' | 'conversation'
      readonly id: number
      readonly messages: readonly Message[]
    }
export type WorkspaceState =
  | { readonly status: 'none' }
  | { readonly status: 'opening'; readonly id: string }
  | {
      readonly status: 'unavailable'
      readonly workspace: Workspace
      readonly reason: string
    }
  | {
      readonly status: 'ready'
      readonly workspace: Workspace
      readonly models: readonly Model[]
      readonly modelId: string | null
      readonly conversations: readonly Conversation[]
      readonly conversation: ConversationView
      readonly running: boolean
      readonly uploading: boolean
      readonly loadingEarlier: boolean
      readonly hasEarlier: boolean
    }
export type ChatSnapshot =
  | {
      readonly status: 'starting' | 'signed-out' | 'signing-in' | 'disposed'
      readonly connection: 'offline' | 'connected' | 'recovering'
      readonly error: ChatError | null
      readonly passwordAuthEnabled: boolean | null
    }
  | {
      readonly status: 'authenticated'
      readonly connection: 'offline' | 'connected' | 'recovering'
      readonly error: ChatError | null
      readonly account: Account
      readonly workspaces: readonly Workspace[]
      readonly workspace: WorkspaceState
    }
export interface AuthSession {
  readonly token: string
  readonly accountId: string
}
export interface ChatOptions {
  readonly url: string
  readonly modelId?: string
}
export interface SendOptions {
  readonly text?: string
  readonly files?: readonly File[]
}
export interface WispChatClient {
  start(): Promise<void>
  subscribe(listener: (snapshot: ChatSnapshot) => void): () => void
  getSnapshot(): ChatSnapshot
  dispose(): void
  readonly auth: {
    signIn(input: { username: string; password: string }): Promise<void>
    setSession(session: AuthSession | null): Promise<void>
    signOut(): void
  }
  readonly workspaces: {
    list(): Promise<readonly Workspace[]>
    create(input?: { title?: string }): Promise<Workspace>
    select(id: string): Promise<void>
  }
  readonly models: { select(id: string): void }
  readonly conversations: {
    list(): Promise<readonly Conversation[]>
    select(id: number): Promise<void>
    startNew(): void
    send(input: SendOptions): Promise<void>
    stop(): Promise<void>
    loadEarlier(): Promise<void>
  }
  readonly attachments: { download(attachment: Attachment): Promise<Blob> }
}
