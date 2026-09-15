import { fireEvent, render, screen } from '@testing-library/react';
import { ResumePreviewPanel } from './resume-preview-panel';

describe('ResumePreviewPanel', () => {
  it('opens, closes by button and closes with Escape', () => {
    render(
      <ResumePreviewPanel>
        <p>Prévia vazia</p>
      </ResumePreviewPanel>,
    );
    fireEvent.click(screen.getByRole('button', { name: /ver currículo/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /ver currículo/i }));
    fireEvent.click(screen.getByRole('button', { name: /fechar prévia/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
