import type { Session, Turn } from './contracts';
import { interviewState } from './interview';
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
