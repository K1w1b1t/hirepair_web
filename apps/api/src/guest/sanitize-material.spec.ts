import { sanitizeMaterial } from './sanitize-material';
describe('provider data minimization', () => {
  it('masks identifiers and contact without changing experience or employment dates', () => {
    const input =
      'CPF: 123.456.789-00\nRG: 12.345.678-9\nTelefone: (11) 99999-1234\nEmail: pessoa@example.com\nNascimento: 12/04/1990\nEndereço: Rua Azul, 123\nFiliação: Maria Silva\nhttps://linkedin.com/in/pessoa\nMecânico 2018–2024';
    const output = sanitizeMaterial(input);
    expect(output).not.toMatch(/123\.456|12\.345|99999|pessoa|1990|Rua Azul|Maria Silva/);
    expect(output).toContain('Mecânico 2018–2024');
  });
});
