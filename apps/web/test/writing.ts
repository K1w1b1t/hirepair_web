import { createSession } from '@hirepair/interview-engine';
export function createWritingTestSession() {
  const s = createSession('s', 'funnel', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
  s.phase = 'ready';
  s.objective = { value: 'ENTER_FAST', provisional: false };
  s.facts = [
    {
      id: 'f',
      revision: 1,
      experienceId: 'e',
      storyId: null,
      text: 'Atendeu clientes',
      origin: { sourceId: 'x', sourceVersion: '1', quote: 'Atendeu clientes' },
      usable: true,
      confirmation: 'confirmed',
      externallyVerified: false,
    },
  ];
  s.confirmation = {
    id: 'c',
    version: 1,
    valid: true,
    inputs: s.inputs,
    dependencies: [],
    factIds: ['f'],
  };
  return s;
}
