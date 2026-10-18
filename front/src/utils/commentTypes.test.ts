import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVISO_DE_TEXTO_LIMPO,
  LIMITE_DO_TIPO,
  ROTULO_DO_TIPO,
  TIPOS_DE_ANOTACAO,
  erroDeTamanho,
  erroDeTexto,
  montarNovaAnotacao,
  textoParaEditar,
} from './commentTypes';

// O TEXT_PATTERN do back (back/src/common/dto-fields.ts), copiado para provar
// que o front recusa e aceita os mesmos caracteres.
const TEXT_PATTERN_DO_BACK = /^(?:[^\p{Cc}\p{Cs}]|[\t\n\r])*$/u;

describe('TIPOS_DE_ANOTACAO', () => {
  it('lists the note first, as the default, and then the class council report', () => {
    assert.deepEqual([...TIPOS_DE_ANOTACAO], ['NOTE', 'CLASS_COUNCIL_REPORT']);
  });
});

describe('ROTULO_DO_TIPO', () => {
  it('names each type in Portuguese', () => {
    assert.equal(ROTULO_DO_TIPO.NOTE, 'Anotação');
    assert.equal(ROTULO_DO_TIPO.CLASS_COUNCIL_REPORT, 'Relatório multiprofissional');
  });
});

describe('LIMITE_DO_TIPO', () => {
  it('uses the same numbers as the API: 1000 for the note and 10000 for the report', () => {
    assert.deepEqual(LIMITE_DO_TIPO, { NOTE: 1000, CLASS_COUNCIL_REPORT: 10000 });
  });
});

describe('erroDeTamanho', () => {
  it('accepts a note of exactly 1000 characters and refuses one of 1001', () => {
    assert.equal(erroDeTamanho('a'.repeat(1000), 'NOTE'), '');
    assert.equal(
      erroDeTamanho('a'.repeat(1001), 'NOTE'),
      'O texto tem 1001 caracteres, acima do limite de 1000 para anotação.',
    );
  });

  it('accepts a report of exactly 10000 characters and refuses one of 10001', () => {
    assert.equal(erroDeTamanho('a'.repeat(10000), 'CLASS_COUNCIL_REPORT'), '');
    assert.equal(
      erroDeTamanho('a'.repeat(10001), 'CLASS_COUNCIL_REPORT'),
      'O texto tem 10001 caracteres, acima do limite de 10000 para relatório multiprofissional.',
    );
  });

  it('applies the limit of the chosen type to the same text', () => {
    const texto = 'a'.repeat(5000);

    assert.equal(erroDeTamanho(texto, 'CLASS_COUNCIL_REPORT'), '');
    assert.notEqual(erroDeTamanho(texto, 'NOTE'), '');
  });

  it('accepts an empty text, which the publish button refuses on its own', () => {
    assert.equal(erroDeTamanho('', 'NOTE'), '');
  });

  it('counts UTF-16 code units, as the API and the textarea do', () => {
    // U+1D49C fica fora do plano básico e ocupa 2 unidades UTF-16, então 500
    // delas cabem em 1000 e 501 não.
    const fora = '\u{1D49C}';

    assert.equal(fora.length, 2);
    assert.equal(erroDeTamanho(fora.repeat(500), 'NOTE'), '');
    assert.equal(
      erroDeTamanho(fora.repeat(501), 'NOTE'),
      'O texto tem 1002 caracteres, acima do limite de 1000 para anotação.',
    );
  });
});

