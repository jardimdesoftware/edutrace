import type { CommentData } from '../interfaces/CommentData';
import {
  ADMIN,
  PROFISSIONAL_EDUCACAO,
  PROFISSIONAL_NAPNE,
  PROFISSIONAL_SAUDE,
} from '../consts';

export interface CommentFilters {
  busca: string;
  idAutor: number | null;
  area: number | null;
  de: string;
  ate: string;
  soEditadas: boolean;
}

export const FILTROS_VAZIOS: CommentFilters = {
  busca: '',
  idAutor: null,
  area: null,
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

export function filtrosAtivos(filtros: CommentFilters): boolean {
  return (
    normalizarTexto(filtros.busca) !== '' ||
    filtros.idAutor !== null ||
    filtros.area !== null ||
    filtros.de !== '' ||
    filtros.ate !== '' ||
    filtros.soEditadas
  );
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
