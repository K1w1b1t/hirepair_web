import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('explains the upcoming product in the main heading', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Um currículo claro para abrir portas.' }),
    ).toBeInTheDocument();
  });

  it('describes the three product principles for visitors and search engines', () => {
    render(<Home />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Passo a passo, sem complicação' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Feito para processos seletivos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Seu currículo pronto para compartilhar' }),
    ).toBeInTheDocument();
  });
});
