import { WRITING_CASES, evaluateWritingFixture } from './writing-evaluation';
it.each(WRITING_CASES)(
  'runs the synthetic writing contract $id without certifying semantics',
  (item) => {
    expect(evaluateWritingFixture(item)).toMatchObject({
      id: item.id,
      structuralPass: true,
      accepted: item.accepted,
      humanReview: { status: 'pending' },
    });
  },
);
