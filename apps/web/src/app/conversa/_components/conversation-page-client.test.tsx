jest.mock('../_lib/journey-progress', () => ({
  startProgress: jest.fn(async () => ({ id: 'journey', phase: 'materials', withoutResume: false })),
  saveProgress: jest.fn(async () => {}),
  readLocalDraft: jest.fn(async () => null),
  saveLocalDraft: jest.fn(async () => {}),
}));
jest.mock('../_lib/cleanup-journey', () => ({ cleanupJourney: jest.fn(async () => {}) }));
jest.mock('./exit-journey', () => ({ ExitJourney: () => null }));
import { preparationFixture } from '../../../../test/preparation';
import { saveEngine } from '../_lib/engine-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ConversationPageClient } from './conversation-page-client';
import type { StoredResume } from '../_lib/resume-storage';
import type { JourneySnapshot } from '../_lib/journey-storage';
import { initialDraft } from '../_lib/journey-storage';
const resume: StoredResume = {
  id: 'doc',
  text: 'Mecânico',
  source: 'pasted',
  fileName: 'Currículo',
  fileType: 'TXT',
  createdAt: 1,
  findings: [],
};
const result = {
  targetRole: 'Mecânico',
  reason: 'r',
  summary: 's',
  requirements: [],
  suggestedArchetype: 'C_OPERATIONAL' as const,
  suggestedObjective: 'ENTER_FAST' as const,
  suggestedTone: 'DIRECT' as const,
};
const preferences = {
  archetype: result.suggestedArchetype,
  objective: result.suggestedObjective,
  tone: result.suggestedTone,
};
const snapshot: JourneySnapshot = { draft: initialDraft, result, preferences, inputHash: 'hash' };
const list = jest.fn(),
  restore = jest.fn(),
  persist = jest.fn();
let lateDocumentsChange: (documents: StoredResume[]) => void;
jest.mock('../_lib/resume-storage', () => ({
  listStoredResumes: () => list(),
  clearStoredResumes: jest.fn().mockResolvedValue(true),
}));
jest.mock('../_lib/engine-storage', () => ({
  deleteEngine: jest.fn().mockResolvedValue(undefined),
  saveEngine: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../_lib/journey-storage', () => ({
  initialDraft: { hasJob: true, jobText: '', targetRole: '', accepted: false },
  restoreJourney: (documents: unknown) => restore(documents),
  persistJourney: (value: unknown) => persist(value),
}));
jest.mock('./import-panel', () => ({
  ImportPanel: ({
    onDocumentsChange,
  }: {
    onDocumentsChange: (documents: StoredResume[]) => void;
  }) => {
    lateDocumentsChange = onDocumentsChange;
    return (
      <div>
        <button onClick={() => onDocumentsChange([])}>Clear</button>
        <button onClick={() => onDocumentsChange([resume])}>Same documents</button>
        <button onClick={() => onDocumentsChange([{ ...resume, text: 'Changed' }])}>
          Change documents
        </button>
      </div>
    );
  },
}));
jest.mock('./job-example-step', () => ({
  JobExampleStep: ({
    draft,
    onDraftChange,
    onComplete,
  }: {
    draft: typeof initialDraft;
    onDraftChange: (draft: typeof initialDraft) => void;
    onComplete: (result: typeof snapshot.result, hash: string) => void;
  }) => (
    <div>
      <button onClick={() => onComplete(result, 'hash')}>Analyze</button>
      <button
        onClick={() =>
          onComplete(
            {
              ...result,
              preparation: preparationFixture({ sessionId: 's', funnelSessionId: 'f' }).session,
            },
            'hash',
          )
        }
      >
        Analyze prepared
      </button>
      <button onClick={() => onDraftChange({ ...draft, hasJob: false })}>Change mode</button>
      <button onClick={() => onDraftChange({ ...draft, targetRole: 'New role' })}>
        Change target
      </button>
      <button onClick={() => onDraftChange({ ...draft, jobText: 'New vacancy' })}>
        Change vacancy
      </button>
      <button onClick={() => onDraftChange({ ...draft, accepted: true })}>Accept</button>
    </div>
  ),
  JobRecommendationsStep: ({
    onContinue,
    onEditJob,
    onPreferencesChange,
  }: {
    onContinue: () => void;
    onEditJob: () => void;
    onPreferencesChange: (preferences: typeof snapshot.preferences) => void;
  }) => (
    <div>
      <button onClick={onContinue}>Interview</button>
      Recommendations<button onClick={onEditJob}>Edit job</button>
      <button onClick={() => onPreferencesChange(preferences)}>Preferences</button>
      <button onClick={() => onPreferencesChange({ ...preferences, objective: 'CHANGE_FIELD' })}>
        New objective
      </button>
    </div>
  ),
}));
let lateSessionChange:
  ((session: import('@hirepair/interview-engine').Session) => void) | undefined;