describe('erroDeTexto', () => {
  const MENSAGEM_DE_CONTROLE =
    'O texto não pode ter caracteres de controle, exceto tabulação e quebra de linha.';

  it('accepts accents, tab, line breaks and emoji', () => {
    assert.equal(erroDeTexto('Ação\tdo João\r\nsegunda linha\n😀 emoji', 'NOTE'), '');
    assert.equal(erroDeTexto('Ação\tdo João\r\nsegunda linha\n😀 emoji', 'CLASS_COUNCIL_REPORT'), '');
  });

  it('accepts an empty text, which the publish button refuses on its own', () => {
    assert.equal(erroDeTexto('', 'NOTE'), '');
  });

  it('refuses the NUL character', () => {
    assert.equal(erroDeTexto('antes\u0000depois', 'NOTE'), MENSAGEM_DE_CONTROLE);
  });

  it('refuses the other C0 controls, such as the bell, the escape and the delete', () => {
    for (const controle of ['\u0007', '\u001b', '\u007f', '\u0008']) {
      assert.equal(erroDeTexto(`a${controle}b`, 'NOTE'), MENSAGEM_DE_CONTROLE);
    }
  });

  it('refuses a C1 control, such as U+0085 (next line)', () => {
    assert.equal(erroDeTexto('a\u0085b', 'NOTE'), MENSAGEM_DE_CONTROLE);
  });

  it('refuses a lone surrogate, high or low', () => {
    assert.equal(erroDeTexto('a\uD800b', 'NOTE'), MENSAGEM_DE_CONTROLE);
    assert.equal(erroDeTexto('a\uDC00b', 'NOTE'), MENSAGEM_DE_CONTROLE);
    assert.equal(erroDeTexto('termina em \uD83D', 'NOTE'), MENSAGEM_DE_CONTROLE);
  });

  it('applies the same rule to the class council report', () => {
    assert.equal(erroDeTexto('a\u0000b', 'CLASS_COUNCIL_REPORT'), MENSAGEM_DE_CONTROLE);
  });

  it('checks the text that is sent: the controls the trim removes on the ends do not count', () => {
    // O front envia o texto com trim, e o trim do JavaScript também tira \v e \f
    // das pontas; o back valida o que chega, sem trim próprio.
    assert.equal(erroDeTexto('\u000cfim de página\u000b', 'NOTE'), '');
    assert.equal(erroDeTexto('\u000cfim\u0000de página\u000b', 'NOTE'), MENSAGEM_DE_CONTROLE);
  });

  describe('with too many combining marks in a row', () => {
    const MENSAGEM_DE_MARCAS = 'O texto não pode ter mais de 30 acentos ou marcas seguidos.';
    const acentos = (quantos: number) => `a${String.fromCodePoint(0x0301).repeat(quantos)}`;

    it('accepts 30 marks in a row and refuses 31', () => {
      assert.equal(erroDeTexto(acentos(30), 'NOTE'), '');
      assert.equal(erroDeTexto(acentos(31), 'NOTE'), MENSAGEM_DE_MARCAS);
    });

    it('applies the same rule to the class council report', () => {
      assert.equal(erroDeTexto(acentos(30), 'CLASS_COUNCIL_REPORT'), '');
      assert.equal(erroDeTexto(acentos(31), 'CLASS_COUNCIL_REPORT'), MENSAGEM_DE_MARCAS);
    });

    it('counts the marks of a run, not of the whole text', () => {
      const duasSequencias = `${acentos(20)} ${acentos(20)}`;

      assert.equal(erroDeTexto(duasSequencias, 'NOTE'), '');
    });

    it('reports the size first, then the controls, then the marks', () => {
      const comTudo = `\u0000${acentos(31)}`;

      assert.equal(erroDeTexto(comTudo, 'NOTE'), MENSAGEM_DE_CONTROLE);
      assert.equal(
        erroDeTexto(`${comTudo}${'a'.repeat(1000)}`, 'NOTE'),
        erroDeTamanho(`${comTudo}${'a'.repeat(1000)}`, 'NOTE'),
      );
    });
  });

  it('reports the size first when the text is too long and has a control character', () => {
    const texto = `\u0000${'a'.repeat(1000)}`;

    assert.equal(erroDeTexto(texto, 'NOTE'), erroDeTamanho(texto, 'NOTE'));
  });

  it('is clean for a text of the limit size, so the check scales to 10000 characters', () => {
    assert.equal(erroDeTexto('ã'.repeat(10000), 'CLASS_COUNCIL_REPORT'), '');
  });

  it('accepts and refuses the same single characters as the TEXT_PATTERN of the API', () => {
    for (let codigo = 0; codigo <= 0xffff; codigo += 1) {
      const caractere = String.fromCharCode(codigo);
      // O front envia o texto com trim, então um caractere que o trim remove vira
      // texto vazio, que o botão de publicar recusa por conta própria.
      if (caractere.trim() === '') continue;

      assert.equal(
        erroDeTexto(caractere, 'NOTE') === '',
        TEXT_PATTERN_DO_BACK.test(caractere),
        `U+${codigo.toString(16).padStart(4, '0')} tem veredito diferente do back`,
      );
    }
  });
});

