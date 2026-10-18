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
    expect(errorsOf({ comment: 'Anotação' }, 'notify_by_email')).toHaveLength(
      0,
    );
  });

  it('should accept a boolean value', () => {
    expect(
      errorsOf(
        { comment: 'Anotação', notify_by_email: true },
        'notify_by_email',
      ),
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

describe('CreateCommentDto, campo type', () => {
  it('should accept the payload without the field, which records a NOTE', () => {
    expect(errorsOf({ comment: 'Anotação' }, 'type')).toHaveLength(0);
  });

  it.each(['NOTE', 'CLASS_COUNCIL_REPORT'])('should accept %s', (type) => {
    expect(errorsOf({ comment: 'Texto', type }, 'type')).toHaveLength(0);
  });

  it.each([
    ['null', null],
    ['a value outside the enum', 'OTHER'],
    ['the name in lower case', 'note'],
    ['an empty string', ''],
    ['a number', 1],
    ['an object', {}],
    ['a key of Object.prototype', 'constructor'],
  ])('should reject %s', (_, type) => {
    const errors = errorsOf({ comment: 'Texto', type }, 'type');

    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.isEnum).toBe(
      'O campo type deve ser NOTE ou CLASS_COUNCIL_REPORT.',
    );
  });
});

describe('CreateCommentDto, limite do comment por tipo', () => {
  const tooLong = (limit: number) =>
    `O campo comment deve ter no máximo ${limit} caracteres.`;

  describe.each([
    ['NOTE', { type: 'NOTE' }],
    ['the type absent', {}],
  ])('with %s', (_, typeField) => {
    it('should accept 1000 characters', () => {
      expect(
        errorsOf({ ...typeField, comment: 'a'.repeat(1000) }, 'comment'),
      ).toHaveLength(0);
    });

    it('should reject 1001 characters with the limit of the annotation', () => {
      const errors = errorsOf(
        { ...typeField, comment: 'a'.repeat(1001) },
        'comment',
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.maxLength).toBe(tooLong(1000));
    });
  });

  describe('with CLASS_COUNCIL_REPORT', () => {
    const type = 'CLASS_COUNCIL_REPORT';

    it('should accept 10000 characters', () => {
      expect(
        errorsOf({ type, comment: 'a'.repeat(10000) }, 'comment'),
      ).toHaveLength(0);
    });

    it('should accept more than the limit of the annotation', () => {
      expect(
        errorsOf({ type, comment: 'a'.repeat(1001) }, 'comment'),
      ).toHaveLength(0);
    });

    it('should reject 10001 characters with the limit of the report', () => {
      const errors = errorsOf({ type, comment: 'a'.repeat(10001) }, 'comment');

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.maxLength).toBe(tooLong(10000));
    });

    it('should still reject an empty report', () => {
      const errors = errorsOf({ type, comment: '' }, 'comment');

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.isNotEmpty).toBe(
        'O campo comment não deve estar vazio.',
      );
    });
  });

  describe('with an invalid type', () => {
    it('should keep the ceiling of 10000 on the comment, so the request cannot grow past it', () => {
      const errors = errorsOf(
        { type: 'OTHER', comment: 'a'.repeat(10001) },
        'comment',
      );

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.maxLength).toBe(tooLong(10000));
    });

    it('should report only the type for a comment that fits the ceiling', () => {
      const payload = { type: 'OTHER', comment: 'a'.repeat(1500) };

      expect(errorsOf(payload, 'comment')).toHaveLength(0);
      expect(errorsOf(payload, 'type')).toHaveLength(1);
    });
  });

  describe('counting in UTF-16 units', () => {
    const emoji = '\uD83D\uDE00';
    const heart = '\u2764\uFE0F';

    it.each([
      ['an emoji', emoji],
      ['a character followed by a variation selector', heart],
    ])(
      'should count %s as 2 units against the limit of the annotation',
      (_, unit) => {
        expect(unit.length).toBe(2);
        expect(
          errorsOf({ type: 'NOTE', comment: unit.repeat(500) }, 'comment'),
        ).toHaveLength(0);
        expect(
          errorsOf({ type: 'NOTE', comment: unit.repeat(501) }, 'comment'),
        ).toHaveLength(1);
      },
    );

    it.each([
      ['an emoji', emoji],
      ['a character followed by a variation selector', heart],
    ])(
      'should count %s as 2 units against the limit of the report',
      (_, unit) => {
        const type = 'CLASS_COUNCIL_REPORT';

        expect(
          errorsOf({ type, comment: unit.repeat(5000) }, 'comment'),
        ).toHaveLength(0);
        expect(
          errorsOf({ type, comment: unit.repeat(5001) }, 'comment'),
        ).toHaveLength(1);
      },
    );
  });
});

