export type FindingKind = 'PARSING' | 'SENSITIVE_DATA' | 'EMBEDDED_IMAGE';
export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface DiagnosticFinding {
  kind: FindingKind;
  severity: FindingSeverity;
  title: string;
  detail: string;
  fact: string;
}

const severityOrder: Record<FindingSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const camelLegitimate = new Set([
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

const camelPattern = /[A-Za-zÀ-ÿ]*[a-zà-ÿ]{2}[A-ZÀ-Þ][a-zà-ÿ][A-Za-zÀ-ÿ]*/g;
const repeatedPattern = /\b([A-Za-zÀ-ÿ]{2,})\s+\1\b/gi;
const gluedFunctionalPattern = /(?:de|da|do|dos|das|em|no|na|com|para|e)[A-ZÀ-Þ]/;
const nominalSuffixes = [
  'ção',
  'ções',
  'são',
  'mento',
  'mentos',
  'ência',
  'ância',
  'ura',
  'ista',
  'ário',
];
const prepositions = ['de', 'da', 'do', 'dos', 'das', 'em', 'no', 'na', 'com', 'para', 'e'];

const sensitivePatterns: Array<[RegExp, string]> = [
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, 'CPF'],
  [/\bRG\b|\bregistro geral\b/i, 'RG'],
  [/estado civil/i, 'estado civil'],
  [/data de nascimento|nascimento\s*:|\bnascid[oa]\b/i, 'data de nascimento'],
  [/filia[çc][ãa]o|nome do pai|nome da m[ãa]e/i, 'filiação'],
];

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function appearsGlued(token: string): boolean {
  if (camelLegitimate.has(token.toLowerCase())) return false;
  return token.length >= 16 || (token.length >= 12 && gluedFunctionalPattern.test(token));
}

function parsingFindings(text: string): DiagnosticFinding[] {
  const glued = [...text.matchAll(camelPattern)].map((match) => match[0]).filter(appearsGlued);

  for (const token of text.match(/\b[A-Za-zÀ-ÿ]{8,}\b/g) ?? []) {
    const lower = token.toLowerCase();
    const preposition = prepositions.find((value) => lower.endsWith(value));
    if (!preposition) continue;
    const root = lower.slice(0, -preposition.length);
    if (root.length >= 7 && nominalSuffixes.some((suffix) => root.endsWith(suffix))) {
      glued.push(token);
    }
  }

  const uniqueGlued = unique(glued);
  const findings: DiagnosticFinding[] = [];
  if (uniqueGlued.length > 0) {
    findings.push({
      kind: 'PARSING',
      severity: 'CRITICAL',
      title: 'Palavras coladas no texto extraído',
      fact: `O texto contém palavras que parecem ter perdido espaços: ${uniqueGlued.join(', ')}.`,
      detail: `Exemplos encontrados: ${uniqueGlued.join(', ')}. Isso costuma derrubar candidatura porque o sistema de triagem pode interpretar o trecho como uma palavra desconhecida.`,
    });
  }

  const repeated = unique([...text.matchAll(repeatedPattern)].map((match) => match[0]));
  if (repeated.length > 0) {
    findings.push({
      kind: 'PARSING',
      severity: 'LOW',
      title: 'Termo repetido em sequência',
      fact: `O texto mostra repetição imediata: ${repeated.join(', ')}.`,
      detail: `Exemplos encontrados: ${repeated.join(', ')}. Isso costuma indicar um erro de digitação que pode tirar clareza da leitura.`,
    });
  }
  return findings;
}

function sensitiveFindings(text: string): DiagnosticFinding[] {
  const found = unique(
    sensitivePatterns.filter(([pattern]) => pattern.test(text)).map(([, label]) => label),
  );
  if (found.length === 0) return [];
  return [
    {
      kind: 'SENSITIVE_DATA',
      severity: 'HIGH',
      title: 'Dado pessoal desnecessário no documento',
      fact: `O parser encontrou: ${found.join(', ')}.`,
      detail: `Encontrado: ${found.join(', ')}. Esse dado não ajuda a aferir competência, ocupa espaço de palavras-chave e aumenta sua exposição sem necessidade.`,
    },
  ];
}

export function sortDiagnosticFindings(findings: DiagnosticFinding[]): DiagnosticFinding[] {
  return [...findings].sort(
    (first, second) => severityOrder[first.severity] - severityOrder[second.severity],
  );
}

export function diagnoseResumeText(text: string): DiagnosticFinding[] {
  return sortDiagnosticFindings([...parsingFindings(text), ...sensitiveFindings(text)]);
}
