import { PROFISSIONAL_EDUCACAO } from '@/consts';
import type {
  NewPeiEntryPayload,
  PeiEntry,
  PeiEntryContent,
  PeiEntryOpinion,
  SyllabusAdaptation,
} from '@/interfaces/PeiEntry';
import { CONTROLE_EM_TEXTO } from './caracteres';
import {
  NAO_INFORMADO,
  camposDaTabela,
  formularioDoRegistro,
  formularioVazioDe,
  lerCaminho,
  montarCorpoDe,
  secoesDeLeitura,
  textoLongo,
  textoOuNaoInformado,
  validarFormularioDe,
  type ErrosDoFormulario,
  type Formulario,
  type LinhaDeLeitura,
  type SecaoDeLeitura,
  type SecaoDef,
} from './formularioPorTabela';
import { periodoLetivoValido } from './paee';

// Limites do DTO do PEI no back.
export const LIMITES_PEI = {
  DISCIPLINA: 150,
  TEXTO: 2000,
  CONTEUDO_PREVISTO: 500,
  ADEQUACAO: 1000,
  MAXIMO_DE_PARES: 20,
} as const;

export const TITULO_IDENTIFICACAO = 'Identificação';
export const TITULO_EMENTA = 'Conteúdo previsto na ementa e adequação';
const ROTULO_SEMESTRE = 'Semestre';
const ROTULO_DISCIPLINA = 'Disciplina';
const ROTULO_PROFESSOR = 'Professor(a)';
const ROTULO_CONTEUDO_PREVISTO = 'Conteúdo previsto na ementa';
const ROTULO_ADEQUACAO = 'Adequação';

function secaoDeTexto(caminho: string, titulo: string): SecaoDef {
  return { titulo, grupos: [{ campos: [textoLongo(caminho, titulo, LIMITES_PEI.TEXTO)] }] };
}

// Rótulos e ordem copiados do contrato da issue #706. A mesma tabela monta o
// formulário, a leitura na tela e o PDF. As duas seções sem campos são lugares
// reservados: a Identificação (semestre, disciplina e professor, que não são
// conteúdo) e a lista de pares, que não cabe num campo de texto. Quem monta o
// formulário e a leitura preenche esses dois lugares.
export const SECOES_PEI: readonly SecaoDef[] = [
  { titulo: TITULO_IDENTIFICACAO, grupos: [] },
  secaoDeTexto('adapted_objectives', 'Objetivos adaptados'),
  secaoDeTexto('prioritized_contents', 'Conteúdos priorizados no semestre'),
  { titulo: TITULO_EMENTA, grupos: [] },
  secaoDeTexto('adapted_methodologies', 'Metodologias adaptadas'),
  secaoDeTexto('adapted_assessments', 'Atividades avaliativas adaptadas'),
  secaoDeTexto('adapted_resources', 'Recursos adaptados'),
  secaoDeTexto('general_notes', 'Observações gerais'),
];

const TITULO_PARECER = 'Parecer semestral';

// Rótulos e limites copiados do contrato da issue #707. O parecer é gravado à
// parte do conteúdo (formulário e PATCH próprios), então tem a própria tabela,
// que também monta a leitura na tela e no PDF.
export const SECOES_PARECER: readonly SecaoDef[] = [
  {
    titulo: TITULO_PARECER,
    grupos: [
      {
        campos: [
          textoLongo('semester_progress', 'Avanços no semestre', LIMITES_PEI.TEXTO),
          textoLongo('semester_difficulties', 'Dificuldades no semestre', LIMITES_PEI.TEXTO),
          textoLongo(
            'next_semester_notes',
            'Apontamentos para o próximo semestre',
            LIMITES_PEI.TEXTO,
          ),
          textoLongo(
            'individual_sessions',
            'Atendimentos individualizados prestados (datas, horários, salas e meio de convocação)',
            LIMITES_PEI.TEXTO,
          ),
        ],
      },
    ],
  },
];

export const CAMINHO_DO_SEMESTRE = 'semester';
export const CAMINHO_DA_DISCIPLINA = 'subject';
export const CAMINHO_DOS_PARES = 'syllabus_adaptations';

export function caminhoDoParDe(indice: number, campo: keyof SyllabusAdaptation): string {
  return `${CAMINHO_DOS_PARES}.${indice}.${campo}`;
}

