import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HeaderProfile } from './header-profile';
import { readHeaderProfile, saveHeaderProfile } from '../_lib/engine-storage';
jest.mock('../_lib/engine-storage', () => ({
  readHeaderProfile: jest.fn(),
  saveHeaderProfile: jest.fn(),
}));
beforeEach(() => {
  jest.resetAllMocks();
  (readHeaderProfile as jest.Mock).mockResolvedValue(null);
});
it('confirms optional local header fields and makes edits pending again', async () => {
  render(<HeaderProfile />);
  await act(async () => {});
  for (const label of ['Nome', 'E-mail', 'Telefone'])
    fireEvent.change(screen.getByLabelText(label), { target: { value: label } });
  fireEvent.click(screen.getByText('Confirmar dados do cabeçalho'));
  expect(await screen.findByRole('status')).toHaveTextContent('Você confirmou');
  expect(saveHeaderProfile).toHaveBeenCalledWith({
    name: 'Nome',
    email: 'E-mail',
    phone: 'Telefone',
    confirmed: true,
  });
  fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Outro' } });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
it('restores saved header and announces storage failures', async () => {
  (readHeaderProfile as jest.Mock).mockResolvedValueOnce({
    name: 'Sintético',
    email: '',
    phone: '',
    confirmed: true,
  });
  render(<HeaderProfile />);
  await waitFor(() => expect(screen.getByLabelText('Nome')).toHaveValue('Sintético'));
  (saveHeaderProfile as jest.Mock).mockRejectedValueOnce(new Error('quota'));
  fireEvent.click(screen.getByText('Confirmar dados do cabeçalho'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar');
});
it('announces read errors and ignores late reads after unmount', async () => {
  (readHeaderProfile as jest.Mock).mockRejectedValueOnce(new Error('unavailable'));
  const view = render(<HeaderProfile />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível abrir');
  view.unmount();
  let resolve!: (v: unknown) => void;
  (readHeaderProfile as jest.Mock).mockReturnValueOnce(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const next = render(<HeaderProfile />);
  next.unmount();
  await act(async () => resolve({ name: 'Tarde' }));
  (readHeaderProfile as jest.Mock).mockRejectedValueOnce(new Error('late'));
  const last = render(<HeaderProfile />);
  last.unmount();
  await act(async () => {});
});
