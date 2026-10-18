import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { UpdateCommentDto } from 'src/comments/dto/update-comment.dto';
import { createValidationPipe } from 'src/common/validation-pipe';

function errorsOf(payload: Record<string, unknown>, property: string) {
  return validateSync(plainToInstance(UpdateCommentDto, payload)).filter(
    (error) => error.property === property,
  );
}

describe('UpdateCommentDto', () => {
  it('should accept a comment with exactly 1000 characters', () => {
    expect(errorsOf({ comment: 'a'.repeat(1000) }, 'comment')).toHaveLength(0);
  });

  it('should accept accents, punctuation, symbols and line breaks', () => {
    const comment =
      'Correção da anotação: "atenção" & concentração.\nSegunda linha.';

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

describe('UpdateCommentDto, teto do comment', () => {
  it('should accept a comment with exactly 10000 characters', () => {
    expect(errorsOf({ comment: 'a'.repeat(10000) }, 'comment')).toHaveLength(0);
  });

  it('should leave the limit of the annotation to the service', () => {
    expect(errorsOf({ comment: 'a'.repeat(1001) }, 'comment')).toHaveLength(0);
  });

  it('should reject a comment with 10001 characters', () => {
    const errors = errorsOf({ comment: 'a'.repeat(10001) }, 'comment');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.maxLength).toBe(
      'O campo comment deve ter no máximo 10000 caracteres.',
    );
  });

  it('should count in UTF-16 units, so 5001 emojis are above the ceiling', () => {
    expect(errorsOf({ comment: '😀'.repeat(5000) }, 'comment')).toHaveLength(0);
    expect(errorsOf({ comment: '😀'.repeat(5001) }, 'comment')).toHaveLength(1);
  });
});

describe('UpdateCommentDto, campo type', () => {
  const pipe = createValidationPipe();

  function transform(body: Record<string, unknown>) {
    return pipe.transform(body, { type: 'body', metatype: UpdateCommentDto });
  }

  it.each(['NOTE', 'CLASS_COUNCIL_REPORT', null, 'OTHER'])(
    'should refuse type %s in the body, because the type does not change after the creation',
    async (type) => {
      const result = transform({ comment: 'Texto', type });

      await expect(result).rejects.toThrow(BadRequestException);
      await expect(result).rejects.toMatchObject({
        response: { message: ['property type should not exist'] },
      });
    },
  );

  it('should accept the body with only comment and notify_by_email', async () => {
    await expect(
      transform({ comment: 'Texto', notify_by_email: true }),
    ).resolves.toBeInstanceOf(UpdateCommentDto);
  });
});

describe('UpdateCommentDto, caracteres de controle no comment', () => {
  it.each([
    ['NUL', 'antes\u0000depois'],
    ['U+0085, um controle C1', 'antes\u0085depois'],
    ['ESC', 'antes\u001bdepois'],
    ['DEL', 'antes\u007fdepois'],
    ['a lone high surrogate', 'antes\uD800depois'],
    ['a lone low surrogate', 'antes\uDC00depois'],
  ])('should reject %s', (_, comment) => {
    const errors = errorsOf({ comment }, 'comment');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.matches).toBe(
      'O campo comment não pode ter caracteres de controle, exceto tabulação e quebra de linha.',
    );
  });

  it.each([
    ['a tab', 'coluna 1\tcoluna 2'],
    ['a line feed', 'linha 1\nlinha 2'],
    ['a carriage return and a line feed', 'linha 1\r\nlinha 2'],
    ['an emoji, which is a valid surrogate pair', 'ótimo \uD83D\uDE00'],
  ])('should accept %s', (_, comment) => {
    expect(errorsOf({ comment }, 'comment')).toHaveLength(0);
  });
});

describe('UpdateCommentDto, marcas combinantes seguidas no comment', () => {
  const message =
    'O campo comment não pode ter mais de 30 acentos ou marcas seguidos.';
  const ACUTE = '́';
  const DOT_BELOW = '̖';

  it('should accept 30 marks in a row', () => {
    expect(
      errorsOf({ comment: `a${ACUTE.repeat(30)}` }, 'comment'),
    ).toHaveLength(0);
  });

  it('should reject 31 marks in a row with the message of the field', () => {
    const errors = errorsOf({ comment: `a${ACUTE.repeat(31)}` }, 'comment');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.maxCombiningMarkRun).toBe(message);
  });

  it('should count marks of different kinds as one run', () => {
    expect(
      errorsOf(
        { comment: `a${ACUTE.repeat(15)}${DOT_BELOW.repeat(15)}` },
        'comment',
      ),
    ).toHaveLength(0);
    expect(
      errorsOf(
        { comment: `a${ACUTE.repeat(15)}${DOT_BELOW.repeat(16)}` },
        'comment',
      ),
    ).toHaveLength(1);
  });

  it('should accept many runs of 30 marks, each one separated by a letter', () => {
    expect(
      errorsOf({ comment: `a${ACUTE.repeat(30)}`.repeat(30) }, 'comment'),
    ).toHaveLength(0);
  });

  it('should accept Portuguese text written in the composed and in the decomposed form', () => {
    const text = 'Ação, atenção e coordenação: João não tem dificuldade.';

    expect(
      errorsOf({ comment: text.normalize('NFC') }, 'comment'),
    ).toHaveLength(0);
    expect(
      errorsOf({ comment: text.normalize('NFD') }, 'comment'),
    ).toHaveLength(0);
  });

  it('should reject the text of 10000 units made of 4999 + 5000 marks that slows the search down', () => {
    const comment = `a${ACUTE.repeat(4999)}${DOT_BELOW.repeat(5000)}`;

    const errors = errorsOf({ comment }, 'comment');

    expect(comment).toHaveLength(10000);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.maxCombiningMarkRun).toBe(message);
  });
});