// O formulário traz o semestre e a disciplina junto do conteúdo, porque a
// criação os pede na mesma tela; o corpo do PATCH, que não os aceita, sai só do
// conteúdo.
export type PeiEntryForm = { semester: string; subject: string } & Formulario<PeiEntryContent>;
type TextosDoForm = Omit<Formulario<PeiEntryContent>, typeof CAMINHO_DOS_PARES>;
type TextosDoCorpo = Omit<PeiEntryContent, typeof CAMINHO_DOS_PARES>;

export function formularioVazioDoPei(): PeiEntryForm {
  return {
    [CAMINHO_DO_SEMESTRE]: '',
    [CAMINHO_DA_DISCIPLINA]: '',
    ...formularioVazioDe<TextosDoForm>(SECOES_PEI),
    [CAMINHO_DOS_PARES]: [],
  };
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

function paresDoRegistro(pares: unknown): PeiEntryForm['syllabus_adaptations'] {
  if (!Array.isArray(pares)) return [];

  return pares.map((par) => ({
    syllabus_content: textoDe(par?.syllabus_content),
    adaptation: textoDe(par?.adaptation),
  }));
}

export function formularioDoPei(registro: PeiEntryContent & Pick<PeiEntry, 'semester' | 'subject'>): PeiEntryForm {
  return {
    [CAMINHO_DO_SEMESTRE]: textoDe(registro.semester),
    [CAMINHO_DA_DISCIPLINA]: textoDe(registro.subject),
    ...formularioDoRegistro<TextosDoForm>(SECOES_PEI, registro),
    [CAMINHO_DOS_PARES]: paresDoRegistro(registro.syllabus_adaptations),
  };
}

export type PeiOpinionForm = Formulario<PeiEntryOpinion>;

export function formularioDoParecer(registro: PeiEntryOpinion): PeiOpinionForm {
  return formularioDoRegistro<PeiOpinionForm>(SECOES_PARECER, registro);
}

// Os quatro campos do parecer e só eles: o conteúdo segue em outro PATCH, para
// cada corpo ficar abaixo do limite de 100 kb do body parser do back. O campo em
// branco vai como texto vazio, que limpa o valor gravado.
export function montarCorpoDoParecer(form: PeiOpinionForm): PeiEntryOpinion {
  return montarCorpoDe<PeiEntryOpinion>(SECOES_PARECER, form);
}

// Pares sem espaços nas pontas e sem o par com os dois lados em branco, como o
// back os espera.
export function paresParaEnvio(pares: readonly SyllabusAdaptation[]): SyllabusAdaptation[] {
  return pares
    .map((par) => ({
      syllabus_content: textoDe(par.syllabus_content).trim(),
      adaptation: textoDe(par.adaptation).trim(),
    }))
    .filter((par) => par.syllabus_content !== '' || par.adaptation !== '');
}

// Os sete campos de conteúdo, que o PATCH aceita. Cada campo enviado troca o
// valor inteiro, a lista de pares inclusive. Quem chama valida antes: o par com
// adequação e sem conteúdo previsto o back recusa.
export function montarCorpoDeAtualizacao(form: PeiEntryForm): PeiEntryContent {
  return {
    ...montarCorpoDe<TextosDoCorpo>(SECOES_PEI, form),
    [CAMINHO_DOS_PARES]: paresParaEnvio(form.syllabus_adaptations),
  };
}

// A disciplina é comparada pelo texto exato: o back tira os espaços das pontas e
// normaliza em NFC, e o front valida e envia esse mesmo texto, para que
// "Matemática" digitada decomposta seja o registro de "Matemática" composta.
function disciplinaNormalizada(disciplina: string): string {
  return disciplina.trim().normalize('NFC');
}

// O POST leva o e-mail do estudante, o semestre e a disciplina, que o PATCH
// não aceita, junto do conteúdo.
export function montarCorpoDeCriacao(email: string, form: PeiEntryForm): NewPeiEntryPayload {
  return {
    student_email: email,
    semester: form.semester.trim(),
    subject: disciplinaNormalizada(form.subject),
    ...montarCorpoDeAtualizacao(form),
  };
}

// Os textos recusam os caracteres de CONTROLE_EM_TEXTO (a tabulação e as quebras
// de linha passam, porque os textos longos as aceitam). A disciplina, que cabe
// numa linha, não aceita nem elas, e recusa também os invisíveis que forjam um
// texto igual ao de outra disciplina: formatação (Cf, como U+200B, U+202E,
// U+FEFF e U+00AD) e os separadores de linha e de parágrafo (Zl e Zp).
const CONTROLE_EM_LINHA = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;

function erroDeTamanhoEControle(
  rotulo: string,
  limpo: string,
  maximo: number,
  controle: RegExp,
  depoisDoRotulo = '',
): string | null {
  const campo = `O campo "${rotulo}"${depoisDoRotulo}`;
  if (limpo.length > maximo) return `${campo} deve ter no máximo ${maximo} caracteres.`;
  if (!controle.test(limpo)) return null;

  return controle === CONTROLE_EM_LINHA
    ? `${campo} não pode ter quebra de linha nem caracteres de controle ou invisíveis.`
    : `${campo} não pode ter caracteres de controle.`;
}

function erroDoSemestre(semestre: string): ErrosDoFormulario {
  return periodoLetivoValido(semestre)
    ? {}
    : {
        [CAMINHO_DO_SEMESTRE]: `O campo "${ROTULO_SEMESTRE}" deve ter o formato AAAA.S, com semestre 1 ou 2 (por exemplo, 2026.2).`,
      };
}

function erroDaDisciplina(disciplina: string): ErrosDoFormulario {
  const limpa = disciplinaNormalizada(disciplina);
  const erro = limpa
    ? erroDeTamanhoEControle(ROTULO_DISCIPLINA, limpa, LIMITES_PEI.DISCIPLINA, CONTROLE_EM_LINHA)
    : `O campo "${ROTULO_DISCIPLINA}" é obrigatório.`;
  return erro ? { [CAMINHO_DA_DISCIPLINA]: erro } : {};
}

// Tamanho e caracteres de controle dos textos de uma seção da tabela.
function errosDosTextos(secao: SecaoDef, form: unknown): ErrosDoFormulario {
  const doTamanho = validarFormularioDe([secao], form);

  return Object.fromEntries(
    camposDaTabela([secao]).flatMap((campo) => {
      const erro =
        doTamanho[campo.caminho] ??
        (CONTROLE_EM_TEXTO.test(textoDe(lerCaminho(form, campo.caminho)))
          ? `O campo "${campo.rotulo}" não pode ter caracteres de controle.`
          : null);
      return erro ? [[campo.caminho, erro]] : [];
    }),
  );
}

function errosDoPar(par: SyllabusAdaptation, indice: number): [string, string][] {
  const conteudo = par.syllabus_content.trim();
  const adequacao = par.adaptation.trim();
  if (!conteudo && !adequacao) return [];

  const doPar = ` do par ${indice + 1}`;
  const doConteudo = conteudo
    ? erroDeTamanhoEControle(
        ROTULO_CONTEUDO_PREVISTO,
        conteudo,
        LIMITES_PEI.CONTEUDO_PREVISTO,
        CONTROLE_EM_TEXTO,
        doPar,
      )
    : `Informe o "${ROTULO_CONTEUDO_PREVISTO}"${doPar}, ou limpe a "${ROTULO_ADEQUACAO}".`;
  const daAdequacao = erroDeTamanhoEControle(
    ROTULO_ADEQUACAO,
    adequacao,
    LIMITES_PEI.ADEQUACAO,
    CONTROLE_EM_TEXTO,
    doPar,
  );
  const entradas: ([string, string] | null)[] = [
    doConteudo ? [caminhoDoParDe(indice, 'syllabus_content'), doConteudo] : null,
    daAdequacao ? [caminhoDoParDe(indice, 'adaptation'), daAdequacao] : null,
  ];

  return entradas.filter((entrada) => entrada !== null);
}

// A chave do erro de um par é o caminho do campo no formulário, com o índice do
// par na tela; os pares em branco ficam de fora, como no envio.
function errosDosPares(pares: readonly SyllabusAdaptation[]): ErrosDoFormulario {
  const excedeu = paresParaEnvio(pares).length > LIMITES_PEI.MAXIMO_DE_PARES;

  return {
    ...(excedeu
      ? {
          [CAMINHO_DOS_PARES]: `Informe no máximo ${LIMITES_PEI.MAXIMO_DE_PARES} pares de conteúdo previsto e adequação.`,
        }
      : {}),
    ...Object.fromEntries(pares.flatMap(errosDoPar)),
  };
}

// Mesmos limites do DTO do back; a chave do resultado é o caminho do campo, na
// ordem em que os campos aparecem na tela. O registro já criado mantém o
// semestre e a disciplina, então só a criação os valida.
export function validarPeiExistente(form: PeiEntryForm): ErrosDoFormulario {
  return SECOES_PEI.reduce<ErrosDoFormulario>(
    (erros, secao) => ({
      ...erros,
      ...(secao.titulo === TITULO_EMENTA
        ? errosDosPares(form.syllabus_adaptations)
        : errosDosTextos(secao, form)),
    }),
    {},
  );
}

export function validarParecer(form: PeiOpinionForm): ErrosDoFormulario {
  return errosDosTextos(SECOES_PARECER[0], form);
}

export function validarPeiNovo(form: PeiEntryForm): ErrosDoFormulario {
  return {
    ...erroDoSemestre(form.semester),
    ...erroDaDisciplina(form.subject),
    ...validarPeiExistente(form),
  };
}

type PeiParaLeitura = PeiEntryContent &
  PeiEntryOpinion &
  Pick<PeiEntry, 'semester' | 'subject'> & {
    author?: { full_name: string } | null;
  };

function linhasDosPares(pares: readonly SyllabusAdaptation[]): LinhaDeLeitura[] {
  if (!pares?.length) return [{ label: TITULO_EMENTA, value: NAO_INFORMADO }];

  return pares.flatMap((par, indice) => [
    {
      label: `${ROTULO_CONTEUDO_PREVISTO} (${indice + 1})`,
      value: textoOuNaoInformado(par.syllabus_content),
    },
    { label: `${ROTULO_ADEQUACAO} (${indice + 1})`, value: textoOuNaoInformado(par.adaptation) },
  ]);
}

// Seções do registro do PEI prontas para a tela de leitura e para o PDF, na
// ordem da tabela: a Identificação (semestre, disciplina e professor(a)), os
// textos e a lista de pares, uma linha para o conteúdo previsto e outra para a
// adequação de cada par, e por último o Parecer semestral.
export function secoesDoPeiParaLeitura(registro: PeiParaLeitura): SecaoDeLeitura[] {
  const doConteudo = secoesDeLeitura(SECOES_PEI, registro).map((secao) => {
    switch (secao.titulo) {
      case TITULO_IDENTIFICACAO:
        return {
          titulo: secao.titulo,
          linhas: [
            { label: ROTULO_SEMESTRE, value: registro.semester?.trim() || NAO_INFORMADO },
            { label: ROTULO_DISCIPLINA, value: registro.subject?.trim() || NAO_INFORMADO },
            { label: ROTULO_PROFESSOR, value: registro.author?.full_name?.trim() || NAO_INFORMADO },
          ],
        };
      case TITULO_EMENTA:
        return { titulo: secao.titulo, linhas: linhasDosPares(registro.syllabus_adaptations) };
      default:
        return secao;
    }
  });

  return [...doConteudo, ...secoesDeLeitura(SECOES_PARECER, registro)];
}

export interface GrupoDeSemestre {
  semester: string;
  registros: PeiEntry[];
}

function compararSemestre(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? 1 : -1;
}

// Registros agrupados por semestre, do mais recente para o mais antigo, e por
// disciplina, em ordem alfabética, dentro de cada semestre. Não depende da
// ordem em que a API devolve a lista.
export function agruparPorSemestre(registros: readonly PeiEntry[]): GrupoDeSemestre[] {
  const ordenados = [...registros].sort(
    (a, b) =>
      compararSemestre(a.semester, b.semester) ||
      a.subject.localeCompare(b.subject, 'pt-BR', { sensitivity: 'base' }) ||
      a.id - b.id,
  );

  return ordenados.reduce<GrupoDeSemestre[]>((grupos, registro) => {
    const ultimo = grupos[grupos.length - 1];
    return ultimo?.semester === registro.semester
      ? [...grupos.slice(0, -1), { ...ultimo, registros: [...ultimo.registros, registro] }]
      : [...grupos, { semester: registro.semester, registros: [registro] }];
  }, []);
}

// A regra definitiva é do back (POST, PATCH e DELETE só do nível Profissional
// da Educação; PATCH só do autor; DELETE do autor ou de qualquer um desse nível
// quando o autor foi excluído). Aqui só decide se os botões de escrita aparecem.
type SessaoDoPei = { sub: number; id_level: number } | null | undefined;

export function podeCriarPei(idLevel?: number): boolean {
  return idLevel === PROFISSIONAL_EDUCACAO;
}

export function podeAlterarPei(sessao: SessaoDoPei, registro: Pick<PeiEntry, 'id_author'>): boolean {
  return (
    podeCriarPei(sessao?.id_level) && registro.id_author !== null && sessao?.sub === registro.id_author
  );
}

// O registro órfão (id_author null, porque a conta do autor foi excluída) não
// tem quem o edite, mas qualquer professor pode excluí-lo para criar o seu.
export function podeExcluirPei(sessao: SessaoDoPei, registro: Pick<PeiEntry, 'id_author'>): boolean {
  return (
    podeCriarPei(sessao?.id_level) && (registro.id_author === null || sessao?.sub === registro.id_author)
  );
}
