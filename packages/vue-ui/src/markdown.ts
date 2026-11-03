import { marked } from 'marked'

const ALLOWED_TAGS = new Set([
  'A',
  'BLOCKQUOTE',
  'BR',
  'CODE',
  'DEL',
  'EM',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'HR',
  'LI',
  'OL',
  'P',
  'PRE',
  'S',
  'STRONG',
  'SUB',
  'SUP',
  'TABLE',
  'TBODY',
  'TD',
  'TH',
  'THEAD',
  'TR',
  'UL',
])

function safeLink(value: string): boolean {
  try {
    const url = new URL(value, window.location.origin)
    return (
      url.protocol === 'https:' ||
      url.protocol === 'http:' ||
      url.protocol === 'mailto:'
    )
  } catch {
    return false
  }
}

function cleanNode(node: Node): void {
  if (!(node instanceof Element)) return
  if (!ALLOWED_TAGS.has(node.tagName)) {
    if (
      ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH'].includes(
        node.tagName,
      )
    ) {
      node.remove()
    } else {
      node.replaceWith(document.createTextNode(node.textContent ?? ''))
    }
    return
  }

  for (const attribute of Array.from(node.attributes)) {
    if (
      node.tagName === 'A' &&
      attribute.name === 'href' &&
      safeLink(attribute.value)
    )
      continue
    if (node.tagName === 'A' && attribute.name === 'title') continue
    node.removeAttribute(attribute.name)
  }
  if (node.tagName === 'A') {
    const href = node.getAttribute('href')
    if (href) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
  }
  Array.from(node.childNodes).forEach(cleanNode)
}

export function renderSafeMarkdown(source: string): string {
  const html = marked.parse(source, { async: false, breaks: true, gfm: true })
  const template = document.createElement('template')
  template.innerHTML = html
  Array.from(template.content.childNodes).forEach(cleanNode)
  for (const table of template.content.querySelectorAll('table')) {
    const scrollContainer = document.createElement('div')
    scrollContainer.className = 'wisp-markdown-scroll'
    table.before(scrollContainer)
    scrollContainer.append(table)
  }
  return template.innerHTML
}
