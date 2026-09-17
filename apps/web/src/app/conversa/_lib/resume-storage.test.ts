import 'fake-indexeddb/auto';
import {
  clearStoredResumes,
  deleteStoredResume,
  listStoredResumes,
  saveStoredResume,
} from './resume-storage';

const firstResume = {
  id: 'resume-1',
  text: 'Experiência em atendimento',
  fileName: 'curriculo.txt',
  source: 'file' as const,
  fileType: 'TXT' as const,
  findings: [],
  createdAt: 100,
};

const secondResume = {
  ...firstResume,
  id: 'resume-2',
  fileName: 'perfil.md',
  source: 'pasted' as const,
  createdAt: 200,
};

describe('resume storage', () => {
  beforeEach(async () => {
    await clearStoredResumes();
  });

  it('saves, lists in creation order, updates, and deletes local resumes', async () => {
    await saveStoredResume(firstResume);
    await saveStoredResume(secondResume);

    expect(await listStoredResumes()).toEqual([firstResume, secondResume]);

    const updated = { ...firstResume, text: 'Experiência atualizada' };
    await saveStoredResume(updated);
    expect(await listStoredResumes()).toEqual([updated, secondResume]);

    await deleteStoredResume(firstResume.id);
    expect(await listStoredResumes()).toEqual([secondResume]);
  });

  it('returns an empty list after clearing the database', async () => {
    await saveStoredResume(firstResume);
    await clearStoredResumes();

    expect(await listStoredResumes()).toEqual([]);
  });
});
