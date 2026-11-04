import type { Session, Topic, Turn } from './contracts';
import { changeInput, replan } from './engine';
export function preserveNegativeAnswer(s: Session, turn: Turn, topic: Topic): Session {
  if (
    turn.answer.kind !== 'absence' ||
    topic.id === 'guided:first' ||
    topic.id === 'guided:first-informal' ||
    topic.id.startsWith('guided:next:')
  )
    return s;
  const finding = (s.diagnostics ?? [])
    .flatMap((r) => r.findings)
    .find((f) => f.id === topic.diagnosticFindingId);
  const quotes = finding?.evidence
    .map((e) => e.quote.trim().toLocaleLowerCase('pt-BR'))
    .filter(Boolean);
  const linked = s.links
    .filter((l) => l.criterionId === topic.criterionId && l.experienceId === topic.experienceId)
    .flatMap((l) => l.factIds);
  const affected = s.facts
    .filter(
      (f) =>
        f.experienceId === topic.experienceId &&
        f.confirmation !== 'rejected' &&
        (quotes
          ? quotes.some((q) => `${f.text} ${f.origin.quote}`.toLocaleLowerCase('pt-BR').includes(q))
          : !linked.length || linked.includes(f.id)),
    )
    .map((f) => f.id);
  if (!affected.length) return s;
  const next = changeInput(s, 'facts', `negative:${turn.id}`);
  next.facts = next.facts.map((f) => (affected.includes(f.id) ? { ...f, usable: false } : f));
  next.pending = [
    ...next.pending,
    {
      id: `negative:${turn.id}`,
      topicId: topic.id,
      criterionId: topic.criterionId,
      factIds: affected,
      blocking: true,
      reason: 'A pessoa declarou ausência; esclareça a divergência antes de usar estes fatos.',
    },
  ];
  next.plan = replan(next);
  return next;
}
