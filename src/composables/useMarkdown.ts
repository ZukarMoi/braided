import { marked } from 'marked'

marked.use({
  gfm: true,    // テーブル・取り消し線など GitHub Flavored Markdown
  breaks: true, // 単一改行 → <br>（チャット向け）
})

// export function escHtml(s = ''): string {
//   return String(s)
//     .replace(/&/g, '&amp;')
//     .replace(/</g, '&lt;')
//     .replace(/>/g, '&gt;')
//     .replace(/"/g, '&quot;')
// }

export function mdToHtml(raw = ''): string {
  if (!raw) return ''
  return marked.parse(raw, { async: false }) as string
}


// 旧実装（簡易版。marked.js 導入前）
// export function mdToHtml(raw: string = ''): string {
//   if (!raw) return ''
//   const blocks: string[] = []
//   let s = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
//   // Code blocks
//   s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, (_: string, c: string) => {
//     blocks.push(`<pre><code>${c.trim()}</code></pre>`)
//     return `\x00${blocks.length - 1}\x00`
//   })
//   // Inline code
//   s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>')
//   // Headers
//   s = s.replace(/^#### (.+)$/gm, '<h4>$1</h4>')
//     .replace(/^### (.+)$/gm, '<h3>$1</h3>')
//     .replace(/^## (.+)$/gm, '<h2>$1</h2>')
//   // Bold / italic
//   s = s.replace(/\*\*\*(.+?)\*\*\*/gs, '<strong><em>$1</em></strong>')
//   s = s.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
//   s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/gs, '<em>$1</em>')
//   // Lists
//   s = s.replace(/^[ \t]*[-*+] (.+)$/gm, '<li>$1</li>').replace(/^[ \t]*\d+\. (.+)$/gm, '<li>$1</li>')
//   s = s.replace(/(<li>[\s\S]*?<\/li>\n?)+/g, m => `<ul>${m}</ul>`)
//   // Paragraphs
//   s = `<p>${s.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>')}</p>`
//   s = s
//     .replace(/<p>(<h[2-4]>|<pre>|<ul>)/g, '$1')
//     .replace(/(<\/h[2-4]>|<\/pre>|<\/ul>)<\/p>/g, '$1')
//     .replace(/<p><\/p>/g, '')
//   // Restore code blocks
//   s = s.replace(/\x00(\d+)\x00/g, (_: string, i: string) => blocks[+i] ?? '')
//   return s
// }