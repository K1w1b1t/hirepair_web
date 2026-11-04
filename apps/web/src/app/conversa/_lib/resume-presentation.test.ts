import { contactLine, resumeBlocks, PROFILE_FIELDS } from './resume-presentation';
it('lists local contact fields without requiring missing legacy fields', () => {
  expect(contactLine({ name: '', email: '', phone: '', confirmed: false })).toBe('');
  expect(
    contactLine({
      name: 'Ana',
      email: 'ana@example.com',
      phone: '123',
      location: 'Cidade, SP',
      linkedin: 'linkedin.com/in/exemplo',
      github: 'github.com/exemplo',
      portfolio: 'https://example.com',
      confirmed: true,
    }),
  ).toBe(
    'Cidade, SP | 123 | ana@example.com\nlinkedin.com/in/exemplo | github.com/exemplo | https://example.com',
  );
  expect(PROFILE_FIELDS.map(([key]) => key)).toEqual([
    'name',
    'professionalTitle',
    'location',
    'email',
    'phone',
    'linkedin',
    'github',
    'portfolio',
  ]);
});
it('separates area headings from experience entries without changing the content or order', () => {
  const sections = [null, 'job-a', 'job-b', null, 'project'].map((experienceId, i) => ({
    id: String(i),
    title: `Seção ${i}`,
    experienceId,
    units: [],
  }));
  const blocks = resumeBlocks(sections);
  expect(blocks.map((b) => b.section)).toEqual(sections);
  expect(blocks.map((b) => b.areaTitle)).toEqual([
    null,
    'Experiência e projetos',
    null,
    null,
    'Experiência e projetos',
  ]);
  expect(blocks.map((b) => b.isExperience)).toEqual([false, true, true, false, true]);
  expect(resumeBlocks([sections[1]])[0].areaTitle).toBe('Experiência e projetos');
  expect(resumeBlocks([])).toEqual([]);
});
it('separates direct contact from professional links into two readable lines', () => {
  expect(
    contactLine({
      name: '',
      email: 'ana@example.com',
      phone: '123',
      location: 'Cidade, SP',
      linkedin: 'linkedin.com/in/exemplo',
      confirmed: true,
    }),
  ).toBe('Cidade, SP | 123 | ana@example.com\nlinkedin.com/in/exemplo');
});
