import { transaction, invalidateEngineWrites } from './engine-storage';
import { clearStoredResumes } from './resume-storage';
import { removeBrowserValue } from './browser-storage';
import { cancelPreparation } from './guest-api';
import { ANALYSIS_KEY } from './job-analysis';
export async function cleanupJourney(discard = false): Promise<void> {
  if (discard) {
    invalidateEngineWrites();
    cancelPreparation();
    await transaction('readwrite', (store, set) => {
      for (const key of ['active', 'header-profile', 'journey', 'drafts']) store.delete(key);
      store.put(true, 'cleanup-pending');
      set(undefined);
    });
  }
  const pending = await transaction<boolean>('readonly', (store, set) => {
    const r = store.get('cleanup-pending');
    r.onsuccess = () => set(r.result === true);
  });
  if (!pending) return;
  if (!(await clearStoredResumes())) throw new Error('LOCAL_STORAGE_UNAVAILABLE');
  for (const key of [
    ANALYSIS_KEY,
    'hirepair_analysis_pending',
    'hirepair_interview_pending',
    'hirepair_engine_funnel',
  ])
    removeBrowserValue(key);
  sessionStorage.removeItem('hirepair_home_exit_intent');
  sessionStorage.removeItem('hirepair_funnel_session_id');
  sessionStorage.removeItem('hirepair_session_started_captured');
  await transaction('readwrite', (store, set) => {
    store.delete('cleanup-pending');
    set(undefined);
  });
}
