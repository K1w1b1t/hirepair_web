import { act, fireEvent, render, screen } from '@testing-library/react';
import { JobExampleStep } from './job-example-step';

describe('JobExampleStep', () => {
  it('asks for a job example and keeps the analysis disabled until terms are accepted', () => {
    render(
      <JobExampleStep
        documents={[
          {
            id: 'resume',
            text: 'Mecânico de manutenção',
            fileName: 'curriculo.txt',
            source: 'pasted',
            fileType: 'TXT',
            findings: [],
            createdAt: 1,
          },
        ]}
      />,
    );
    const button = screen.getByRole('button', { name: /analisar e sugerir/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      'title',
      'Informe os requisitos da vaga e aceite os Termos e a Política de Privacidade para analisar.',
    );
    fireEvent.change(screen.getByLabelText(/requisitos da vaga/i), {
      target: { value: 'Engenheiro mecânico' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
  });

  it('links to the terms and shows network failures in a temporary notification', async () => {
    jest.useFakeTimers();
    const originalFetch = globalThis.fetch;
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('NetworkError'));
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: fetchMock });
    render(
      <JobExampleStep
        documents={[
          {
            id: 'resume',
            text: 'Mecânico de manutenção',
            fileName: 'curriculo.txt',
            source: 'pasted',
            fileType: 'TXT',
            findings: [],
            createdAt: 1,
          },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Termos' })).toHaveAttribute('href', '/legal#terms');
    expect(screen.getByRole('link', { name: 'Termos' })).toHaveClass('job-terms-link');
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute(
      'href',
      '/legal#privacy',
    );
    expect(screen.getByRole('link', { name: 'Política de Privacidade' })).toHaveClass(
      'job-terms-link',
    );
    fireEvent.change(screen.getByLabelText(/requisitos da vaga/i), {
      target: { value: 'Engenheiro mecânico' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /analisar e sugerir/i }));
    expect(await screen.findByRole('alert')).toHaveClass('import-toast');
    expect(screen.getByRole('alert')).not.toHaveTextContent('NetworkError');
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    Object.defineProperty(globalThis, 'fetch', { configurable: true, value: originalFetch });
    jest.useRealTimers();
  });
});
