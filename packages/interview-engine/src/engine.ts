import type {
  Session,
  Inputs,
  Plan,
  Phase,
  EvidenceLink,
  Extraction,
  CriteriaAnalysis,
  Strategy,
  Fact,
  GroundedContent,
  Topic,
} from './contracts';
import { diagnosticTopics, type DiagnosticReport } from './diagnostic';
export function createSession(id: string, funnelSessionId: string, inputs: Inputs): Session {
  return {
    version: 1,
    id,
    funnelSessionId,
    revision: 0,
    phase: 'preparation',
    objective: null,
    inputs,
    sources: [],
    experiences: [],
    stories: [],
    facts: [],
    criteria: [],
    links: [],
    turns: [],
    pending: [],
    plan: null,
    strategy: null,
    confirmation: null,
    content: null,
    interruption: null,
    commands: [],
  };
}
const transitions: Record<Phase, Phase[]> = {
  preparation: ['interview'],
  interview: ['confirmation'],
  confirmation: ['interview', 'ready'],
  ready: ['interview', 'writing'],
  writing: ['interview'],
};
export function canWrite(s: Session): boolean {
  return (
    !!s.objective &&
    !!s.confirmation?.valid &&
    equalInputs(s.confirmation.inputs, s.inputs) &&
    s.confirmation.factIds.length > 0 &&
    s.confirmation.factIds.every((id) =>
      s.facts.some((f) => f.id === id && f.confirmation === 'confirmed' && f.usable),
    ) &&
    !s.pending.some((p) => p.blocking) &&
    !s.links.some((l) => l.status === 'contradiction') &&
    !s.interruption
  );
}
export function equalInputs(a: Inputs, b: Inputs): boolean {
  return (
    a.resumes === b.resumes && a.job === b.job && a.objective === b.objective && a.facts === b.facts
  );
}
export function transition(s: Session, phase: Phase): Session {
  if (!transitions[s.phase].includes(phase) || s.interruption)
    throw new Error('INVALID_TRANSITION');
  if (!s.objective) throw new Error('OBJECTIVE_REQUIRED');
  if ((phase === 'ready' || phase === 'writing') && !canWrite(s))
    throw new Error('EVIDENCE_REQUIRED');
  return { ...s, phase };
}
export function interrupt(
  s: Session,
  kind: 'paused' | 'budget_exhausted' | 'partial',
  reason: string,
): Session {
  if (!reason.trim()) throw new Error('REASON_REQUIRED');
  return { ...s, interruption: { kind, reason, resumePhase: s.phase } };
}
export function resume(s: Session): Session {
  return { ...s, interruption: null };
}
export function evidenceStatus(link: EvidenceLink, facts: Fact[]): EvidenceLink['status'] {
  if (link.status === 'declared_absence' || link.status === 'contradiction') {
    if (!link.declarationTurnId) throw new Error('DECLARATION_REQUIRED');
    return link.status;
  }
  const linked = link.factIds
    .map((id) => {
      const fact = facts.find((f) => f.id === id && f.experienceId === link.experienceId);
      if (!fact) throw new Error('INVALID_REFERENCE');
      return fact;
    })
    .filter((f) => f.confirmation !== 'rejected');
  if (!linked.length) return 'unknown';
  return linked.every((f) => f.confirmation === 'confirmed') ? 'confirmed' : 'candidate';
}
const criterionImpact = { ELIMINATORY: 3, NEGOTIABLE: 2, DECORATIVE: 1 };
export function replan(s: Session): Plan {
  const topics: Topic[] = s.criteria.flatMap((criterion) => {
    const links = s.links.filter((link) => link.criterionId === criterion.id);
    const candidates: Array<EvidenceLink | null> = links.length ? links : [null];
    return candidates.flatMap((link) => {
      const status = link ? evidenceStatus(link, s.facts) : 'unknown';
      if (status === 'confirmed' || status === 'declared_absence') return [];
      return [
        {
          id: `topic:${criterion.id}:${link?.experienceId ?? 'unknown'}`,
          criterionId: criterion.id,
          experienceId: link?.experienceId ?? null,
          missingEvidence: criterion.evidenceNeeded,
          reason:
            status === 'contradiction'
              ? 'Precisamos esclarecer relatos diferentes antes de usar esta informação.'
              : criterion.reason,
          impact: status === 'contradiction' ? 3 : criterionImpact[criterion.category],
          uncertainty: status === 'candidate' ? 2 : 3,
          relevance: criterion.relevance,
        },
      ];
    });
  });
  topics.push(...diagnosticTopics(s));
  topics.sort(
    (a, b) =>
      b.impact - a.impact ||
      b.uncertainty - a.uncertainty ||
      b.relevance - a.relevance ||
      a.id.localeCompare(b.id),
  );
  return {
    id: 'plan',
    version: (s.plan?.version ?? 0) + 1,
    inputs: { ...s.inputs },
    dependencies: ['resumes', 'job', 'objective', 'facts'],
    valid: true,
    topics,
  };
}
export function changeInput(s: Session, input: keyof Inputs, value: string): Session {
  if (s.inputs[input] === value) return s;
  const invalidate = <T extends { valid: boolean; dependencies: string[] }>(
    item: T | null,
  ): T | null => item && { ...item, valid: item.valid && !item.dependencies.includes(input) };
  return {
    ...s,
    inputs: { ...s.inputs, [input]: value },
    revision: s.revision + 1,
    phase: input === 'facts' ? 'interview' : 'preparation',
    plan: invalidate(s.plan),
    strategy: invalidate(s.strategy),
    confirmation: invalidate(s.confirmation),
    content: invalidate(s.content),
    criteria: input === 'job' ? [] : s.criteria,
    links: input === 'job' ? [] : s.links,
    ...(input === 'facts'
      ? {}
      : { diagnostics: [], pending: s.pending.filter((p) => !p.diagnosticFindingId) }),
  };
}
export function applyCommand(
  s: Session,
  id: string,
  hash: string,
  revision: number,
  command: (session: Session) => Session,
): Session {
  const previous = s.commands.find((item) => item.id === id);
  if (previous) {
    if (previous.hash !== hash) throw new Error('IDEMPOTENCY_CONFLICT');
    return s;
  }
  if (s.revision !== revision) throw new Error('REVISION_CONFLICT');
  const next = command(structuredClone(s));
  return { ...next, revision: s.revision + 1, commands: [...s.commands, { id, hash }] };
}
const tones: Record<Strategy['archetype'], Strategy['tone']> = {
  A_FIRST_JOB: 'DIRECT',
  B_CAREER_CHANGE: 'CONSULTATIVE',
  C_OPERATIONAL: 'DIRECT',
  D_SAME_FIELD_RETURN: 'NEUTRAL',
  E_SPECIALIST: 'TECHNICAL',
};
export function prepare(s: Session, extraction: Extraction, analysis: CriteriaAnalysis): Session {
  if (s.phase !== 'preparation' || !s.objective) throw new Error('INVALID_PREPARATION');
  const facts: Fact[] = extraction.facts.map((f) => ({
    ...f,
    storyId: null,
    confirmation: 'candidate',
    externallyVerified: false,
    usable: true,
    revision: 1,
  }));
  const updated: Session = {
    ...s,
    experiences: extraction.experiences,
    facts,
    criteria: analysis.criteria,
    links: analysis.links,
    phase: 'interview',
    strategy: {
      id: 'strategy',
      version: (s.strategy?.version ?? 0) + 1,
      inputs: { ...s.inputs },
      dependencies: ['resumes', 'job', 'objective', 'facts'],
      valid: true,
      archetype: analysis.archetype,
      tone: tones[analysis.archetype],
      reason: analysis.reason,
      formula: analysis.archetype === 'C_OPERATIONAL' ? 'SCOPE_COMPLIANCE' : 'CAR',
    },
  };
  return { ...updated, plan: replan(updated) };
}
export function confirm(s: Session, factIds: string[]): Session {
  if (
    s.phase !== 'confirmation' ||
    !factIds.length ||
    new Set(factIds).size !== factIds.length ||
    factIds.some(
      (id) => !s.facts.some((f) => f.id === id && f.confirmation === 'confirmed' && f.usable),
    )
  )
    throw new Error('INVALID_CONFIRMATION');
  return {
    ...s,
    stories: s.stories.map((story) => ({ ...story, text: '' })),
    turns: s.turns.map((turn) => ({ ...turn, answer: { ...turn.answer, text: '' } })),
    confirmation: {
      id: 'confirmation',
      version: (s.confirmation?.version ?? 0) + 1,
      inputs: { ...s.inputs },
      dependencies: ['resumes', 'job', 'objective', 'facts'],
      valid: true,
      factIds,
    },
  };
}
export function validateContent(s: Session, content: GroundedContent): void {
  if (
    !['ready', 'writing'].includes(s.phase) ||
    !canWrite(s) ||
    !content.valid ||
    !equalInputs(content.inputs, s.inputs) ||
    !content.sections.length ||
    content.sections.some(
      (section) =>
        !section.text.trim() ||
        !section.factIds.length ||
        section.factIds.some((id) => !s.confirmation!.factIds.includes(id)),
    )
  )
    throw new Error('UNGROUNDED_CONTENT');
}
export function recordTurn(s: Session, turn: import('./contracts').Turn): Session {
  if (
    s.phase !== 'interview' ||
    s.interruption ||
    !turn.id.trim() ||
    !turn.question.text.trim() ||
    !turn.answer.text.trim() ||
    !s.plan?.valid ||
    !s.plan.topics.some((t) => t.id === turn.question.topicId) ||
    turn.factIds.some((id) => !s.facts.some((f) => f.id === id)) ||
    s.turns.length >= 100 ||
    turn.answer.text.length > 10_000
  )
    throw new Error('INVALID_TURN');
  const old = s.turns.find((t) => t.id === turn.id);
  if (old) {
    const signature = (item: import('./contracts').Turn) =>
      JSON.stringify([
        item.id,
        item.question.text,
        item.question.topicId,
        item.answer.kind,
        item.answer.text,
        item.factIds,
      ]);
    if (signature(old) !== signature(turn)) throw new Error('IDEMPOTENCY_CONFLICT');
    return s;
  }
  return {
    ...s,
    turns: [...s.turns, { ...turn, recordedAt: turn.recordedAt ?? Date.now() }],
    plan: replan(s),
  };
}
export function decideFact(
  s: Session,
  id: string,
  confirmation: Fact['confirmation'],
  usable: boolean,
  factsHash: string,
): Session {
  if (
    !['interview', 'confirmation'].includes(s.phase) ||
    !s.facts.some((f) => f.id === id) ||
    !['candidate', 'confirmed', 'rejected'].includes(confirmation) ||
    typeof usable !== 'boolean' ||
    !factsHash ||
    factsHash === s.inputs.facts
  )
    throw new Error('INVALID_FACT_DECISION');
  const updated = changeInput(s, 'facts', factsHash);
  updated.facts = s.facts.map((f) =>
    f.id === id ? { ...f, confirmation, usable, revision: f.revision + 1 } : f,
  );
  updated.links = updated.links.map((link) => ({
    ...link,
    status: evidenceStatus(link, updated.facts),
  }));
  updated.plan = replan(updated);
  return updated;
}
/** Preserve the original confirmed history even when a new extraction reuses an ID. */
export function mergeHistory(previous: Session, incoming: Session): Session {
  const next = structuredClone(incoming);
  for (const source of previous.sources)
    if (!next.sources.some((item) => item.id === source.id && item.version === source.version))
      next.sources.push(source);
  const experienceIds = new Map<string, string>();
  next.experiences = next.experiences.map((experience) => {
    const old = previous.experiences.find((item) => item.id === experience.id);
    if (!old || JSON.stringify(old) === JSON.stringify(experience)) return experience;
    const id = `${experience.id.slice(0, 30)}:${incoming.inputs.resumes.slice(0, 16)}`;
    experienceIds.set(experience.id, id);
    return { ...experience, id };
  });
  const factIds = new Map<string, string>();
  next.facts = next.facts.map((fact) => {
    const original = previous.facts.find((item) => item.id === fact.id);
    const experienceId = experienceIds.get(fact.experienceId) ?? fact.experienceId;
    const sameFact = (item: Fact) =>
      item.text === fact.text &&
      JSON.stringify(item.origin) === JSON.stringify(fact.origin) &&
      item.experienceId === experienceId;
    let id = fact.id;
    if (original && !sameFact(original))
      id = `${fact.id.slice(0, 30)}:${incoming.inputs.resumes.slice(0, 16)}`;
    const old = previous.facts.find((item) => item.id === id);
    if (id !== fact.id) factIds.set(fact.id, id);
    if (old && sameFact(old)) return old;
    return { ...fact, id, experienceId };
  });
  for (const experience of previous.experiences)
    if (!next.experiences.some((item) => item.id === experience.id))
      next.experiences.push(experience);
  for (const fact of previous.facts)
    if (!next.facts.some((item) => item.id === fact.id)) next.facts.push(fact);
  next.links = next.links.map((link) => ({
    ...link,
    experienceId:
      link.experienceId === null
        ? null
        : (experienceIds.get(link.experienceId) ?? link.experienceId),
    factIds: link.factIds.map((id) => factIds.get(id) ?? id),
  }));
  next.turns = previous.turns;
  next.stories = previous.stories;
  next.commands = previous.commands;
  next.revision = previous.revision + 1;
  return next;
}
/** Policy contract only: #15 executes the action and presents the actual question. */
export function nextAction(s: Session): import('./contracts').NextAction {
  if (s.interruption) return { version: 1, kind: 'stop', reason: s.interruption.reason };
  if (s.phase === 'preparation')
    return {
      version: 1,
      kind: 'prepare',
      reason: 'Preparar evidências e critérios para o alvo declarado.',
    };
  if ((s.phase === 'ready' || s.phase === 'writing') && canWrite(s))
    return {
      version: 1,
      kind: 'write',
      confirmationVersion: s.confirmation!.version,
      reason: 'A confirmação vigente permite redigir somente os fatos selecionados.',
    };
  const plan = replan(s);
  if (plan.topics.length)
    return {
      version: 1,
      kind: 'investigate',
      topic: plan.topics[0],
      reason: plan.topics[0].reason,
    };
  const factIds = s.facts.filter((f) => f.confirmation !== 'rejected' && f.usable).map((f) => f.id);
  if (factIds.length)
    return {
      version: 1,
      kind: 'confirm',
      factIds,
      reason: 'Revisar os fatos utilizáveis antes de escrever.',
    };
  return {
    version: 1,
    kind: 'investigate',
    topic: null,
    reason: 'Conhecer uma experiência concreta antes de preparar a confirmação.',
  };
}
/** Raw conversation text expires independently of documents and confirmed facts. */
export function purgeRaw(s: Session, now: number): Session {
  const expired = s.turns
    .filter((turn) => (turn.recordedAt ?? 0) + 30 * 86400000 <= now)
    .map((turn) => turn.id);
  if (!expired.length) return s;
  return {
    ...s,
    turns: s.turns.map((turn) =>
      expired.includes(turn.id) ? { ...turn, answer: { ...turn.answer, text: '' } } : turn,
    ),
    stories: s.stories.map((story) =>
      expired.includes(story.turnId) ? { ...story, text: '' } : story,
    ),
  };
}

