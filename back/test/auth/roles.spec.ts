import { hasAnyRole } from 'src/auth/roles';

describe('hasAnyRole', () => {
  it.each([
    [[3], [3, 5], true],
    [[3, 6], [6], true],
    [[3, 6], [1, 2], false],
    [[6], [3, 5], false],
    [[1], [1], true],
  ])('should answer for roles %j against %j', (roles, allowed, expected) => {
    expect(hasAnyRole(roles, allowed)).toBe(expected);
  });

  it('should deny when the user has no roles', () => {
    expect(hasAnyRole([], [1, 2, 3])).toBe(false);
    expect(hasAnyRole(undefined, [1, 2, 3])).toBe(false);
    expect(hasAnyRole(null, [1, 2, 3])).toBe(false);
  });

  it('should deny when the allowed list is empty', () => {
    expect(hasAnyRole([1, 2], [])).toBe(false);
  });
});
