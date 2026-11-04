import type { SVGProps } from 'react'
const paths: Record<string, string> = {
  add: 'M12 5v14M5 12h14',
  attach_file: 'm8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8',
  chat_bubble_outline: 'M4 4h16v13H9l-5 4V4Z',
  check: 'm5 12 4 4L19 6',
  chevron_right: 'm9 5 7 7-7 7',
  close: 'm6 6 12 12M6 18 18 6',
  cloud: 'M7 18a5 5 0 1 1 1-10 6 6 0 0 1 11 2 4 4 0 0 1-1 8H7Z',
  expand_more: 'm6 9 6 6 6-6',
  logout: 'M10 4H4v16h6m4-13 5 5-5 5M8 12h11',
  more_vert: 'M12 4h.01M12 12h.01M12 20h.01',
  send: 'm3 3 19 9-19 9 4-9-4-9Zm4 9h15',
  stop: 'M6 6h12v12H6Z',
  workspaces: 'M4 4h6v6H4zM14 4h6v16h-6zM4 14h6v6H4z',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
}

export function ChatIcon({
  name,
  size = 20,
  ...props
}: SVGProps<SVGSVGElement> & { name: string; size?: number }) {
  return (
    <svg
      {...props}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more_vert' ? 3.5 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, ...props.style }}
    >
      <path d={paths[name]} />
    </svg>
  )
}
