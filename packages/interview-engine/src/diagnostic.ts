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
  rulesVersion: number;
  contextVersion: string;
  sourceVersion?: string;
  status: 'absent' | 'available';
  document: DiagnosticDocument | null;
  findings: DiagnosticFinding[];
  limitations: string[];
}

export const DIAGNOSTIC_RULES_VERSION = 2 as const;

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
// Separate fixed-prefix patterns avoid overlapping optional whitespace and large alternations.
const sensitivePatterns = [
  /\bCPF[ \t]{0,16}:?[ \t]{0,16}\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/giu,
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/gu,
  /\b(?:RG|registro geral)[ \t]{0,16}[:-]?[ \t]{0,16}\d[\d. -]*/giu,
  /(?:estado civil|data de nascimento|nascimento|filiação|nome do pai|nome da mãe)[ \t]{0,16}:[^\n]*/giu,
];
const scopePatterns = [
  /domínio[ \t]{1,16}(?:completo|total|avançado)/giu,
  /especialista em[^.\n]*/giu,
  /responsável por toda[^.\n]*/giu,
  /lider(?:ei|ou|ava)[ \t]{1,16}tod[ao][ \t]{1,16}[ao][ \t]{1,16}\p{L}+/giu,
  /\b\d{1,12}(?:[.,]\d{1,12})?%/gu,
  /alta (?:confiabilidade|disponibilidade)/giu,
  /baixa latência/giu,
];
const dateToken = String.raw`(?:\d{2}/\d{4}|\d{4}-\d{2}|\d{4})`;
const dateRange = new RegExp(
  String.raw`(${dateToken})\s*(?:[-–—]|a|até)\s*(${dateToken}|atual|presente)`,
  'giu',
);

/** Prefer the labelled match when its numeric portion also matches the generic pattern. */
function sensitiveMatches(text: string): RegExpExecArray[] {
  const matches = sensitivePatterns.flatMap((pattern) => [...text.matchAll(pattern)]);
  matches.sort((a, b) => a.index - b.index);
  let end = -1;
  return matches.filter((match) => {
    if (match.index < end) return false;
    end = match.index + match[0].length;
    return true;
  });
}

/** Linear scan: no control character in a regex and no retrying a failed long suffix. */
function* unreadableMatches(text: string) {
  let start = 0;
  while (start < text.length) {
    const code = text.charCodeAt(start);
    if (code !== 0 && code !== 0xfffd) {
      start++;
      continue;
    }
    let end = start + 1;
    while (text.charCodeAt(end) === code) end++;
    if (code === 0 || end - start >= 2) yield { index: start, 0: text.slice(start, end) };
    start = end;
  }
}

function directedCompany(value: string): string | null {
  const words = value.trim().split(/\s+/u);
  const normalized = words.map((word) => word.toLocaleLowerCase('pt-BR'));
  const verb = words.findIndex((word) =>
    /^(?:trabalhar|atuar|ingressar|candidatar[\p{L}-]*)$/iu.test(word),
  );
  if (verb < 0) return null;
  const prep = normalized.findIndex(
    (word, index) => index > verb && ['na', 'no', 'para', 'à'].includes(word),
  );
  if (prep < 0) return null;
  const article = normalized[prep] === 'para' && normalized[prep + 1] === 'a';
  const company = words
    .slice(prep + (article ? 2 : 1))
    .join(' ')
    .replace(/[.!]+$/, '');
  return company;
}

/** Month bounds preserve the uncertainty of year-only dates. */
function monthBounds(value: string): [number, number] | null {
  const yearOnly = /^\d{4}$/.test(value);
  const parts = value.split(/[-/]/).map(Number);
  const year = value.includes('/') ? parts[1] : parts[0];
  const month = value.includes('/') ? parts[0] : parts[1];
  if (year < 1900 || year > 2100 || (!yearOnly && (month < 1 || month > 12))) return null;
  return yearOnly ? [year * 12, year * 12 + 11] : [year * 12 + month - 1, year * 12 + month - 1];
}

interface FindingSpec extends Pick<
  DiagnosticFinding,
  'code' | 'severity' | 'nature' | 'title' | 'explanation' | 'action'
