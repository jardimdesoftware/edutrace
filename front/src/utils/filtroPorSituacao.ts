import type { StudentData } from '@/interfaces/StudentData';

// Mesmos valores que o back aceita em GET /users?situation=. A lista padrão
// mostra os ativos e quem está nos 7 dias de carência, e esconde os desativados.
export type SituacaoDaLista = 'padrao' | 'carencia' | 'desativados';

export const SITUACAO_PADRAO: SituacaoDaLista = 'padrao';

// Filtro "Situação", só do administrador.
export const OPCOES_FILTRO_SITUACAO: readonly { value: SituacaoDaLista; label: string }[] = [
  { value: 'padrao', label: 'Ativos e em carência' },
  { value: 'carencia', label: 'Em carência' },
  { value: 'desativados', label: 'Desativados' },
];

// O valor de um select chega como texto. Qualquer coisa que não seja uma das
// opções volta para a lista padrão, em vez de esvaziar a tela.
export function lerFiltroSituacao(valor: string): SituacaoDaLista {
  const opcao = OPCOES_FILTRO_SITUACAO.find((item) => item.value === valor);
  return opcao ? opcao.value : SITUACAO_PADRAO;
}

// Depois de restaurar quem está na carência ou reativar um desativado, a conta
// volta a ser ativa e sai das listas que só mostram um desses dois grupos.
export function permaneceNaSituacao(
  usuario: Pick<StudentData, 'deleted_at' | 'deactivated_at'>,
  situacao: SituacaoDaLista,
): boolean {
  const desativado = !!usuario.deactivated_at;
  const emCarencia = !!usuario.deleted_at && !desativado;

  if (situacao === 'desativados') return desativado;
  if (situacao === 'carencia') return emCarencia;
  return !desativado;
}
