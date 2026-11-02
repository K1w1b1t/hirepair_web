import { GUIDED_EVAL_CASES, runGuidedEval } from './guided-eval';
it.each(GUIDED_EVAL_CASES)(
  'evaluates the synthetic $id journey with deterministic assertions',
  (item) => {
    expect(runGuidedEval(item)).toMatchObject({ pass: true });
  },
);
