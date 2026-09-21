import { fireEvent, render, screen } from '@testing-library/react';
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
    fireEvent.change(screen.getByLabelText(/requisitos da vaga/i), {
      target: { value: 'Engenheiro mecânico' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    expect(button).toBeEnabled();
  });
});
