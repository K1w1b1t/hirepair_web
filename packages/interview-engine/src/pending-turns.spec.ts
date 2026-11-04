import { pendingInterviewTurns } from './pending-turns';
import { createSession } from './engine';
import type { Turn } from './contracts';
it('shares the browser eligibility rules, including factual negatives and excluding timeline endings', () => {
  const s = createSession('s', 'f', { resumes: '', job: '', objective: '', facts: '' });
  const turn = (
    id: string,
    topicId: string,
    kind: Turn['answer']['kind'],
    text = 'Resposta',
  ): Turn => ({ id, question: { topicId, text: 'Pergunta' }, answer: { text, kind }, factIds: [] });
  s.turns = [
    turn('specific', 'topic', 'specific'),
    turn('vague', 'topic', 'vague'),
    turn('negative', 'guided:e:tools', 'absence'),
    turn('first', 'guided:first', 'absence'),
    turn('informal', 'guided:first-informal', 'absence'),
    turn('last', 'guided:next:e', 'absence'),
    turn('unknown', 'topic', 'unknown'),
    turn('empty', 'topic', 'specific', ''),
  ];
  expect(pendingInterviewTurns(s).map((t) => t.id)).toEqual(['specific', 'vague', 'negative']);
  s.interview = {
    topics: {},
    analyzedTurnIds: ['specific'],
    activeMs: 0,
    reviewRequested: false,
    limits: { reformulations: 2, turns: 100, answerChars: 10000, activeMs: 1200000 },
  };
  expect(pendingInterviewTurns(s).map((t) => t.id)).toEqual(['vague', 'negative']);
});
