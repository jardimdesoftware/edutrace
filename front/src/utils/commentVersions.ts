import type { CommentData, CommentEditData } from '../interfaces/CommentData';

export interface PreviousVersion {
  numero: number;
  texto: string;
  escritaEm: Date | string;
  original: boolean;
}

type CommentWithEdits = Pick<CommentData, 'created_at' | 'edits'>;

// Cada edição guarda o texto que foi substituído, e o created_at dela marca
// o momento da substituição. Por isso a versão N foi escrita quando a edição
// N-1 aconteceu, e a versão original foi escrita na criação da anotação.
function sortedEdits(anotacao: CommentWithEdits): CommentEditData[] {
  return [...(anotacao.edits ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

export function buildPreviousVersions(
  anotacao: CommentWithEdits,
): PreviousVersion[] {
  const edicoes = sortedEdits(anotacao);

  return edicoes
    .map((edicao, indice) => ({
      numero: indice + 1,
      texto: edicao.comment,
      escritaEm:
        indice === 0 ? anotacao.created_at : edicoes[indice - 1].created_at,
      original: indice === 0,
    }))
    .reverse();
}

export function lastEditedAt(anotacao: CommentWithEdits): Date | string | null {
  const edicoes = sortedEdits(anotacao);

  return edicoes.length > 0 ? edicoes[edicoes.length - 1].created_at : null;
}
