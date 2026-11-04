import { act, renderHook, waitFor } from '@testing-library/react';
import { useRetainedDraft } from './use-retained-draft';
import { readLocalDraft, saveLocalDraft } from '../_lib/journey-progress';
jest.mock('../_lib/journey-progress', () => ({
  readLocalDraft: jest.fn(),
  saveLocalDraft: jest.fn(),
}));
beforeEach(() => {
  jest.clearAllMocks();
  (saveLocalDraft as jest.Mock).mockResolvedValue(undefined);
});
it('restores and persists typing, including functional updates', async () => {
  (readLocalDraft as jest.Mock).mockResolvedValue('salvo');
  const { result } = renderHook(() => useRetainedDraft('answer', ''));
  await waitFor(() => expect(result.current[0]).toBe('salvo'));
  act(() => result.current[1]((previous) => previous + '!'));
  expect(saveLocalDraft).toHaveBeenLastCalledWith('answer', 'salvo!');
  act(() => result.current[1]('novo'));
  expect(result.current[0]).toBe('novo');
});
it('does not overwrite typing with late restoration', async () => {
  let resolve!: (value: string) => void;
  (readLocalDraft as jest.Mock).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const { result } = renderHook(() => useRetainedDraft('a', ''));
  act(() => result.current[1]('digitado'));
  await act(async () => resolve('antigo'));
  expect(result.current[0]).toBe('digitado');
});
it('ignores a late result after unmount and handles missing drafts', async () => {
  let resolve!: (value: string | null) => void;
  (readLocalDraft as jest.Mock).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const view = renderHook(() => useRetainedDraft('a', 'inicial'));
  view.unmount();
  await act(async () => resolve('late'));
  (readLocalDraft as jest.Mock).mockResolvedValue(null);
  const next = renderHook(() => useRetainedDraft('b', 'inicial'));
  await act(async () => {});
  expect(next.result.current[0]).toBe('inicial');
});
it('reports storage failures', async () => {
  (readLocalDraft as jest.Mock).mockRejectedValue(new Error());
  const { result } = renderHook(() => useRetainedDraft('a', ''));
  await waitFor(() => expect(result.current[2]).toContain('abrir'));
  (saveLocalDraft as jest.Mock).mockRejectedValue(new Error());
  act(() => result.current[1]('novo'));
  await waitFor(() => expect(result.current[2]).toContain('salvar'));
});
it('ignores a read failure arriving after unmount', async () => {
  let reject!: (value: Error) => void;
  (readLocalDraft as jest.Mock).mockImplementation(
    () =>
      new Promise((_r, j) => {
        reject = j;
      }),
  );
  const v = renderHook(() => useRetainedDraft('a', ''));
  v.unmount();
  await act(async () => reject(new Error()));
});
