import { render, screen } from '@testing-library/react';
import Home from './page';

it('opens the real product from the main landing CTA while preserving contact', () => {
  render(<Home />);
  expect(screen.getByRole('link', { name: 'Começar a conversa' })).toHaveAttribute(
    'href',
    '/conversa',
  );
  expect(screen.getByRole('link', { name: /conversar pelo whatsapp/i })).toHaveAttribute(
    'href',
    expect.stringContaining('wa.me'),
  );
});
