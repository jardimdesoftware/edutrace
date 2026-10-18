import type { CommentData, CommentQuery, CommentType } from '../interfaces/CommentData';
import {
  ADMIN,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from '../consts';
import { MARCAS_DEMAIS } from './caracteres';

export interface CommentFilters {
  busca: string;
  idAutor: number | null;
  area: number | null;
  tipo: CommentType | null;
  de: string;
  ate: string;
  soEditadas: boolean;
}

export const FILTROS_VAZIOS: CommentFilters = {
  busca: '',
  idAutor: null,
  area: null,
  tipo: null,
  de: '',
  ate: '',
  soEditadas: false,
};

export const AREAS: { nivel: number; nome: string }[] = [
  { nivel: PROFISSIONAL_SAUDE, nome: 'Saúde' },
  { nivel: PROFISSIONAL_EDUCACAO, nome: 'Educação' },
  { nivel: PROFISSIONAL_NAPNE, nome: 'NAPNE' },
  { nivel: ADMIN, nome: 'Administração' },
];

const QUALQUER_CONTROLE = /\p{Cc}/gu;

// A busca vai ao servidor sem caractere de controle: o back o recusa com 400, e
// uma tabulação colada de uma planilha cai no meio do termo, onde o trim não
// chega. Cada controle vira um espaço, para que dois termos colados por
// tabulação continuem separados, e só depois vem o trim.
export function limparBusca(busca: string): string {
  return busca.replace(QUALQUER_CONTROLE, ' ').trim();
}

export const ERRO_DE_MARCAS_NA_BUSCA =
  'A busca não pode ter mais de 30 acentos ou marcas seguidos.';

// A busca com marcas combinantes demais o back recusa, então ela nem sai.
export function erroDaBusca(busca: string): string {
  return MARCAS_DEMAIS.test(limparBusca(busca)) ? ERRO_DE_MARCAS_NA_BUSCA : '';
}

// A busca que vale para o servidor, dada a que o usuário digitou e a que valia
// antes. A vazia vale na hora, sem a espera, para que apagar o campo ou limpar
// os filtros não deixe uma consulta intermediária com o termo antigo. A
// inválida nunca vale (fica a anterior). As demais valem depois da espera.
export function proximaBusca(digitada: string, valida: string, esperou: boolean): string {
  const limpa = limparBusca(digitada);
  if (limpa === '') return '';

  return esperou && !erroDaBusca(limpa) ? limpa : valida;
}

export function filtrosAtivos(filtros: CommentFilters): boolean {
  return (
    limparBusca(filtros.busca) !== '' ||
    filtros.idAutor !== null ||
    filtros.area !== null ||
    filtros.tipo !== null ||
    filtros.de !== '' ||
    filtros.ate !== '' ||
    filtros.soEditadas
  );
}

// O back só aceita data com ano de 1000 a 9999 no instante enviado (em UTC).
const ANO_ACEITO_PELO_BACK = /^[1-9]\d{3}-/;

// O campo de data devolve "aaaa-mm-dd" do dia escolhido no fuso do usuário, então
// o limite é a meia-noite local do dia (e não a UTC): uma anotação feita às 23h
// de um dia pertence a ele. Data vazia, que não existe no calendário ou cujo
// instante cai fora dos anos 1000 a 9999 (o "até" de 9999-12-31 vai ao ano
// 10000) não vira parâmetro: o filtro fica sem efeito, e a API não responde 400.
function meiaNoiteLocal(data: string, diasDepois = 0): string | undefined {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!partes) return undefined;

  const [ano, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const inicioDe = (diaDoMes: number) => {
    const inicio = new Date(0);
    inicio.setFullYear(ano, mes - 1, diaDoMes);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
  };

  const escolhido = inicioDe(dia);
  const existe =
    escolhido.getFullYear() === ano &&
    escolhido.getMonth() === mes - 1 &&
    escolhido.getDate() === dia;

  if (!existe) return undefined;

  // O dia seguinte é do calendário, não 24 horas depois: no dia da troca do
  // horário de verão o dia tem 23 ou 25 horas.
  const instante = inicioDe(dia + diasDepois).toISOString();
  return ANO_ACEITO_PELO_BACK.test(instante) ? instante : undefined;
}

interface PaginaDaConsulta {
  cursor?: number;
  limit?: number;
}

// Traduz os filtros da tela para a query de GET /comments/:id_user. O "até" é
// inclusivo na tela e o "to" da API é exclusivo (created_at < to), por isso vai
// a meia-noite do dia seguinte. Só sai o parâmetro que tem valor.
export function montarConsulta(
  filtros: CommentFilters,
  pagina: PaginaDaConsulta = {},
): CommentQuery {
  const busca = erroDaBusca(filtros.busca) ? '' : limparBusca(filtros.busca);
  const de = meiaNoiteLocal(filtros.de);
  const ate = meiaNoiteLocal(filtros.ate, 1);

  return {
    ...(busca ? { q: busca } : {}),
    ...(filtros.idAutor !== null ? { author: filtros.idAutor } : {}),
    ...(filtros.area !== null ? { area: filtros.area } : {}),
    ...(filtros.tipo !== null ? { type: filtros.tipo } : {}),
    ...(de ? { from: de } : {}),
    ...(ate ? { to: ate } : {}),
    ...(filtros.soEditadas ? { edited: true } : {}),
    ...(pagina.cursor !== undefined ? { cursor: pagina.cursor } : {}),
    ...(pagina.limit !== undefined ? { limit: pagina.limit } : {}),
  };
}

export function normalizarTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// Os campos de data devolvem "aaaa-mm-dd" no fuso local; a comparação usa o
// mesmo formato para que uma anotação feita às 23h não caia no dia seguinte
// por causa do UTC.
function dataLocal(data: Date | string): string {
  const d = new Date(data);
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function listarAutores(
  anotacoes: CommentData[],
): { id: number; nome: string }[] {
  const autores = new Map<number, string>();
  anotacoes.forEach((anotacao) => {
    if (!autores.has(anotacao.id_author)) {
      autores.set(anotacao.id_author, anotacao.author_name);
    }
  });

  return [...autores]
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function filtrarAnotacoes(
  anotacoes: CommentData[],
  filtros: CommentFilters,
): CommentData[] {
  const termo = normalizarTexto(filtros.busca);

  return anotacoes.filter((anotacao) => {
    if (
      termo &&
      !normalizarTexto(anotacao.comment).includes(termo) &&
      !normalizarTexto(anotacao.author_name).includes(termo)
    ) {
      return false;
    }

    if (filtros.idAutor !== null && anotacao.id_author !== filtros.idAutor) {
      return false;
    }

    if (filtros.area !== null && anotacao.author_level !== filtros.area) {
      return false;
    }

    const criadaEm = dataLocal(anotacao.created_at);
    if (filtros.de && criadaEm < filtros.de) return false;
    if (filtros.ate && criadaEm > filtros.ate) return false;

    if (filtros.soEditadas && (anotacao.edits ?? []).length === 0) {
      return false;
    }

    return true;
  });
}
