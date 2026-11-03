// Parte genérica dos formulários orientados por tabela (estudo de caso e PAEE):
// a tabela de seções diz quais campos existem, e daqui saem o formulário vazio,
// o formulário de um registro, o corpo da API, a validação e as linhas de
// leitura. Cada documento só declara a própria tabela.

export const NAO_INFORMADO = 'Não informado';
const NENHUMA_OPCAO = 'Nenhuma opção marcada';

// obrigatorio: o campo em branco é recusado. Marcação nunca é obrigatória: item
// desmarcado é uma resposta.
export type CampoDef =
  | {
      tipo: 'texto' | 'textoLongo';
      caminho: string;
      rotulo: string;
      max: number;
      obrigatorio?: true;
    }
  | {
      tipo: 'numero';
      caminho: string;
      rotulo: string;
      max: number;
      unidade: { singular: string; plural: string };
      obrigatorio?: true;
    }
  | { tipo: 'data'; caminho: string; rotulo: string; obrigatorio?: true }
  | { tipo: 'marcacao'; caminho: string; rotulo: string };

// A lista de verificação agrupa itens marcáveis sob um título, com os textos
// que a acompanham; os outros grupos só reúnem campos que têm um subtítulo.
export type GrupoDef =
  | { titulo?: string; lista?: false; campos: CampoDef[] }
  | { titulo: string; lista: true; campos: CampoDef[] };

// Num formulário em passos, cada seção é um passo. Seções seguidas com o mesmo
// `passo` formam um passo só, com esse rótulo na barra de passos.
// dividirPorGrupo: uma seção grande vira um passo por grupo, cada um com o
// título do grupo na barra de passos.
// caminhosExtras: caminhos que a tela controla fora da tabela (como o período
// do PAEE ou a lista do PEI), para o erro de um deles cair no passo da seção.
export interface SecaoDef {
  titulo: string;
  grupos: GrupoDef[];
  passo?: string;
  dividirPorGrupo?: true;
  caminhosExtras?: string[];
}

// Só leva a chave quando o campo é obrigatório, para a definição dos campos
// comuns continuar com a mesma forma.
const marcaObrigatorio = (obrigatorio?: true) => (obrigatorio ? { obrigatorio } : {});

export const texto = (
  caminho: string,
  rotulo: string,
  max: number,
  obrigatorio?: true,
): CampoDef => ({
  tipo: 'texto',
  caminho,
  rotulo,
  max,
  ...marcaObrigatorio(obrigatorio),
});
export const textoLongo = (
  caminho: string,
  rotulo: string,
  max: number,
  obrigatorio?: true,
): CampoDef => ({
  tipo: 'textoLongo',
  caminho,
  rotulo,
  max,
  ...marcaObrigatorio(obrigatorio),
});
export const numero = (
  caminho: string,
  rotulo: string,
  max: number,
  unidade: { singular: string; plural: string },
  obrigatorio?: true,
): CampoDef => ({ tipo: 'numero', caminho, rotulo, max, unidade, ...marcaObrigatorio(obrigatorio) });
export const marcacao = (caminho: string, rotulo: string): CampoDef => ({
  tipo: 'marcacao',
  caminho,
  rotulo,
});
export const data = (caminho: string, rotulo: string, obrigatorio?: true): CampoDef => ({
  tipo: 'data',
  caminho,
  rotulo,
  ...marcaObrigatorio(obrigatorio),
});

export function camposDaTabela(secoes: readonly SecaoDef[]): CampoDef[] {
  return secoes.flatMap((secao) => secao.grupos).flatMap((grupo) => grupo.campos);
}

export type Formulario<T> = {
  [K in keyof T]-?: NonNullable<T[K]> extends boolean
    ? boolean
    : NonNullable<T[K]> extends string | number
      ? string
      : Formulario<NonNullable<T[K]>>;
};

export type ErrosDoFormulario = Record<string, string>;

type Registro = Record<string, unknown>;

