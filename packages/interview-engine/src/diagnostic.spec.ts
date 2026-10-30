import * as diagnostics from './diagnostic';

// All documents in this suite are synthetic; no candidate data.
const document = (text: string): diagnostics.DiagnosticDocument => ({
  id: 'synthetic-resume',
  hash: 'a'.repeat(64),
  text,
  usedInApplications: 'unknown',
});
const run = (text: string, extra: Partial<diagnostics.DiagnosticInput> = {}) =>
  diagnostics.diagnoseDocument({
    document: document(text),
    contextVersion: 'b'.repeat(64),
    nowMonth: 2026 * 12 + 9,
    ...extra,
  });

describe('versioned document diagnosis', () => {
  it('returns absence rather than a fictitious diagnosis', () => {
    expect(
      diagnostics.diagnoseDocument({ document: null, contextVersion: 'none', nowMonth: 0 }),
    ).toMatchObject({ status: 'absent', findings: [] });
  });
  it('locates synthetic sensitive data and gives an action without claiming competence', () => {
    const report = run('CPF: 123.456.789-09');
    expect(report.status).toBe('available');
    expect(report.findings[0]).toMatchObject({
      code: 'UNNECESSARY_PERSONAL_DATA',
      nature: 'observed',
      documentId: 'synthetic-resume',
      documentHash: 'a'.repeat(64),
      action: expect.any(String),
      evidence: [{ start: 0, end: 19, quote: 'CPF: 123.456.789-09' }],
    });
    expect(report.limitations).toContain('Não avaliamos o layout visual deste documento.');
  });
  it('treats glued words as a hypothesis, and repetition as an observation', () => {
    const report = run('Experiênciade atendimento atendimento com TypeScript e DevOps.');
    expect(report.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'POSSIBLE_GLUED_WORD',
          nature: 'hypothesis',
          restriction: null,
        }),
        expect.objectContaining({ code: 'REPEATED_TEXT', nature: 'observed' }),
      ]),
    );
    expect(report.findings.map((f) => f.evidence[0].quote).join(' ')).not.toMatch(
      /TypeScript|DevOps/,
    );
  });
  it('restricts a targeted original only for standard reuse, never an employer in history', () => {
    const report = run('Objetivo: trabalhar na Empresa Aurora\nExperiência: Empresa Antiga', {
      target: { company: 'Empresa Boreal' },
    });
    expect(report.findings[0]).toMatchObject({
      code: 'TARGETED_RESUME',
      severity: 'CRITICAL',
      restriction: { destinations: ['standard'], documentHash: 'a'.repeat(64) },
    });
    expect(run('Experiência: Empresa Aurora').findings).toEqual([]);
  });
  it('measures full months between recorded intervals without claiming unemployment', () => {
    const report = run('01/2023 - 02/2023 Loja\n04/2023 - 09/2023 Mercado');
    const gap = report.findings.find((f) => f.code === 'CHRONOLOGY_INTERVAL')!;
    expect(gap.explanation).toContain('1 mês');
    expect(gap.explanation).toContain('não prova desemprego');
    expect(gap.investigation).not.toBeNull();
  });
  it('never infers gaps from missing dates or pages from plain text', () => {
    expect(run('Experiência em atendimento').findings).toEqual([]);
    expect(run('2023 - 2024 Loja\n2024 - atual Mercado').findings).toEqual([]);
    expect(run('Experiência em atendimento').limitations).toContain(
      'Não há contagem de páginas confiável.',
    );
  });
  it('flags broad unsupported declarations only as hypotheses', () => {
    const report = run('Domínio completo de toda a operação.\nHabilidades: Excel; Python');
    expect(report.findings.filter((f) => f.nature === 'hypothesis')).toHaveLength(3);
    expect(report.findings.every((f) => f.restriction === null)).toBe(true);
  });
  it('checks measured pages only against a known archetype', () => {
    const doc = { ...document('Atendimento'), pageCount: 3 };
    expect(run(doc.text, { document: doc, archetype: 'C_OPERATIONAL' }).findings[0]).toMatchObject({
      code: 'EXCESS_PAGES',
      nature: 'observed',
    });
    expect(run(doc.text, { document: doc }).findings).toEqual([]);
  });
  it('never transfers an original restriction to a different document hash or destination', () => {
    const report = run('Objetivo: trabalhar na Empresa Aurora');
    expect(diagnostics.exportRestrictions(report, 'a'.repeat(64), 'standard')).toHaveLength(1);
    expect(diagnostics.exportRestrictions(report, 'c'.repeat(64), 'standard')).toEqual([]);
    expect(diagnostics.exportRestrictions(report, 'a'.repeat(64), 'ats')).toEqual([]);
  });
});

