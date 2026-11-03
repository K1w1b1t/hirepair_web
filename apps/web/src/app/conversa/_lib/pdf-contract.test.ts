import { pageLimit } from './pdf-contract';
it.each(['A_FIRST_JOB', 'B_CAREER_CHANGE', 'C_OPERATIONAL'] as const)(
  'limits %s to one page',
  (type) => expect(pageLimit(type)).toBe(1),
);
it.each(['D_SAME_FIELD_RETURN', 'E_SPECIALIST'] as const)('allows two pages for %s', (type) =>
  expect(pageLimit(type)).toBe(2),
);
