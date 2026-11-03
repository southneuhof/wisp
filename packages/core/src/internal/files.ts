import type { UploadHandle, NativeWorkspace } from './protocol.js'
export class FileValidationError extends Error {}

export function validateDraft(text: string, files: readonly File[]): void {
  if (!text.trim() && !files.length)
    throw new FileValidationError('Enter a message or attach a file')
  if (files.length > 5)
    throw new FileValidationError('Attach at most five files')
  if (files.some((f) => f.size > 4 * 1024 * 1024))
    throw new FileValidationError('Each attachment must be at most 4 MiB')
  if (files.reduce((s, f) => s + f.size, 0) > 5 * 1024 * 1024)
    throw new FileValidationError('Attachments must total at most 5 MiB')
}
const mimeExtensions: Record<string, string> = {
  txt: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  log: 'text/plain',
  xml: 'application/xml',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}
export function fileMime(file: File): string {
  const declared = file.type.split(';')[0]?.trim().toLowerCase()
  if (declared === 'image/jpg') return 'image/jpeg'
  if (
    file.name.toLowerCase().endsWith('.csv') &&
    declared === 'application/vnd.ms-excel'
  )
    return 'text/csv'
  return declared && declared !== 'application/octet-stream'
    ? declared
    : (mimeExtensions[file.name.split('.').pop()?.toLowerCase() ?? ''] ??
        'application/octet-stream')
}
export async function uploadFiles(
  files: readonly File[],
  workspace: Pick<NativeWorkspace, 'uploadBlob'>,
  signal: AbortSignal,
): Promise<UploadHandle[]> {
  const prepared = await Promise.all(
    files.map(async (file) => ({
      file,
      mimeType: fileMime(file),
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  )
  for (const p of prepared) {
    const signatures: Record<string, number[]> = {
      'image/png': [137, 80, 78, 71, 13, 10, 26, 10],
      'image/jpeg': [255, 216, 255],
      'image/webp': [82, 73, 70, 70, -1, -1, -1, -1, 87, 69, 66, 80],
      'application/pdf': [37, 80, 68, 70, 45],
    }
    if (
      p.mimeType.startsWith('image/') &&
      !['image/png', 'image/jpeg', 'image/webp'].includes(p.mimeType)
    )
      throw new FileValidationError('Use PNG, JPEG, or WebP images')
    const signature = signatures[p.mimeType]
    if (signature && !signature.every((b, i) => b === -1 || p.bytes[i] === b))
      throw new FileValidationError('Attachment bytes do not match its format')
  }
  const handles: UploadHandle[] = []
  for (const p of prepared) {
    signal.throwIfAborted()
    const oid = await workspace.uploadBlob(p.bytes)
    signal.throwIfAborted()
    handles.push({ oid, mimeType: p.mimeType, name: p.file.name })
  }
  return handles
}
