import { rolesCompositionError, sameRoles, sortRoles } from 'src/users/roles';

describe('rolesCompositionError', () => {
  it.each([[[1]], [[2]], [[3]], [[6]], [[3, 6]], [[6, 5, 4, 3]]])(
    'should accept %j',
    (roles) => {
      expect(rolesCompositionError(roles)).toBeNull();
    },
  );

  it.each([
    [[]],
    [undefined],
    ['3'],
    [[1.5]],
    [['3']],
    [[0]],
    [[7]],
    [[3, 3]],
    [[1, 3]],
    [[2, 3]],
    [[1, 2]],
    [[3, 6, 7]],
  ])('should refuse %j', (roles) => {
    expect(rolesCompositionError(roles)).toEqual(expect.any(String));
  });
});

describe('sortRoles and sameRoles', () => {
  it('should sort without mutating the input', () => {
    const roles = [6, 3];

    expect(sortRoles(roles)).toEqual([3, 6]);
    expect(roles).toEqual([6, 3]);
  });

  it('should compare as sets, ignoring the order', () => {
    expect(sameRoles([6, 3], [3, 6])).toBe(true);
    expect(sameRoles([3], [3, 6])).toBe(false);
    expect(sameRoles([3, 5], [3, 6])).toBe(false);
  });
});
