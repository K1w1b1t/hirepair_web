import 'fake-indexeddb/auto';
import { serialize, deserialize } from 'node:v8';
import { createSession } from '@hirepair/interview-engine';
import { commitInterview, hashValue } from './interview-session';
import { deleteEngine, saveEngine, readEngine } from './engine-storage';
Object.defineProperty(globalThis, 'structuredClone', {
  configurable: true,
  value: (v: unknown) => deserialize(serialize(v)),
});
it('commits commands with a content hash and expected revision, refusing stale writes', async () => {
  await deleteEngine();
  const initial = createSession('s', 'f', { resumes: '', job: '', objective: '', facts: '' });
  await saveEngine(initial, null);
  const result = await commitInterview(initial, { action: 'declare' }, (s) => ({
    ...s,
    objective: { value: 'ENTER_FAST', provisional: false },
  }));
  expect(result.commands).toHaveLength(1);
  expect(result.commands[0].hash).toBe(await hashValue({ action: 'declare' }));
  expect((await readEngine())!.revision).toBe(1);
  await expect(commitInterview(initial, {}, (s) => s)).rejects.toThrow('REVISION_CONFLICT');
});
