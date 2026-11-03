import { render, screen } from '@testing-library/react';
import Page from './page';
import DetailPage from './[id]/page';
jest.mock('./resume-library', () => ({
  ResumeLibrary: ({ id }: { id?: string }) => <p>{id || 'Biblioteca'}</p>,
}));
it('renders the library and resolves a saved resume route', async () => {
  const v = render(<Page />);
  expect(screen.getByText('Biblioteca')).toBeInTheDocument();
  v.unmount();
  render(await DetailPage({ params: Promise.resolve({ id: 'resume-id' }) }));
  expect(screen.getByText('resume-id')).toBeInTheDocument();
});
