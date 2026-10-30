import type { Strategy, Session, Topic } from './contracts';
export interface DiagnosticDocument {
  id: string;
  hash: string;
  text: string;
  usedInApplications: 'yes' | 'no' | 'unknown';
  fileHash?: string;
  pageCount?: number;
  pages?: Array<{ page: number; start: number; end: number }>;
}
export interface DiagnosticInput {
  document: DiagnosticDocument | null;
  contextVersion: string;
  nowMonth: number;
  target?: { company?: string };
  archetype?: Strategy['archetype'];
  longCareer?: boolean;
  experiences?: Array<{
    id: string;
    quote: string;
    start: string | null;
    end: string | null;
    current: boolean | null;
  }>;
}
export interface DiagnosticEvidence {
  start: number;
  end: number;
  quote: string;
  page?: number;
}
export type DiagnosticCode =
  | 'UNREADABLE_EXTRACTED_TEXT'
  | 'UNNECESSARY_PERSONAL_DATA'
  | 'POSSIBLE_GLUED_WORD'
  | 'REPEATED_TEXT'
  | 'TARGETED_RESUME'
  | 'SCOPE_NEEDS_SUPPORT'
  | 'SKILL_NEEDS_EXAMPLE'
  | 'DATES_NEED_CLARIFICATION'
  | 'CHRONOLOGY_INTERVAL'
  | 'EXCESS_PAGES';
export interface DiagnosticFinding {
  version: 1;
  id: string;
  code: DiagnosticCode;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  nature: 'observed' | 'hypothesis';
  documentId: string;
  documentHash: string;
  evidence: DiagnosticEvidence[];
  title: string;
  explanation: string;
  action: string;
  investigation: { experienceId: string | null; missingEvidence: string } | null;
  restriction: {
    documentHash: string;
    destinations: Array<'standard' | 'ats'>;
    correction: string;
  } | null;
}
export interface DiagnosticReport {
  version: 1;
  rulesVersion: 1;
  contextVersion: string;
  sourceVersion?: string;
  status: 'absent' | 'available';
  document: DiagnosticDocument | null;
  findings: DiagnosticFinding[];
  limitations: string[];
}

const priority = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const legitimate = new Set([
  'javascript',
  'typescript',
  'postgresql',
  'mysql',
  'mongodb',
  'nodejs',
  'nestjs',
  'nextjs',
  'reactjs',
  'github',
  'gitlab',
  'linkedin',
  'youtube',
  'whatsapp',
  'powerbi',
  'powerpoint',
  'wordpress',
  'hubspot',
  'salesforce',
  'openai',
  'hackerone',
  'bugcrowd',
  'tryhackme',
  'hackthebox',
  'devops',
  'appsec',
  'docker',
  'kubernetes',
  'autocad',
  'totvs',
  'iphone',
  'macos',
  'ios',
]);
const sensitive =
  /(?:CPF\s*:?\s*)?\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b(?:RG|registro geral)\s*[:-]?\s*\d[\d. -]*|estado civil\s*:[^\n]*|(?:data de nascimento|nascimento|filiação|nome do pai|nome da mãe)\s*:[^\n]*/giu;
const dateToken = '(?:\\d{2}/\\d{4}|\\d{4}-\\d{2}|\\d{4})';
const dateRange = new RegExp(
  `(${dateToken})\\s*(?:[-–—]|a|até)\\s*(${dateToken}|atual|presente)`,
  'giu',
);

/** Month bounds preserve the uncertainty of year-only dates. */
function monthBounds(value: string): [number, number] | null {
  const yearOnly = /^\d{4}$/.test(value);
  const parts = value.split(/[-/]/).map(Number);
  const year = value.includes('/') ? parts[1] : parts[0];
  const month = value.includes('/') ? parts[0] : parts[1];
  if (year < 1900 || year > 2100 || (!yearOnly && (month < 1 || month > 12))) return null;
  return yearOnly ? [year * 12, year * 12 + 11] : [year * 12 + month - 1, year * 12 + month - 1];
}