describe('CreateCommentDto, caracteres de controle no comment', () => {
  const message =
    'O campo comment não pode ter caracteres de controle, exceto tabulação e quebra de linha.';

  describe.each([
    ['NOTE', { type: 'NOTE' }],
    ['the type absent', {}],
    ['CLASS_COUNCIL_REPORT', { type: 'CLASS_COUNCIL_REPORT' }],
  ])('with %s', (_, typeField) => {
    it.each([
      ['NUL', 'antes\u0000depois'],
      ['U+0085, um controle C1', 'antes\u0085depois'],
      ['ESC', 'antes\u001bdepois'],
      ['DEL', 'antes\u007fdepois'],
      ['a lone high surrogate', 'antes\uD800depois'],
      ['a lone low surrogate', 'antes\uDC00depois'],
      ['a control character alone', '\u0000'],
    ])('should reject %s', (__, comment) => {
      const errors = errorsOf({ ...typeField, comment }, 'comment');

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.matches).toBe(message);
    });

    it.each([
      ['a tab', 'coluna 1\tcoluna 2'],
      ['a line feed', 'linha 1\nlinha 2'],
      ['a carriage return and a line feed', 'linha 1\r\nlinha 2'],
      ['an emoji, which is a valid surrogate pair', 'ótimo \uD83D\uDE00'],
      ['an invisible format character, which is not a control one', 'a\u200bb'],
    ])('should accept %s', (__, comment) => {
      expect(errorsOf({ ...typeField, comment }, 'comment')).toHaveLength(0);
    });
  });
});

describe('CreateCommentDto, marcas combinantes seguidas no comment', () => {
  const message =
    'O campo comment não pode ter mais de 30 acentos ou marcas seguidos.';
  const ACUTE = '́';
  const DOT_BELOW = '̖';

  describe.each([
    ['NOTE', { type: 'NOTE' }],
    ['the type absent', {}],
    ['CLASS_COUNCIL_REPORT', { type: 'CLASS_COUNCIL_REPORT' }],
  ])('with %s', (_, typeField) => {
    it('should accept 30 marks in a row', () => {
      const comment = `a${ACUTE.repeat(30)}`;

      expect(errorsOf({ ...typeField, comment }, 'comment')).toHaveLength(0);
    });

    it('should reject 31 marks in a row with the message of the field', () => {
      const comment = `a${ACUTE.repeat(31)}`;

      const errors = errorsOf({ ...typeField, comment }, 'comment');

      expect(errors).toHaveLength(1);
      expect(errors[0].constraints?.maxCombiningMarkRun).toBe(message);
    });

    it('should count marks of different kinds as one run', () => {
      const accepted = `a${ACUTE.repeat(15)}${DOT_BELOW.repeat(15)}`;
      const rejected = `a${ACUTE.repeat(15)}${DOT_BELOW.repeat(16)}`;

      expect(
        errorsOf({ ...typeField, comment: accepted }, 'comment'),
      ).toHaveLength(0);
      expect(
        errorsOf({ ...typeField, comment: rejected }, 'comment'),
      ).toHaveLength(1);
    });

    it('should count a mark outside the BMP, written as a surrogate pair', () => {
      const stem = '\u{1D165}';

      expect(
        errorsOf({ ...typeField, comment: `a${stem.repeat(30)}` }, 'comment'),
      ).toHaveLength(0);
      expect(
        errorsOf({ ...typeField, comment: `a${stem.repeat(31)}` }, 'comment'),
      ).toHaveLength(1);
    });

    it('should accept many runs of 30 marks, each one separated by a letter', () => {
      const comment = `a${ACUTE.repeat(30)}`.repeat(30);

      expect(errorsOf({ ...typeField, comment }, 'comment')).toHaveLength(0);
    });

    it('should accept Portuguese text written in the composed and in the decomposed form', () => {
      const text =
        'Ação, atenção e coordenação: João e Conceição não têm dificuldade.';

      expect(
        errorsOf({ ...typeField, comment: text.normalize('NFC') }, 'comment'),
      ).toHaveLength(0);
      expect(
        errorsOf({ ...typeField, comment: text.normalize('NFD') }, 'comment'),
      ).toHaveLength(0);
    });
  });

  it('should reject the report of 10000 units made of 4999 + 5000 marks that slows the search down', () => {
    const comment = `a${ACUTE.repeat(4999)}${DOT_BELOW.repeat(5000)}`;

    const errors = errorsOf(
      { type: 'CLASS_COUNCIL_REPORT', comment },
      'comment',
    );

    expect(comment).toHaveLength(10000);
    expect(errors).toHaveLength(1);
    expect(errors[0].constraints?.maxCombiningMarkRun).toBe(message);
  });
});
