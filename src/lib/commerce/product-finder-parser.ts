export function parseProductFinderPrompt(input: string): { query: string; budgetBrl: number | null } | null {
  const trimmed = input.trim();
  const command = trimmed.match(/^\/(?:produto|comprar|procurar|achar|oferta|shopping|monitorar|alerta\s+preco|preco\s+alerta)\s+(.+)$/i);
  const natural = /\b(quero|procure|procurar|achar|encontre|comprar|compra|melhor oferta|melhor oportunidade|monitorar|alerta de preco|preco caiu)\b/i.test(trimmed)
    && /\b(comprar|produto|oferta|marketplace|mercado livre|amazon|shopee|magalu|ate|abaixo|menos de|por ate|preco)\b/i.test(trimmed);
  if (!command && !natural) return null;

  let raw = (command ? command[1] : trimmed)
    .replace(/\b(quero|procure|procurar|achar|encontre|comprar|compra|monitorar|avise|alerta|alertar|um|uma|o|a|produto|item|preco)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const budgetMatch = raw.match(/(?:r\$\s*)?(\d{2,6}(?:[,.]\d{1,2})?)\s*(?:reais|brl)?/i);
  const budgetBrl = budgetMatch
    ? Number(budgetMatch[1].replace('.', '').replace(',', '.'))
    : null;

  raw = raw
    .replace(/\b(ate|abaixo de|menos de|por ate|no maximo|maximo)\b/gi, ' ')
    .replace(/(?:r\$\s*)?\d{2,6}(?:[,.]\d{1,2})?\s*(?:reais|brl)?/gi, ' ')
    .replace(/\b(no|na|em|mercado livre|amazon|shopee|magalu|marketplace|melhor oferta|melhor oportunidade)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (raw.length < 2) return null;
  return {
    query: raw.slice(0, 120),
    budgetBrl: budgetBrl && Number.isFinite(budgetBrl) ? budgetBrl : null,
  };
}
