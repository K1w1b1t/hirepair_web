import RootLayout, { metadata } from './layout';

describe('RootLayout', () => {
  it('sets the document language and renders its content', () => {
    const layout = RootLayout({ children: <main>Conteúdo</main> });

    expect(layout.props.lang).toBe('pt-BR');
    expect(layout.props.children.props.children).toEqual(<main>Conteúdo</main>);
    expect(metadata.title).toBe('HirePair | Currículos claros para novas oportunidades');
  });
});
