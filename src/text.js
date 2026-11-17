/**
 * Text from item data: one string, or a map from language tag to text
 * (`{ "en": "Pay it", "zh": "去付款" }`). Shown in the person's language,
 * then its primary tag, then `en`, then the first one given. Pure.
 */
export function pickText(value, language = 'en') {
  if (typeof value === 'string') return value
  if (value === null || typeof value !== 'object') return ''
  const tags = Object.keys(value)
  const want = String(language).toLowerCase()
  const primary = want.split('-')[0]
  const found = tags.find(tag => tag.toLowerCase() === want)
    ?? tags.find(tag => tag.toLowerCase() === primary)
    ?? tags.find(tag => tag.toLowerCase().split('-')[0] === primary)
    ?? tags.find(tag => tag.toLowerCase() === 'en')
    ?? tags[0]
  return typeof value[found] === 'string' ? value[found] : ''
}
