import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { PeiEntry } from '@/interfaces/PeiEntry';
import { setNestedField } from './nestedField';
import {
  ADMIN,
  ESTUDANTE,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from '../consts';
import { camposDaTabela } from './formularioPorTabela';
import {
  LIMITES_PEI,
  SECOES_PARECER,
  SECOES_PEI,
  agruparPorSemestre,
  caminhoDoParDe,
  formularioDoParecer,
  formularioDoPei,
  formularioVazioDoPei,
  montarCorpoDeAtualizacao,
  montarCorpoDeCriacao,
  montarCorpoDoParecer,
  paresParaEnvio,
  podeAlterarPei,
  podeCriarPei,
  podeExcluirPei,
  secoesDoPeiParaLeitura,
  validarParecer,
  validarPeiExistente,
  validarPeiNovo,
  type PeiEntryForm,
  type PeiOpinionForm,
} from './pei';

const EMAIL = 'aluno@edutrace.com';

// Copiados do contrato da issue #706 (back/src/pei-entries). Mudar o DTO muda
// este contrato, e aqui o front acompanha, como o paee.test.ts faz.
const CHAVES_DE_TEXTO_DO_CONTEUDO = [
  'adapted_objectives',
  'prioritized_contents',
  'adapted_methodologies',
  'adapted_assessments',
  'adapted_resources',
  'general_notes',
];
const CHAVES_DO_CONTEUDO = [...CHAVES_DE_TEXTO_DO_CONTEUDO, 'syllabus_adaptations'];
const CHAVES_DO_POST = ['student_email', 'semester', 'subject', ...CHAVES_DO_CONTEUDO];
const CHAVES_DE_TEXTO_DO_POST = ['student_email', 'semester', 'subject', ...CHAVES_DE_TEXTO_DO_CONTEUDO];
const CHAVES_DO_PAR = ['adaptation', 'syllabus_content'];

// Copiados do contrato da issue #707: o parecer semestral grava em quatro
// colunas do mesmo registro, pelo mesmo PATCH, mas o front o envia à parte do
// conteúdo (cada corpo fica abaixo do limite de 100 kb do body parser do back).
const CHAVES_DO_PARECER = [
  'semester_progress',
  'semester_difficulties',
  'next_semester_notes',
  'individual_sessions',
];
const PARECER_EM_BRANCO: PeiOpinionForm = {
  semester_progress: '',
  semester_difficulties: '',
  next_semester_notes: '',
  individual_sessions: '',
};
const ROTULOS_DO_PARECER = [
  'Avanços no semestre',
  'Dificuldades no semestre',
  'Apontamentos para o próximo semestre',
  'Atendimentos individualizados prestados (datas, horários, salas e meio de convocação)',
];
const TITULO_DO_PARECER = 'Parecer semestral';

const TITULOS = [
  'Identificação',
  'Objetivos adaptados',
  'Conteúdos priorizados no semestre',
  'Conteúdo previsto na ementa e adequação',
  'Metodologias adaptadas',
  'Atividades avaliativas adaptadas',
  'Recursos adaptados',
  'Observações gerais',
];
const TITULOS_DA_LEITURA = [...TITULOS, TITULO_DO_PARECER];

function registro(sobrescrever: Partial<PeiEntry> = {}): PeiEntry {
  return {
    id: 3,
    semester: '2026.2',
    subject: 'Matemática',
    adapted_objectives: 'Ampliar a autonomia nas operações',
    prioritized_contents: 'Funções e geometria',
    syllabus_adaptations: [
      { syllabus_content: 'Funções do 1º grau', adaptation: 'Usar material concreto' },
      { syllabus_content: 'Geometria plana', adaptation: '' },
    ],
    adapted_methodologies: 'Aulas com recursos visuais',
    adapted_assessments: 'Prova com tempo ampliado',
    adapted_resources: 'Calculadora e ábaco',
    general_notes: 'Responde bem a atividades em dupla',
    semester_progress: 'Passou a resolver as operações sozinho',
    semester_difficulties: 'Perde o foco em provas longas',
    next_semester_notes: 'Manter o tempo ampliado nas provas',
    individual_sessions: 'Terças, 14h, sala 3, convocado pela coordenação',
    created_at: '2026-10-17T12:00:00.000Z',
    updated_at: '2026-10-18T12:00:00.000Z',
    id_author: 7,
    author: { full_name: 'Professora Ana' },
    ...sobrescrever,
  };
}

function formulario(sobrescrever: Partial<PeiEntryForm> = {}): PeiEntryForm {
  return { ...formularioDoPei(registro()), ...sobrescrever };
}

function formularioDoParecerDe(sobrescrever: Partial<PeiOpinionForm> = {}): PeiOpinionForm {
  return { ...formularioDoParecer(registro()), ...sobrescrever };
}

const repetir = (tamanho: number) => 'a'.repeat(tamanho);
const par = (syllabus_content: string, adaptation = '') => ({ syllabus_content, adaptation });

describe('SECOES_PEI', () => {
  it('lists the sections in the order of the contract, with the two reserved places', () => {
    assert.deepEqual(
      SECOES_PEI.map((secao) => secao.titulo),
      TITULOS,
    );
  });

  it('has one text field per section of text, with the limit of the back', () => {
    const campos = SECOES_PEI.flatMap((secao) => secao.grupos).flatMap((grupo) => grupo.campos);

    assert.deepEqual(
      campos.map((campo) => campo.caminho),
      CHAVES_DE_TEXTO_DO_CONTEUDO,
    );
    for (const campo of campos) {
      assert.equal(campo.tipo, 'textoLongo');
      assert.equal(campo.tipo === 'textoLongo' && campo.max, 2000, campo.caminho);
    }
  });

  it('does not hold the opinion: the content form and its PATCH never carry it', () => {
    const caminhos = camposDaTabela(SECOES_PEI).map((campo) => campo.caminho);

    for (const chave of CHAVES_DO_PARECER) {
      assert.equal(caminhos.includes(chave), false, chave);
    }
  });
});

describe('formularioVazioDoPei', () => {
  it('has every text empty and no pair', () => {
    const form = formularioVazioDoPei();

    assert.deepEqual(Object.keys(form).sort(), ['semester', 'subject', ...CHAVES_DO_CONTEUDO].sort());
    for (const chave of ['semester', 'subject', ...CHAVES_DE_TEXTO_DO_CONTEUDO]) {
      assert.equal(form[chave as keyof PeiEntryForm], '', chave);
    }
    assert.deepEqual(form.syllabus_adaptations, []);
  });
});

describe('formularioDoPei', () => {
  it('copies the semester, the subject, the texts and the pairs of the entry', () => {
    const form = formularioDoPei(registro());

    assert.equal(form.semester, '2026.2');
    assert.equal(form.subject, 'Matemática');
    assert.equal(form.adapted_objectives, 'Ampliar a autonomia nas operações');
    assert.equal(form.general_notes, 'Responde bem a atividades em dupla');
    assert.deepEqual(form.syllabus_adaptations, registro().syllabus_adaptations);
  });

  it('does not carry the opinion of the entry into the form of the content', () => {
    const form = formularioDoPei(registro()) as unknown as Record<string, unknown>;

    for (const chave of CHAVES_DO_PARECER) {
      assert.equal(chave in form, false, chave);
    }
  });

  it('does not share the list of pairs with the entry', () => {
    const original = registro();
    const form = formularioDoPei(original);

    assert.notEqual(form.syllabus_adaptations, original.syllabus_adaptations);
    assert.notEqual(form.syllabus_adaptations[0], original.syllabus_adaptations[0]);
  });

  it('turns what the API does not send into empty text and no pair', () => {
    const form = formularioDoPei({
      semester: '2026.1',
      subject: 'Física',
      syllabus_adaptations: [{ syllabus_content: 'Cinemática' }, null, {}] as never,
    } as unknown as PeiEntry);

    assert.equal(form.adapted_objectives, '');
    assert.deepEqual(form.syllabus_adaptations, [par('Cinemática'), par(''), par('')]);
    assert.deepEqual(
      formularioDoPei({ semester: '2026.1', subject: 'Física' } as unknown as PeiEntry)
        .syllabus_adaptations,
      [],
    );
  });
});

describe('paresParaEnvio', () => {
  it('trims both sides of every pair', () => {
    assert.deepEqual(paresParaEnvio([par('  Funções  ', '  Material concreto\n')]), [
      par('Funções', 'Material concreto'),
    ]);
  });

  it('drops the pair with both sides blank, and keeps the order of the others', () => {
    assert.deepEqual(
      paresParaEnvio([par('Primeiro'), par('   ', ' \n '), par('Segundo', 'Adequação'), par('', '')]),
      [par('Primeiro'), par('Segundo', 'Adequação')],
    );
  });

  it('keeps the pair that has only the adaptation, so the validation can refuse it', () => {
    assert.deepEqual(paresParaEnvio([par('', 'Sem conteúdo')]), [par('', 'Sem conteúdo')]);
  });
});

// O POST quebrou contra o back real na #705 por causa do tipo de um campo do
// corpo. Estes testes fixam as chaves e o tipo de cada uma.
describe('montarCorpoDeCriacao', () => {
  it('sends exactly the keys of the contract, with the e-mail, the semester and the subject', () => {
    const corpo = montarCorpoDeCriacao(EMAIL, formulario());

    assert.deepEqual(Object.keys(corpo).sort(), [...CHAVES_DO_POST].sort());
    assert.equal(corpo.student_email, EMAIL);
    assert.equal(corpo.semester, '2026.2');
    assert.equal(corpo.subject, 'Matemática');
  });

  it('sends every text as a string and the pairs as a list of objects with two strings', () => {
    for (const form of [formulario(), formularioVazioDoPei()]) {
      const corpo = montarCorpoDeCriacao(EMAIL, form) as unknown as Record<string, unknown>;

      for (const chave of CHAVES_DE_TEXTO_DO_POST) {
        assert.equal(typeof corpo[chave], 'string', chave);
      }
      assert.ok(Array.isArray(corpo.syllabus_adaptations));
      for (const item of corpo.syllabus_adaptations as Record<string, unknown>[]) {
        assert.deepEqual(Object.keys(item).sort(), CHAVES_DO_PAR);
        assert.equal(typeof item.syllabus_content, 'string');
        assert.equal(typeof item.adaptation, 'string');
      }
    }
  });

  it('sends every field of the contract even with the form empty, with no value lost in the JSON', () => {
    const corpo = montarCorpoDeCriacao(EMAIL, formularioVazioDoPei());

    assert.deepEqual(Object.keys(corpo).sort(), [...CHAVES_DO_POST].sort());
    assert.deepEqual(JSON.parse(JSON.stringify(corpo)), corpo);
    assert.deepEqual(corpo.syllabus_adaptations, []);
  });

  it('sends the adaptation as an empty string when the pair has only the planned content', () => {
    const corpo = montarCorpoDeCriacao(EMAIL, formulario({ syllabus_adaptations: [par('Funções')] }));

    assert.deepEqual(corpo.syllabus_adaptations, [par('Funções', '')]);
  });

  it('trims the texts, the semester and the subject, and drops the blank pairs', () => {
    const corpo = montarCorpoDeCriacao(
      EMAIL,
      formulario({
        semester: ' 2026.1 ',
        subject: '  Física  ',
        adapted_objectives: '  Objetivos  ',
        syllabus_adaptations: [par('  Dinâmica  ', ' Roteiro '), par('  ', '')],
      }),
    );

    assert.equal(corpo.semester, '2026.1');
    assert.equal(corpo.subject, 'Física');
    assert.equal(corpo.adapted_objectives, 'Objetivos');
    assert.deepEqual(corpo.syllabus_adaptations, [par('Dinâmica', 'Roteiro')]);
  });

  it('sends the subject in NFC, so "Matemática" typed decomposed is the same record as the composed one', () => {
    const decomposta = 'Matemática';
    const composta = 'Matemática';

    assert.notEqual(decomposta, composta);
    const corpo = montarCorpoDeCriacao(EMAIL, formulario({ subject: `  ${decomposta}  ` }));

    assert.equal(corpo.subject, composta);
    assert.equal(montarCorpoDeCriacao(EMAIL, formulario({ subject: composta })).subject, composta);
  });

  // O POST do back recusa os campos do parecer (400, forbidNonWhitelisted): o
  // registro nasce com o parecer em branco.
  it('never sends a key of the opinion, even when the form carries them', () => {
    const comParecer = { ...formulario(), ...formularioDoParecerDe() } as PeiEntryForm;

    for (const form of [formulario(), formularioVazioDoPei(), comParecer]) {
      const corpo = montarCorpoDeCriacao(EMAIL, form) as unknown as Record<string, unknown>;

      assert.deepEqual(Object.keys(corpo).sort(), [...CHAVES_DO_POST].sort());
      for (const chave of CHAVES_DO_PARECER) {
        assert.equal(chave in corpo, false, chave);
      }
    }
  });

  it('takes the e-mail of the student from the argument, never from the form', () => {
    const corpo = montarCorpoDeCriacao(
      EMAIL,
      { ...formulario(), student_email: 'outro@edutrace.com' } as PeiEntryForm,
    );

    assert.equal(corpo.student_email, EMAIL);
  });
});

describe('montarCorpoDeAtualizacao', () => {
  it('sends exactly the seven fields of content', () => {
    const corpo = montarCorpoDeAtualizacao(formulario());

    assert.deepEqual(Object.keys(corpo).sort(), [...CHAVES_DO_CONTEUDO].sort());
  });

  it('never sends the semester, the subject or the e-mail of the student, even when the form has them', () => {
    const corpo = montarCorpoDeAtualizacao({
      ...formulario({ semester: '2027.1', subject: 'Outra disciplina' }),
      student_email: EMAIL,
    } as PeiEntryForm) as unknown as Record<string, unknown>;

    for (const chave of ['semester', 'subject', 'student_email']) {
      assert.equal(chave in corpo, false, chave);
    }
  });

  // O PATCH do conteúdo leva só os 7 campos de conteúdo; o parecer segue em um
  // PATCH à parte (montarCorpoDoParecer), para cada corpo ficar abaixo do limite
  // de 100 kb do body parser do back.
  it('never sends a key of the opinion, even when the form carries them', () => {
    const comParecer = { ...formulario(), ...formularioDoParecerDe() } as PeiEntryForm;

    for (const form of [formulario(), formularioVazioDoPei(), comParecer]) {
      const corpo = montarCorpoDeAtualizacao(form) as unknown as Record<string, unknown>;

      assert.deepEqual(Object.keys(corpo).sort(), [...CHAVES_DO_CONTEUDO].sort());
      for (const chave of CHAVES_DO_PARECER) {
        assert.equal(chave in corpo, false, chave);
      }
    }
  });

  it('sends every text as a string and the whole list of pairs, with the blank ones dropped', () => {
    const corpo = montarCorpoDeAtualizacao(
      formulario({ adapted_resources: '  Ábaco  ', syllabus_adaptations: [par('Funções', 'Roteiro'), par('', '')] }),
    ) as unknown as Record<string, unknown>;

    for (const chave of CHAVES_DE_TEXTO_DO_CONTEUDO) {
      assert.equal(typeof corpo[chave], 'string', chave);
    }
    assert.equal(corpo.adapted_resources, 'Ábaco');
    assert.deepEqual(corpo.syllabus_adaptations, [par('Funções', 'Roteiro')]);
  });

  it('sends the list of pairs empty when the teacher removed every pair, so the PATCH clears it', () => {
    const corpo = montarCorpoDeAtualizacao(formulario({ syllabus_adaptations: [] }));

    assert.deepEqual(corpo.syllabus_adaptations, []);
  });

  it('has the same content as the POST', () => {
    const form = formulario();
    const { student_email, semester, subject, ...conteudoDoPost } = montarCorpoDeCriacao(EMAIL, form);

    assert.deepEqual(montarCorpoDeAtualizacao(form), conteudoDoPost);
    assert.ok(student_email && semester && subject);
  });
});

describe('validarPeiNovo, semester', () => {
  for (const valido of ['2026.1', '2026.2', ' 2026.1 ', '1999.2']) {
    it(`accepts "${valido}"`, () => {
      assert.equal('semester' in validarPeiNovo(formulario({ semester: valido })), false);
    });
  }

  for (const invalido of ['', '   ', '2026', '2026.0', '2026.3', '26.1', '2026.12', '2026-1', '2026,1', '2026.1x', '20261', 'abcd.1']) {
    it(`refuses ${JSON.stringify(invalido)}`, () => {
      const erros = validarPeiNovo(formulario({ semester: invalido }));

      assert.match(erros.semester, /"Semestre" deve ter o formato AAAA\.S/);
    });
  }
});

describe('validarPeiNovo, subject', () => {
  it('requires the subject, also when it has only blanks', () => {
    for (const vazio of ['', '   ', '\t']) {
      assert.match(validarPeiNovo(formulario({ subject: vazio })).subject, /"Disciplina" é obrigatório/);
    }
  });

  it('accepts a subject of 150 characters, counting after the trim', () => {
    assert.equal('subject' in validarPeiNovo(formulario({ subject: repetir(LIMITES_PEI.DISCIPLINA) })), false);
    assert.equal(
      'subject' in validarPeiNovo(formulario({ subject: ` ${repetir(LIMITES_PEI.DISCIPLINA)} ` })),
      false,
    );
  });

  it('refuses a subject of 151 characters', () => {
    const erros = validarPeiNovo(formulario({ subject: repetir(LIMITES_PEI.DISCIPLINA + 1) }));

    assert.match(erros.subject, /"Disciplina" deve ter no máximo 150 caracteres/);
  });

  it('refuses a line break or a control character in the subject', () => {
    for (const subject of ['Mate\nmática', 'Mate\rmática', 'Mate\tmática', 'Mate\u0000mática', 'Mate\u0085mática']) {
      assert.match(
        validarPeiNovo(formulario({ subject })).subject,
        /não pode ter quebra de linha nem caracteres de controle/,
        JSON.stringify(subject),
      );
    }
  });

  it('accepts accents and punctuation in the subject', () => {
    assert.equal('subject' in validarPeiNovo(formulario({ subject: 'Língua Portuguesa e Literatura I (Ensino Médio)' })), false);
  });

  // Zero width space, bidi override, byte order mark, soft hyphen, line separator,
  // paragraph separator and a lone surrogate: invisible on the screen, and the
  // subject is compared by its exact text.
  const INVISIVEIS = [
    ['U+200B', 'Mate​mática'],
    ['U+202E', 'Mate\u202Emática'],
    ['U+FEFF', 'Mate﻿mática'],
    ['U+00AD', 'Mate­mática'],
    ['U+2028', 'Mate mática'],
    ['U+2029', 'Mate mática'],
    ['a lone surrogate', 'Mate\uD800mática'],
  ];

  for (const [nome, subject] of INVISIVEIS) {
    it(`refuses ${nome} in the subject, with the error on the field`, () => {
      const erros = validarPeiNovo(formulario({ subject }));

      assert.deepEqual(Object.keys(erros), ['subject']);
      assert.match(erros.subject, /"Disciplina" não pode ter quebra de linha nem caracteres de controle/);
    });
  }

  it('refuses the invisible character also at the edge of the subject, when the trim does not remove it', () => {
    for (const subject of ['​Matemática', 'Matemática​', '\u202EMatemática', 'Matemática­']) {
      assert.ok('subject' in validarPeiNovo(formulario({ subject })), JSON.stringify(subject));
    }
  });

  it('validates and sends the subject after the trim, as the back does, so a BOM at the edge is dropped', () => {
    const subject = '﻿Matemática ';

    assert.equal('subject' in validarPeiNovo(formulario({ subject })), false);
    assert.equal(montarCorpoDeCriacao(EMAIL, formulario({ subject })).subject, 'Matemática');
  });

  it('accepts a paired surrogate (an emoji), and refuses the zero width joiner with the format characters', () => {
    assert.equal('subject' in validarPeiNovo(formulario({ subject: 'Robótica \u{1F916}' })), false);
    assert.ok('subject' in validarPeiNovo(formulario({ subject: 'a‍b' })));
  });

  it('counts the length of the subject after the NFC normalization, as the back does', () => {
    const decomposta = 'é'.repeat(LIMITES_PEI.DISCIPLINA);

    assert.equal(decomposta.length, LIMITES_PEI.DISCIPLINA * 2);
    assert.equal('subject' in validarPeiNovo(formulario({ subject: decomposta })), false);
    assert.match(
      validarPeiNovo(formulario({ subject: 'é'.repeat(LIMITES_PEI.DISCIPLINA + 1) })).subject,
      /deve ter no máximo 150 caracteres/,
    );
  });
});

describe('validarPeiNovo e validarPeiExistente, texts', () => {
  for (const caminho of CHAVES_DE_TEXTO_DO_CONTEUDO) {
    it(`accepts ${caminho} with 2000 characters and refuses it with 2001`, () => {
      const noLimite = validarPeiExistente(formulario({ [caminho]: repetir(LIMITES_PEI.TEXTO) }));
      const acima = validarPeiExistente(formulario({ [caminho]: repetir(LIMITES_PEI.TEXTO + 1) }));

      assert.equal(caminho in noLimite, false);
      assert.match(acima[caminho], /deve ter no máximo 2000 caracteres/);
    });

    it(`accepts ${caminho} empty`, () => {
      assert.deepEqual(validarPeiExistente(formulario({ [caminho]: '' })), {});
    });
  }

  it('counts the length after the trim', () => {
    const erros = validarPeiExistente(
      formulario({ general_notes: `  ${repetir(LIMITES_PEI.TEXTO)}  ` }),
    );

    assert.deepEqual(erros, {});
  });

  it('accepts tabs and line breaks, and refuses the other control characters', () => {
    assert.deepEqual(validarPeiExistente(formulario({ general_notes: 'Linha 1\r\nLinha 2\tcom tab' })), {});
    for (const texto of ['a\u0000b', 'a\u001bb', 'a\u007fb', 'a\u0085b', 'a\uD800b', 'a\uDFFFb']) {
      assert.match(
        validarPeiExistente(formulario({ general_notes: texto })).general_notes,
        /não pode ter caracteres de controle/,
        JSON.stringify(texto),
      );
    }
  });

  it('accepts a paired surrogate in a text, such as an emoji, and refuses the lone one also at the edges', () => {
    assert.deepEqual(validarPeiExistente(formulario({ general_notes: 'Gosta de \u{1F916}' })), {});
    for (const texto of ['\uD800', 'abc\uDC00', '\uDBFFabc']) {
      assert.ok('general_notes' in validarPeiExistente(formulario({ general_notes: texto })), JSON.stringify(texto));
    }
  });

  it('does not validate the semester or the subject of an entry that already exists', () => {
    assert.deepEqual(validarPeiExistente(formulario({ semester: 'errado', subject: '' })), {});
  });

  it('accepts a complete form', () => {
    assert.deepEqual(validarPeiNovo(formulario()), {});
    assert.deepEqual(validarPeiExistente(formulario()), {});
  });
});

describe('validarPeiNovo e validarPeiExistente, pairs', () => {
  it('accepts a planned content of 500 characters and refuses 501', () => {
    const noLimite = validarPeiExistente(
      formulario({ syllabus_adaptations: [par(repetir(LIMITES_PEI.CONTEUDO_PREVISTO))] }),
    );
    const acima = validarPeiExistente(
      formulario({ syllabus_adaptations: [par(repetir(LIMITES_PEI.CONTEUDO_PREVISTO + 1))] }),
    );

    assert.deepEqual(noLimite, {});
    assert.deepEqual(Object.keys(acima), [caminhoDoParDe(0, 'syllabus_content')]);
    assert.match(acima[caminhoDoParDe(0, 'syllabus_content')], /do par 1 deve ter no máximo 500 caracteres/);
  });

  it('accepts an adaptation of 1000 characters and refuses 1001', () => {
    const noLimite = validarPeiExistente(
      formulario({ syllabus_adaptations: [par('Funções', repetir(LIMITES_PEI.ADEQUACAO))] }),
    );
    const acima = validarPeiExistente(
      formulario({ syllabus_adaptations: [par('Funções', repetir(LIMITES_PEI.ADEQUACAO + 1))] }),
    );

    assert.deepEqual(noLimite, {});
    assert.deepEqual(Object.keys(acima), [caminhoDoParDe(0, 'adaptation')]);
    assert.match(acima[caminhoDoParDe(0, 'adaptation')], /"Adequação" do par 1 deve ter no máximo 1000 caracteres/);
  });

  it('refuses a pair with an adaptation and without a planned content', () => {
    for (const conteudo of ['', '   ', '\n']) {
      const erros = validarPeiExistente(
        formulario({ syllabus_adaptations: [par('Funções', 'Ok'), par(conteudo, 'Adequação solta')] }),
      );

      assert.deepEqual(Object.keys(erros), [caminhoDoParDe(1, 'syllabus_content')]);
      assert.match(erros[caminhoDoParDe(1, 'syllabus_content')], /Informe o "Conteúdo previsto na ementa" do par 2/);
    }
  });

  it('discards the pair with both sides blank instead of refusing it', () => {
    const erros = validarPeiExistente(
      formulario({ syllabus_adaptations: [par(''), par('   ', ' \n '), par('Funções')] }),
    );

    assert.deepEqual(erros, {});
  });

  it('accepts a pair with a planned content and without an adaptation', () => {
    assert.deepEqual(validarPeiExistente(formulario({ syllabus_adaptations: [par('Funções')] })), {});
  });

  it('accepts no pair at all', () => {
    assert.deepEqual(validarPeiExistente(formulario({ syllabus_adaptations: [] })), {});
  });

  it('accepts 20 pairs and refuses 21', () => {
    const pares = (quantidade: number) =>
      Array.from({ length: quantidade }, (_, indice) => par(`Conteúdo ${indice + 1}`));

    assert.deepEqual(validarPeiExistente(formulario({ syllabus_adaptations: pares(20) })), {});

    const erros = validarPeiExistente(formulario({ syllabus_adaptations: pares(21) }));
    assert.deepEqual(Object.keys(erros), ['syllabus_adaptations']);
    assert.match(erros.syllabus_adaptations, /no máximo 20 pares/);
  });

  it('counts the limit after discarding the blank pairs', () => {
    const preenchidos = Array.from({ length: 20 }, (_, indice) => par(`Conteúdo ${indice + 1}`));

    assert.deepEqual(validarPeiExistente(formulario({ syllabus_adaptations: [...preenchidos, par('')] })), {});
  });

  it('keys the error of a pair by its index on the screen, also when blank pairs come before it', () => {
    const erros = validarPeiExistente(
      formulario({ syllabus_adaptations: [par(''), par('Funções'), par('', 'Solta')] }),
    );

    assert.deepEqual(Object.keys(erros), ['syllabus_adaptations.2.syllabus_content']);
  });

  it('refuses a control character in a pair', () => {
    const erros = validarPeiExistente(formulario({ syllabus_adaptations: [par('a\u0000b', 'c\u001bd')] }));

    assert.deepEqual(Object.keys(erros), [
      caminhoDoParDe(0, 'syllabus_content'),
      caminhoDoParDe(0, 'adaptation'),
    ]);
  });

  it('refuses a lone surrogate in a pair, on the side that has it, and accepts a paired one', () => {
    const erros = validarPeiExistente(formulario({ syllabus_adaptations: [par('a\uD800b', 'c\uDC00d')] }));

    assert.deepEqual(Object.keys(erros), [
      caminhoDoParDe(0, 'syllabus_content'),
      caminhoDoParDe(0, 'adaptation'),
    ]);
    assert.match(erros[caminhoDoParDe(0, 'syllabus_content')], /não pode ter caracteres de controle/);
    assert.deepEqual(
      validarPeiExistente(formulario({ syllabus_adaptations: [par('Robótica \u{1F916}', 'Kit \u{1F527}')] })),
      {},
    );
  });

  it('lists the errors in the order of the screen: semester, subject, texts and pairs in between', () => {
    const erros = validarPeiNovo(
      formulario({
        semester: 'errado',
        subject: '',
        general_notes: repetir(LIMITES_PEI.TEXTO + 1),
        adapted_methodologies: repetir(LIMITES_PEI.TEXTO + 1),
        syllabus_adaptations: [par('', 'Solta')],
        adapted_objectives: repetir(LIMITES_PEI.TEXTO + 1),
      }),
    );

    assert.deepEqual(Object.keys(erros), [
      'semester',
      'subject',
      'adapted_objectives',
      'syllabus_adaptations.0.syllabus_content',
      'adapted_methodologies',
      'general_notes',
    ]);
  });
});

describe('secoesDoPeiParaLeitura', () => {
  const linhasDe = (secoes: ReturnType<typeof secoesDoPeiParaLeitura>, titulo: string) =>
    secoes.find((secao) => secao.titulo === titulo)?.linhas;

  it('lists the sections in the order of the contract, with the opinion after the general notes', () => {
    assert.deepEqual(
      secoesDoPeiParaLeitura(registro()).map((secao) => secao.titulo),
      TITULOS_DA_LEITURA,
    );
  });

  it('prints the four texts of the opinion under the labels of the contract', () => {
    assert.deepEqual(linhasDe(secoesDoPeiParaLeitura(registro()), TITULO_DO_PARECER), [
      { label: ROTULOS_DO_PARECER[0], value: 'Passou a resolver as operações sozinho' },
      { label: ROTULOS_DO_PARECER[1], value: 'Perde o foco em provas longas' },
      { label: ROTULOS_DO_PARECER[2], value: 'Manter o tempo ampliado nas provas' },
      { label: ROTULOS_DO_PARECER[3], value: 'Terças, 14h, sala 3, convocado pela coordenação' },
    ]);
  });

  it('prints "Não informado" for an opinion field that is blank, also when the API does not send it', () => {
    const embranco = Object.fromEntries(CHAVES_DO_PARECER.map((chave) => [chave, '  ']));
    const semOParecer = Object.fromEntries(
      Object.entries(registro()).filter(([chave]) => !CHAVES_DO_PARECER.includes(chave)),
    );

    for (const lido of [registro(embranco as Partial<PeiEntry>), semOParecer as unknown as PeiEntry]) {
      const linhas = linhasDe(secoesDoPeiParaLeitura(lido), TITULO_DO_PARECER);

      assert.deepEqual(
        linhas?.map((linha) => linha.value),
        ['Não informado', 'Não informado', 'Não informado', 'Não informado'],
      );
    }
  });

  it('prints the filled fields of the opinion and "Não informado" only for the blank ones', () => {
    const linhas = linhasDe(
      secoesDoPeiParaLeitura(registro({ semester_difficulties: '', individual_sessions: '' })),
      TITULO_DO_PARECER,
    );

    assert.deepEqual(
      linhas?.map((linha) => linha.value),
      [
        'Passou a resolver as operações sozinho',
        'Não informado',
        'Manter o tempo ampliado nas provas',
        'Não informado',
      ],
    );
  });

  it('prints the semester, the subject and the teacher in the identification', () => {
    assert.deepEqual(linhasDe(secoesDoPeiParaLeitura(registro()), 'Identificação'), [
      { label: 'Semestre', value: '2026.2' },
      { label: 'Disciplina', value: 'Matemática' },
      { label: 'Professor(a)', value: 'Professora Ana' },
    ]);
  });

  it('prints "Não informado" for the teacher of an entry whose author was deleted', () => {
    for (const semAutor of [{ author: null }, { author: undefined }, { author: { full_name: '  ' } }]) {
      const linhas = linhasDe(secoesDoPeiParaLeitura(registro(semAutor as Partial<PeiEntry>)), 'Identificação');

      assert.deepEqual(linhas?.[2], { label: 'Professor(a)', value: 'Não informado' });
    }
  });

  it('prints each text under the label of the contract', () => {
    const secoes = secoesDoPeiParaLeitura(registro());

    assert.deepEqual(linhasDe(secoes, 'Objetivos adaptados'), [
      { label: 'Objetivos adaptados', value: 'Ampliar a autonomia nas operações' },
    ]);
    assert.deepEqual(linhasDe(secoes, 'Conteúdos priorizados no semestre'), [
      { label: 'Conteúdos priorizados no semestre', value: 'Funções e geometria' },
    ]);
    assert.equal(linhasDe(secoes, 'Metodologias adaptadas')?.[0].value, 'Aulas com recursos visuais');
    assert.equal(linhasDe(secoes, 'Atividades avaliativas adaptadas')?.[0].value, 'Prova com tempo ampliado');
    assert.equal(linhasDe(secoes, 'Recursos adaptados')?.[0].value, 'Calculadora e ábaco');
    assert.equal(linhasDe(secoes, 'Observações gerais')?.[0].value, 'Responde bem a atividades em dupla');
  });

  it('prints "Não informado" for a text that is empty', () => {
    const secoes = secoesDoPeiParaLeitura(registro({ general_notes: '   ', adapted_resources: '' }));

    assert.equal(linhasDe(secoes, 'Observações gerais')?.[0].value, 'Não informado');
    assert.equal(linhasDe(secoes, 'Recursos adaptados')?.[0].value, 'Não informado');
  });

  it('prints the planned content and the adaptation of each pair, numbered, in the order of the list', () => {
    assert.deepEqual(linhasDe(secoesDoPeiParaLeitura(registro()), 'Conteúdo previsto na ementa e adequação'), [
      { label: 'Conteúdo previsto na ementa (1)', value: 'Funções do 1º grau' },
      { label: 'Adequação (1)', value: 'Usar material concreto' },
      { label: 'Conteúdo previsto na ementa (2)', value: 'Geometria plana' },
      { label: 'Adequação (2)', value: 'Não informado' },
    ]);
  });

  it('prints "Não informado" in a single row when the entry has no pair, also when the API does not send the list', () => {
    for (const lista of [[], undefined]) {
      const linhas = linhasDe(
        secoesDoPeiParaLeitura(registro({ syllabus_adaptations: lista as never })),
        'Conteúdo previsto na ementa e adequação',
      );

      assert.deepEqual(linhas, [{ label: 'Conteúdo previsto na ementa e adequação', value: 'Não informado' }]);
    }
  });

  it('gives every row of a section a different label, because the screen uses it as the key', () => {
    for (const secao of secoesDoPeiParaLeitura(registro())) {
      const rotulos = secao.linhas.map((linha) => linha.label);

      assert.equal(new Set(rotulos).size, rotulos.length, secao.titulo);
    }
  });
});

describe('SECOES_PARECER', () => {
  it('is one section, "Parecer semestral", with the four fields in the order of the contract', () => {
    assert.deepEqual(
      SECOES_PARECER.map((secao) => secao.titulo),
      [TITULO_DO_PARECER],
    );
    assert.deepEqual(
      camposDaTabela(SECOES_PARECER).map((campo) => [campo.caminho, campo.rotulo]),
      CHAVES_DO_PARECER.map((chave, indice) => [chave, ROTULOS_DO_PARECER[indice]]),
    );
  });

  it('has text areas with the limit of 2000 characters of the back', () => {
    for (const campo of camposDaTabela(SECOES_PARECER)) {
      assert.equal(campo.tipo, 'textoLongo', campo.caminho);
      assert.equal(campo.tipo === 'textoLongo' && campo.max, 2000, campo.caminho);
    }
  });
});

describe('formularioDoParecer', () => {
  it('copies the four fields of the opinion of the entry, and nothing else', () => {
    const form = formularioDoParecer(registro());

    assert.deepEqual(form, {
      semester_progress: 'Passou a resolver as operações sozinho',
      semester_difficulties: 'Perde o foco em provas longas',
      next_semester_notes: 'Manter o tempo ampliado nas provas',
      individual_sessions: 'Terças, 14h, sala 3, convocado pela coordenação',
    });
  });

  it('turns what the API does not send into empty text', () => {
    const form = formularioDoParecer({ semester_progress: 'Avançou', individual_sessions: null } as never);

    assert.deepEqual(form, {
      semester_progress: 'Avançou',
      semester_difficulties: '',
      next_semester_notes: '',
      individual_sessions: '',
    });
    assert.deepEqual(formularioDoParecer({} as PeiEntry), PARECER_EM_BRANCO);
  });
});

// O PATCH do parecer leva só os quatro campos do parecer, todos texto: o do
// conteúdo é outro PATCH. Estes testes fixam as chaves e o tipo de cada uma.
describe('montarCorpoDoParecer', () => {
  it('sends exactly the four keys of the contract, every one a string', () => {
    for (const form of [formularioDoParecerDe(), PARECER_EM_BRANCO]) {
      const corpo = montarCorpoDoParecer(form) as unknown as Record<string, unknown>;

      assert.deepEqual(Object.keys(corpo).sort(), [...CHAVES_DO_PARECER].sort());
      for (const chave of CHAVES_DO_PARECER) {
        assert.equal(typeof corpo[chave], 'string', chave);
      }
    }
  });

  it('sends every field even when blank, so the PATCH can clear it, with no value lost in the JSON', () => {
    const corpo = montarCorpoDoParecer(formularioDoParecerDe({ next_semester_notes: '   ' }));

    assert.equal(corpo.next_semester_notes, '');
    assert.deepEqual(JSON.parse(JSON.stringify(corpo)), corpo);
    assert.deepEqual(montarCorpoDoParecer(PARECER_EM_BRANCO), PARECER_EM_BRANCO);
  });

  it('trims the texts and keeps the line breaks inside them', () => {
    const corpo = montarCorpoDoParecer(
      formularioDoParecerDe({ semester_progress: '  Avançou\nem leitura  ' }),
    );

    assert.equal(corpo.semester_progress, 'Avançou\nem leitura');
  });

  it('never sends a key of the content, the semester, the subject or the e-mail, even when the form carries them', () => {
    const comConteudo = {
      ...formulario(),
      ...formularioDoParecerDe(),
      student_email: EMAIL,
    } as unknown as PeiOpinionForm;

    const corpo = montarCorpoDoParecer(comConteudo) as unknown as Record<string, unknown>;

    assert.deepEqual(Object.keys(corpo).sort(), [...CHAVES_DO_PARECER].sort());
  });
});

describe('validarParecer', () => {
  for (const caminho of CHAVES_DO_PARECER) {
    it(`accepts ${caminho} with 2000 characters and refuses it with 2001`, () => {
      const noLimite = validarParecer(formularioDoParecerDe({ [caminho]: repetir(LIMITES_PEI.TEXTO) }));
      const acima = validarParecer(formularioDoParecerDe({ [caminho]: repetir(LIMITES_PEI.TEXTO + 1) }));

      assert.equal(caminho in noLimite, false);
      assert.deepEqual(Object.keys(acima), [caminho]);
      assert.match(acima[caminho], /deve ter no máximo 2000 caracteres/);
    });

    it(`accepts ${caminho} empty`, () => {
      assert.deepEqual(validarParecer(formularioDoParecerDe({ [caminho]: '' })), {});
    });
  }

  it('names the field by its label in the message', () => {
    const erros = validarParecer(
      formularioDoParecerDe({ individual_sessions: repetir(LIMITES_PEI.TEXTO + 1) }),
    );

    assert.equal(
      erros.individual_sessions,
      `O campo "${ROTULOS_DO_PARECER[3]}" deve ter no máximo 2000 caracteres.`,
    );
  });

  it('counts the length after the trim', () => {
    const erros = validarParecer(
      formularioDoParecerDe({ semester_progress: `  ${repetir(LIMITES_PEI.TEXTO)}  ` }),
    );

    assert.deepEqual(erros, {});
  });

  it('accepts tabs and line breaks, and refuses the other control characters', () => {
    assert.deepEqual(
      validarParecer(formularioDoParecerDe({ semester_progress: 'Linha 1\r\nLinha 2\tcom tab' })),
      {},
    );
    for (const texto of ['a\u0000b', 'a\u001bb', 'a\u007fb', 'a\u0085b']) {
      assert.match(
        validarParecer(formularioDoParecerDe({ semester_difficulties: texto })).semester_difficulties,
        /não pode ter caracteres de controle/,
        JSON.stringify(texto),
      );
    }
  });

  it('refuses a lone surrogate, also at the edges, and accepts a paired one (an emoji)', () => {
    for (const texto of ['a\uD800b', 'a\uDFFFb', '\uD800', 'abc\uDC00', '\uDBFFabc']) {
      assert.deepEqual(
        Object.keys(validarParecer(formularioDoParecerDe({ next_semester_notes: texto }))),
        ['next_semester_notes'],
        JSON.stringify(texto),
      );
    }
    assert.deepEqual(
      validarParecer(formularioDoParecerDe({ next_semester_notes: 'Gosta de \u{1F916}' })),
      {},
    );
  });

  it('lists the errors in the order of the screen', () => {
    const erros = validarParecer(
      formularioDoParecerDe({
        individual_sessions: repetir(LIMITES_PEI.TEXTO + 1),
        semester_progress: repetir(LIMITES_PEI.TEXTO + 1),
        next_semester_notes: 'a\u0000b',
      }),
    );

    assert.deepEqual(Object.keys(erros), ['semester_progress', 'next_semester_notes', 'individual_sessions']);
  });

  it('accepts a complete form and a blank one', () => {
    assert.deepEqual(validarParecer(formularioDoParecerDe()), {});
    assert.deepEqual(validarParecer(PARECER_EM_BRANCO), {});
  });
});

describe('agruparPorSemestre', () => {
  const entrada = (id: number, semester: string, subject: string) => registro({ id, semester, subject });

  it('groups by semester, newest first, and by subject in alphabetical order inside each one', () => {
    const grupos = agruparPorSemestre([
      entrada(1, '2025.2', 'Matemática'),
      entrada(2, '2026.1', 'Português'),
      entrada(3, '2026.2', 'Química'),
      entrada(4, '2026.1', 'Biologia'),
      entrada(5, '2026.2', 'Artes'),
      entrada(6, '2026.1', 'Física'),
    ]);

    assert.deepEqual(
      grupos.map((grupo) => [grupo.semester, grupo.registros.map((item) => item.subject)]),
      [
        ['2026.2', ['Artes', 'Química']],
        ['2026.1', ['Biologia', 'Física', 'Português']],
        ['2025.2', ['Matemática']],
      ],
    );
  });

  it('orders the semesters of different years and the two of the same year', () => {
    const grupos = agruparPorSemestre([
      entrada(1, '2024.2', 'A'),
      entrada(2, '2026.1', 'A'),
      entrada(3, '2025.1', 'A'),
      entrada(4, '2025.2', 'A'),
    ]);

    assert.deepEqual(
      grupos.map((grupo) => grupo.semester),
      ['2026.1', '2025.2', '2025.1', '2024.2'],
    );
  });

  it('sorts the subjects ignoring case and accents, as a teacher reads them', () => {
    const grupos = agruparPorSemestre([
      entrada(1, '2026.1', 'matemática'),
      entrada(2, '2026.1', 'Ética'),
      entrada(3, '2026.1', 'Artes'),
      entrada(4, '2026.1', 'Física'),
    ]);

    assert.deepEqual(
      grupos[0].registros.map((item) => item.subject),
      ['Artes', 'Ética', 'Física', 'matemática'],
    );
  });

  it('keeps the two entries of subjects that differ only in case, ordered by id', () => {
    const grupos = agruparPorSemestre([entrada(9, '2026.1', 'matemática'), entrada(4, '2026.1', 'Matemática')]);

    assert.deepEqual(
      grupos[0].registros.map((item) => item.id),
      [4, 9],
    );
  });

  it('returns no group for no entry, and one group for entries of a single semester', () => {
    assert.deepEqual(agruparPorSemestre([]), []);
    assert.equal(agruparPorSemestre([entrada(1, '2026.1', 'A'), entrada(2, '2026.1', 'B')]).length, 1);
  });

  it('does not change the list it receives', () => {
    const lista = [entrada(1, '2025.2', 'B'), entrada(2, '2026.1', 'A')];
    const copia = [...lista];

    agruparPorSemestre(lista);

    assert.deepEqual(lista, copia);
  });
});

describe('podeCriarPei', () => {
  const NIVEIS = [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE];

  for (const nivel of NIVEIS) {
    const esperado = nivel === PROFISSIONAL_EDUCACAO;
    it(`${esperado ? 'shows' : 'hides'} the button to add an entry for level ${nivel}`, () => {
      assert.equal(podeCriarPei([nivel]), esperado);
    });
  }

  it('hides the button without a session', () => {
    assert.equal(podeCriarPei(undefined), false);
  });
});

describe('podeAlterarPei', () => {
  const NIVEIS = [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE];
  const ID_DO_AUTOR = 7;
  const OUTRO_ID = 8;

  it('shows edit only to the education professional who is the author of the entry', () => {
    assert.equal(podeAlterarPei({ sub: ID_DO_AUTOR, roles: [PROFISSIONAL_EDUCACAO] }, { id_author: ID_DO_AUTOR }), true);
  });

  it('hides edit from another education professional', () => {
    assert.equal(podeAlterarPei({ sub: OUTRO_ID, roles: [PROFISSIONAL_EDUCACAO] }, { id_author: ID_DO_AUTOR }), false);
  });

  for (const nivel of NIVEIS.filter((n) => n !== PROFISSIONAL_EDUCACAO)) {
    it(`hides edit from level ${nivel}, even with the id of the author`, () => {
      assert.equal(podeAlterarPei({ sub: ID_DO_AUTOR, roles: [nivel] }, { id_author: ID_DO_AUTOR }), false);
    });
  }

  it('hides edit from everyone when the author was deleted', () => {
    for (const nivel of NIVEIS) {
      assert.equal(podeAlterarPei({ sub: ID_DO_AUTOR, roles: [nivel] }, { id_author: null }), false, String(nivel));
    }
  });

  it('hides edit without a session', () => {
    assert.equal(podeAlterarPei(null, { id_author: ID_DO_AUTOR }), false);
    assert.equal(podeAlterarPei(undefined, { id_author: null }), false);
  });
});

describe('podeExcluirPei', () => {
  const NIVEIS = [ADMIN, ESTUDANTE, PROFISSIONAL_EDUCACAO, PROFISSIONAL_SAUDE, PROFISSIONAL_NAPNE];
  const ID_DO_AUTOR = 7;
  const OUTRO_ID = 8;

  it('shows delete to the education professional who is the author of the entry', () => {
    assert.equal(podeExcluirPei({ sub: ID_DO_AUTOR, roles: [PROFISSIONAL_EDUCACAO] }, { id_author: ID_DO_AUTOR }), true);
  });

  it('shows delete to any education professional when the author was deleted (orphan entry)', () => {
    for (const sub of [ID_DO_AUTOR, OUTRO_ID]) {
      assert.equal(podeExcluirPei({ sub, roles: [PROFISSIONAL_EDUCACAO] }, { id_author: null }), true, String(sub));
    }
  });

  it('hides delete from another education professional when the entry has an author', () => {
    assert.equal(podeExcluirPei({ sub: OUTRO_ID, roles: [PROFISSIONAL_EDUCACAO] }, { id_author: ID_DO_AUTOR }), false);
  });

  for (const nivel of NIVEIS.filter((n) => n !== PROFISSIONAL_EDUCACAO)) {
    it(`hides delete from level ${nivel}, with the id of the author and also on an orphan entry`, () => {
      assert.equal(podeExcluirPei({ sub: ID_DO_AUTOR, roles: [nivel] }, { id_author: ID_DO_AUTOR }), false);
      assert.equal(podeExcluirPei({ sub: ID_DO_AUTOR, roles: [nivel] }, { id_author: null }), false);
    });
  }

  it('hides delete without a session, also on an orphan entry', () => {
    assert.equal(podeExcluirPei(null, { id_author: ID_DO_AUTOR }), false);
    assert.equal(podeExcluirPei(undefined, { id_author: ID_DO_AUTOR }), false);
    assert.equal(podeExcluirPei(null, { id_author: null }), false);
    assert.equal(podeExcluirPei(undefined, { id_author: null }), false);
  });

  it('keeps the edit with the author only: the orphan entry is deletable but never editable', () => {
    const orfao = { id_author: null };
    const sessao = { sub: ID_DO_AUTOR, roles: [PROFISSIONAL_EDUCACAO] };

    assert.equal(podeExcluirPei(sessao, orfao), true);
    assert.equal(podeAlterarPei(sessao, orfao), false);
  });
});

describe('caminhoDoParDe', () => {
  it('is the path setNestedField needs to edit one side of a pair of the form', () => {
    const form = formulario({ syllabus_adaptations: [par('Um', 'a'), par('Dois', 'b')] });

    const alterado = setNestedField(form, caminhoDoParDe(1, 'adaptation'), 'novo');

    assert.deepEqual(alterado.syllabus_adaptations, [par('Um', 'a'), par('Dois', 'novo')]);
    assert.deepEqual(form.syllabus_adaptations, [par('Um', 'a'), par('Dois', 'b')]);
  });

  it('is the key of the error the form clears when the teacher edits that side', () => {
    assert.equal(caminhoDoParDe(0, 'syllabus_content'), 'syllabus_adaptations.0.syllabus_content');
    assert.equal(caminhoDoParDe(12, 'adaptation'), 'syllabus_adaptations.12.adaptation');
  });
});

describe('PEI buttons with several roles', () => {
  it('shows the write to an Education professional who also has other roles', () => {
    assert.equal(podeCriarPei([PROFISSIONAL_EDUCACAO, 6]), true);
  });

  it('hides the write from the AEE teacher alone', () => {
    assert.equal(podeCriarPei([6]), false);
  });
});
