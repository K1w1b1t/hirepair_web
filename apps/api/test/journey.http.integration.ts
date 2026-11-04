/** Real HTTP authorization/failure boundaries; each scenario gets an isolated quota namespace. */
import * as assert from 'node:assert/strict';
import {
  createSession,
  startWithoutDocuments,
  runJourney,
  parseInterviewBlock,
  type Session,
} from '@hirepair/interview-engine';
import { createJourneyStack, controlledOutput } from './journey-stack';
import { buildInterviewGeneration } from '../src/interview/block.service';
import { GuestAccessService } from '../src/guest/guest-access.service';
import { AiBudgetService } from '../src/operational/ai-budget.service';
async function ready(): Promise<Session> {
  const s = createSession('synthetic-session', 'synthetic-funnel', {
    resumes: '',
    job: '',
    objective: 'ENTER_FAST',
    facts: '',
  });
  s.objective = { value: 'ENTER_FAST', provisional: false };
  const trace = await runJourney(startWithoutDocuments(s), 'Atendente', '', {
    answer: () =>
      Promise.resolve({
        kind: 'specific',
        text: 'Atualmente atendo clientes na Feira Azul desde 2024. Uso um caderno diariamente.',
      }),
    block: (request) => {
      const { sources, generation } = buildInterviewGeneration(request, 'synthetic', 'synthetic');
      return Promise.resolve(
        parseInterviewBlock(
          JSON.stringify(
            controlledOutput(
              generation.systemInstruction,
              JSON.parse(generation.prompt) as Parameters<typeof controlledOutput>[1],
            ),
          ),
          request,
          sources,
        ),
      );
    },
    write: () => Promise.resolve({ version: 1, explanation: 'Synthetic', sections: [] }),
  });
  assert.equal(trace.session.guided?.status, 'complete');
  assert.equal(trace.session.strategy?.valid, true);
  return trace.session;
}
async function main() {
  for (const scenario of [
    'authorization',
    'stale',
    'missing-selection',
    'missing-confirmation',
    'invalid-provider',
    '429',
    '503',
    'exhausted',
    'concurrent',
  ]) {
    const stack = await createJourneyStack();
    try {
      const access = stack.app.get(GuestAccessService);
      const { accessToken } = access.issue();
      const session = await ready();
      const savedFacts = JSON.stringify(session.facts);
      if (scenario === 'stale') session.inputs.job = 'changed';
      if (scenario === 'missing-selection' || scenario === 'missing-confirmation')
        session.selection = null;
      if (scenario === 'missing-confirmation') session.confirmation = null;
      if (scenario === 'invalid-provider') stack.control.failure = 'invalid';
      if (scenario === '429' || scenario === '503') stack.control.failure = scenario;
      if (scenario === 'exhausted') {
        const budget = stack.app.get(AiBudgetService);
        for (let i = 0; i < 6; i++)
          await budget.reserve(
            {
              principalId: access.verify(accessToken).visitorId,
              scopeId: session.id,
              operation: 'resume-writing',
              idempotencyKey: `prefill-${i}`,
              inputVersion: 'v1',
            },
            'synthetic-prefill',
            1,
          );
      }
      const post = () =>
        fetch(`${stack.root}/guest/resume-writing`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(scenario === 'authorization' ? {} : { authorization: `Bearer ${accessToken}` }),
            'idempotency-key': 'journey-writing-boundary-v1',
          },
          body: JSON.stringify({ version: 1, session, targetRole: 'Atendente' }),
        });
      if (scenario === 'concurrent') {
        const responses = await Promise.all([post(), post()]);
        assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
        assert.equal(stack.calls.length, 1);
      } else {
        const response = await post();
        const expected =
          scenario === 'authorization'
            ? 401
            : ['stale', 'missing-selection', 'missing-confirmation'].includes(scenario)
              ? 400
              : scenario === 'invalid-provider'
                ? 502
                : 503;
        assert.equal(response.status, expected, `${scenario}: ${await response.text()}`);
        assert.equal(
          stack.calls.length,
          ['invalid-provider', '429', '503'].includes(scenario) ? 1 : 0,
        );
      }
      assert.equal(JSON.stringify(session.facts), savedFacts, 'failure preserves facts');
      assert.equal(
        JSON.stringify(stack.calls).includes('Feira Azul'),
        false,
        'operational report has no content',
      );
      console.log(`PASS real HTTP: ${scenario}`);
    } finally {
      await stack.close();
    }
  }
}
void main().catch((error: unknown) => {
  console.error(error);
  console.error('HTTP journey boundaries failed; inspect the failing scenario.');
  process.exitCode = 1;
});
