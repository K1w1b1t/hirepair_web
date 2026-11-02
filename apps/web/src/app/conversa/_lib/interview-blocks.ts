import {
  applyGuidedBlock,
  discovery,
  INTERVIEW_PAYLOAD_LIMIT,
  interviewState,
  type InterviewBlockRequest,
  type InterviewBlockResult,
  type Session,
  type Turn,
} from '@hirepair/interview-engine';
import { sanitizeMaterial } from './sanitize-material';
import type { JobDraft } from './job-analysis';
export interface BlockPlan {
  request: InterviewBlockRequest | null;
  chunks: Array<{ id: string; topicId: string; end: number; complete: boolean }>;
  pendingCount: number;
  deferred: boolean;
  blocked: boolean;
}
export function pendingInterviewTurns(s: Session): Turn[] {
  const analyzed = new Set(interviewState(s).analyzedTurnIds);
  return s.turns.filter(
    (t) =>
      !analyzed.has(t.id) &&
      !!t.answer.text &&
      (['specific', 'vague'].includes(t.answer.kind) ||
        (t.answer.kind === 'absence' &&
          t.question.topicId !== 'guided:first' &&
          t.question.topicId !== 'guided:first-informal' &&
          !t.question.topicId.startsWith('guided:next:'))),
  );
}
export function planInterviewBlock(
  s: Session,
  draft: JobDraft,
  inputsHash: string,
  limit = INTERVIEW_PAYLOAD_LIMIT,
): BlockPlan {
  const pending = pendingInterviewTurns(s),
    state = interviewState(s);
  if (!pending.length)
    return { request: null, chunks: [], pendingCount: 0, deferred: false, blocked: false };
  const base: InterviewBlockRequest = {
    version: 1,
    sessionId: s.id,
    funnelSessionId: s.funnelSessionId,
    revision: s.revision,
    inputsHash,
    objective: s.objective!.value,
    jobText: sanitizeMaterial(draft.hasJob ? draft.jobText : ''),
    targetRole: sanitizeMaterial(draft.targetRole),
    turns: [],
    topics: [],
    context: {
      experiences: s.experiences.map(({ id, title, start, end, current, origin }) => ({
        id,
        title,
        start,
        end,
        current,
        origin,
      })),
      facts: s.facts
        .filter((f) => f.confirmation !== 'rejected')
        .map(({ id, experienceId, text, origin }) => ({ id, experienceId, text, origin })),
    },
  };
  const chunks: BlockPlan['chunks'] = [];
  let request = base,
    blocked = false;
  for (const turn of pending.slice(0, 3)) {
    const offset = state.analyzedCharacters?.[turn.id] ?? 0;
    const text = sanitizeMaterial(turn.answer.text).slice(offset);
    const withText = (value: string): InterviewBlockRequest => ({
      ...request,
      turns: [
        ...request.turns,
        { id: turn.id, topicId: turn.question.topicId, text: value, kind: turn.answer.kind },
      ],
      topics: request.topics.some((t) => t.id === turn.question.topicId)
        ? request.topics
        : [
            ...request.topics,
            {
              ...discovery,
              id: turn.question.topicId,
              missingEvidence: turn.question.text,
              criterionId: turn.decision?.criterionId ?? null,
              experienceId: turn.decision?.experienceId ?? null,
              reason: turn.decision?.reason ?? discovery.reason,
            },
          ],
    });
    let segment = text;
    if (JSON.stringify(withText(segment)).length > limit) {
      if (chunks.length) break;
      const points = Array.from(text);
      let low = 0,
        high = points.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (JSON.stringify(withText(points.slice(0, middle).join(''))).length <= limit)
          low = middle;
        else high = middle - 1;
      }
      segment = points.slice(0, low).join('');
      if (!segment) {
        blocked = true;
        break;
      }
    }
    request = withText(segment);
    chunks.push({
      id: turn.id,
      topicId: turn.question.topicId,
      end: offset + segment.length,
      complete: segment.length === text.length,
    });
    if (segment.length < text.length) break;
  }
  return {
    request: chunks.length ? request : null,
    chunks,
    pendingCount: pending.length,
    deferred: chunks.length < pending.length || chunks.some((c) => !c.complete),
    blocked,
  };
}
export function applyInterviewBlockPlan(
  s: Session,
  result: InterviewBlockResult,
  plan: BlockPlan,
  hash: string,
): Session {
  const incomplete = new Set(plan.chunks.filter((c) => !c.complete).map((c) => c.topicId));
  const next = applyGuidedBlock(
    s,
    { ...result, assessments: result.assessments.filter((a) => !incomplete.has(a.topicId)) },
    plan.chunks.map((c) => c.id),
    hash,
  );
  const state = interviewState(next),
    offsets = { ...state.analyzedCharacters };
  for (const chunk of plan.chunks) {
    if (chunk.complete) delete offsets[chunk.id];
    else offsets[chunk.id] = chunk.end;
  }
  next.interview = {
    ...state,
    analyzedCharacters: offsets,
    analyzedTurnIds: state.analyzedTurnIds.filter(
      (id) => !plan.chunks.some((c) => c.id === id && !c.complete),
    ),
  };
  return next;
}
