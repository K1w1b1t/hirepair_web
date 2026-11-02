import type {
  Session,
  Topic,
  InterviewState,
  TopicProgress,
  NextAction,
  Extraction,
  CriteriaAnalysis,
  Turn,
} from './contracts';
import {
  changeInput,
  replan,
  recordTurn,
  resume,
  transition,
  resolveDiagnosticFinding,
} from './engine';
export const INTERVIEW_LIMITS = {
  reformulations: 2,
  turns: 100,
  answerChars: 10_000,
  activeMs: 20 * 60_000,
};
export function interviewState(s: Session): InterviewState {
  return (
    s.interview ?? {
      topics: {},
      analyzedTurnIds: [],
      activeMs: 0,
      reviewRequested: false,
      limits: { ...INTERVIEW_LIMITS },
    }
  );
}
export const discovery: Topic = {
  id: 'discovery',
  criterionId: null,
  experienceId: null,
  missingEvidence: 'Uma experiência concreta',
  reason: 'Experiências fora do emprego formal também podem ajudar.',
  impact: 1,
  uncertainty: 3,
  relevance: 1,
};
const open = (): TopicProgress => ({ status: 'open', noGain: 0, evidence: [], question: null });
export function interviewAction(s: Session): NextAction {
  const state = interviewState(s);
  const factIds = s.facts.filter((f) => f.usable && f.confirmation !== 'rejected').map((f) => f.id);
  if (state.activeMs >= state.limits.activeMs || s.turns.length >= state.limits.turns)
    return {
      version: 1,
      kind: 'review',
      factIds,
      reason: 'Chegamos ao limite da conversa. Você pode revisar o que já contou e as pendências.',
    };
  if (state.reviewRequested || s.phase === 'confirmation') {
    const selected = s.facts
      .filter((f) => f.usable && f.confirmation === 'confirmed')
      .map((f) => f.id);
    if (
      selected.length &&
      !s.pending.some((p) => p.blocking) &&
      !s.links.some((l) => l.status === 'contradiction')
    )
      return {
        version: 1,
        kind: 'confirm',
        factIds: selected,
        reason: 'Confira e confirme apenas os fatos que você escolheu manter.',
      };
    return {
      version: 1,
      kind: 'review',
      factIds,
      reason: 'Veja o que você quer manter e o que ainda precisa esclarecer.',
    };
  }
  const topics = replan(s).topics;
  const blocking = s.pending.find((p) => p.blocking);
  const conflict =
    (blocking
      ? (topics.find((t) => t.id === blocking.topicId) ?? {
          ...discovery,
          id: blocking.topicId ?? 'discovery',
          reason: blocking.reason,
        })
      : undefined) ??
    topics.find((t) =>
      s.links.some(
        (l) =>
          l.criterionId === t.criterionId &&
          l.experienceId === t.experienceId &&
          l.status === 'contradiction',
      ),
    );
  const topic =
    conflict ??
    [...topics, discovery].find(
      (t) => t.id === state.focusTopicId && state.topics[t.id]?.status === 'open',
    ) ??
    [...topics, discovery].find((t) => !state.topics[t.id] || state.topics[t.id].status === 'open');
  if (!topic)
    return {
      version: 1,
      kind: 'review',
      factIds,
      reason: 'Os blocos foram percorridos. Vamos revisar os fatos e as lacunas.',
    };
  const progress = state.topics[topic.id] ?? open();
  const unanalyzed = s.turns.filter(
    (t) =>
      t.question.topicId === topic.id &&
      !state.analyzedTurnIds.includes(t.id) &&
      ['specific', 'vague'].includes(t.answer.kind),
  );
  if (unanalyzed.length >= 6)
    return {
      version: 1,
      kind: 'review',
      factIds,
      reason: 'Vamos analisar este bloco antes de fazer novas perguntas.',
    };
  const kind = conflict ? 'clarify' : progress.noGain ? 'deepen' : 'ask';
  const question = conflict
    ? 'Você contou versões diferentes. Qual era o período e qual parte você fez pessoalmente?'
    : (progress.question ??
      (topic.id === 'discovery'
        ? 'Conte uma atividade que você fez em um trabalho, na escola, em um projeto ou ajudando alguém.'
        : `Conte uma situação em que você lidou com ${topic.missingEvidence}. O que você fez?`));
  return {
    version: 1,
    kind,
    topic,
    question,
    reason: topic.diagnosticFindingId
      ? 'Vamos conferir um detalhe da sua experiência.'
      : state.focusTopicId === topic.id
        ? `Você pediu para revisitar este tópico. ${topic.reason}`
        : topic.reason,
  };
}
export function startWithoutDocuments(s: Session): Session {
  if (!s.objective || s.sources.length || s.phase !== 'preparation')
    throw new Error('INVALID_PREPARATION');
  const next = transition(s, 'interview');
  return {
    ...next,
    interview: interviewState(next),
    plan: { ...replan(next), topics: [discovery] },
  };
}
export function answerInterview(s: Session, turn: Turn): Session {
  const state = interviewState(s);
  const action = interviewAction(s);
  if (
    !['ask', 'deepen', 'clarify'].includes(action.kind) ||
    !('topic' in action) ||
    !action.topic ||
    action.topic.id !== turn.question.topicId ||
    state.activeMs >= state.limits.activeMs ||
    turn.answer.text.length > state.limits.answerChars ||
    s.turns.length >= state.limits.turns
  )
    throw new Error('INVALID_TURN');
  const topic = action.topic;
  const plan = {
    ...replan(s),
    topics: [...replan(s).topics.filter((t) => t.id !== topic.id), topic],
  };
  const next = recordTurn(
    { ...s, plan },
    {
      ...turn,
      decision: {
        kind: action.kind,
        reason: action.reason,
        criterionId: topic.criterionId,
        experienceId: topic.experienceId,
      },
    },
  );
  const localQuestions = [
    'Onde foi essa atividade e o que você fazia lá?',
    'Em que período você fez essa atividade?',
    'Nessa atividade, qual parte você fazia pessoalmente?',
    'Que ferramentas ou materiais você usava, e com que frequência?',
    'Conte uma dificuldade que apareceu e o que você fez.',
    'O que aconteceu depois, e como você percebeu esse resultado?',
  ];
  const answered = s.turns.filter(
    (t) => t.question.topicId === topic.id && !state.analyzedTurnIds.includes(t.id),
  ).length;
  const progress = state.topics[topic.id] ?? open();
  const terminal = ['absence', 'declined', 'unknown', 'forgotten', 'skipped'].includes(
    turn.answer.kind,
  );
  next.interview = {
    ...state,
    topics: {
      ...state.topics,
      [topic.id]: {
        ...progress,
        status: terminal ? (turn.answer.kind as TopicProgress['status']) : 'open',
        question: localQuestions[Math.min(answered, localQuestions.length - 1)],
      },
    },
  };
  if (terminal) {
    next.pending = [
      ...next.pending,
      {
        id: `topic:${turn.id}`,
        criterionId: topic.criterionId,
        factIds: [],
        reason: `Tópico encerrado: ${turn.answer.kind}.`,
        blocking: false,
      },
    ];
    if (turn.answer.kind === 'absence' && topic.criterionId)
      next.links = [
        ...next.links.filter(
          (l) => !(l.criterionId === topic.criterionId && l.experienceId === topic.experienceId),
        ),
        {
          id: `absence:${turn.id}`,
          criterionId: topic.criterionId,
          experienceId: topic.experienceId,
          factIds: [],
          status: 'declared_absence',
          declarationTurnId: turn.id,
        },
      ];
  }
  return next;
}
export function addActiveTime(s: Session, milliseconds: number): Session {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) throw new Error('INVALID_TIME');
  const state = interviewState(s);
  return { ...s, interview: { ...state, activeMs: state.activeMs + milliseconds } };
}
export function requestReview(s: Session): Session {
  const next = resume(s);
  if (next.phase === 'ready') return next;
  const updated = next.phase === 'interview' ? transition(next, 'confirmation') : next;
  return { ...updated, interview: { ...interviewState(updated), reviewRequested: true } };
}
export function reopenInterview(s: Session, topicId?: string): Session {
  let next = resume(s);
  if (next.phase !== 'interview') next = transition(next, 'interview');
  const state = interviewState(next);
  const topics = { ...state.topics };
  topics[topicId ?? 'discovery'] = open();
  return {
    ...next,
    confirmation: next.confirmation ? { ...next.confirmation, valid: false } : null,
    content: next.content ? { ...next.content, valid: false } : null,
    interview: { ...state, topics, reviewRequested: false, focusTopicId: topicId ?? 'discovery' },
  };
}
export interface BlockAssessment {
  topicId: string;
  sufficient: boolean;
  evidence: string[];
  question: string | null;
  contradictionFactIds: string[];
}
export interface InterviewBlockResult {
  version: 1;
  revision: number;
  extraction: Extraction;
  analysis: CriteriaAnalysis | null;
  assessments: BlockAssessment[];
}
export function incorporateBlock(
  s: Session,
  result: InterviewBlockResult,
  turnIds: string[],
  factsHash: string,
): Session {
  if (
    result.revision !== s.revision ||
    !turnIds.length ||
    turnIds.some((id) => !s.turns.some((t) => t.id === id))
  )
    throw new Error('REVISION_CONFLICT');
  const state = interviewState(s);
  if (turnIds.some((id) => state.analyzedTurnIds.includes(id)))
    throw new Error('BLOCK_ALREADY_ANALYZED');
  const next = changeInput(s, 'facts', factsHash);
  const experiences = result.extraction.experiences;
  next.experiences = [
    ...s.experiences,
    ...experiences.filter((e) => !s.experiences.some((old) => old.id === e.id)),
  ];
  for (const f of result.extraction.facts) {
    if (s.facts.some((old) => old.id === f.id)) throw new Error('DUPLICATE_ID');
    const turn = s.turns.find((t) => t.id === f.origin.sourceId);
    if (!turn || !turnIds.includes(turn.id) || !turn.answer.text.includes(f.origin.quote))
      throw new Error('INVALID_ORIGIN');
    const storyId = `story:${turn.id}:${f.experienceId}`;
    if (!next.stories.some((story) => story.id === storyId))
      next.stories = [
        ...next.stories,
        { id: storyId, turnId: turn.id, experienceId: f.experienceId, text: '' },
      ];
    next.facts = [
      ...next.facts,
      {
        ...f,
        storyId,
        confirmation: 'candidate',
        externallyVerified: false,
        usable: true,
        revision: 1,
      },
    ];
    next.turns = next.turns.map((t) =>
      t.id === turn.id ? { ...t, factIds: [...t.factIds, f.id] } : t,
    );
  }
  if (result.analysis) {
    next.criteria = result.analysis.criteria;
    next.links = result.analysis.links;
  }
  const topics = { ...state.topics };
  for (const assessment of result.assessments) {
    const old = topics[assessment.topicId] ?? open();
    const gain = assessment.evidence.some((e) => !old.evidence.includes(e));
    const noGain = gain ? 0 : old.noGain + 1;
    topics[assessment.topicId] = {
      status: assessment.sufficient
        ? 'sufficient'
        : noGain >= state.limits.reformulations
          ? 'limit'
          : 'open',
      noGain,
      evidence: [...new Set([...old.evidence, ...assessment.evidence])],
      question: assessment.question,
    };
    if (!assessment.sufficient)
      next.pending = [
        ...next.pending.filter((p) => p.id !== `gap:${assessment.topicId}`),
        {
          id: `gap:${assessment.topicId}`,
          criterionId: null,
          factIds: [],
          reason: assessment.question ?? 'Faltam detalhes deste tópico.',
          blocking: false,
        },
      ];
    else {
      next.pending = next.pending.filter((p) => p.id !== `gap:${assessment.topicId}`);
      const diagnosticId = replan(s).topics.find(
        (t) => t.id === assessment.topicId,
      )?.diagnosticFindingId;
      if (diagnosticId) next.pending = resolveDiagnosticFinding(next, diagnosticId).pending;
    }
    if (assessment.contradictionFactIds.length) {
      const ids = assessment.contradictionFactIds;
      if (ids.some((id) => !next.facts.some((f) => f.id === id)))
        throw new Error('INVALID_REFERENCE');
      next.pending = [
        ...next.pending,
        {
          id: `conflict:${assessment.topicId}`,
          topicId: assessment.topicId,
          criterionId: null,
          factIds: ids,
          reason:
            'Precisamos esclarecer o período, o escopo ou a participação antes de usar estes fatos.',
          blocking: true,
        },
      ];
      next.facts = next.facts.map((f) => (ids.includes(f.id) ? { ...f, usable: false } : f));
    }
  }
  next.interview = { ...state, topics, analyzedTurnIds: [...state.analyzedTurnIds, ...turnIds] };
  next.plan = replan(next);
  return next;
}
export function editFact(s: Session, id: string, text: string, factsHash: string): Session {
  const fact = s.facts.find((f) => f.id === id);
  if (!fact || !text.trim() || text.length > 500) throw new Error('INVALID_FACT_EDIT');
  const next = changeInput(s, 'facts', factsHash);
  next.factHistory = [...(s.factHistory ?? []), fact];
  next.facts = s.facts.map((f) =>
    f.id === id
      ? {
          ...f,
          text: text.trim(),
          revision: f.revision + 1,
          confirmation: 'candidate',
          usable: true,
          externallyVerified: false,
          origin: { sourceId: `edit:${id}`, sourceVersion: factsHash, quote: text.trim() },
        }
      : f,
  );
  return next;
}
/** Explicit correction/removal resolves a conflict; never select a model version silently. */
export function resolveFactConflict(s: Session, id: string): Session {
  const pending = s.pending.filter((p) => !(p.blocking && p.factIds.includes(id)));
  const links = s.links.map((l) =>
    l.status === 'contradiction' && l.factIds.includes(id)
      ? { ...l, status: 'unknown' as const, factIds: l.factIds.filter((f) => f !== id) }
      : l,
  );
  return { ...s, pending, links };
}
export function editExperience(
  s: Session,
  id: string,
  patch: { title: string; start: string | null; end: string | null },
  factsHash: string,
): Session {
  if (
    !s.experiences.some((e) => e.id === id) ||
    !patch.title.trim() ||
    patch.title.length > 200 ||
    (patch.start?.length ?? 0) > 40 ||
    (patch.end?.length ?? 0) > 40
  )
    throw new Error('INVALID_EXPERIENCE_EDIT');
  const next = changeInput(s, 'facts', factsHash);
  next.experiences = s.experiences.map((e) =>
    e.id === id
      ? {
          ...e,
          ...patch,
          origin: {
            sourceId: `experience-edit:${id}`,
            sourceVersion: factsHash,
            quote: JSON.stringify(patch),
          },
        }
      : e,
  );
  next.factHistory = [...(s.factHistory ?? []), ...s.facts.filter((f) => f.experienceId === id)];
  next.facts = s.facts.map((f) =>
    f.experienceId === id && f.confirmation !== 'rejected'
      ? { ...f, revision: f.revision + 1, confirmation: 'candidate', externallyVerified: false }
      : f,
  );
  next.plan = replan(next);
  return next;
}