import {
  attachDiagnostics,
  createSession,
  replan,
  changeInput,
  applyCommand,
  resolveDiagnosticFinding,
} from './engine';
describe('diagnostic integration with the existing session', () => {
  const session = () =>
    createSession('session', 'funnel', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
  it('adds only nonblocking investigation topics and no confirmed facts', () => {
    const report = run('Domínio completo');
    const updated = attachDiagnostics(session(), [report]);
    expect(updated.pending).toEqual([
      expect.objectContaining({ blocking: false, diagnosticFindingId: report.findings[0].id }),
    ]);
    expect(replan(updated).topics[0]).toMatchObject({
      criterionId: null,
      diagnosticFindingId: report.findings[0].id,
    });
    expect(updated.facts).toEqual([]);
    expect(updated.phase).toBe('preparation');
  });
  it('is idempotent and preserves resolved investigations until inputs change', () => {
    const report = run('Domínio completo');
    const updated = attachDiagnostics(session(), [report]);
    const resolved = resolveDiagnosticFinding(updated, report.findings[0].id);
    expect(attachDiagnostics(resolved, [report])).toBe(resolved);
    expect(replan(resolved).topics).toEqual([]);
    expect(() => resolveDiagnosticFinding(resolved, 'missing')).toThrow(
      'DIAGNOSTIC_FINDING_NOT_FOUND',
    );
    const changed = {
      ...report,
      contextVersion: 'new',
      findings: report.findings.map((f) => ({ ...f, id: 'new' })),
    };
    expect(attachDiagnostics(resolved, [changed]).pending).toHaveLength(1);
  });
  it('invalidates old findings and only their pending records when target/material/objective changes', () => {
    const updated = attachDiagnostics(session(), [run('Domínio completo')]);
    for (const field of ['resumes', 'job', 'objective'] as const) {
      const changed = changeInput(updated, field, 'new');
      expect(changed.diagnostics).toEqual([]);
      expect(changed.pending).toEqual([]);
    }
    expect(changeInput(updated, 'facts', 'new').diagnostics).toEqual(updated.diagnostics);
    expect(attachDiagnostics(updated, []).pending).toEqual([]);
  });
  it('uses the existing command revision and hash conflict rules', () => {
    const original = session();
    const action = (s: typeof original) => attachDiagnostics(s, [run('Domínio completo')]);
    const updated = applyCommand(original, 'diagnostic', 'hash', 0, action);
    expect(applyCommand(updated, 'diagnostic', 'hash', 0, action)).toBe(updated);
    expect(() => applyCommand(updated, 'diagnostic', 'other', 1, action)).toThrow(
      'IDEMPOTENCY_CONFLICT',
    );
  });
});

it('does not restrict a career objective as though it named another company', () => {
  expect(
    run('Objetivo: atuar na área de vendas', { target: { company: 'Aurora' } }).findings,
  ).toEqual([]);
});
it('locates unreadable extracted characters without inferring a visual layout', () => {
  const report = run('Atendimento \uFFFD\uFFFD\uFFFD clientes');
  expect(report.findings[0]).toMatchObject({
    code: 'UNREADABLE_EXTRACTED_TEXT',
    nature: 'observed',
    severity: 'CRITICAL',
    restriction: { destinations: ['ats'] },
  });
});

it.each([
  ['CPF 12345678909', 'UNNECESSARY_PERSONAL_DATA'],
  ['RG: 12.345.678', 'UNNECESSARY_PERSONAL_DATA'],
  ['estado civil: solteira', 'UNNECESSARY_PERSONAL_DATA'],
  ['nascimento: 01/01/1990', 'UNNECESSARY_PERSONAL_DATA'],
  ['filiação: pessoa sintética', 'UNNECESSARY_PERSONAL_DATA'],
  ['ExperiênciaProfissional no atendimento', 'POSSIBLE_GLUED_WORD'],
  ['13/2023 - 02/2024', 'DATES_NEED_CLARIFICATION'],
  ['2023-00 - 2024-01', 'DATES_NEED_CLARIFICATION'],
  ['1899 - 2020', 'DATES_NEED_CLARIFICATION'],
  ['2101 - 2102', 'DATES_NEED_CLARIFICATION'],
  ['2024 - 2023', 'DATES_NEED_CLARIFICATION'],
  ['2027 - 2028', 'DATES_NEED_CLARIFICATION'],
  ['2020 - 2028', 'DATES_NEED_CLARIFICATION'],
])('handles a synthetic pattern %s', (text, code) => {
  expect(run(text).findings.some((f) => f.code === code)).toBe(true);
});
it('merges overlapping periods and conservatively bounds year-only dates', () => {
  expect(
    run('01/2020 - 12/2024\n01/2020 - 12/2020\n02/2020 - 03/2021\n2023 - atual').findings,
  ).toEqual([]);
  expect(
    run('2020 - 2021\n2023 - 2024').findings.find((f) => f.code === 'CHRONOLOGY_INTERVAL')!
      .explanation,
  ).toContain('12 mês');
  expect(run('01/2026 - 02/2026\n04/2026 - presente').findings[0].severity).toBe('HIGH');
});
it('handles pages, usage, optional structure and source-local date clarifications', () => {
  const doc = {
    ...document('Atendeu clientes\nAtividade atual\nEncerrada'),
    usedInApplications: 'yes' as const,
    pageCount: 2,
    pages: [
      { page: 1, start: 0, end: 16 },
      { page: 2, start: 17, end: 50 },
    ],
  };
  const experiences = [
    { id: 'missing', quote: 'Atendeu clientes', start: null, end: null, current: null },
    { id: 'unknown-end', quote: 'Encerrada', start: '2023', end: null, current: false },
    { id: 'active', quote: 'Atividade atual', start: '2024', end: null, current: true },
    { id: 'complete', quote: 'Encerrada', start: '2020', end: '2023', current: false },
    { id: 'not-local', quote: 'Outra fonte', start: null, end: null, current: null },
    { id: 'empty', quote: '', start: null, end: null, current: null },
  ];
  const report = run(doc.text, { document: doc, experiences, archetype: 'B_CAREER_CHANGE' });
  expect(report.findings.filter((f) => f.code === 'DATES_NEED_CLARIFICATION')).toHaveLength(2);
  expect(report.findings[0].evidence[0].page).toBeDefined();
  expect(report.findings[1].evidence[0].page).toBeDefined();
  expect(
    run(doc.text, { document: doc, archetype: 'B_CAREER_CHANGE', longCareer: false }).findings[0]
      .code,
  ).toBe('EXCESS_PAGES');
  expect(
    run(doc.text, { document: doc, archetype: 'B_CAREER_CHANGE', longCareer: true }).findings,
  ).toEqual([]);
  expect(run(doc.text, { document: doc, archetype: 'D_SAME_FIELD_RETURN' }).findings).toEqual([]);
  expect(run(doc.text, { document: { ...doc, pageCount: 0 } }).limitations).toContain(
    'Não há contagem de páginas confiável.',
  );
});
it('avoids legitimate terms, repeated skill mentions and generic target prose', () => {
  expect(
    run('Objetivo: atendimento ao cliente\nHabilidades: Excel, ; Python\nUsei Excel e Python.')
      .findings,
  ).toEqual([]);
  expect(
    run('Objetivo: trabalhar na Empresa Aurora', { target: { company: 'Empresa Aurora' } })
      .findings[0].explanation,
  ).not.toContain('diferente');
});
it('keeps unrelated pending items and builds/resolves diagnostics in an existing plan', () => {
  const s = createSession('s', 'f', { resumes: '', job: '', objective: '', facts: '' });
  s.pending = [{ id: 'other', criterionId: null, factIds: [], reason: 'other', blocking: false }];
  s.plan = replan(s);
  const report = run('01/2020 - 02/2020\n04/2020 - 05/2020\nDomínio completo\nCPF 12345678909');
  const attached = attachDiagnostics(s, [report]);
  expect(attached.plan!.topics).toHaveLength(2);
  const resolved = resolveDiagnosticFinding(
    attached,
    report.findings.find((f) => f.code === 'CHRONOLOGY_INTERVAL')!.id,
  );
  expect(resolved.plan!.topics).toHaveLength(1);
  expect(attachDiagnostics(attached, []).pending).toEqual(s.pending);
  // Same reports with additional unrelated entries must not reopen resolved investigations.
  const extra = { ...run('Atendimento'), contextVersion: 'extra' };
  expect(attachDiagnostics(resolved, [report, extra]).plan!.topics).toHaveLength(1);
});
it('cannot resolve a finding in a legacy session without diagnostics', () => {
  expect(() =>
    resolveDiagnosticFinding(
      createSession('s', 'f', { resumes: '', job: '', objective: '', facts: '' }),
      'missing',
    ),
  ).toThrow('DIAGNOSTIC_FINDING_NOT_FOUND');
});
it('does not declare an unlabelled eleven-digit contact number to be an unnecessary CPF', () => {
  const finding = run('11999999999').findings[0];
  expect(finding).toMatchObject({ nature: 'hypothesis', restriction: null });
});
it('finds a named destination after the intended role and broad scope claims', () => {
  expect(run('Objetivo: atuar como enfermeira no Hospital Aurora').findings[0]).toMatchObject({
    code: 'TARGETED_RESUME',
    severity: 'CRITICAL',
  });
  expect(
    run('Liderei toda a arquitetura e aumentei a produtividade em 900%.').findings.filter(
      (f) => f.code === 'SCOPE_NEEDS_SUPPORT',
    ),
  ).toHaveLength(2);
});

import { analysis as syntheticAnalysis, extraction as syntheticExtraction } from './fixtures';
import { prepare, decideFact, transition, confirm, canWrite } from './engine';
it('keeps critical original restrictions separate from interview and confirmation permissions', () => {
  let session = createSession('s', 'f', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
  session.objective = { value: 'ENTER_FAST', provisional: false };
  session = prepare(session, syntheticExtraction, syntheticAnalysis);
  session = attachDiagnostics(session, [
    run('Objetivo: trabalhar na Empresa Aurora\n\uFFFD\uFFFD\nDomínio completo'),
  ]);
  expect(session.plan!.topics.length).toBeGreaterThan(0);
  session = decideFact(session, 'f', 'confirmed', true, 'confirmed-hash');
  session = transition(session, 'confirmation');
  session = confirm(session, ['f']);
  expect(canWrite(session)).toBe(true);
  expect(transition(session, 'ready').phase).toBe('ready');
  expect(session.diagnostics![0].findings.filter((f) => f.severity === 'CRITICAL')).toHaveLength(2);
});
it('keeps distinct investigations identifiable even when their literal quotes coincide', () => {
  const missing = { id: 'one', quote: 'Atendimento', start: null, end: null, current: null };
  const report = run('Atendimento', { experiences: [missing, { ...missing, id: 'two' }] });
  expect(new Set(report.findings.map((f) => f.id)).size).toBe(2);
});
