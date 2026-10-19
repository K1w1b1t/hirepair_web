import { requestRoute } from './request-route';
it.each([undefined, null, '/private', {}, { path: 123 }])(
  'does not log unmatched arbitrary URL data %j',
  (route) => {
    expect(requestRoute({ route, url: '/email@example.com?token=secret' })).toBe('/unmatched');
  },
);
it('uses only the server-declared route template', () => {
  expect(requestRoute({ route: { path: '/users/:id' }, url: '/users/email@example.com' })).toBe(
    '/users/:id',
  );
});
