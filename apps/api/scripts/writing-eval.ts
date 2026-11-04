import {
  WRITING_CASES,
  WRITING_RUBRIC_VERSION,
  evaluateWritingFixture,
} from '@hirepair/interview-engine';
const cases = WRITING_CASES.map(evaluateWritingFixture);
process.stdout.write(
  JSON.stringify(
    {
      mode: 'synthetic-contracts',
      rubricVersion: WRITING_RUBRIC_VERSION,
      semanticApproval: false,
      cases,
    },
    null,
    2,
  ) + '\n',
);
if (cases.some((item) => !item.structuralPass)) process.exitCode = 1;
