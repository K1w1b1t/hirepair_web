import { createSession } from './engine';
import {
  writingSnapshot,
  writingAuthorization,
  approveResume,
  parseResumeWriting,
  manualResumeFacts,
  resumeContent,
  type ResumeDraft,
} from './writing';

describe('writingSnapshot', () => {
  it('refuses an unapproved interview before preparing provider input', () => {
    const session = createSession('session', 'funnel', {
      resumes: 'r',
      job: 'j',
      objective: 'o',
      facts: 'f',
    });
    expect(() => writingSnapshot(session)).toThrow('WRITING_NOT_AUTHORIZED');
  });
  it('copies only authorized facts and their provenance', () => {
    const session = createSession('session', 'funnel', {
      resumes: 'r',
      job: 'j',
      objective: 'o',
      facts: 'f',
    });
    session.objective = { value: 'ENTER_FAST', provisional: false };
    const origin = { sourceId: 's', sourceVersion: '1', quote: 'Atendeu clientes' };
    session.facts = ['selected', 'excluded'].map((id) => ({
      id,
      experienceId: 'experience',
      storyId: null,
      text: origin.quote,
      origin,
      revision: 1,
      confirmation: 'confirmed',
      externallyVerified: false,
      usable: true,
    }));
    session.confirmation = {
      id: 'confirmation',
      version: 1,
      inputs: session.inputs,
      dependencies: ['selected'],
      valid: true,
      factIds: ['selected'],
    };
    const snapshot = writingSnapshot(session);
    expect(snapshot.facts.map((fact) => fact.id)).toEqual(['selected']);
    snapshot.facts[0].origin.quote = 'changed';
    expect(session.facts[0].origin.quote).toBe('Atendeu clientes');
    expect(snapshot).toMatchObject({ sessionId: 'session', revision: 0, inputs: session.inputs });
  });
});