describe('textoParaEditar', () => {
  it('returns a clean text as it is, without flagging it', () => {
    const texto = 'Ação\tdo João\r\nsegunda linha\n😀 emoji  ';

    assert.deepEqual(textoParaEditar(texto), { texto, limpou: false });
  });

  it('turns the vertical tab and the form feed into a line break', () => {
    assert.deepEqual(textoParaEditar('linha 1\u000bLinha 2\u000cLinha 3'), {
      texto: 'linha 1\nLinha 2\nLinha 3',
      limpou: true,
    });
  });

  it('removes the other controls: NUL, bell, escape, DEL and the C1 ones', () => {
    assert.deepEqual(textoParaEditar('a\u0000b\u0007c\u001bd\u007fe\u0085f'), {
      texto: 'abcdef',
      limpou: true,
    });
  });

  it('removes a lone surrogate but keeps a real emoji, which is a pair', () => {
    assert.deepEqual(textoParaEditar('a\uD800b😀c\uDC00d'), { texto: 'ab😀cd', limpou: true });
  });

  it('keeps the tab and the line breaks', () => {
    const texto = 'a\tb\r\nc\nd';

    assert.equal(textoParaEditar(texto).texto, texto);
  });

  it('flags the text as changed when only a vertical tab or form feed was swapped', () => {
    assert.equal(textoParaEditar('a\u000bb').limpou, true);
    assert.equal(textoParaEditar('a\u000cb').limpou, true);
  });

  it('does not trim the text', () => {
    assert.equal(textoParaEditar('  a\u0000b  ').texto, '  ab  ');
  });

  it('leaves a text that the form accepts, whatever the single character removed', () => {
    for (let codigo = 0; codigo <= 0xffff; codigo += 1) {
      const limpo = textoParaEditar(`a${String.fromCharCode(codigo)}b`).texto;

      assert.equal(
        TEXT_PATTERN_DO_BACK.test(limpo),
        true,
        `U+${codigo.toString(16).padStart(4, '0')} sobrou no texto de edição`,
      );
    }
  });

  it('gives a text that needs no further cleaning', () => {
    const { texto } = textoParaEditar('a\u0000b\u000cc\uD800d');

    assert.deepEqual(textoParaEditar(texto), { texto, limpou: false });
  });

  it('does not touch the combining marks, which the size and character checks report', () => {
    const acentos = `a${String.fromCodePoint(0x0301).repeat(40)}`;

    assert.deepEqual(textoParaEditar(acentos), { texto: acentos, limpou: false });
  });
});

describe('AVISO_DE_TEXTO_LIMPO', () => {
  it('tells the author, in Portuguese, that invisible characters were removed', () => {
    assert.equal(
      AVISO_DE_TEXTO_LIMPO,
      'Removemos caracteres invisíveis que o sistema não aceita mais.',
    );
  });
});

describe('montarNovaAnotacao', () => {
  it('builds the POST body with the trimmed text, the student, the type and the email option', () => {
    assert.deepEqual(
      montarNovaAnotacao({
        texto: '  texto do relatório \n',
        idUsuario: 10,
        tipo: 'CLASS_COUNCIL_REPORT',
        avisarPorEmail: true,
      }),
      {
        comment: 'texto do relatório',
        id_user: 10,
        type: 'CLASS_COUNCIL_REPORT',
        notify_by_email: true,
      },
    );
  });

  it('sends the type even when it is the default note', () => {
    const corpo = montarNovaAnotacao({
      texto: 'anotação',
      idUsuario: 3,
      tipo: 'NOTE',
      avisarPorEmail: false,
    });

    assert.equal(corpo.type, 'NOTE');
    assert.equal(corpo.notify_by_email, false);
  });
});
