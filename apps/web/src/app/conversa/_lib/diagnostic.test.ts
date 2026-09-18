import { diagnoseResumeText, type FindingSeverity } from './diagnostic';

describe('diagnoseResumeText', () => {
  it('detects glued words without flagging legitimate camelCase terms', () => {
    const findings = diagnoseResumeText(
      'Experiênciade atendimento com TypeScript, DevOps e Docker.',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      kind: 'PARSING',
      severity: 'CRITICAL',
    });
    expect(findings[0].detail).toContain('Experiênciade');
    expect(findings[0].detail).not.toMatch(/TypeScript|DevOps|Docker/);
  });

  it('detects formatted and unformatted CPF, RG, marital status and birth date', () => {
    const findings = diagnoseResumeText(
      'CPF: 123.456.789-09 RG: 12.345.678 estado civil: solteira data de nascimento: 01/01/1990',
    );

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'SENSITIVE_DATA', severity: 'HIGH' });
    expect(findings[0].detail).toMatch(/CPF/);
    expect(findings[0].detail).toMatch(/RG/);
    expect(findings[0].detail).toMatch(/estado civil/);
    expect(findings[0].detail).toMatch(/data de nascimento/);
  });

  it('detects an unformatted CPF and repeated terms', () => {
    const findings = diagnoseResumeText('CPF 12345678909 atendimento atendimento');

    expect(findings.map(({ kind }) => kind)).toEqual(['SENSITIVE_DATA', 'PARSING']);
    expect(findings[1]).toMatchObject({ severity: 'LOW' });
    expect(findings[1].detail).toContain('atendimento atendimento');
  });

  it('orders findings from critical to low severity', () => {
    const findings = diagnoseResumeText(
      'Experiênciade atendimento. CPF 12345678909. atendimento atendimento.',
    );
    const severities = findings.map(({ severity }) => severity) as FindingSeverity[];

    expect(severities).toEqual(['CRITICAL', 'HIGH', 'LOW']);
  });

  it('returns no findings for clean text', () => {
    expect(diagnoseResumeText('Atendimento ao cliente e uso de TypeScript.')).toEqual([]);
  });
});