export function writingFixture() {
  const s = createSession('s', 'funnel', { resumes: 'r', job: 'j', objective: 'o', facts: 'f' });
  s.phase = 'ready';
  s.objective = { value: 'ENTER_FAST', provisional: false };
  const origin = { sourceId: 'source', sourceVersion: 'v1', quote: 'Atendeu clientes' };
  s.experiences = [
    {
      id: 'e',
      title: 'Atendente',
      start: '2020',
      end: '2023',
      current: false,
      kind: 'work',
      origin,
    },
  ];
  s.facts = [
    {
      id: 'f',
      revision: 1,
      experienceId: 'e',
      storyId: null,
      text: 'Atendeu clientes',
      origin,
      usable: true,
      confirmation: 'confirmed',
      externallyVerified: false,
    },
  ];
  s.confirmation = {
    id: 'c',
    version: 1,
    inputs: s.inputs,
    dependencies: ['facts'],
    valid: true,
    factIds: ['f'],
  };
  s.strategy = {
    id: 'strategy',
    version: 1,
    inputs: s.inputs,
    dependencies: ['facts'],
    valid: true,
    archetype: 'A_FIRST_JOB',
    tone: 'DIRECT',
    reason: 'Sintético',
    formula: 'CAR',
  };
  const content: ResumeDraft = {
    version: 1,
    explanation: 'Atendimento relevante para a vaga.',
    sections: [
      {
        id: 'experience',
        title: 'Experiência',
        experienceId: 'e',
        units: [{ id: 'bullet', text: 'Atendeu clientes', factIds: ['f'], criterionIds: [] }],
      },
    ],
  };
  return { s, content };
}
describe('closed grounded resume content', () => {
  it('accepts supported content and separates manual declarations', () => {
    const { s, content } = writingFixture();
    expect(parseResumeWriting(JSON.stringify(content), s)).toEqual(content);
    expect(manualResumeFacts(content)).toEqual([]);
    expect(resumeContent(s, content).sections[0].factIds).toEqual(['f']);
    content.sections[0].units[0].factIds = [];
    expect(manualResumeFacts(content)[0]).toMatchObject({ origin: 'user-edit', confirmed: false });
    expect(resumeContent(s, content).sections[0].factIds).toEqual(['edit:bullet']);
  });
  it.each([
    ['number', 'Atendeu 900 clientes', 'UNSUPPORTED_NUMBER'],
    ['keyword', 'Atendeu clientes usando SAP', 'UNSUPPORTED_CLAIM'],
    ['inflation', 'Liderou a operação', 'UNSUPPORTED_CLAIM'],
  ])('rejects %s even with a valid fact ID', (_name, text, error) => {
    const { s, content } = writingFixture();
    content.sections[0].units[0].text = text;
    expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow(error);
  });
  it('allows actual supported metrics and tools without treating a criterion as proof', () => {
    const { s, content } = writingFixture();
    s.facts[0].text = 'Atendeu 20 clientes usando Excel';
    content.sections[0].units[0].text = s.facts[0].text;
    s.links = [
      {
        id: 'l',
        criterionId: 'criterion',
        experienceId: 'e',
        factIds: ['f'],
        status: 'confirmed',
        declarationTurnId: null,
      },
    ];
    content.sections[0].units[0].criterionIds = ['criterion'];
    expect(parseResumeWriting(JSON.stringify(content), s)).toEqual(content);
  });
  it.each(['informal', 'project', 'education', 'course'] as const)(
    'limits %s to two bullets',
    (kind) => {
      const { s, content } = writingFixture();
      s.experiences[0].kind = kind;
      content.sections[0].units = [0, 1, 2].map((n) => ({
        ...content.sections[0].units[0],
        id: `b${n}`,
      }));
      expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow('RESUME_TOO_DENSE');
    },
  );
  it.each([
    (c: ResumeDraft) => {
      c.sections[0].units[0].factIds = ['missing'];
    },
    (c: ResumeDraft) => {
      c.sections[0].units[0].criterionIds = ['missing'];
    },
  ])('refuses nonexistent references', (change) => {
    const { s, content } = writingFixture();
    change(content);
    expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow('UNGROUNDED_RESUME_UNIT');
  });
  it.each([
    null,
    [],
    {},
    { version: 1, explanation: '', sections: [] },
    { version: 1, explanation: 'x', sections: [], injected: true },
  ])('rejects malformed top level %j', (value) => {
    expect(() => parseResumeWriting(JSON.stringify(value), writingFixture().s)).toThrow(
      'INVALID_RESUME',
    );
  });
  it.each([
    (c: ResumeDraft) => {
      c.sections[0].title = '';
    },
    (c: ResumeDraft) => {
      c.sections.push(c.sections[0]);
    },
    (c: ResumeDraft) => {
      c.sections[0].units = [];
    },
  ])('rejects malformed sections', (change) => {
    const { s, content } = writingFixture();
    change(content);
    expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow('INVALID_RESUME_SECTION');
  });
  it.each([
    (c: ResumeDraft) => {
      c.sections[0].units[0].text = '';
    },
    (c: ResumeDraft) => {
      c.sections[0].units[0].id = 'experience';
    },
    (c: ResumeDraft) => {
      c.sections[0].units[0].factIds = [];
    },
    (c: ResumeDraft) => {
      c.sections[0].units[0].factIds = ['f', 'f'];
    },
  ])('rejects malformed units', (change) => {
    const { s, content } = writingFixture();
    change(content);
    expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow('INVALID_RESUME_UNIT');
  });
  it('refuses unknown or mismatched experiences', () => {
    const { s, content } = writingFixture();
    content.sections[0].experienceId = 'missing';
    expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow('INVALID_EXPERIENCE');
    content.sections[0].experienceId = 'e';
    s.facts[0].experienceId = 'other';
    expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow('UNGROUNDED_RESUME_UNIT');
  });
  it('accepts general sections and rejects revoked facts', () => {
    const { s, content } = writingFixture();
    content.sections[0].experienceId = null;
    expect(parseResumeWriting(JSON.stringify(content), s)).toEqual(content);
    s.facts[0].usable = false;
    expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow('WRITING_NOT_AUTHORIZED');
  });
});
it('rejects document-wide excess and versions existing content', () => {
  const { s, content } = writingFixture();
  content.sections = Array.from({ length: 7 }, (_, n) => ({
    id: `s${n}`,
    title: 'Resumo',
    experienceId: null,
    units: [{ id: `u${n}`, text: 'x'.repeat(1000), factIds: ['f'], criterionIds: [] }],
  }));
  expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow('RESUME_TOO_DENSE');
  s.content = {
    id: 'old',
    version: 2,
    inputs: s.inputs,
    dependencies: [],
    valid: true,
    sections: [],
  };
  expect(resumeContent(s, content).version).toBe(3);
  s.experiences[0].kind = undefined;
  expect(parseResumeWriting(JSON.stringify(writingFixture().content), s)).toBeDefined();
});

