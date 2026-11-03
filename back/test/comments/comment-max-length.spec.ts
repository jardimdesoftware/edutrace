import {
  COMMENT_MAX_LENGTH_CEILING,
  commentMaxLengthOf,
  commentTooLongMessage,
} from 'src/comments/comment-max-length';

describe('commentMaxLengthOf', () => {
  it.each([
    ['NOTE', 1000],
    ['CLASS_COUNCIL_REPORT', 10000],
  ])('should return the limit of the %s type', (type, limit) => {
    expect(commentMaxLengthOf(type)).toBe(limit);
  });

  it('should treat an absent type as NOTE, the default of the column', () => {
    expect(commentMaxLengthOf(undefined)).toBe(1000);
  });

  it.each([
    ['null', null],
    ['a value outside the enum', 'OTHER'],
    ['the name in lower case', 'note'],
    ['a number', 5],
    ['an object', {}],
    ['a key of Object.prototype', 'constructor'],
    ['the __proto__ key', '__proto__'],
  ])(
    'should fall back to the ceiling for %s, so only the type is reported',
    (_, type) => {
      expect(commentMaxLengthOf(type)).toBe(COMMENT_MAX_LENGTH_CEILING);
    },
  );
});

describe('COMMENT_MAX_LENGTH_CEILING', () => {
  it('should be the highest limit among the types', () => {
    expect(COMMENT_MAX_LENGTH_CEILING).toBe(10000);
  });
});

describe('commentTooLongMessage', () => {
  it('should name the field and the limit', () => {
    expect(commentTooLongMessage(1000)).toBe(
      'O campo comment deve ter no máximo 1000 caracteres.',
    );
    expect(commentTooLongMessage(10000)).toBe(
      'O campo comment deve ter no máximo 10000 caracteres.',
    );
  });
});
