import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home', () => {
  it('renders the page heading', () => {
    render(<Home />);

    expect(screen.getByRole('heading', { level: 1, name: 'HirePair Web' })).toBeInTheDocument();
  });

  it('renders the three stack cards', () => {
    render(<Home />);

    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(3);
  });
});
