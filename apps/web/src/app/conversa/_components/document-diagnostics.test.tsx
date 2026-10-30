jest.mock('../_lib/diagnostic', () => ({
  __esModule: true,
  ...jest.requireActual('../_lib/diagnostic'),
}));
jest.mock('../_lib/resume-storage', () => ({
  __esModule: true,
  ...jest.requireActual('../_lib/resume-storage'),
}));
jest.mock('../_lib/engine-storage', () => ({
  __esModule: true,
  ...jest.requireActual('../_lib/engine-storage'),
}));
import 'fake-indexeddb/auto';
import { serialize, deserialize } from 'node:v8';
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DocumentDiagnostics } from './document-diagnostics';
import { clearStoredResumes, saveStoredResume, type StoredResume } from '../_lib/resume-storage';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (value: unknown) => deserialize(serialize(value)),
});
const doc: StoredResume = {
  id: 'synthetic',
  text: 'CPF: 123.456.789-09',
  fileName: 'synthetic.txt',
  fileType: 'TXT',
  source: 'file',
  createdAt: 0,
  findings: [],
};
beforeEach(async () => {
  await clearStoredResumes();
});
it('shows absence without inventing findings', () => {
  render(<DocumentDiagnostics documents={[]} onChange={jest.fn()} />);
  expect(screen.getByText(/sem currículo para diagnosticar/i)).toBeInTheDocument();
});
it('shows evidence, action and usage confirmation for an actual document', async () => {
  await saveStoredResume(doc);
  const change = jest.fn();
  function Harness() {
    const [docs, setDocs] = useState([doc]);
    return (
      <DocumentDiagnostics
        documents={docs}
        onChange={(next) => {
          change(next);
          setDocs(next);
        }}
      />
    );
  }
  render(<Harness />);
  expect(await screen.findByText('Dado pessoal desnecessário no documento')).toBeInTheDocument();
  expect(screen.getByText(/Remova esse dado/)).toBeInTheDocument();
  expect(screen.getByText('Observado')).toBeInTheDocument();
  await waitFor(() => expect(screen.getByLabelText(/este currículo é o usado/i)).toBeEnabled());
  fireEvent.change(screen.getByLabelText(/este currículo é o usado/i), {
    target: { value: 'yes' },
  });
  await waitFor(() =>
    expect(change).toHaveBeenCalledWith([expect.objectContaining({ usedInApplications: 'yes' })]),
  );
});