it('approves the document and binds manual declarations to its version', () => {
  const { s, content } = writingFixture();
  content.sections[0].units[0].factIds = [];
  s.writing = {
    status: 'review',
    key: 'k',
    inputHash: 'h',
    original: content,
    draft: content,
    approval: null,
  };
  const approval = { hash: 'hash', profileHash: 'profile', approvedAt: 1 };
  expect(() => approveResume(s, approval, false)).toThrow('INVALID_RESUME_APPROVAL');
  const approved = approveResume(s, approval, true);
  expect(approved.writing!.manualFacts![0].confirmed).toBe(true);
  expect(approved.content!.sections[0].factIds).toEqual(['edit:bullet']);
  s.writing.authorization = writingAuthorization(s);
  expect(approveResume(s, approval, true).writing!.status).toBe('approved');
  s.inputs.job = 'changed';
  expect(() => approveResume(s, approval, true)).toThrow('INVALID_RESUME_APPROVAL');
});
it('refuses approval without usable content or permission', () => {
  const { s, content } = writingFixture();
  const approval = { hash: 'h', profileHash: 'p', approvedAt: 1 };
  expect(() => approveResume(s, approval, true)).toThrow();
  s.writing = {
    status: 'review',
    key: 'k',
    inputHash: 'h',
    original: content,
    draft: null,
    approval: null,
  };
  expect(() => approveResume(s, approval, true)).toThrow();
  s.writing.draft = { ...content, sections: [] };
  expect(() => approveResume(s, approval, true)).toThrow();
  s.writing.draft = content;
  s.confirmation = null;
  expect(() => approveResume(s, approval, true)).toThrow();
});
it('accepts closed v1 provider content and returns an essential evidence pending state', () => {
  const { s, content } = writingFixture();
  expect(parseResumeWriting(JSON.stringify({ ...content, pending: null }), s)).toEqual(content);
  expect(() =>
    parseResumeWriting(
      JSON.stringify({ ...content, sections: [], pending: 'Esclarecer participação individual.' }),
      s,
    ),
  ).toThrow('Esclarecer participação individual.');
  expect(() => parseResumeWriting(JSON.stringify({ ...content, pending: 4 }), s)).toThrow(
    'INVALID_RESUME',
  );
});
it('does not accept a pending response from an unknown schema version', () => {
  const { s, content } = writingFixture();
  expect(() =>
    parseResumeWriting(
      JSON.stringify({ ...content, version: 2, sections: [], pending: 'Lacuna' }),
      s,
    ),
  ).toThrow('INVALID_RESUME');
});
it('enforces the project density limit across multiple sections for the same experience', () => {
  const { s, content } = writingFixture();
  s.experiences[0].kind = 'project';
  content.sections = [0, 1, 2].map((n) => ({
    id: `section-${n}`,
    title: 'Projeto',
    experienceId: 'e',
    units: [{ ...content.sections[0].units[0], id: `bullet-${n}` }],
  }));
  expect(() => parseResumeWriting(JSON.stringify(content), s)).toThrow('RESUME_TOO_DENSE');
});
