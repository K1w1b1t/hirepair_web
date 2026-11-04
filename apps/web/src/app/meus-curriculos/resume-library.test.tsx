import { render, screen, act } from '@testing-library/react';
import { ResumeLibrary } from './resume-library';
import { listCompletedResumes, readCompletedResume } from '../conversa/_lib/completed-resumes';
jest.mock('../conversa/_lib/completed-resumes', () => ({
  listCompletedResumes: jest.fn(),
  readCompletedResume: jest.fn(),
}));
jest.mock('../conversa/_components/pdf-export', () => ({ PdfExport: () => <a>Baixar PDF</a> }));
const fixture = {
  id: 'r',
  title: 'Atendente',
  approvedAt: 1,
  profile: { name: 'Ana Sintética', professionalTitle: 'Atendente', email: '', phone: '' },
  document: {
    sections: [
      { id: 's', title: 'Resumo', units: [{ id: 'u', text: 'Atendeu clientes com atenção.' }] },
    ],
  },
  artifact: {},
};
it('shows the empty state and the existing create flow', async () => {
  (listCompletedResumes as jest.Mock).mockResolvedValue([]);
  render(<ResumeLibrary />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  await screen.findByText('Seu próximo passo começa com um currículo');
  expect(screen.getByRole('link', { name: 'Criar meu currículo' })).toHaveAttribute(
    'href',
    '/conversa',
  );
});
it('lists saved resumes and opens their approved screen', async () => {
  (listCompletedResumes as jest.Mock).mockResolvedValue([fixture]);
  render(<ResumeLibrary />);
  expect(await screen.findByRole('link', { name: /Atendente/ })).toHaveAttribute(
    'href',
    '/meus-curriculos/r',
  );
});
it('shows the stored file and accessible text', async () => {
  (readCompletedResume as jest.Mock).mockResolvedValue(fixture);
  render(<ResumeLibrary id="r" />);
  await screen.findByText('Baixar PDF');
  expect(screen.getByText('Ana Sintética')).toBeInTheDocument();
  expect(screen.getByText('Atendeu clientes com atenção.')).toBeInTheDocument();
});
it('reports missing resumes and storage errors', async () => {
  (readCompletedResume as jest.Mock).mockResolvedValue(null);
  const view = render(<ResumeLibrary id="missing" />);
  expect(await screen.findByRole('alert')).toHaveTextContent('não foi encontrado');
  view.unmount();
  (listCompletedResumes as jest.Mock).mockRejectedValue(new Error());
  render(<ResumeLibrary />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível');
});
it('ignores results and errors after leaving', async () => {
  let resolve!: (v: unknown[]) => void;
  (listCompletedResumes as jest.Mock).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const v = render(<ResumeLibrary />);
  v.unmount();
  await act(async () => resolve([]));
  let reject!: (v: Error) => void;
  (listCompletedResumes as jest.Mock).mockImplementation(
    () =>
      new Promise((_r, j) => {
        reject = j;
      }),
  );
  const w = render(<ResumeLibrary />);
  w.unmount();
  await act(async () => reject(new Error()));
});
it('keeps approved sections accessible without a visible textual panel', async () => {
  (readCompletedResume as jest.Mock).mockResolvedValue(fixture);
  render(<ResumeLibrary id="r" />);
  await screen.findByText('Baixar PDF');
  expect(screen.queryByText('Versão textual acessível')).not.toBeInTheDocument();
  expect(screen.getByRole('article', { name: 'Versão textual do currículo' })).toHaveClass(
    'sr-only',
  );
});
it('preserves every stored contact in the accessible approved version', async () => {
  (readCompletedResume as jest.Mock).mockResolvedValue({
    ...fixture,
    profile: {
      ...fixture.profile,
      location: 'Cidade, SP',
      email: 'ana@example.com',
      phone: '123',
      linkedin: 'linkedin.com/in/exemplo',
      github: 'github.com/exemplo',
      portfolio: 'https://example.com',
    },
  });
  render(<ResumeLibrary id="r" />);
  await screen.findByText('Baixar PDF');
  expect(screen.getByRole('article', { name: 'Versão textual do currículo' })).toHaveTextContent(
    'Cidade, SP | 123 | ana@example.com linkedin.com/in/exemplo | github.com/exemplo | https://example.com',
  );
});