export function diagnoseDocument(input: DiagnosticInput): DiagnosticReport {
  const doc = input.document;
  const report: DiagnosticReport = {
    version: 1,
    rulesVersion: 1,
    contextVersion: input.contextVersion,
    status: doc ? 'available' : 'absent',
    document: doc,
    findings: [],
    limitations: [],
  };
  if (!doc) return report;
  const { text } = doc;
  report.limitations.push('Não avaliamos o layout visual deste documento.');
  if (doc.usedInApplications !== 'yes')
    report.limitations.push(
      'Ainda não foi confirmado que este é o currículo usado nas candidaturas.',
    );
  const measuredPages = Number.isInteger(doc.pageCount) && doc.pageCount! > 0;
  if (!measuredPages) report.limitations.push('Não há contagem de páginas confiável.');
  if (!input.archetype)
    report.limitations.push(
      'A estrutura do currículo ainda não foi definida para avaliar o limite de páginas.',
    );
  if (input.archetype === 'B_CAREER_CHANGE' && input.longCareer === undefined)
    report.limitations.push(
      'Sem confirmação de carreira longa, o limite de uma ou duas páginas para transição permanece indefinido.',
    );
  const evidence = (start: number, end: number): DiagnosticEvidence => {
    const page = doc.pages?.find((p) => start >= p.start && start < p.end)?.page;
    return { start, end, quote: text.slice(start, end), ...(page === undefined ? {} : { page }) };
  };
  const add = (
    code: DiagnosticCode,
    severity: DiagnosticFinding['severity'],
    nature: DiagnosticFinding['nature'],
    start: number,
    end: number,
    title: string,
    explanation: string,
    action: string,
    investigate = false,
    destinations: Array<'standard' | 'ats'> = [],
  ) => {
    report.findings.push({
      version: 1,
      id: `${doc.id}:${doc.hash}:${input.contextVersion}:${code}:${start}:${report.findings.length}`,
      code,
      severity,
      nature,
      documentId: doc.id,
      documentHash: doc.hash,
      evidence: [evidence(start, end)],
      title,
      explanation,
      action,
      investigation: investigate ? { experienceId: null, missingEvidence: action } : null,
      restriction: destinations.length
        ? { documentHash: doc.hash, destinations, correction: action }
        : null,
    });
  };
  for (const match of text.matchAll(/\uFFFD{2,}|\u0000+/gu)) {
    add(
      'UNREADABLE_EXTRACTED_TEXT',
      'CRITICAL',
      'observed',
      match.index,
      match.index + match[0].length,
      'Caracteres ilegíveis no texto extraído',
      'O texto extraído contém caracteres de substituição ou nulos. Não é possível concluir se a origem é o arquivo ou o processo de extração, nem avaliar colunas ou imagens.',
      'Compare com o original e corrija ou reimporte até que o trecho seja legível antes de enviar este arquivo a um sistema de triagem.',
      false,
      ['ats'],
    );
  }
  for (const match of text.matchAll(sensitive)) {
    const ambiguous = /^\d{11}$/.test(match[0]);
    add(
      'UNNECESSARY_PERSONAL_DATA',
      'HIGH',
      ambiguous ? 'hypothesis' : 'observed',
      match.index,
      match.index + match[0].length,
      'Dado pessoal desnecessário no documento',
      ambiguous
        ? 'A sequência tem onze dígitos e pode ser um CPF ou outro número, inclusive um contato. É preciso esclarecer antes de remover.'
        : 'Encontramos um identificador ou campo pessoal que não demonstra competência profissional.',
      ambiguous
        ? 'Confira o que representa esse número. Se for CPF, remova da cópia destinada às candidaturas; preserve contatos úteis.'
        : 'Remova esse dado da cópia destinada às candidaturas.',
      false,
      ambiguous ? [] : ['standard', 'ats'],
    );
  }
  for (const match of text.matchAll(/\p{L}+/gu)) {
    const token = match[0];
    if (legitimate.has(token.toLowerCase())) continue;
    const glued =
      (token.length >= 12 && /\p{Ll}{2}\p{Lu}\p{Ll}/u.test(token)) ||
      /(?:ção|ções|são|mentos?|ência|ância|ura|ista|ário)(?:de|da|do|dos|das|em|no|na|com|para|e)$/iu.test(
        token,
      );
    if (glued)
      add(
        'POSSIBLE_GLUED_WORD',
        'HIGH',
        'hypothesis',
        match.index,
        match.index + token.length,
        'Possível perda de espaços',
        'O trecho pode conter palavras coladas. O texto extraído sozinho não comprova erro no arquivo ou falha em sistemas de triagem.',
        'Compare este trecho com o original e corrija os espaços na origem, se necessário.',
      );
  }
  for (const match of text.matchAll(/(?<!\p{L})(\p{L}{2,})\s+\1(?!\p{L})/giu)) {
    add(
      'REPEATED_TEXT',
      'LOW',
      'observed',
      match.index,
      match.index + match[0].length,
      'Termo repetido em sequência',
      'O texto extraído repete o mesmo termo imediatamente.',
      'Confira se a repetição é necessária e remova a duplicação na origem.',
    );
  }
  for (const match of text.matchAll(/(?:objetivo|candidatura|destinatário)\s*:[^\n]+/giu)) {
    const directed =
      /(?:trabalhar|atuar|ingressar|candidatar[^ ]*)(?:\s+como\s+[^.\n]+?)?\s+(?:n[ao]|para a?|à)\s+(.+)/iu.exec(
        match[0],
      );
    if (!directed) continue;
    const company = directed[1].trim().replace(/[.!]+$/, '');
    if (
      !/^(?:empresa|hospital|clínica|instituto|organização|universidade|escola)\b/iu.test(company)
    )
      continue;
    const mismatch =
      input.target?.company &&
      company.toLocaleLowerCase('pt-BR') !== input.target.company.toLocaleLowerCase('pt-BR');
    add(
      'TARGETED_RESUME',
      'CRITICAL',
      'observed',
      match.index,
      match.index + match[0].length,
      'Documento dirigido a um destinatário específico',
      `O objetivo menciona um destinatário específico${mismatch ? ', diferente da empresa informada para o alvo atual' : ''}. Isso não define este arquivo como currículo padrão.`,
      'Remova a destinação específica antes de reutilizar como currículo padrão, ou mantenha esta versão identificada para seu destinatário.',
      false,
      ['standard'],
    );
  }
  for (const match of text.matchAll(
    /(?:domínio\s+(?:completo|total|avançado)|especialista em[^.\n]*|responsável por toda[^.\n]*|lider(?:ei|ou|ava)\s+tod[ao]\s+(?:a|o)\s+\p{L}+|\d+(?:[.,]\d+)?%|alta (?:confiabilidade|disponibilidade)|baixa latência)/giu,
  )) {
    add(
      'SCOPE_NEEDS_SUPPORT',
      'HIGH',
      'hypothesis',
      match.index,
      match.index + match[0].length,
      'Declaração de escopo a esclarecer',
      'A expressão declara domínio, escala ou resultado sem explicar neste trecho a participação e as condições. Isso não prova exagero nem falsidade.',
      'Conte um exemplo concreto, sua participação e os limites desse resultado; revise a expressão se ela não representar o que fez.',
      true,
    );
  }
  for (const match of text.matchAll(
    /^(?:habilidades|competências|ferramentas|stack)\s*:\s*([^\n]+)/gimu,
  )) {
    const rest = (
      text.slice(0, match.index) + text.slice(match.index + match[0].length)
    ).toLocaleLowerCase('pt-BR');
    let offset = match.index + match[0].indexOf(match[1]);
    for (const item of match[1].split(/[,;|]/)) {
      const skill = item.trim();
      if (skill && !rest.includes(skill.toLocaleLowerCase('pt-BR'))) {
        const start = offset + item.indexOf(skill);
        add(
          'SKILL_NEEDS_EXAMPLE',
          'HIGH',
          'hypothesis',
          start,
          start + skill.length,
          'Habilidade sem exemplo localizado',
          'A habilidade aparece nesta lista, mas não localizamos o mesmo termo fora dela. Pode haver experiência não descrita ou outro vocabulário; isso não prova falta de competência.',
          'Relate uma situação em que usou essa habilidade ou revise sua inclusão.',
          true,
        );
      }
      offset += item.length + 1;
    }
  }
  const intervals: Array<{ start: number; end: number; offset: number; length: number }> = [];
  for (const match of text.matchAll(dateRange)) {
    const start = monthBounds(match[1]);
    const current = /^(?:atual|presente)$/iu.test(match[2]);
    const end = current ? [input.nowMonth, input.nowMonth] : monthBounds(match[2]);
    if (
      !start ||
      !end ||
      end[1] < start[0] ||
      start[0] > input.nowMonth ||
      end[0] > input.nowMonth
    ) {
      add(
        'DATES_NEED_CLARIFICATION',
        'MEDIUM',
        'observed',
        match.index,
        match.index + match[0].length,
        'Datas a esclarecer',
        'Não foi possível interpretar este período com segurança.',
        'Confira as datas e informe mês e ano quando lembrar; não é preciso inventar datas.',
        true,
      );
      continue;
    }
    intervals.push({ start: start[0], end: end[1], offset: match.index, length: match[0].length });
  }
  intervals.sort((a, b) => a.start - b.start || b.end - a.end);
  let previous: (typeof intervals)[number] | undefined;
  for (const interval of intervals) {
    if (previous && interval.start > previous.end + 1) {
      const months = interval.start - previous.end - 1;
      add(
        'CHRONOLOGY_INTERVAL',
        interval.start >= input.nowMonth - 12 ? 'HIGH' : 'MEDIUM',
        'observed',
        previous.offset,
        previous.offset + previous.length,
        'Intervalo entre períodos registrados',
        `Há pelo menos ${months} mês(es) entre os períodos registrados (${monthLabel(previous.end + 1)} a ${monthLabel(interval.start - 1)}). Isso não prova desemprego: experiências podem ter sido omitidas.`,
        'Confira os períodos e, se quiser, conte atividades formais, informais, estudos ou outros contextos desse intervalo.',
        true,
      );
      report.findings[report.findings.length - 1].evidence.push(
        evidence(interval.offset, interval.offset + interval.length),
      );
    }
    if (!previous || interval.end > previous.end) previous = interval;
  }
  for (const experience of input.experiences ?? []) {
    const start = text.indexOf(experience.quote);
    if (
      start < 0 ||
      !experience.quote ||
      (experience.start && (experience.end || experience.current === true))
    )
      continue;
    add(
      'DATES_NEED_CLARIFICATION',
      'MEDIUM',
      'observed',
      start,
      start + experience.quote.length,
      'Período sem datas suficientes',
      'A estrutura disponível desta experiência não informa um período completo. Isso não permite concluir que houve intervalo de trabalho.',
      'Esclareça o período e se a atividade continua; datas desconhecidas podem permanecer desconhecidas.',
      true,
    );
    report.findings[report.findings.length - 1].investigation!.experienceId = experience.id;
  }
  if (measuredPages && input.archetype) {
    const limit =
      ['A_FIRST_JOB', 'C_OPERATIONAL'].includes(input.archetype) ||
      (input.archetype === 'B_CAREER_CHANGE' && input.longCareer === false)
        ? 1
        : 2;
    if (doc.pageCount! > limit)
      add(
        'EXCESS_PAGES',
        'MEDIUM',
        'observed',
        0,
        0,
        'Páginas acima da estrutura escolhida',
        `O parser mediu ${doc.pageCount} páginas; a estrutura disponível admite até ${limit}. A paginação não comprova problemas de layout.`,
        'Revise conteúdos repetidos ou menos relevantes para o alvo antes de preparar a próxima versão.',
      );
  }
  report.findings.sort(
    (a, b) => priority[a.severity] - priority[b.severity] || a.id.localeCompare(b.id),
  );
  return report;
}
function monthLabel(month: number): string {
  return `${String((month % 12) + 1).padStart(2, '0')}/${Math.floor(month / 12)}`;
}
/** Original-document restrictions are never inherited by a newly generated artifact. */
export function exportRestrictions(
  report: DiagnosticReport,
  hash: string,
  destination: 'standard' | 'ats',
): DiagnosticFinding[] {
  return report.findings.filter(
    (f) => f.restriction?.documentHash === hash && f.restriction.destinations.includes(destination),
  );
}

export function diagnosticTopics(s: Session): Topic[] {
  const pending = new Set(s.pending.map((p) => p.diagnosticFindingId));
  return (s.diagnostics ?? []).flatMap((report) =>
    report.findings
      .filter((f) => f.investigation && pending.has(f.id))
      .map((f) => ({
        id: `diagnostic:${f.id}`,
        diagnosticFindingId: f.id,
        criterionId: null,
        experienceId: f.investigation!.experienceId,
        missingEvidence: f.investigation!.missingEvidence,
        reason: f.explanation,
        impact: f.severity === 'HIGH' ? 2 : 1,
        uncertainty: f.nature === 'hypothesis' ? 3 : 2,
        relevance: 1,
      })),
  );
}