jest.mock('./interview-workspace', () => ({
  InterviewWorkspace: ({
    session,
    onChange,
  }: {
    session: import('@hirepair/interview-engine').Session;
    onChange: (s: import('@hirepair/interview-engine').Session) => void;
  }) => {
    lateSessionChange = onChange;
    return (
      <div>
        Interview view
        <button onClick={() => onChange({ ...session, phase: 'confirmation' })}>
          Review block
        </button>
      </div>
    );
  },
}));
describe('conversation persistence and transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.history.replaceState({}, '', '/conversa');
    list.mockResolvedValue([resume]);
    restore.mockResolvedValue({ draft: initialDraft });
  });
  it.each(['job', 'recommendations'])('falls back from %s without materials', async (phase) => {
    window.history.replaceState({}, '', `/conversa?etapa=${phase}`);
    list.mockResolvedValue([]);
    render(<ConversationPageClient />);
    await waitFor(() => expect(window.location.search).toBe('?etapa=materials'));
  });
  it('falls back to vacancy when a requested analysis is obsolete', async () => {
    window.history.replaceState({}, '', '/conversa?etapa=recommendations');
    render(<ConversationPageClient />);
    await screen.findByText('Analyze');
    expect(window.location.search).toBe('?etapa=job');
  });
  it('stores a completed analysis and advances to recommendations', async () => {
    window.history.replaceState({}, '', '/conversa?etapa=job');
    render(<ConversationPageClient />);

    await screen.findByText('Analyze');
    fireEvent.click(screen.getByText('Analyze'));

    expect(await screen.findByText('Recommendations')).toBeInTheDocument();
    expect(window.location.search).toBe('?etapa=recommendations');
    expect(persist).toHaveBeenLastCalledWith(snapshot);
  });
  it('retains preferences when editing the vacancy', async () => {
    window.history.replaceState({}, '', '/conversa?etapa=recommendations');
    restore.mockResolvedValue(snapshot);
    render(<ConversationPageClient />);
    await screen.findByText('Recommendations');
    fireEvent.click(screen.getByText('Preferences'));
    fireEvent.click(screen.getByText('Edit job'));
    expect(window.location.search).toBe('?etapa=job');
    expect(screen.getByRole('link', { name: 'Voltar para o início' })).toHaveAttribute('href', '/');
    expect(screen.queryByText('Excluir minha jornada deste aparelho')).not.toBeInTheDocument();
  });
  it('invalidates derived analysis when materials change and preserves unchanged material', async () => {
    restore.mockResolvedValue(snapshot);
    render(<ConversationPageClient />);
    await screen.findByText('Continuar');
    fireEvent.click(screen.getByText('Same documents'));
    expect(persist).toHaveBeenLastCalledWith(snapshot);
    fireEvent.click(screen.getByText('Change documents'));
    expect(persist).toHaveBeenLastCalledWith(
      expect.objectContaining({ result: undefined, inputHash: undefined }),
    );
    fireEvent.click(screen.getByText('Clear'));
    expect(window.location.search).toBe('?etapa=materials');
  });
  it.each(['Change mode', 'Change target', 'Change vacancy', 'Accept'])(
    'updates the draft through %s',
    async (action) => {
      window.history.replaceState({}, '', '/conversa?etapa=job');
      restore.mockResolvedValue(snapshot);
      render(<ConversationPageClient />);
      await screen.findByText(action);
      fireEvent.click(screen.getByText(action));
      expect(persist).toHaveBeenCalled();
      if (action !== 'Accept')
        expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ result: undefined }));
    },
  );
  it('ignores document callbacks before hydration, and unmounted async reads', async () => {
    let resolve!: (value: StoredResume[]) => void;
    list.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const view = render(<ConversationPageClient />);
    fireEvent.click(screen.getByText('Change documents'));
    expect(persist).not.toHaveBeenCalled();
    view.unmount();
    await act(async () => resolve([resume]));
    expect(restore).not.toHaveBeenCalled();
  });
  it('ignores a late state read after unmount', async () => {
    let resolve!: (value: JourneySnapshot) => void;
    restore.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const view = render(<ConversationPageClient />);
    await waitFor(() => expect(restore).toHaveBeenCalled());
    view.unmount();
    await act(async () => resolve(snapshot));
    expect(persist).not.toHaveBeenCalled();
  });
  it('preserves a user navigation while restoration completes', async () => {
    let resolve!: (value: JourneySnapshot) => void;
    restore.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    render(<ConversationPageClient />);
    await screen.findByText('Continuar');
    fireEvent.click(screen.getByText('Continuar'));
    await act(async () => resolve({ draft: initialDraft }));
    expect(window.location.search).toBe('?etapa=job');
  });
});

