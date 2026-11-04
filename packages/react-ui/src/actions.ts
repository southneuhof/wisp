export interface WispChatActions {
  refreshWorkspaces(): Promise<void>
  selectWorkspace(id: string): Promise<void>
  createWorkspace(title?: string): Promise<void>
  selectConversation(id: number): Promise<void>
  startNewConversation(): void
  selectModel(id: string): void
  signOut(): void
}
