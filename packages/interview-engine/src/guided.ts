import type { Session, Topic, Turn } from './contracts';
import { replan, recordTurn, equalInputs } from './engine';
import { incorporateBlock, discovery, type InterviewBlockResult } from './interview';
import { KNOWLEDGE_VERSION } from './resume-knowledge';
import { preserveNegativeAnswer } from './negative-answer';
import {
  emptyTimeline,
  syncTimeline,
  timelineFinished,
  timelineQuestion,
  normalizeTimelineTurn,
  afterTimelineAnswer,
  contextualFollowup,
} from './timeline';
export function startGuided(s: Session): Session {
  if (s.guided?.status === 'complete' && s.selection && !validEngineSelection(s))
    return { ...s, phase: 'interview', guided: { ...s.guided, status: 'interview' } };
  if (s.guided)
    return s.guided.status === 'complete' || s.guided.timeline
      ? s
      : { ...s, guided: { ...s.guided, timeline: syncTimeline(s) } };
  return {
    ...s,
    phase: s.phase === 'ready' ? 'ready' : 'interview',
    interruption: null,
    guided: {
      version: 1,
      status: s.phase === 'ready' ? 'complete' : 'interview',
      maxAnswers: 12,
      activeLimitMs: 480000,
      activeMs: 0,
      answered: [],
      timeline: emptyTimeline(),
      clarification: null,
    },
  };
}
export function guidedQuestion(s: Session): { topic: Topic; text: string } | null {
  const g = s.guided!;
  if (
    g.status !== 'interview' ||
    g.stopRequested ||
    g.answered.length >= g.maxAnswers ||
    g.activeMs >= g.activeLimitMs
  )
    return null;
  if (g.clarification)
    return {
      topic: g.clarification.topic,
      text: contextualFollowup(s, g.clarification.topic.id, g.clarification.question),
    };
  return timelineQuestion(s);
}
export function guidedAnswer(s: Session, turn: Turn): Session {
  const question = guidedQuestion(s);
  if (!question || turn.question.topicId !== question.topic.id) throw new Error('INVALID_TURN');
  turn = normalizeTimelineTurn(turn);
  const next = recordTurn(
    { ...s, phase: 'interview', plan: { ...replan(s), topics: [question.topic] } },
    {
      ...turn,
      decision: {
        kind: s.guided!.clarification ? 'clarify' : 'ask',
        reason: question.topic.reason,
        criterionId: question.topic.criterionId,
        experienceId: question.topic.experienceId,
      },
    },
  );
  const updated: Session = {
    ...next,
    selection: s.selection ? { ...s.selection, valid: false } : null,
    guided: {
      ...s.guided!,
      answered: [...s.guided!.answered, question.topic.id],
      clarification: null,
      stopRequested:
        turn.answer.kind === 'declined' &&
        /^(?:quero\s+)?(?:parar|encerrar)[.!]?$/i.test(turn.answer.text.trim()),
    },
  };
  updated.guided!.timeline = afterTimelineAnswer(updated, turn, !!s.guided!.clarification);
  return preserveNegativeAnswer(updated, turn, question.topic);
}
export function selectedFactIds(s: Session): string[] {
  return s.selection?.facts.map((f) => f.id) ?? s.confirmation?.factIds ?? [];
}
export function validEngineSelection(s: Session): boolean {
  const selected = s.selection;
  return (
    !!selected?.valid &&
    equalInputs(selected.inputs, s.inputs) &&
    selected.facts.length > 0 &&
    selected.knowledgeVersion === KNOWLEDGE_VERSION &&
    selected.rulesVersion === 1 &&
    selected.facts.every((v) =>
      s.facts.some(
        (f) =>
          f.id === v.id &&
          f.revision === v.revision &&
          f.origin.sourceVersion === v.originVersion &&
          f.usable &&
          f.confirmation !== 'rejected' &&
          !s.pending.some((p) => p.blocking && p.factIds.includes(f.id)) &&
          !s.links.some((l) => l.status === 'contradiction' && l.factIds.includes(f.id)),
      ),
    )
  );
}
function grounded(s: Session, id: string): boolean {
  const fact = s.facts.find((f) => f.id === id)!;
  const origin = fact.origin;
  return (
    !!origin.quote.trim() &&
    (s.sources.some(
      (src) =>
        src.id === origin.sourceId &&
        src.version === origin.sourceVersion &&
        src.text.includes(origin.quote),
    ) ||
      s.turns.some(
        (t) =>
          t.id === origin.sourceId &&
          (t.answer.text.includes(origin.quote) || (!t.answer.text && t.factIds.includes(id))),
      ) ||
      (origin.sourceId === `edit:${id}` && origin.quote === fact.text))
  );
}
export function completeGuided(s: Session): Session {
  const conflicts = new Set([
    ...s.pending.filter((p) => p.blocking).flatMap((p) => p.factIds),
    ...s.links.filter((l) => l.status === 'contradiction').flatMap((l) => l.factIds),
  ]);
  const eligible = s.facts.filter(
    (f) => f.usable && f.confirmation !== 'rejected' && !conflicts.has(f.id) && grounded(s, f.id),
  );
  const ranked = eligible
    .map((f) => ({ fact: f, score: s.links.filter((l) => l.factIds.includes(f.id)).length }))
    .sort((a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id))
    .slice(0, 10)
    .map((item) => item.fact);
  const ids = new Set(ranked.map((f) => f.id));
  const selection = {
    id: 'engine-selection',
    kind: 'engine' as const,
    version: (s.selection?.version ?? 0) + 1,
    inputs: { ...s.inputs },
    dependencies: ['resumes', 'job', 'objective', 'facts'],
    valid: !s.guided!.timeline || timelineFinished(s),
    knowledgeVersion: KNOWLEDGE_VERSION,
    rulesVersion: 1,
    facts: ranked.map((f) => ({
      id: f.id,
      revision: f.revision,
      originVersion: f.origin.sourceVersion,
      reason: s.links.some((l) => l.factIds.includes(f.id))
        ? 'Evidência declarada relacionada à vaga.'
        : 'Experiência declarada com origem preservada.',
    })),
    excluded: s.facts
      .filter((f) => !ids.has(f.id))
      .map((f) => ({
        id: f.id,
        reason: conflicts.has(f.id)
          ? 'Informação conflitante.'
          : 'Sem lastro utilizável ou fora da seleção.',
      })),
  };
  const complete = !!s.objective && ranked.length > 0 && selection.valid;
  return {
    ...s,
    selection,
    phase: complete ? 'ready' : 'interview',
    interruption: null,
    guided: { ...s.guided!, status: complete ? 'complete' : 'partial' },
    stories: complete ? s.stories.map((story) => ({ ...story, text: '' })) : s.stories,
    turns: complete
      ? s.turns.map((turn) => ({ ...turn, answer: { ...turn.answer, text: '' } }))
      : s.turns,
  };
}

export function applyGuidedBlock(
  s: Session,
  result: InterviewBlockResult,
  turnIds: string[],
  hash: string,
): Session {
  if (
    [...result.extraction.facts, ...result.extraction.experiences].some((f) =>
      s.turns.some((t) => t.id === f.origin.sourceId && t.answer.kind === 'absence'),
    )
  )
    throw new Error('NEGATIVE_ANSWER_IS_NOT_A_FACT');
  const next = incorporateBlock(s, result, turnIds, hash);
  next.guided!.timeline = syncTimeline(next);
  const followup = result.assessments.find(
    (a) => !a.sufficient && a.question && next.interview!.topics[a.topicId].noGain < 2,
  );
  if (followup) {
    const decision = s.turns.find((t) => t.question.topicId === followup.topicId)?.decision;
    next.guided = {
      ...next.guided!,
      clarification: {
        topic: {
          ...discovery,
          id: followup.topicId,
          criterionId: decision?.criterionId ?? null,
          experienceId: decision?.experienceId ?? null,
        },
        question: followup.question!,
      },
    };
  }
  return next;
}
