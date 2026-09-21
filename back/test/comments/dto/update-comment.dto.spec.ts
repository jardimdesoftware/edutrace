import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateCommentDto } from 'src/comments/dto/update-comment.dto';

function errorsOf(payload: Record<string, unknown>, property: string) {
  return validateSync(plainToInstance(UpdateCommentDto, payload)).filter(
    (error) => error.property === property,
  );
}

describe('UpdateCommentDto', () => {
  it('should accept a comment with exactly 1000 characters', () => {
    expect(errorsOf({ comment: 'a'.repeat(1000) }, 'comment')).toHaveLength(0);
  });

  it('should reject a comment with 1001 characters', () => {
    const errors = errorsOf({ comment: 'a'.repeat(1001) }, 'comment');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.maxLength).toBe(
      'O campo comment deve ter no máximo 1000 caracteres.',
    );
  });

  it('should accept accents, punctuation, symbols and line breaks', () => {
    const comment = 'Correção da anotação: "atenção" & concentração.\nSegunda linha.';

    expect(errorsOf({ comment }, 'comment')).toHaveLength(0);
  });

  it('should reject an empty comment', () => {
    const errors = errorsOf({ comment: '' }, 'comment');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isNotEmpty).toBe(
      'O campo comment não deve estar vazio.',
    );
  });

  it('should reject a notify_by_email that is not a boolean', () => {
    const errors = errorsOf(
      { comment: 'Anotação', notify_by_email: 'sim' },
      'notify_by_email',
    );

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isBoolean).toBe(
      'O campo notify_by_email deve ser um booleano.',
    );
  });
});
