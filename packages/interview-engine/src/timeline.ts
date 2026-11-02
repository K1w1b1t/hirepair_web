import type { Experience, GuidedState, Session, Topic, Turn } from './contracts';
import { experienceFinding } from './experience-findings';
type Timeline = NonNullable<GuidedState['timeline']>;
type Anchor = Timeline['anchors'][number];
export const emptyTimeline = (): Timeline => ({
  anchors: [],
  completed: [],
  latest: false,
  noProfessionalHistory: false,
  halted: false,
});
const label = (experience: Experience) =>
  `a experiência “${[experience.title, experience.place, experience.start].filter(Boolean).join(' · ').slice(0, 70)}”`;
const prefix = (anchor: Anchor) => `guided:${encodeURIComponent(anchor.id)}:`;
const chronology = (start: string | null) =>
  start?.replace(/^(\d{2})\/(\d{4})$/, '$2-$1') ?? '9999';
export function syncTimeline(s: Session): Timeline {
  const timeline = structuredClone(s.guided!.timeline ?? emptyTimeline());
  const ordered = [...s.experiences].sort(
    (a, b) => chronology(a.start).localeCompare(chronology(b.start)) || a.id.localeCompare(b.id),
  );
  for (const experience of ordered) {
    const sourceTurn = s.turns.find((t) => t.id === experience.origin.sourceId);
    const existing = timeline.anchors.find(
      (a) =>
        a.experienceId === experience.id ||
        (a.experienceId === null &&
          (a.turnId === experience.origin.sourceId ||
            (sourceTurn &&
              (sourceTurn.question.topicId.startsWith(prefix(a)) ||
                sourceTurn.question.topicId ===
                  s.turns.find((t) => t.id === a.turnId)!.question.topicId)))),
    );
    if (existing) {
      existing.experienceId = experience.id;
      existing.label = label(experience);
    } else
      timeline.anchors.push({
        id: experience.id,
        experienceId: experience.id,
        label: label(experience),
        turnId: null,
      });
  }
  return timeline;
}
const bodies = {
  period: 'em que período você trabalhou? Pode ser aproximado.',
  responsibility: 'o que ficava por sua conta no dia a dia?',
  context: 'em que lugar você trabalhava?',
  tools: 'que ferramentas ou materiais você usava?',
  frequency: 'com que frequência você fazia esse trabalho?',
  action: 'qual dificuldade apareceu e o que você fez para lidar com ela?',
  result: 'o que aconteceu depois da sua ação e como você percebeu esse resultado?',
} as const;
function dimensions(s: Session, anchor: Anchor): Set<string> {
  const known = new Set(
    s
      .guided!.answered.filter((id) => id.startsWith(prefix(anchor)))
      .map((id) => id.slice(prefix(anchor).length)),
  );
  const experience = s.experiences.find((e) => e.id === anchor.experienceId);
  if (experience?.start) known.add('period');
  if (experience?.place) known.add('context');
  if (
    s.facts.some(
      (f) => f.experienceId === anchor.experienceId && f.usable && f.confirmation !== 'rejected',
    )
  )
    known.add('responsibility');
  const turns = s.turns.filter(
    (t) =>
      t.id === anchor.turnId ||
      t.question.topicId.startsWith(prefix(anchor)) ||
      (anchor.experienceId !== null && t.decision?.experienceId === anchor.experienceId),
  );
  const declared = [
    ...s.facts.filter((f) => f.experienceId === anchor.experienceId).map((f) => f.text),
    ...turns.map((t) => t.answer.text),
  ]
    .join(' ')
    .toLocaleLowerCase('pt-BR');
  if (/\b(?:excel|planilhas?|word|power ?bi|computador|ferramentas?)\b/.test(declared))
    known.add('tools');
  if (/diariamente|todos os dias|toda semana|semanalmente|mensalmente/.test(declared))
    known.add('frequency');
  if (/\b(?:19|20)\d{2}\b/.test(declared)) known.add('period');
  const translated: Record<string, string> = {
    período: 'period',
    responsabilidade: 'responsibility',
    contexto: 'context',
    ferramenta: 'tools',
    frequência: 'frequency',
    dificuldade: 'action',
    resultado: 'result',
  };
  for (const [id, progress] of Object.entries(s.interview?.topics ?? {}))
    if (id.startsWith(prefix(anchor)) || turns.some((t) => t.question.topicId === id))
      for (const evidence of progress.evidence) known.add(translated[evidence] ?? evidence);
  return known;
}
function basicComplete(s: Session, anchor: Anchor) {
  const known = dimensions(s, anchor);
  return known.has('period') && known.has('responsibility');
}
function reconcile(s: Session, timeline: Timeline): Timeline {
  for (const anchor of timeline.anchors)
    if (basicComplete(s, anchor) && !timeline.completed.includes(anchor.id))
      timeline.completed.push(anchor.id);
  const last = timeline.anchors.at(-1);
  if (
    last &&
    timeline.completed.length === timeline.anchors.length &&
    s.experiences.some((e) => e.id === last.experienceId && e.current === true)
  )
    timeline.latest = true;
  return timeline;
}
export function timelineFinished(s: Session): boolean {
  const timeline = reconcile(s, syncTimeline(s));
  return timeline.latest && timeline.completed.length === timeline.anchors.length;
}
function topic(s: Session, id: string, anchor: Anchor | undefined, dimension: string): Topic {
  const criterion = s.criteria[0];
  return {
    id,
    criterionId: criterion?.id ?? null,
    experienceId: anchor?.experienceId ?? null,
    missingEvidence: dimension,
    reason:
      criterion?.reason ??
      'Conhecer esta experiência e sua participação antes de seguir para a próxima.',
    impact: 1,
    uncertainty: 2,
    relevance: 2,
  };
}
export function timelineQuestion(s: Session): { topic: Topic; text: string } | null {
  const timeline = reconcile(s, syncTimeline(s));
  if (timeline.halted) return null;
  const active = timeline.anchors.find(
    (a) => experienceFinding(s, a) || !timeline.completed.includes(a.id),
  );
  if (active) {
    const finding = experienceFinding(s, active);
    if (finding) return finding;
    const known = dimensions(s, active);
    const dimension = !known.has('period') ? 'period' : 'responsibility';
    return {
      topic: topic(s, `${prefix(active)}${dimension}`, active, dimension),
      text: `Sobre ${active.label}, ${bodies[dimension]}`,
    };
  }
  const last = timeline.anchors.at(-1);
  if (!last)
    return timeline.latest
      ? null
      : {
          topic: topic(
            s,
            timeline.noProfessionalHistory ? 'guided:first-informal' : 'guided:first',
            undefined,
            'first-experience',
          ),
          text: timeline.noProfessionalHistory
            ? 'Qual foi sua primeira experiência em um projeto da escola, curso ou ajudando alguém?'
            : 'Qual foi sua primeira experiência profissional, mesmo que tenha sido um trabalho informal?',
        };
  if (!timeline.latest)
    return {
      topic: topic(s, `guided:next:${encodeURIComponent(last.id)}`, last, 'next-experience'),
      text: `Depois d${last.label.startsWith('a ') ? last.label : 'a ' + last.label}, qual foi sua próxima experiência profissional? Se essa foi a mais recente, pode me contar isso.`,
    };
  const known = dimensions(s, last);
  const dimension = (['context', 'tools', 'frequency', 'action', 'result'] as const).find(
    (d) => !known.has(d),
  );
  return dimension
    ? {
        topic: topic(s, `${prefix(last)}${dimension}`, last, dimension),
        text: `Sobre ${last.label}, ${bodies[dimension]}`,
      }
    : null;
}
const terminalNext =
  /^(?:(?:essa |esta |aquela )?(?:(?:foi|é|era) (?:a |minha )?)?(?:última|mais recente)(?: experiência)?|n[aã]o(?: (?:tive|tenho|houve) (?:outra|mais nenhuma)(?: experiência)?)?|nenhuma(?: outra)?|s[oó] essa)[.!]?$/i;
