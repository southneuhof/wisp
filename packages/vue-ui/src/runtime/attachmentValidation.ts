export const MAX_CHAT_ATTACHMENTS = 5
export const MAX_CHAT_ATTACHMENT_BYTES = 4 * 1024 * 1024
export const MAX_CHAT_ATTACHMENT_TOTAL_BYTES = 5 * 1024 * 1024

const MIME_BY_EXTENSION = new Map<string, string>([
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.csv', 'text/csv'],
  ['.gif', 'image/gif'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.json', 'application/json'],
  ['.log', 'text/plain'],
  ['.md', 'text/markdown'],
  ['.markdown', 'text/markdown'],
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain'],
  ['.webp', 'image/webp'],
  ['.xml', 'application/xml'],
  ['.yaml', 'application/yaml'],
  ['.yml', 'application/yaml'],
])

export function canonicalMimeType(file: File): string {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
  const inferredMime = MIME_BY_EXTENSION.get(extension)
  const declaredMime = (file.type.split(';', 1)[0] ?? '').trim().toLowerCase()

  if (declaredMime === 'image/jpg') return 'image/jpeg'
  if (
    inferredMime === 'text/csv' &&
    declaredMime === 'application/vnd.ms-excel'
  )
    return inferredMime
  if (declaredMime && declaredMime !== 'application/octet-stream')
    return declaredMime
  return inferredMime ?? 'application/octet-stream'
}

export function validateChatDraft(
  text: string,
  files: readonly File[],
): string | undefined {
  if (!text.trim() && files.length === 0) {
    return 'Enter a question or attach a file before sending.'
  }
  if (files.length > MAX_CHAT_ATTACHMENTS) {
    return `You can attach up to ${MAX_CHAT_ATTACHMENTS} files.`
  }
  if (files.some((file) => file.size > MAX_CHAT_ATTACHMENT_BYTES)) {
    return 'Each file must be 4 MiB or smaller.'
  }
  if (
    files.reduce((total, file) => total + file.size, 0) >
    MAX_CHAT_ATTACHMENT_TOTAL_BYTES
  ) {
    return 'The total file size must be 5 MiB or smaller.'
  }
  if (
    files.some((file) => {
      const mimeType = canonicalMimeType(file)
      return (
        mimeType.startsWith('image/') &&
        !['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
      )
    })
  ) {
    return 'Use PNG, JPEG, or WebP images.'
  }
  return undefined
}
