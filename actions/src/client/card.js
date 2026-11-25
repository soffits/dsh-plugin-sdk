/** The item card in a sent message (`conversation.user.text.node`, key `ui-actions-item`). */
import { createElement as h } from 'react'
import { Glyph } from './bar.js'

/**
 * @param {object} options
 * @param {{ useSource: (id: string) => { name?: string, icon?: Function } | undefined }} options.sources
 */
export function createCard({ sources }) {
  /** @param {{ node: { data: { source: string, sourceName: string, title: string, lines: string[] } } }} props */
  return function ItemCard({ node }) {
    const item = node.data
    const source = sources.useSource(item.source)
    const name = source?.name || item.sourceName
    const Icon = source?.icon
    const line = item.lines[0]
    return h('span', { className: 'ua-item', 'data-item-source': item.source, title: [`${name}: ${item.title}`, ...item.lines].join('\n') },
      h('span', { className: 'ua-itemIcon', 'aria-hidden': true }, Icon ? h(Icon, { size: 18 }) : h(Glyph, { name: 'item' })),
      h('span', { className: 'ua-itemText' },
        h('span', { className: 'ua-itemSource' }, name),
        h('span', { className: 'ua-itemTitle' }, item.title),
        line && h('span', { className: 'ua-itemLine' }, line)))
  }
}
