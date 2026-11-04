import type { ResumeSection } from '@hirepair/interview-engine';
import type { HeaderProfile } from './engine-storage';
export const PROFILE_FIELDS = [
  ['name', 'Nome'],
  ['professionalTitle', 'Título profissional'],
  ['location', 'Cidade e estado'],
  ['email', 'E-mail'],
  ['phone', 'Telefone'],
  ['linkedin', 'LinkedIn'],
  ['github', 'GitHub'],
  ['portfolio', 'Portfólio ou site'],
] as const;
export function contactLine(profile: HeaderProfile): string {
  return [
    [profile.location, profile.phone, profile.email].filter(Boolean).join(' | '),
    [profile.linkedin, profile.github, profile.portfolio].filter(Boolean).join(' | '),
  ]
    .filter(Boolean)
    .join('\n');
}
export function resumeBlocks(sections: ResumeSection[]) {
  return sections.map((section, index) => ({
    section,
    isExperience: section.experienceId !== null,
    areaTitle:
      section.experienceId !== null && (index === 0 || sections[index - 1].experienceId === null)
        ? 'Experiência e projetos'
        : null,
  }));
}