export function lerCaminho(origem: unknown, caminho: string): unknown {
  return caminho.split('.').reduce<unknown>((atual, chave) => {
    return typeof atual === 'object' && atual !== null ? (atual as Registro)[chave] : undefined;
  }, origem);
}

function comCaminho(origem: Registro, chaves: string[], valor: unknown): Registro {
  const [chave, ...resto] = chaves;
  const filho = origem[chave];
  return {
    ...origem,
    [chave]: resto.length
      ? comCaminho(typeof filho === 'object' && filho !== null ? (filho as Registro) : {}, resto, valor)
      : valor,
  };
}

function montar(secoes: readonly SecaoDef[], valorDoCampo: (campo: CampoDef) => unknown): Registro {
  return camposDaTabela(secoes).reduce<Registro>((corpo, campo) => {
    const valor = valorDoCampo(campo);
    return valor === undefined ? corpo : comCaminho(corpo, campo.caminho.split('.'), valor);
  }, {});
}

const PARTES_DA_DATA = /^(\d{4})-(\d{2})-(\d{2})/;

function partesDaData(valor: unknown): [string, string, string] | null {
  const partes = typeof valor === 'string' ? PARTES_DA_DATA.exec(valor) : null;
  return partes ? [partes[1], partes[2], partes[3]] : null;
}

// A API pode devolver a data com hora; o campo de data e a tela só usam o dia.
// Não passa por Date, que deslocaria o dia pelo fuso do navegador.
function dataParaCampo(valor: unknown): string {
  return partesDaData(valor)?.join('-') ?? '';
}

export function formatarDataISO(valor: string | null | undefined): string {
  const partes = partesDaData(valor);
  return partes ? `${partes[2]}/${partes[1]}/${partes[0]}` : '';
}

function textoDe(valor: unknown): string {
  return typeof valor === 'string' ? valor : '';
}

// O formulário tem a forma do corpo da API, mas guarda tudo o que o usuário
// digita como texto (números e datas) ou marcação.
export function formularioVazioDe<F>(secoes: readonly SecaoDef[]): F {
  return montar(secoes, (campo) => (campo.tipo === 'marcacao' ? false : '')) as F;
}

export function formularioDoRegistro<F>(secoes: readonly SecaoDef[], registro: unknown): F {
  return montar(secoes, (campo) => {
    const valor = lerCaminho(registro, campo.caminho);
    switch (campo.tipo) {
      case 'marcacao':
        return valor === true;
      case 'numero':
        return typeof valor === 'number' ? String(valor) : '';
      case 'data':
        return dataParaCampo(valor);
      default:
        return textoDe(valor);
    }
  }) as F;
}

// Corpo das seções do POST e do PATCH, só com os campos da tabela. Número e
// data em branco ficam fora; o PATCH troca a seção inteira, então o campo
// omitido é o campo limpo. Quem chama valida antes: número fora do padrão vira
// NaN.
export function montarCorpoDe<P>(secoes: readonly SecaoDef[], form: unknown): P {
  return montar(secoes, (campo) => {
    const valor = lerCaminho(form, campo.caminho);
    if (campo.tipo === 'marcacao') return valor === true;

    const limpo = textoDe(valor).trim();
    if (campo.tipo === 'numero') return limpo ? Number(limpo) : undefined;
    if (campo.tipo === 'data') return limpo || undefined;
    return limpo;
  }) as P;
}

function dataExiste(valor: string): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!partes) return false;

  const [ano, mes, dia] = partes.slice(1).map(Number);
  const normalizada = new Date(0);
  normalizada.setUTCFullYear(ano, mes - 1, dia);
  return (
    normalizada.getUTCFullYear() === ano &&
    normalizada.getUTCMonth() === mes - 1 &&
    normalizada.getUTCDate() === dia
  );
}

