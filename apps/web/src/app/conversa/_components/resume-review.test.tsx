import { createWritingTestSession } from '../../../../test/writing';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import {
  startGuided,
  approveResume,
  type Session,
  type ResumeDraft,
} from '@hirepair/interview-engine';
import { ResumeReview, SectionEditor, ProfileEditor } from './resume-review';
import { generateResume, hasInterviewAccess } from '../_lib/guest-api';
import { readHeaderProfile } from '../_lib/engine-storage';
import { commitInterview } from '../_lib/interview-session';
import { captureAnalyticsEvent } from '../../../analytics/analytics';
jest.mock('../_lib/guest-api', () => ({
  generateResume: jest.fn(),
  hasInterviewAccess: jest.fn(() => true),
  authorizeResume: jest.fn(),
}));
jest.mock('../_lib/engine-storage', () => ({
  readHeaderProfile: jest.fn(),
  saveHeaderProfile: jest.fn(),
}));
jest.mock('../_lib/interview-session', () => ({
  hashValue: async () => 'hash',
  commitInterview: jest.fn(async (s, _p, fn) => ({ ...fn(s), revision: s.revision + 1 })),
}));
jest.mock('./turnstile-challenge', () => ({
  TurnstileChallenge: ({ onReady }: { onReady: (value: unknown) => void }) => (
    <button onClick={() => onReady({ token: 'proof', termsVersion: 'v', privacyVersion: 'v' })}>
      Verificar acesso
    </button>
  ),
}));
jest.mock('../../../analytics/analytics', () => ({ captureAnalyticsEvent: jest.fn() }));
const content: ResumeDraft = {
  version: 1,
  explanation: 'Atendimento relevante para a vaga.',
  sections: [
    {
      id: 'summary',
      title: 'Resumo',
      experienceId: null,
      units: [{ id: 'b', text: 'Atendeu clientes', factIds: ['f'], criterionIds: [] }],
    },
  ],
};
const fixture = createWritingTestSession;

function reviewingSession() {
  const s = fixture();
  s.writing = {
    status: 'review',
    key: 'review-key',
    inputHash: 'h',
    original: content,
    draft: content,
    approval: null,
  };
  return s;
}

