/**
 * Swap the settings-rail gear for this section's ACP mark.
 * The shell hard-codes nav glyphs by id; out-of-tree plugins cannot register one.
 */

const NAV_LABEL = 'ACP Worker'

function card(x: string): SVGRectElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  node.setAttribute('x', x)
  node.setAttribute('y', '3.2')
  node.setAttribute('width', '5.6')
  node.setAttribute('height', '9.6')
  node.setAttribute('rx', '1.4')
  node.setAttribute('fill', 'none')
  node.setAttribute('stroke', 'currentColor')
  node.setAttribute('stroke-width', '1.3')
  return node
}

function acpNavSvg(className: string | null): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('width', '16')
  svg.setAttribute('height', '16')
  svg.setAttribute('viewBox', '0 0 16 16')
  svg.setAttribute('fill', 'none')
  svg.setAttribute('data-acp-nav', '1')
  svg.setAttribute('aria-hidden', 'true')
  if (className !== null && className !== '') svg.setAttribute('class', className)
  const link = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  link.setAttribute('d', 'M7.2 8h1.6')
  link.setAttribute('stroke', 'currentColor')
  link.setAttribute('stroke-width', '1.3')
  link.setAttribute('stroke-linecap', 'round')
  svg.append(card('1.6'), card('8.8'), link)
  return svg
}

function applyOnce(): void {
  for (const dialog of document.querySelectorAll('[role="dialog"][aria-modal="true"]')) {
    const nav = dialog.querySelector('nav')
    if (nav === null) continue
    for (const btn of nav.querySelectorAll('button')) {
      const text = (btn.textContent ?? '').replace(/\s+/g, ' ').trim()
      if (text !== NAV_LABEL) continue
      btn.setAttribute('data-acp-worker-nav', '')
      const current = btn.querySelector('svg')
      if (current?.getAttribute('data-acp-nav') === '1') continue
      const next = acpNavSvg(current?.getAttribute('class') ?? null)
      if (current !== null) current.replaceWith(next)
      else btn.insertBefore(next, btn.firstChild)
    }
  }
}

/**
 * Keep the ACP nav glyph on the settings rail while this section is mounted.
 */
export function watchAcpNavIcon(): () => void {
  applyOnce()
  const observer = new MutationObserver(applyOnce)
  observer.observe(document.body, { childList: true, subtree: true })
  return () => { observer.disconnect() }
}