function erroDoCampo(campo: CampoDef, valor: unknown): string | null {
  const limpo = textoDe(valor).trim();

  if (campo.tipo !== 'marcacao' && campo.obrigatorio && !limpo) {
    return `O campo "${campo.rotulo}" é obrigatório.`;
  }

  switch (campo.tipo) {
    case 'texto':
    case 'textoLongo':
      return limpo.length > campo.max
        ? `O campo "${campo.rotulo}" deve ter no máximo ${campo.max} caracteres.`
        : null;
    case 'numero':
      return limpo && !(/^\d+$/.test(limpo) && Number(limpo) <= campo.max)
        ? `O campo "${campo.rotulo}" deve ser um número inteiro entre 0 e ${campo.max}.`
        : null;
    case 'data':
      return limpo && !dataExiste(limpo)
        ? `O campo "${campo.rotulo}" deve ser uma data válida.`
        : null;
    default:
      return null;
  }
}

// Mesmos limites do DTO do back; a chave do resultado é o caminho do campo.
export function validarFormularioDe(secoes: readonly SecaoDef[], form: unknown): ErrosDoFormulario {
  return Object.fromEntries(
    camposDaTabela(secoes).flatMap((campo) => {
      const erro = erroDoCampo(campo, lerCaminho(form, campo.caminho));
      return erro ? [[campo.caminho, erro]] : [];
    }),
  );
}

export interface LinhaDeLeitura {
  label: string;
  value: string;
}

export interface SecaoDeLeitura {
  titulo: string;
  linhas: LinhaDeLeitura[];
}

export function textoOuNaoInformado(valor: unknown): string {
  return textoDe(valor).trim() || NAO_INFORMADO;
}

function valorDoCampo(campo: CampoDef, valor: unknown): string {
  switch (campo.tipo) {
    case 'marcacao':
      return valor === true ? 'Sim' : 'Não';
    case 'numero': {
      if (typeof valor !== 'number') return NAO_INFORMADO;
      const { singular, plural } = campo.unidade;
      return `${valor} ${valor === 1 ? singular : plural}`;
    }
    case 'data':
      return formatarDataISO(textoDe(valor)) || NAO_INFORMADO;
    default:
      return textoOuNaoInformado(valor);
  }
}

// Numa lista de verificação só os itens marcados saem, um por linha, como o
// relatório faz com os grupos de opções da triagem. Os textos vão em linhas
// próprias, que levam o título do grupo no rótulo.
function linhasDoGrupo(grupo: GrupoDef, registro: unknown): LinhaDeLeitura[] {
  const linhaDe = (campo: CampoDef, label: string): LinhaDeLeitura => ({
    label,
    value: valorDoCampo(campo, lerCaminho(registro, campo.caminho)),
  });

  if (!grupo.lista) return grupo.campos.map((campo) => linhaDe(campo, campo.rotulo));

  const marcados = grupo.campos
    .filter((campo) => campo.tipo === 'marcacao' && lerCaminho(registro, campo.caminho) === true)
    .map((campo) => `• ${campo.rotulo}`);
  const textos = grupo.campos
    .filter((campo) => campo.tipo !== 'marcacao')
    .map((campo) => linhaDe(campo, `${grupo.titulo}: ${campo.rotulo.toLowerCase()}`));

  return [
    { label: grupo.titulo, value: marcados.length ? marcados.join('\n') : NENHUMA_OPCAO },
    ...textos,
  ];
}

export function secoesDeLeitura(secoes: readonly SecaoDef[], registro: unknown): SecaoDeLeitura[] {
  return secoes.map((secao) => ({
    titulo: secao.titulo,
    linhas: secao.grupos.flatMap((grupo) => linhasDoGrupo(grupo, registro)),
  }));
}

// Curso a mostrar numa tela de documento do estudante: o do registro carregado,
// que vem com o estudante e é o único que o estudante lendo o próprio documento
// recebe; sem registro ainda, o do cadastro de quem o profissional abriu pelo
// id da URL. undefined é o curso que a tela não conhece (a linha some) e null é
// o estudante sem curso.
export function cursoDoEstudante(
  registro: { student?: { course: string | null } } | null,
  cadastro: { course?: string | null } | null,
): string | null | undefined {
  const origem = registro?.student ?? cadastro;
  return origem ? (origem.course ?? null) : undefined;
}