import { act } from '@testing-library/react';
import * as diagnostic from '../_lib/diagnostic';
import * as storage from '../_lib/resume-storage';
import * as engineStorage from '../_lib/engine-storage';
import { createSession } from '@hirepair/interview-engine';
afterEach(() => {
  jest.restoreAllMocks();
});
function Harness({
  initial = [doc],
  onSessionChange,
}: {
  initial?: StoredResume[];
  onSessionChange?: Parameters<typeof DocumentDiagnostics>[0]['onSessionChange'];
}) {
  const [documents, setDocuments] = useState(initial);
  return (
    <DocumentDiagnostics
      documents={documents}
      onChange={setDocuments}
      archetype="C_OPERATIONAL"
      onSessionChange={onSessionChange}
    />
  );
}
it('presents hypothesis and page evidence, allows correction, and does not diagnose stories', async () => {
  const second = { ...doc, id: 'second', fileName: 'second.txt', text: 'Atendimento atendimento' };
  const withPages = {
    ...doc,
    text: 'Domínio completo',
    pageCount: 3,
    pages: [{ page: 1, start: 0, end: 16 }],
  };
  await saveStoredResume(withPages);
  await saveStoredResume(second);
  render(<Harness initial={[withPages, second]} />);
  expect(await screen.findByText('Hipótese')).toBeInTheDocument();
  expect(screen.getByText('3 páginas medidas pelo parser')).toBeInTheDocument();
  expect(screen.getAllByText(/Página 1/)).toHaveLength(2);
  await waitFor(() =>
    expect(screen.getByLabelText(`Tipo de material de ${doc.fileName}`)).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText(`Texto do currículo de ${doc.fileName}`), {
    target: { value: 'Texto corrigido' },
  });
  fireEvent.submit(screen.getByRole('form', { name: `Corrigir texto de ${doc.fileName}` }));
  expect(await screen.findByText(/Nenhum achado nas regras aplicáveis/)).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByLabelText(`Tipo de material de ${doc.fileName}`)).toBeEnabled(),
  );
  fireEvent.change(screen.getByLabelText(`Tipo de material de ${doc.fileName}`), {
    target: { value: 'story' },
  });
  expect(await screen.findByText(/Relato preservado como material candidato/)).toBeInTheDocument();
  // Submitting whitespace produces no replacement, even when submission bypasses browser validation.
  fireEvent.change(screen.getByLabelText('Texto do currículo de second.txt'), {
    target: { value: '  ' },
  });
  fireEvent.submit(screen.getByRole('form', { name: 'Corrigir texto de second.txt' }));
  expect((await storage.listStoredResumes()).find((d) => d.id === 'second')!.text).toBe(
    second.text,
  );
});
it('reports failed changes and read/persistence unavailability honestly', async () => {
  await saveStoredResume(doc);
  render(<Harness />);
  await waitFor(() => expect(screen.getByLabelText(/este currículo é o usado/i)).toBeEnabled());
  jest.spyOn(storage, 'updateStoredResume').mockRejectedValueOnce(new Error('REVISION_CONFLICT'));
  fireEvent.change(screen.getByLabelText(/este currículo é o usado/i), {
    target: { value: 'yes' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('Reabra a jornada');
});
it('still shows local findings when engine storage cannot be read', async () => {
  await saveStoredResume(doc);
  jest.spyOn(engineStorage, 'readEngine').mockRejectedValue(new Error('LOCAL_STORAGE_UNAVAILABLE'));
  render(<Harness />);
  expect(await screen.findByText('Dado pessoal desnecessário no documento')).toBeInTheDocument();
  expect(await screen.findByRole('alert')).toHaveTextContent('retomada não está garantida');
});
it('publishes the current engine revision after attaching findings, and tolerates no session', async () => {
  await engineStorage.deleteEngine();
  await saveStoredResume(doc);
  await engineStorage.saveEngine(
    createSession('s', 'f', { resumes: '', job: '', objective: '', facts: '' }),
    null,
  );
  const onSessionChange = jest.fn();
  const view = render(<Harness onSessionChange={onSessionChange} />);
  await waitFor(() =>
    expect(onSessionChange).toHaveBeenCalledWith(
      expect.objectContaining({ diagnostics: expect.any(Array) }),
    ),
  );
  view.unmount();
  await engineStorage.deleteEngine();
  render(<Harness initial={await storage.listStoredResumes()} onSessionChange={jest.fn()} />);
  await waitFor(() => expect(screen.getByLabelText(/este currículo é o usado/i)).toBeEnabled());
});
it('ignores extraction that completes after unmount and hides findings when the target changes', async () => {
  let complete!: (value: Awaited<ReturnType<typeof diagnostic.diagnoseStoredDocuments>>) => void;
  const spy = jest.spyOn(diagnostic, 'diagnoseStoredDocuments').mockReturnValueOnce(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const view = render(<DocumentDiagnostics documents={[doc]} onChange={jest.fn()} />);
  await waitFor(() => expect(spy).toHaveBeenCalled());
  view.unmount();
  await act(async () => {
    complete([]);
  });
  spy.mockRestore();
});
it.each([false, true])(
  'ignores a late persistence completion/error after unmount (%s)',
  async (failure) => {
    await saveStoredResume(doc);
    let complete!: () => void;
    const promise = new Promise<StoredResume[]>((resolve, reject) => {
      complete = () => (failure ? reject(new Error('late')) : resolve([doc]));
    });
    const spy = jest.spyOn(diagnostic, 'persistDiagnosticReports').mockReturnValueOnce(promise);
    const view = render(
      <DocumentDiagnostics documents={[doc]} onChange={jest.fn()} onSessionChange={jest.fn()} />,
    );
    await waitFor(() => expect(spy).toHaveBeenCalled());
    view.unmount();
    await act(async () => {
      complete();
    });
  },
);
it('rejects a metadata edit on a legacy document deleted before diagnosis could be saved', async () => {
  render(<DocumentDiagnostics documents={[doc]} onChange={jest.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Reabra a jornada');
  await waitFor(() => expect(screen.getByLabelText(/este currículo é o usado/i)).toBeEnabled());
  fireEvent.change(screen.getByLabelText(/este currículo é o usado/i), {
    target: { value: 'yes' },
  });
  expect(await screen.findByRole('alert')).toHaveTextContent('retomada não está garantida');
});
