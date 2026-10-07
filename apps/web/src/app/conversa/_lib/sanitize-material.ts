/** Minimization, not anonymization: professional history can still identify a person. */
export function sanitizeMaterial(text: string): string {
  return text
    .replace(/^.*\b(?:RG|registro geral)\s*[:-]?\s*\d[\d.\-\s]*.*$/gim, '[RG]')
    .replace(/^.*(?:data de nascimento|nascimento\s*:|nascid[oa]\s+em).*$/gim, '[NASCIMENTO]')
    .replace(/^.*(?:filia[çc][ãa]o|nome d[oa] (?:pai|m[ãa]e))\s*:.*$/gim, '[FILIAÇÃO]')
    .replace(/^.*(?:endere[çc]o\s*:|\b(?:rua|avenida|travessa|alameda)\s+).*$/gim, '[ENDEREÇO]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[EMAIL]')
    .replace(/(?:\+55\s*)?(?:\(\d{2}\)|\b\d{2})[\s.-]*9?\d{4}[\s.-]*\d{4}\b/g, '[TELEFONE]')
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>]+/gi, '[LINK]');
}
