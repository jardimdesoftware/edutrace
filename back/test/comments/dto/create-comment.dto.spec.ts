import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateCommentDto } from 'src/comments/dto/create-comment.dto';

function validate(payload: Record<string, unknown>) {
  return validateSync(
    plainToInstance(CreateCommentDto, { id_user: 2, ...payload }),
  );
}

function errorsOf(payload: Record<string, unknown>, property: string) {
  return validate(payload).filter((error) => error.property === property);
}

describe('CreateCommentDto, campo comment', () => {
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

  it('should count accented characters as a single character', () => {
    expect(errorsOf({ comment: 'ç'.repeat(1000) }, 'comment')).toHaveLength(0);
    expect(errorsOf({ comment: 'ç'.repeat(1001) }, 'comment')).toHaveLength(1);
  });

  it('should accept accents, punctuation, symbols and line breaks', () => {
    const comment = [
      'Avaliação do João: atenção e coordenação em evolução.',
      'Observações do responsável: "não houve intercorrência".',
      'Símbolos aceitos: <, >, &, %, #, @, $, 100%, 1/2, a+b.',
      'Acentuação completa: áàâãéêíóôõúüç ÁÀÂÃÉÊÍÓÔÕÚÜÇ.',
    ].join('\n');

    expect(errorsOf({ comment }, 'comment')).toHaveLength(0);
  });

  it('should not treat html or script text as invalid', () => {
    const comment = '<script>alert(1)</script> & <b>negrito</b>';

    expect(errorsOf({ comment }, 'comment')).toHaveLength(0);
  });

  it('should reject an empty comment', () => {
    const errors = errorsOf({ comment: '' }, 'comment');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isNotEmpty).toBe(
      'O campo comment não deve estar vazio.',
    );
  });

  it('should reject a comment that is not a string', () => {
    const errors = errorsOf({ comment: 42 }, 'comment');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isString).toBe(
      'O campo comment deve ser uma string.',
    );
  });
});

describe('CreateCommentDto, campo notify_by_email', () => {
  it('should accept the payload without the field', () => {
    expect(
      errorsOf({ comment: 'Anotação' }, 'notify_by_email'),
    ).toHaveLength(0);
  });

  it('should accept a boolean value', () => {
    expect(
      errorsOf({ comment: 'Anotação', notify_by_email: true }, 'notify_by_email'),
    ).toHaveLength(0);
  });

  it('should reject a value that is not a boolean', () => {
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