/** Apply through applyCommand/saveEngine; diagnosis never promotes candidate facts. */
export function attachDiagnostics(s: Session, reports: DiagnosticReport[]): Session {
  const previous = s.diagnostics ?? [];
  if (JSON.stringify(previous) === JSON.stringify(reports)) return s;
  const preserved = new Set(
    previous
      .filter((old) =>
        reports.some(
          (report) =>
            report.contextVersion === old.contextVersion &&
            report.document?.hash === old.document?.hash,
        ),
      )
      .flatMap((report) => report.findings.map((f) => f.id)),
  );
  const findings = reports.flatMap((report) => report.findings);
  const ids = new Set(findings.map((f) => f.id));
  const pending = s.pending.filter((p) => !p.diagnosticFindingId || ids.has(p.diagnosticFindingId));
  for (const finding of findings) {
    if (
      !finding.investigation ||
      preserved.has(finding.id) ||
      pending.some((p) => p.diagnosticFindingId === finding.id)
    )
      continue;
    pending.push({
      id: `diagnostic:${finding.id}`,
      diagnosticFindingId: finding.id,
      criterionId: null,
      factIds: [],
      reason: finding.explanation,
      blocking: false,
    });
  }
  const updated = { ...s, diagnostics: reports, pending };
  return { ...updated, plan: s.plan ? replan(updated) : null };
}
/** #15 calls this after collecting/reviewing an explanation; it never confirms a fact. */
export function resolveDiagnosticFinding(s: Session, id: string): Session {
  if (!(s.diagnostics ?? []).some((report) => report.findings.some((f) => f.id === id)))
    throw new Error('DIAGNOSTIC_FINDING_NOT_FOUND');
  const updated = { ...s, pending: s.pending.filter((p) => p.diagnosticFindingId !== id) };
  return { ...updated, plan: s.plan ? replan(updated) : null };
}
