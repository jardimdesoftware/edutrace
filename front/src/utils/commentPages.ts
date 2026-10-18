import type { CommentPage } from '../interfaces/CommentData';

// Acrescenta a página nova à lista já carregada. O cursor e os totais são os da
// resposta mais recente; um id que já está na lista não se repete.
export function juntarPaginas(atual: CommentPage, nova: CommentPage): CommentPage {
  const carregados = new Set(atual.items.map((item) => item.id));

  return {
    ...nova,
    items: [...atual.items, ...nova.items.filter((item) => !carregados.has(item.id))],
  };
}

// Cada chamada abre uma requisição e devolve a pergunta "ainda sou a última?".
// A resposta de uma requisição que deixou de ser a última (o filtro mudou
// enquanto ela voltava) não pode sobrescrever a da mais nova.
export function criarSequencia(): () => () => boolean {
  let ultima = 0;

  return () => {
    ultima += 1;
    const minha = ultima;
    return () => minha === ultima;
  };
}

// A carga guarda a chave da consulta a que pertence (estudante, filtros e
// número da tentativa). Quando a chave da tela muda a carga fica para trás e a
// lista passa a "carregando" sem apagar estado no efeito; a página antiga
// continua na tela, esmaecida, até a nova chegar. Em erro a página antiga
// também fica, só para o painel de filtros não sumir e permitir corrigir o
// filtro. A página de OUTRO estudante nunca aparece: ela é de outra pessoa.
export interface Carga {
  chave: string;
  idEstudante: number;
  pagina: CommentPage | null;
  erro: string | null;
  erroMais: string | null;
}

export function cargaConcluida(
  chave: string,
  idEstudante: number,
  pagina: CommentPage,
): Carga {
  return { chave, idEstudante, pagina, erro: null, erroMais: null };
}

// No erro, só a página do mesmo estudante continua na tela.
export function cargaComErro(
  anterior: Carga | null,
  chave: string,
  idEstudante: number,
  erro: string,
): Carga {
  return {
    chave,
    idEstudante,
    pagina: anterior?.idEstudante === idEstudante ? anterior.pagina : null,
    erro,
    erroMais: null,
  };
}

// O "Carregar mais" só se junta à carga da mesma chave: se os filtros mudaram
// enquanto a página vinha, ela é de outra consulta e não entra na lista nova.
export function cargaComMais(
  atual: Carga | null,
  chave: string,
  nova: CommentPage,
): Carga | null {
  return atual?.chave === chave && atual.pagina
    ? { ...atual, pagina: juntarPaginas(atual.pagina, nova), erroMais: null }
    : atual;
}

export function cargaComErroDeMais(
  atual: Carga | null,
  chave: string,
  erroMais: string,
): Carga | null {
  return atual?.chave === chave ? { ...atual, erroMais } : atual;
}

export interface EstadoDaLista {
  pagina: CommentPage | null;
  carregando: boolean;
  erro: string | null;
  erroMais: string | null;
  proximo: number | null;
  temMais: boolean;
}

// O que a tela mostra, dada a última carga e a consulta de agora. A página vale
// para o mesmo estudante (mesmo de uma consulta antiga, enquanto a nova carrega);
// carregando, erro, erroMais e o cursor do "Carregar mais" valem só para a
// carga da MESMA chave.
export function estadoDaLista(
  carga: Carga | null,
  idEstudante: number | null,
  chave: string,
): EstadoDaLista {
  const doEstudante = carga?.idEstudante === idEstudante ? carga : null;
  const daConsulta = doEstudante?.chave === chave ? doEstudante : null;
  const erro = daConsulta?.erro ?? null;

  return {
    pagina: doEstudante?.pagina ?? null,
    carregando: idEstudante !== null && !daConsulta,
    erro,
    erroMais: daConsulta?.erroMais ?? null,
    proximo: daConsulta && !erro ? (daConsulta.pagina?.next_cursor ?? null) : null,
    temMais: !erro && (doEstudante?.pagina?.next_cursor ?? null) !== null,
  };
}

interface Contagem {
  carregadas: number;
  total: number;
  overall: number;
}

// total é o que casa com os filtros e overall é tudo o que o estudante tem.
export function resumoDaContagem({ carregadas, total, overall }: Contagem): string {
  const anotacao = total === 1 ? 'anotação' : 'anotações';
  if (total === overall) return `Mostrando ${carregadas} de ${total} ${anotacao}.`;

  const filtrada = total === 1 ? 'filtrada' : 'filtradas';
  return `Mostrando ${carregadas} de ${total} ${anotacao} ${filtrada} (${overall} no total).`;
}