function Harness({
  initial = fixture(),
  role = 'Atendente',
}: {
  initial?: Session;
  role?: string;
}) {
  const [session, setSession] = useState(initial);
  return (
    <ResumeReview
      session={session}
      draft={{ hasJob: false, jobText: '', targetRole: role, accepted: true }}
      onChange={setSession}
    />
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  (hasInterviewAccess as jest.Mock).mockReturnValue(true);
  Object.defineProperty(globalThis, 'structuredClone', {
    configurable: true,
    value: (v: unknown) => JSON.parse(JSON.stringify(v)),
  });
  (readHeaderProfile as jest.Mock).mockResolvedValue({
    name: 'Pessoa',
    email: '',
    phone: '',
    confirmed: false,
  });
  (generateResume as jest.Mock).mockResolvedValue(content);
});
it('generates once, reviews, edits and approves without further AI calls', async () => {
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar meu currículo' }));
  await screen.findByRole('button', { name: 'Editar Resumo' });
  expect(generateResume).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('Por que valorizamos estas experiências?')).not.toBeInTheDocument();
  expect(captureAnalyticsEvent).toHaveBeenCalledWith('resume_generated', {
    funnel_session_id: 'funnel',
  });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Resumo' }));
  fireEvent.change(screen.getByLabelText('Conteúdo'), {
    target: { value: 'Atendeu clientes na loja.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await screen.findByText('Atendeu clientes na loja.');
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar currículo' }));
  await screen.findByRole('heading', { name: 'Currículo aprovado' });
  expect(generateResume).toHaveBeenCalledTimes(1);
  expect(commitInterview).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({
      status: 'approved',
      manualFacts: [
        expect.objectContaining({ confirmed: true, text: 'Atendeu clientes na loja.' }),
      ],
    }),
    expect.any(Function),
    expect.objectContaining({ confirmed: true }),
  );
});
it('opens an empty section editor, cancels, then adds and removes content', async () => {
  const s = reviewingSession();
  render(<Harness initial={s} />);
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar seção' }));
  expect(screen.getByLabelText('Título da seção')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar seção' }));
  fireEvent.change(screen.getByLabelText('Título da seção'), { target: { value: 'Cursos' } });
  fireEvent.change(screen.getByLabelText('Conteúdo'), {
    target: { value: 'Curso declarado pela pessoa' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await screen.findByRole('button', { name: 'Editar Cursos' });
  fireEvent.click(screen.getByRole('button', { name: 'Editar Cursos' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remover seção' }));
  await waitFor(() =>
    expect(screen.queryByText('Curso declarado pela pessoa')).not.toBeInTheDocument(),
  );
});
it('edits contacts locally and returns to review', async () => {
  const s = reviewingSession();
  render(<Harness initial={s} />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Editar nome e contatos' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Editar nome e contatos' }));
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Novo nome' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await screen.findByText('Novo nome');
  expect(commitInterview).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.anything(),
    expect.any(Function),
    expect.objectContaining({ name: 'Novo nome', confirmed: false }),
  );
  expect(generateResume).not.toHaveBeenCalled();
});
it.each(['pending', 'failed'] as const)('does not generate on resuming %s', async (status) => {
  const s = fixture();
  s.writing = { status, key: 'key', inputHash: 'h', original: null, draft: null, approval: null };
  render(<Harness initial={s} />);
  await waitFor(() => expect(readHeaderProfile).toHaveBeenCalled());
  expect(generateResume).not.toHaveBeenCalled();
});
it('preserves a failed generation and avoids a success event', async () => {
  (generateResume as jest.Mock).mockRejectedValue(new Error('unavailable'));
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar meu currículo' }));
  await screen.findByText(
    'Não conseguimos concluir uma versão válida. Sua história permanece salva.',
  );
  expect(captureAnalyticsEvent).not.toHaveBeenCalled();
});
it('keeps references for unchanged text and drops them for manual declarations', () => {
  const save = jest.fn();
  render(
    <SectionEditor section={content.sections[0]} busy={false} onSave={save} onCancel={jest.fn()} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  expect(save.mock.calls[0][0].units[0].factIds).toEqual(['f']);
});
it('reports profile read failure and avoids updates after unmount', async () => {
  (readHeaderProfile as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  const view = render(<Harness />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Não foi possível abrir seus contatos.',
  );
  view.unmount();
  let resolve!: (value: unknown) => void;
  (readHeaderProfile as jest.Mock).mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const later = render(<Harness />);
  later.unmount();
  resolve(null);
});
it('keeps the section editor open when saving fails', async () => {
  const s = reviewingSession();
  render(<Harness initial={s} />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar Resumo' }));
  (commitInterview as jest.Mock).mockRejectedValueOnce(new Error('conflict'));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await screen.findByText('Não foi possível salvar. Suas alterações continuam abertas.');
  expect(screen.getByLabelText('Conteúdo')).toBeInTheDocument();
});
it('reports approval failure without claiming completion', async () => {
  const s = reviewingSession();
  render(<Harness initial={s} />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Aprovar currículo' })).toBeEnabled(),
  );
  (commitInterview as jest.Mock).mockRejectedValueOnce(new Error('conflict'));
  fireEvent.click(screen.getByRole('button', { name: 'Aprovar currículo' }));
  await screen.findByText('Não foi possível aprovar. Tente salvar novamente.');
});
it('reports contact save failure and allows cancellation', async () => {
  const s = reviewingSession();
  render(<Harness initial={s} />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Editar nome e contatos' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Editar nome e contatos' }));
  (commitInterview as jest.Mock).mockRejectedValueOnce(new Error('conflict'));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await screen.findByText('Não foi possível salvar seus contatos.');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByRole('button', { name: 'Editar Resumo' })).toBeInTheDocument();
});
it('does not call the provider when persisting the pending command fails', async () => {
  (commitInterview as jest.Mock).mockRejectedValueOnce(new Error('conflict'));
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar meu currículo' }));
  await screen.findByRole('alert');
  expect(generateResume).not.toHaveBeenCalled();
});
it('reports local failure after a provider failure without repeating the call', async () => {
  const original = (commitInterview as jest.Mock).getMockImplementation()!;
  (commitInterview as jest.Mock)
    .mockImplementationOnce(original)
    .mockRejectedValueOnce(new Error('conflict'));
  (generateResume as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar meu currículo' }));
  await screen.findByText(
    'Não foi possível salvar o resultado. Reabra a página para conferir o estado salvo.',
  );
  expect(generateResume).toHaveBeenCalledTimes(1);
});
it('blocks approval when source authorization has changed', async () => {
  const s = fixture();
  s.writing = {
    status: 'review',
    key: 'k',
    inputHash: 'h',
    authorization: 'obsolete',
    original: content,
    draft: content,
    approval: null,
  };
  render(<Harness initial={s} />);
  expect(screen.getByRole('button', { name: 'Aprovar currículo' })).toBeDisabled();
  expect(screen.getByText(/As informações usadas neste currículo mudaram/)).toBeInTheDocument();
  await act(async () => {});
});
it('uses empty optional profile fields without blocking the document', async () => {
  (readHeaderProfile as jest.Mock).mockResolvedValueOnce(null);
  const s = fixture();
  s.writing = {
    status: 'review',
    key: 'k',
    inputHash: 'h',
    original: null,
    draft: content,
    approval: null,
  };
  render(<Harness initial={s} />);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Editar nome e contatos' })).toBeEnabled(),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Editar nome e contatos' }));
  expect(screen.getByLabelText('Nome')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
});
it('waits for renewal verification after a browser reload', async () => {
  (hasInterviewAccess as jest.Mock).mockReturnValue(false);
  render(<Harness />);
  expect(screen.getByRole('button', { name: 'Preparar meu currículo' })).toBeDisabled();
  await act(async () => {});
});
it('does not repeat a generation when clicked twice in the same transition', async () => {
  render(<Harness role="" />);
  await act(async () => {
    const button = screen.getByRole('button', { name: 'Preparar meu currículo' });
    fireEvent.click(button);
    fireEvent.click(button);
  });
  await screen.findByRole('button', { name: 'Editar Resumo' });
  expect(generateResume).toHaveBeenCalledTimes(1);
});
it('renews access before generating when a challenge is available', async () => {
  (hasInterviewAccess as jest.Mock).mockReturnValue(false);
  render(<Harness />);
  fireEvent.click(screen.getByRole('button', { name: 'Verificar acesso' }));
  fireEvent.click(screen.getByRole('button', { name: 'Preparar meu currículo' }));
  await screen.findByRole('button', { name: 'Editar Resumo' });
  expect(generateResume).toHaveBeenCalledTimes(1);
});
it('handles access expiring before a challenge arrives', async () => {
  render(<Harness />);
  (hasInterviewAccess as jest.Mock).mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar meu currículo' }));
  await screen.findByRole('alert');
  expect(generateResume).not.toHaveBeenCalled();
});
it('ignores a profile read rejection after the screen is closed', async () => {
  let reject!: (reason: Error) => void;
  (readHeaderProfile as jest.Mock).mockReturnValueOnce(
    new Promise((_done, fail) => {
      reject = fail;
    }),
  );
  const view = render(<Harness />);
  view.unmount();
  await act(async () => {
    reject(new Error('closed'));
  });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('supports a legacy profile without a professional title in the dedicated editor', () => {
  render(
    <ProfileEditor
      profile={{ name: '', email: '', phone: '', confirmed: false }}
      busy={false}
      onSave={jest.fn()}
      onCancel={jest.fn()}
    />,
  );
  expect(screen.getByLabelText('Título profissional')).toHaveValue('');
});
it.each([true, false])('returns missing evidence to the motor, guided=%s', async (guided) => {
  (generateResume as jest.Mock).mockResolvedValueOnce({
    kind: 'pending',
    reason: 'Esclarecer participação individual.',
  });
  render(<Harness initial={guided ? startGuided(fixture()) : fixture()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Preparar meu currículo' }));
  await screen.findByText(
    'Não conseguimos concluir uma versão válida. Sua história permanece salva.',
  );
  expect(captureAnalyticsEvent).not.toHaveBeenCalled();
  expect(commitInterview).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ kind: 'pending' }),
    expect.any(Function),
  );
});
it('shows a visible Editar action on each section and opens the filled section editor', async () => {
  render(<Harness initial={reviewingSession()} />);
  const edit = screen.getByRole('button', { name: 'Editar Resumo' });
  expect(edit).toHaveTextContent(/^Editar$/);
  const profileEdit = screen.getByRole('button', { name: 'Editar nome e contatos' });
  expect(profileEdit).toHaveTextContent(/^Editar$/);
  fireEvent.click(edit);
  expect(screen.getByLabelText('Título da seção')).toHaveValue('Resumo');
  expect(screen.getByLabelText('Conteúdo')).toHaveValue('Atendeu clientes');
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Adicionar seção' }));
  expect(screen.getByLabelText('Título da seção')).toHaveValue('');
  expect(screen.getByLabelText('Conteúdo')).toHaveValue('');
  await act(async () => {});
});
it('locks the approved document and keeps it read-only after opening it again', async () => {
  const s = approveResume(
    reviewingSession(),
    { hash: 'document', profileHash: 'profile', approvedAt: 1 },
    true,
  );
  (readHeaderProfile as jest.Mock).mockResolvedValueOnce({
    name: '',
    email: '',
    phone: '',
    confirmed: true,
  });
  render(<Harness initial={s} />);
  await act(async () => {});
  expect(screen.getByRole('heading', { name: 'Currículo aprovado' })).toBeInTheDocument();
  expect(screen.getByText('Atendeu clientes')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Adicionar seção' })).not.toBeInTheDocument();
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  expect(screen.queryByText('Nome e contatos')).not.toBeInTheDocument();
});
it('closes an open editor when the document becomes approved', async () => {
  const s = reviewingSession();
  const draft = { hasJob: false, jobText: '', targetRole: 'Atendente', accepted: true };
  const view = render(<ResumeReview session={s} draft={draft} onChange={jest.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Editar Resumo' }));
  expect(screen.getByLabelText('Conteúdo')).toHaveValue('Atendeu clientes');
  view.rerender(
    <ResumeReview
      session={approveResume(s, { hash: 'document', profileHash: 'profile', approvedAt: 1 }, true)}
      draft={draft}
      onChange={jest.fn()}
    />,
  );
  expect(screen.queryAllByRole('textbox')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Salvar alterações' })).not.toBeInTheDocument();
  await act(async () => {});
});