> {
  start: number;
  end: number;
  investigate?: boolean;
  destinations?: Array<'standard' | 'ats'>;
}
interface RuleContext {
  input: DiagnosticInput;
  doc: DiagnosticDocument;
  report: DiagnosticReport;
  add: (spec: FindingSpec) => DiagnosticFinding;
  evidence: (start: number, end: number) => DiagnosticEvidence;
}
interface Interval {
  start: number;
  end: number;
  offset: number;
  length: number;
}
function hasMeasuredPages(doc: DiagnosticDocument): boolean {
  return Number.isInteger(doc.pageCount) && doc.pageCount! > 0;
}
function addLimitations({ input, doc, report }: RuleContext): void {
  report.limitations.push('Não avaliamos o layout visual deste documento.');
  if (doc.usedInApplications !== 'yes')
    report.limitations.push(
      'Ainda não foi confirmado que este é o currículo usado nas candidaturas.',
    );
  const measuredPages = hasMeasuredPages(doc);
  if (!measuredPages) report.limitations.push('Não há contagem de páginas confiável.');
  if (!input.archetype)
    report.limitations.push(
      'A estrutura do currículo ainda não foi definida para avaliar o limite de páginas.',
    );
  if (input.archetype === 'B_CAREER_CHANGE' && input.longCareer === undefined)
    report.limitations.push(
      'Sem confirmação de carreira longa, o limite de uma ou duas páginas para transição permanece indefinido.',
    );
}
function createContext(
  input: DiagnosticInput,
  doc: DiagnosticDocument,
  report: DiagnosticReport,
): RuleContext {
  const evidence = (start: number, end: number): DiagnosticEvidence => {
    const page = doc.pages?.find((p) => start >= p.start && start < p.end)?.page;
    return {
      start,
      end,
      quote: doc.text.slice(start, end),
      ...(page === undefined ? {} : { page }),
    };
  };
  const add = ({
    code,
    severity,
    nature,
    start,
    end,
    title,
    explanation,
    action,
    investigate = false,
    destinations = [],
  }: FindingSpec): DiagnosticFinding => {
    const finding: DiagnosticFinding = {
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
    };
    report.findings.push(finding);
    return finding;
  };
  return { input, doc, report, add, evidence };
}
function unreadableFindings(ctx: RuleContext) {
  const { doc, add } = ctx;
  const { text } = doc;
  for (const match of unreadableMatches(text)) {
    add({
      code: 'UNREADABLE_EXTRACTED_TEXT',
      severity: 'CRITICAL',
      nature: 'observed',
      start: match.index,
      end: match.index + match[0].length,
      title: 'Caracteres ilegíveis no texto extraído',
      explanation:
        'O texto extraído contém caracteres de substituição ou nulos. Não é possível concluir se a origem é o arquivo ou o processo de extração, nem avaliar colunas ou imagens.',
      action:
        'Compare com o original e corrija ou reimporte até que o trecho seja legível antes de enviar este arquivo a um sistema de triagem.',
      investigate: false,
      destinations: ['ats'],
    });
  }
}
function sensitiveFindings(ctx: RuleContext) {
  const { doc, add } = ctx;
  const { text } = doc;
  for (const match of sensitiveMatches(text)) {
    const ambiguous = /^\d{11}$/.test(match[0]);
    add({
      code: 'UNNECESSARY_PERSONAL_DATA',
      severity: 'HIGH',
      nature: ambiguous ? 'hypothesis' : 'observed',
      start: match.index,
      end: match.index + match[0].length,
      title: 'Dado pessoal desnecessário no documento',
      explanation: ambiguous
        ? 'A sequência tem onze dígitos e pode ser um CPF ou outro número, inclusive um contato. É preciso esclarecer antes de remover.'
        : 'Encontramos um identificador ou campo pessoal que não demonstra competência profissional.',
      action: ambiguous
        ? 'Confira o que representa esse número. Se for CPF, remova da cópia destinada às candidaturas; preserve contatos úteis.'
        : 'Remova esse dado da cópia destinada às candidaturas.',
      investigate: false,
      destinations: ambiguous ? [] : ['standard', 'ats'],
    });
  }
}
function parsingFindings(ctx: RuleContext) {
  const { doc, add } = ctx;
  const { text } = doc;
  for (const match of text.matchAll(/\p{L}+/gu)) {
    const token = match[0];
    if (legitimate.has(token.toLowerCase())) continue;
    const glued =
      (token.length >= 12 && /\p{Ll}{2}\p{Lu}\p{Ll}/u.test(token)) ||
      /(?:ção|ções|são|mentos?|ência|ância|ura|ista|ário)(?:de|da|do|dos|das|em|no|na|com|para|e)$/iu.test(
        token,
      );
    if (glued)
      add({
        code: 'POSSIBLE_GLUED_WORD',
        severity: 'HIGH',
        nature: 'hypothesis',
        start: match.index,
        end: match.index + token.length,
        title: 'Possível perda de espaços',
        explanation:
          'O trecho pode conter palavras coladas. O texto extraído sozinho não comprova erro no arquivo ou falha em sistemas de triagem.',
        action: 'Compare este trecho com o original e corrija os espaços na origem, se necessário.',
      });
  }
  for (const match of text.matchAll(/(?<!\p{L})(\p{L}{2,})\s+\1(?!\p{L})/giu)) {
    add({
      code: 'REPEATED_TEXT',
      severity: 'LOW',
      nature: 'observed',
      start: match.index,
      end: match.index + match[0].length,
      title: 'Termo repetido em sequência',
      explanation: 'O texto extraído repete o mesmo termo imediatamente.',
      action: 'Confira se a repetição é necessária e remova a duplicação na origem.',
    });
  }
}
function targetFindings(ctx: RuleContext) {
  const { doc, input, add } = ctx;
  const { text } = doc;
  for (const match of text.matchAll(/(?:objetivo|candidatura|destinatário)[ \t]{0,16}:[^\n]+/giu)) {
    const company = directedCompany(match[0]);
    if (company === null) continue;
    if (
      !/^(?:empresa|hospital|clínica|instituto|organização|universidade|escola)\b/iu.test(company)
    )
      continue;
    const mismatch =
      input.target?.company &&
      company.toLocaleLowerCase('pt-BR') !== input.target.company.toLocaleLowerCase('pt-BR');
    add({
      code: 'TARGETED_RESUME',
      severity: 'CRITICAL',
      nature: 'observed',
      start: match.index,
      end: match.index + match[0].length,
      title: 'Documento dirigido a um destinatário específico',
      explanation: `O objetivo menciona um destinatário específico${mismatch ? ', diferente da empresa informada para o alvo atual' : ''}. Isso não define este arquivo como currículo padrão.`,
      action:
        'Remova a destinação específica antes de reutilizar como currículo padrão, ou mantenha esta versão identificada para seu destinatário.',
      investigate: false,
      destinations: ['standard'],
    });
  }
}
function scopeFindings(ctx: RuleContext) {
  const { doc, add } = ctx;
  const { text } = doc;
  for (const match of scopePatterns.flatMap((pattern) => [...text.matchAll(pattern)])) {
    add({
      code: 'SCOPE_NEEDS_SUPPORT',
      severity: 'HIGH',
      nature: 'hypothesis',
      start: match.index,
      end: match.index + match[0].length,
      title: 'Declaração de escopo a esclarecer',
      explanation:
        'A expressão declara domínio, escala ou resultado sem explicar neste trecho a participação e as condições. Isso não prova exagero nem falsidade.',
      action:
        'Conte um exemplo concreto, sua participação e os limites desse resultado; revise a expressão se ela não representar o que fez.',
      investigate: true,
    });
  }
}
function skillFindings(ctx: RuleContext) {
  const { doc, add } = ctx;
  const { text } = doc;
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
        add({
          code: 'SKILL_NEEDS_EXAMPLE',
          severity: 'HIGH',
          nature: 'hypothesis',
          start: start,
          end: start + skill.length,
          title: 'Habilidade sem exemplo localizado',
          explanation:
            'A habilidade aparece nesta lista, mas não localizamos o mesmo termo fora dela. Pode haver experiência não descrita ou outro vocabulário; isso não prova falta de competência.',
          action: 'Relate uma situação em que usou essa habilidade ou revise sua inclusão.',
          investigate: true,
        });
      }
      offset += item.length + 1;
    }
  }
}
function readIntervals(ctx: RuleContext) {
  const { doc, input, add } = ctx;
  const { text } = doc;
  const intervals: Interval[] = [];
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
      add({
        code: 'DATES_NEED_CLARIFICATION',
        severity: 'MEDIUM',
        nature: 'observed',
        start: match.index,
        end: match.index + match[0].length,
        title: 'Datas a esclarecer',
        explanation: 'Não foi possível interpretar este período com segurança.',
        action:
          'Confira as datas e informe mês e ano quando lembrar; não é preciso inventar datas.',
        investigate: true,
      });
      continue;
    }
    intervals.push({ start: start[0], end: end[1], offset: match.index, length: match[0].length });
  }

  return intervals;
}
function chronologyFindings(ctx: RuleContext) {
  const { input, add, evidence } = ctx;
  const intervals = readIntervals(ctx);
  intervals.sort((a, b) => a.start - b.start || b.end - a.end);
  let previous: (typeof intervals)[number] | undefined;
  for (const interval of intervals) {
    if (previous && interval.start > previous.end + 1) {
      const months = interval.start - previous.end - 1;
      add({
        code: 'CHRONOLOGY_INTERVAL',
        severity: interval.start >= input.nowMonth - 12 ? 'HIGH' : 'MEDIUM',
        nature: 'observed',
        start: previous.offset,
        end: previous.offset + previous.length,
        title: 'Intervalo entre períodos registrados',
        explanation: `Há pelo menos ${months} mês(es) entre os períodos registrados (${monthLabel(previous.end + 1)} a ${monthLabel(interval.start - 1)}). Isso não prova desemprego: experiências podem ter sido omitidas.`,
        action:
          'Confira os períodos e, se quiser, conte atividades formais, informais, estudos ou outros contextos desse intervalo.',
        investigate: true,
      });
      ctx.report.findings
        .at(-1)!
        .evidence.push(evidence(interval.offset, interval.offset + interval.length));
    }
    if (!previous || interval.end > previous.end) previous = interval;
  }
}
function experienceFindings(ctx: RuleContext) {
  const { doc, input, add } = ctx;
  const { text } = doc;
  for (const experience of input.experiences ?? []) {
    const start = text.indexOf(experience.quote);
    if (
      start < 0 ||
      !experience.quote ||
      (experience.start && (experience.end || experience.current === true))
    )
      continue;
    add({
      code: 'DATES_NEED_CLARIFICATION',
      severity: 'MEDIUM',
      nature: 'observed',
      start: start,
      end: start + experience.quote.length,
      title: 'Período sem datas suficientes',
      explanation:
        'A estrutura disponível desta experiência não informa um período completo. Isso não permite concluir que houve intervalo de trabalho.',
      action:
        'Esclareça o período e se a atividade continua; datas desconhecidas podem permanecer desconhecidas.',
      investigate: true,
    });
    ctx.report.findings.at(-1)!.investigation!.experienceId = experience.id;
  }
}
function pageFindings(ctx: RuleContext) {
  const { doc, input, add } = ctx;
  const measuredPages = hasMeasuredPages(doc);
  if (measuredPages && input.archetype) {
    const limit =
      ['A_FIRST_JOB', 'C_OPERATIONAL'].includes(input.archetype) ||
      (input.archetype === 'B_CAREER_CHANGE' && input.longCareer === false)
        ? 1
        : 2;
    if (doc.pageCount! > limit)
      add({
        code: 'EXCESS_PAGES',
        severity: 'MEDIUM',
        nature: 'observed',
        start: 0,
        end: 0,
        title: 'Páginas acima da estrutura escolhida',
        explanation: `O parser mediu ${doc.pageCount} páginas; a estrutura disponível admite até ${limit}. A paginação não comprova problemas de layout.`,
        action:
          'Revise conteúdos repetidos ou menos relevantes para o alvo antes de preparar a próxima versão.',
      });
  }
}
export function diagnoseDocument(input: DiagnosticInput): DiagnosticReport {
  const doc = input.document;
  const report: DiagnosticReport = {
    version: 1,
    rulesVersion: DIAGNOSTIC_RULES_VERSION,
    contextVersion: input.contextVersion,
    status: doc ? 'available' : 'absent',
    document: doc,
    findings: [],
    limitations: [],
  };
  if (!doc) return report;
  const ctx = createContext(input, doc, report);
  addLimitations(ctx);
  unreadableFindings(ctx);
  sensitiveFindings(ctx);
  parsingFindings(ctx);
  targetFindings(ctx);
  scopeFindings(ctx);
  skillFindings(ctx);
  chronologyFindings(ctx);
  experienceFindings(ctx);
  pageFindings(ctx);
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