const noHistory =
  /^(?:nunca trabalhei|(?:ainda )?n[aã]o (?:tenho|tive)(?: nenhuma)? experi[eê]ncia(?: profissional)?|(?:estou buscando|busco) (?:meu |o )?primeiro emprego)[.!]?$/i;
export function normalizeTimelineTurn(turn: Turn): Turn {
  const id = turn.question.topicId;
  if (
    (id.startsWith('guided:next:') && terminalNext.test(turn.answer.text.trim())) ||
    (id === 'guided:first' && noHistory.test(turn.answer.text.trim()))
  )
    return { ...turn, answer: { ...turn.answer, kind: 'absence' } };
  return turn;
}
export function afterTimelineAnswer(s: Session, turn: Turn, clarification: boolean): Timeline {
  const timeline = syncTimeline(s),
    id = turn.question.topicId;
  const first = id === 'guided:first' || id === 'guided:first-informal';
  if (!clarification && (first || id.startsWith('guided:next:'))) {
    if (turn.answer.kind !== 'specific' && turn.answer.kind !== 'vague') {
      if (first && !timeline.noProfessionalHistory) timeline.noProfessionalHistory = true;
      else if (!first && turn.answer.kind === 'absence') timeline.latest = true;
      else timeline.halted = true;
    } else {
      const latest =
        /atualmente|trabalho atual|experiência atual|(?:última|mais recente) experiência/i.test(
          turn.answer.text,
        );
      timeline.latest = latest;
      timeline.anchors.push({
        id: `story:${turn.id}`,
        experienceId: null,
        turnId: turn.id,
        label: latest
          ? 'sua experiência profissional atual ou mais recente'
          : first
            ? timeline.noProfessionalHistory
              ? 'sua primeira experiência em um projeto ou ajuda a alguém'
              : 'sua primeira experiência profissional'
            : `sua ${timeline.anchors.length + 1}ª experiência profissional`,
      });
      if (timeline.noProfessionalHistory) timeline.latest = true;
    }
  }
  return reconcile(s, timeline);
}
export function contextualFollowup(s: Session, topicId: string, question: string): string {
  const timeline = syncTimeline(s);
  const turn = s.turns.find((t) => t.question.topicId === topicId);
  const anchor = timeline.anchors.find(
    (a) =>
      topicId.startsWith(prefix(a)) ||
      a.turnId === turn?.id ||
      (a.experienceId !== null && a.experienceId === turn?.decision?.experienceId),
  );
  const reference =
    anchor?.label ??
    (timeline.noProfessionalHistory
      ? 'sua primeira experiência em um projeto ou ajuda a alguém'
      : 'sua primeira experiência profissional');
  return `Sobre ${reference}, ${question.charAt(0).toLocaleLowerCase('pt-BR')}${question.slice(1)}`.slice(
    0,
    500,
  );
}
