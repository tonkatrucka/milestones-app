/** Strip Anthropic web-search citation markup; keep the cited sentence text. */
export function sanitizeResearchBulletText(text: string): string {
  return text
    .replace(/<cite\b[^>]*>([\s\S]*?)<\/cite>/gi, '$1')
    .replace(/<cite\b[^>]*>/gi, '')
    .replace(/<\/cite>/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
