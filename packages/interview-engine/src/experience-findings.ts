import type { Session, Topic } from './contracts';
import { diagnosticTopics } from './diagnostic';
export function experienceFinding(
  s: Session,
  anchor: { experienceId: string | null; label: string },
): { topic: Topic; text: string } | null {
  const experience = s.experiences.find((e) => e.id === anchor.experienceId);
  if (!experience) return null;
  const topics = diagnosticTopics(s);
  const findings = (s.diagnostics ?? []).flatMap((r) => r.findings);
  for (const topic of topics) {
    if (s.guided!.answered.includes(topic.id)) continue;
    const finding = findings.find((f) => f.id === topic.diagnosticFindingId)!;
    if (topic.experienceId !== null && topic.experienceId !== experience.id) continue;
    if (topic.experienceId === null && finding.documentId !== experience.origin.sourceId) continue;
    const quote = finding.evidence
      .map((e) => e.quote)
      .join(' ')
      .slice(0, 40);
    let question: string;
    switch (finding.code) {
      case 'SKILL_NEEDS_EXAMPLE':
        question = `você chegou a usar “${quote}” nesse trabalho ou em outra experiência? Conte uma situação, se aconteceu.`;
        break;
      case 'SCOPE_NEEDS_SUPPORT':
        question = `o trecho “${quote}” se refere a esse trabalho ou a outra experiência? Conte sua participação e o alcance.`;
        break;
      case 'DATES_NEED_CLARIFICATION':
        question = `o período “${quote}” pertence a essa experiência? Esclareça as datas e se o trabalho continua.`;
        break;
      case 'CHRONOLOGY_INTERVAL':
        question =
          'o que você fez no intervalo até a experiência seguinte? Pode ter sido outro trabalho, estudo ou projeto.';
        break;
      default:
        continue;
    }
    return {
      topic: { ...topic, experienceId: experience.id },
      text: `Sobre ${anchor.label}, ${question}`,
    };
  }
  return null;
}
