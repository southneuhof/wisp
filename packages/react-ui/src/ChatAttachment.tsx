import { useEffect, useRef, useState } from 'react'
import type { Attachment } from '@southneuhof/wisp-core'
import type { WispChatBinding } from '@southneuhof/wisp-react'
export function ChatAttachment({
  attachment,
  chat,
  downloadLabel,
  failedLabel = 'Failed',
}: {
  attachment: Attachment
  chat: WispChatBinding
  downloadLabel: string
  failedLabel?: string
}) {
  const [image, setImage] = useState(''),
    [failed, setFailed] = useState(false)
  const epoch = useRef(0),
    downloads = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const current = ++epoch.current
    let imageUrl = ''
    setImage('')
    setFailed(false)
    if (attachment.mimeType.startsWith('image/'))
      void chat.client.attachments
        .download(attachment)
        .then((blob) => {
          if (current !== epoch.current) return
          imageUrl = URL.createObjectURL(blob)
          setImage(imageUrl)
        })
        .catch(() => {
          if (current === epoch.current) setFailed(true)
        })
    return () => {
      epoch.current++
      if (imageUrl) URL.revokeObjectURL(imageUrl)
      for (const [url, timer] of downloads.current) {
        clearTimeout(timer)
        URL.revokeObjectURL(url)
      }
      downloads.current.clear()
    }
  }, [attachment, chat.client])
  async function download() {
    const current = epoch.current
    try {
      const blob = await chat.client.attachments.download(attachment)
      if (current !== epoch.current) return
      const url = URL.createObjectURL(blob)
      downloads.current.set(
        url,
        setTimeout(() => {
          URL.revokeObjectURL(url)
          downloads.current.delete(url)
        }, 1000),
      )
      const a = document.createElement('a')
      a.href = url
      a.download = attachment.name
      a.click()
    } catch {
      if (current === epoch.current) setFailed(true)
    }
  }
  return (
    <div className="wisp-attachment">
      {image && <img src={image} alt={attachment.name} />}
      <button type="button" onClick={() => void download()}>
        {downloadLabel} {attachment.name}
      </button>
      {failed && (
        <span role="status">
          {failedLabel}: {attachment.name}
        </span>
      )}
    </div>
  )
}
