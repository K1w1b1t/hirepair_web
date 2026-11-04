import type { Session, Turn } from './contracts';
import type { InterviewBlockRequest } from './block';
import type { InterviewBlockResult } from './interview';
import type { ResumeDraft } from './writing';
import {
  startGuided,
  guidedQuestion,
  guidedAnswer,
  applyGuidedBlock,
  completeGuided,
} from './guided';
import { discovery } from './interview';
import { pendingInterviewTurns } from './pending-turns';
import { applyCommand, canWrite } from './engine';

export interface JourneyAdapter {
  answer(question: string, topicId: string, index: number): Promise<Turn['answer']>;
  block(request: InterviewBlockRequest): Promise<InterviewBlockResult>;
  write(session: Session): Promise<ResumeDraft>;
}
export interface JourneyTrace {
  turns: Array<{ question: string; answer: string; topicId: string }>;
  session: Session;
  document: ResumeDraft | null;
  failure: 'provider-or-budget' | null;
}
export async function runJourney(
  initial: Session,
  targetRole: string,
  jobText: string,
  adapter: JourneyAdapter,
): Promise<JourneyTrace> {
  const trace: JourneyTrace = {
    session: startGuided(initial),
    turns: [],
    document: null,
    failure: null,
  };
  const commit = (command: (s: Session) => Session) => {
    const id = `eval-command-${trace.session.revision}`;
    trace.session = applyCommand(trace.session, id, id, trace.session.revision, command);
  };
  try {
    for (;;) {
      const s = trace.session;
      const question = guidedQuestion(s);
      const pending = pendingInterviewTurns(s);
      const repeated = pending.some(
        (t) => s.guided!.answered.filter((id) => id === t.question.topicId).length > 1,
      );
      if (
        pending.length &&
        (pending.length >= 3 ||
          !question ||
          repeated ||
          pending.some((t) => t.answer.kind === 'absence'))
      ) {
        const turns = pending.slice(0, 3);
        const topics = [
          ...new Map(
            turns.map((t) => [
              t.question.topicId,
              {
                ...discovery,
                id: t.question.topicId,
                missingEvidence: t.question.text,
                experienceId: t.decision!.experienceId,
                criterionId: t.decision!.criterionId,
                reason: t.decision!.reason,
              },
            ]),
          ).values(),
        ];
        const request: InterviewBlockRequest = {
          version: 1,
          sessionId: s.id,
          funnelSessionId: s.funnelSessionId,
          revision: s.revision,
          inputsHash: 'journey-eval-v1',
          objective: s.objective!.value,
          targetRole,
          jobText,
          turns: turns.map((t) => ({
            id: t.id,
            topicId: t.question.topicId,
            text: t.answer.text,
            kind: t.answer.kind,
          })),
          topics,
          context: {
            experiences: s.experiences,
            facts: s.facts
              .filter((f) => f.confirmation !== 'rejected')
              .map(({ id, experienceId, text, origin }) => ({ id, experienceId, text, origin })),
          },
        };
        const result = await adapter.block(request);
        commit((current) =>
          applyGuidedBlock(
            current,
            result,
            turns.map((t) => t.id),
            `journey-eval-${s.revision}`,
          ),
        );
        continue;
      }
      if (!question) break;
      const answer = await adapter.answer(question.text, question.topic.id, s.turns.length);
      trace.turns.push({
        question: question.text,
        topicId: question.topic.id,
        answer: answer.text,
      });
      commit((current) =>
        guidedAnswer(current, {
          id: `eval-turn-${current.turns.length + 1}`,
          question: { text: question.text, topicId: question.topic.id },
          answer,
          factIds: [],
        }),
      );
    }
    commit(completeGuided);
    if (canWrite(trace.session)) trace.document = await adapter.write(trace.session);
  } catch {
    trace.failure = 'provider-or-budget';
  }
  return trace;
}
