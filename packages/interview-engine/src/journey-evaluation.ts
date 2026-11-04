export const JOURNEY_DIMENSIONS = [
  'questionRelevance',
  'evidenceGain',
  'sufficiency',
  'fidelity',
  'proportionality',
  'clarity',
  'sectionStructure',
  'presentation',
] as const;

export function evaluateJourneyReview(
  scores: Record<string, number | undefined>,
  criticalFailures: readonly string[],
  reviewer: string | null,
): 'passed' | 'failed' | 'pending-review' {
  if (criticalFailures.length) return 'failed';
  if (
    JOURNEY_DIMENSIONS.some((key) => {
      const score = scores[key];
      return score === undefined || !Number.isInteger(score) || score < 3 || score > 4;
    })
  )
    return 'failed';
  if (!reviewer?.trim()) return 'pending-review';
  return 'passed';
}
