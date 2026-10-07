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
jest.mock('../_lib/resume-storage', () => ({ listStoredResumes: () => list() }));
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
