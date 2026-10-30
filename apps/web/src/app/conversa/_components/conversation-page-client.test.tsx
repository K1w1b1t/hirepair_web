jest.mock('./document-diagnostics', () => ({ DocumentDiagnostics: jest.fn(() => null) }));
import { clearStoredResumes } from '../_lib/resume-storage';
import { preparationFixture } from '../../../../test/preparation';
import { saveEngine, deleteEngine } from '../_lib/engine-storage';
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
  }) => (
    <div>
      <button onClick={() => onDocumentsChange([])}>Clear</button>
      <button onClick={() => onDocumentsChange([resume])}>Same documents</button>
      <button onClick={() => onDocumentsChange([{ ...resume, text: 'Changed' }])}>
        Change documents
      </button>
    </div>
  ),
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
    onEditJob,
    onPreferencesChange,
  }: {
    onEditJob: () => void;
    onPreferencesChange: (preferences: typeof snapshot.preferences) => void;
  }) => (
    <div>
      Recommendations<button onClick={onEditJob}>Edit job</button>
      <button onClick={() => onPreferencesChange(preferences)}>Preferences</button>
      <button onClick={() => onPreferencesChange({ ...preferences, objective: 'CHANGE_FIELD' })}>
        New objective
      </button>
    </div>
  ),
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
  it('restores valid analysis, synchronizes edit/back URLs and retains preferences', async () => {
    window.history.replaceState({}, '', '/conversa?etapa=recommendations');
    restore.mockResolvedValue(snapshot);
    render(<ConversationPageClient />);
    await screen.findByText('Recommendations');
    fireEvent.click(screen.getByText('Preferences'));
    fireEvent.click(screen.getByText('Edit job'));
    expect(window.location.search).toBe('?etapa=job');
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(window.location.search).toBe('?etapa=materials');
    fireEvent.click(screen.getByText('Continuar'));
    expect(window.location.search).toBe('?etapa=recommendations');
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }));
    expect(window.location.search).toBe('?etapa=job');
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

it('deletes the whole local journey only after explicit confirmation', async () => {
  window.history.replaceState({}, '', '/conversa');
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
  list.mockResolvedValue([resume]);
  restore.mockResolvedValue(snapshot);
  render(<ConversationPageClient />);
  await screen.findByText('Continuar');
  fireEvent.click(screen.getByRole('button', { name: 'Excluir minha jornada deste aparelho' }));
  expect(confirm).toHaveBeenCalled();
  confirm.mockReturnValue(true);
  list.mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button', { name: 'Excluir minha jornada deste aparelho' }));
  await waitFor(() => expect(screen.queryByText('Continuar')).not.toBeInTheDocument());
  expect(window.location.search).toBe('?etapa=materials');
  confirm.mockRestore();
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
it('reports storage conflicts and deletion failures without claiming success', async () => {
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
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  (deleteEngine as jest.Mock).mockRejectedValueOnce(new Error('unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Excluir minha jornada deste aparelho' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível excluir'),
  );
  confirm.mockRestore();
});

it('does not report full deletion when document storage fails to clear', async () => {
  window.history.replaceState({}, '', '/conversa');
  list.mockResolvedValue([resume]);
  restore.mockResolvedValue(snapshot);
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  (clearStoredResumes as jest.Mock).mockResolvedValueOnce(false);
  render(<ConversationPageClient />);
  await screen.findByText('Continuar');
  fireEvent.click(screen.getByRole('button', { name: 'Excluir minha jornada deste aparelho' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível excluir');
  confirm.mockRestore();
});

import { DocumentDiagnostics } from './document-diagnostics';
it.each([false, true])(
  'synchronizes the engine revision after diagnosis (existing result: %s)',
  async (hasResult) => {
    jest.mocked(DocumentDiagnostics).mockClear();
    window.history.replaceState({}, '', '/conversa?etapa=job');
    list.mockResolvedValue([resume]);
    restore.mockResolvedValue(hasResult ? snapshot : { draft: initialDraft });
    render(<ConversationPageClient />);
    await waitFor(() => expect(jest.mocked(DocumentDiagnostics)).toHaveBeenCalled());
    const calls = jest.mocked(DocumentDiagnostics).mock.calls;
    const props = calls[calls.length - 1][0];
    const session = preparationFixture({ sessionId: 's', funnelSessionId: 'f' }).session;
    await act(async () => {
      props.onSessionChange!(session);
    });
    expect(persist.mock.calls[persist.mock.calls.length - 1][0].result?.preparation).toEqual(
      hasResult ? session : undefined,
    );
  },
);
