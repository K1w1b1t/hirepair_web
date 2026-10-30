import { createHash } from 'node:crypto';
import { createSession, prepare, type PreparationRequest } from '@hirepair/interview-engine';
export function preparationFixture(
  request: Pick<PreparationRequest, 'sessionId' | 'funnelSessionId'> &
    Partial<Pick<PreparationRequest, 'objective' | 'provisional' | 'jobText' | 'documents'>>,
) {
  const s = createSession(request.sessionId, request.funnelSessionId, {
    resumes: 'r',
    job: 'j',
    objective: 'o',
    facts: 'f',
  });
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  s.sources = (request.documents ?? []).map((document) => ({
    ...document,
    version: hash(document.text),
  }));
  s.inputs.resumes = hash(JSON.stringify(s.sources));
  s.objective = {
    value: request.objective ?? 'ENTER_FAST',
    provisional: request.provisional ?? false,
  };
  return {
    version: 1,
    session: prepare(
      s,
      { experiences: [], facts: [] },
      {
        criteria: request.jobText
          ? [
              {
                id: 'c',
                text: 'Experiência relevante',
                kind: 'explicit',
                category: 'NEGOTIABLE',
                quote: request.jobText,
                reason: 'Entender uma situação concreta do trabalho.',
                evidenceNeeded: 'Conte um exemplo do que você fez.',
                objectiveBasis: false,
                relevance: 3,
              },
            ]
          : [],
        links: [],
        archetype: 'B_CAREER_CHANGE',
        reason: 'Seu histórico aponta para uma transição.',
      },
    ),
  };
}
