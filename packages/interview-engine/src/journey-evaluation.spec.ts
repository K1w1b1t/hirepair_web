import { evaluateJourneyReview, JOURNEY_DIMENSIONS } from './journey-evaluation';

const scores = Object.fromEntries(JOURNEY_DIMENSIONS.map((key) => [key, 3]));
it('requires recorded human review independently of automatic scores', () => {
  expect(evaluateJourneyReview(scores, [], null)).toBe('pending-review');
});
it('accepts a reviewed case only when every dimension meets the threshold', () => {
  expect(evaluateJourneyReview(scores, [], 'reviewer')).toBe('passed');
  expect(evaluateJourneyReview({ ...scores, clarity: 2 }, [], 'reviewer')).toBe('failed');
});
it('blocks critical failures regardless of scores or missing review', () => {
  expect(evaluateJourneyReview(scores, ['fabrication'], null)).toBe('failed');
});
it('rejects missing, fractional and out of range scores', () => {
  for (const clarity of [undefined, -1, 5, 3.5, NaN]) {
    expect(evaluateJourneyReview({ ...scores, clarity }, [], 'reviewer')).toBe('failed');
  }
  expect(evaluateJourneyReview(scores, [], ' ')).toBe('pending-review');
});