it('saves communication choices against the current local revision and invalidates content', async () => {
  window.history.replaceState({}, '', '/conversa?etapa=recommendations');
  list.mockResolvedValue([resume]);
  for (const hasContent of [false, true]) {
    const session = preparationFixture({ sessionId: 's', funnelSessionId: 'f' }).session;
    if (hasContent) session.content = { ...session.plan!, sections: [] };
    restore.mockResolvedValue({
      ...snapshot,
      draft: { ...initialDraft, objective: 'ENTER_FAST' },
      result: { ...result, preparation: session },
    });
    const view = render(<ConversationPageClient />);
    await screen.findByText('Recommendations');
    fireEvent.click(screen.getByText('Preferences'));
    await waitFor(() =>
      expect(saveEngine).toHaveBeenCalledWith(expect.objectContaining({ revision: 1 }), 0),
    );
    view.unmount();
  }
});
it('returns to preparation after the person changes the declared objective', async () => {
  window.history.replaceState({}, '', '/conversa?etapa=recommendations');
  list.mockResolvedValue([resume]);
  restore.mockResolvedValue({ ...snapshot, draft: { ...initialDraft, objective: 'ENTER_FAST' } });
  render(<ConversationPageClient />);
  await screen.findByText('Recommendations');
  fireEvent.click(screen.getByText('New objective'));
  expect(window.location.search).toBe('?etapa=job');
});
it('reports storage conflicts without claiming success', async () => {
  window.history.replaceState({}, '', '/conversa?etapa=recommendations');
  list.mockResolvedValue([resume]);
  const session = preparationFixture({ sessionId: 's', funnelSessionId: 'f' }).session;
  restore.mockResolvedValue({
    ...snapshot,
    draft: { ...initialDraft, objective: 'ENTER_FAST' },
    result: { ...result, preparation: session },
  });
  (saveEngine as jest.Mock).mockRejectedValueOnce(new Error('REVISION_CONFLICT'));
  render(<ConversationPageClient />);
  await screen.findByText('Recommendations');
  fireEvent.click(screen.getByText('Preferences'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
});
it('starts without documents, saves the same session and restores the relevant interview screen', async () => {
  window.history.replaceState({}, '', '/conversa');
  list.mockResolvedValue([]);
  restore.mockResolvedValue({ draft: initialDraft });
  const view = render(<ConversationPageClient />);
  await screen.findByText('Começar sem currículo');
  const skipResume = screen.getByRole('button', { name: 'Começar sem currículo' });
  expect(
    screen.getByText('Clear').compareDocumentPosition(skipResume) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(skipResume).toHaveClass('journey-without-resume');
  fireEvent.click(screen.getByText('Começar sem currículo'));
  expect(window.location.search).toContain('sem-curriculo=1');
  await screen.findByText('Analyze prepared');
  fireEvent.click(screen.getByText('Analyze prepared'));
  await screen.findByText('Interview view');
  fireEvent.click(screen.getByText('Review block'));
  expect(
    screen.queryByRole('button', { name: /voltar para a etapa anterior/i }),
  ).not.toBeInTheDocument();
  view.unmount();
  window.history.replaceState({}, '', '/conversa?etapa=recommendations&sem-curriculo=1');
  restore.mockResolvedValue({
    ...snapshot,
    result: {
      ...result,
      preparation: preparationFixture({ sessionId: 's', funnelSessionId: 'f' }).session,
    },
  });
  render(<ConversationPageClient />);
  await screen.findByText('Interview view');
});
it.each(['confirmation', 'ready'] as const)(
  'restores the %s screen even when the requested entry is outdated',
  async (phase) => {
    window.history.replaceState({}, '', '/conversa');
    list.mockResolvedValue([resume]);
    const s = preparationFixture({ sessionId: 's', funnelSessionId: 'f' }).session;
    s.phase = phase;
    restore.mockResolvedValue({ ...snapshot, result: { ...result, preparation: s } });
    render(<ConversationPageClient />);
    await screen.findByText('Interview view');
    expect(
      screen.queryByRole('button', { name: /voltar para a etapa anterior/i }),
    ).not.toBeInTheDocument();
  },
);
it('continues from imported recommendations and cannot resurrect state through a late child update after deletion', async () => {
  window.history.replaceState({}, '', '/conversa?etapa=recommendations');
  list.mockResolvedValue([resume]);
  const s = preparationFixture({ sessionId: 's', funnelSessionId: 'f' }).session;
  restore.mockResolvedValue({ ...snapshot, result: { ...result, preparation: s } });
  render(<ConversationPageClient />);
  await screen.findByText('Recommendations');
  fireEvent.click(screen.getByText('Interview'));
  await screen.findByText('Interview view');
  const late = lateSessionChange!;
  const view = screen.getByText('Interview view');
  expect(view).toBeInTheDocument();
  expect(screen.queryByText('Excluir minha jornada deste aparelho')).not.toBeInTheDocument();
  act(() => late({ ...s, phase: 'confirmation' }));
  expect(screen.getByText('Interview view')).toBeInTheDocument();
  act(() => lateDocumentsChange([]));
  act(() => late({ ...s, phase: 'ready' }));
  expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ result: undefined }));
});
it('allows vacancy entry without documents when the explicit mode was selected', async () => {
  window.history.replaceState({}, '', '/conversa?etapa=job&sem-curriculo=1');
  list.mockResolvedValue([]);
  restore.mockResolvedValue({ draft: initialDraft });
  render(<ConversationPageClient />);
  await screen.findByText('Analyze');
  expect(window.location.search).toContain('etapa=job');
});
it('does not imply a review phase for a legacy result without a prepared aggregate', async () => {
  window.history.replaceState({}, '', '/conversa?etapa=interview');
  list.mockResolvedValue([resume]);
  restore.mockResolvedValue(snapshot);
  render(<ConversationPageClient />);
  await screen.findByText('Recommendations');
  expect(screen.queryByRole('button', { name: /voltar/i })).not.toBeInTheDocument();
});
import {
  startProgress,
  saveProgress,
  readLocalDraft,
  saveLocalDraft,
} from '../_lib/journey-progress';
it('restores the saved phase and snapshot independently of an old URL', async () => {
  (startProgress as jest.Mock).mockResolvedValueOnce({
    id: 'journey',
    phase: 'job',
    withoutResume: true,
  });
  (readLocalDraft as jest.Mock).mockResolvedValueOnce(snapshot);
  list.mockResolvedValue([]);
  restore.mockResolvedValue(snapshot);
  window.history.replaceState({}, '', '/conversa');
  render(<ConversationPageClient />);
  await screen.findByText('Analyze');
  expect(persist).toHaveBeenCalledWith(snapshot);
});
it('reports phase and draft persistence failures', async () => {
  window.history.replaceState({}, '', '/conversa');
  list.mockResolvedValue([resume]);
  restore.mockResolvedValue(snapshot);
  (saveLocalDraft as jest.Mock).mockRejectedValueOnce(new Error());
  render(<ConversationPageClient />);
  expect(await screen.findByRole('alert')).toHaveTextContent('salvar seu progresso');
  (saveProgress as jest.Mock).mockRejectedValueOnce(new Error());
  fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('salvar a etapa'));
});
it('reports restoration failures and ignores failures after leaving', async () => {
  (startProgress as jest.Mock).mockRejectedValueOnce(new Error());
  const v = render(<ConversationPageClient />);
  expect(await screen.findByRole('alert')).toHaveTextContent('abrir o progresso');
  v.unmount();
  let reject!: (e: Error) => void;
  (startProgress as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((_r, j) => {
        reject = j;
      }),
  );
  const late = render(<ConversationPageClient />);
  await act(async () => {});
  late.unmount();
  await act(async () => reject(new Error()));
});
it('returns to a persisted writing session when opening the site without a phase URL', async () => {
  const session = preparationFixture({ sessionId: 's', funnelSessionId: 'f' }).session;
  session.phase = 'writing';
  window.history.replaceState({}, '', '/conversa');
  restore.mockResolvedValue({ ...snapshot, result: { ...result, preparation: session } });
  render(<ConversationPageClient />);
  await screen.findByText('Interview view');
});
it('handles early navigation before the durable journey is opened', async () => {
  let resolve!: (v: unknown) => void;
  (startProgress as jest.Mock).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = render(<ConversationPageClient />);
  fireEvent.click(screen.getByRole('button', { name: 'Começar sem currículo' }));
  await waitFor(() => expect(resolve).toBeDefined());
  await act(async () => resolve({ id: 'j', phase: 'materials', withoutResume: false }));
  view.unmount();
});
it.each(['navigate', 'unmount'])(
  'does not overwrite %s while the restored step commits',
  async (action) => {
    window.history.replaceState({}, '', '/conversa');
    restore.mockResolvedValue(snapshot);
    list.mockResolvedValue([resume]);
    let resolve!: () => void;
    (saveProgress as jest.Mock).mockImplementationOnce(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );
    const view = render(<ConversationPageClient />);
    await waitFor(() => expect(resolve).toBeDefined());
    if (action === 'navigate') fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    else view.unmount();
    await act(async () => resolve());
    if (action === 'navigate') expect(window.location.search).toBe('?etapa=recommendations');
  },
);
