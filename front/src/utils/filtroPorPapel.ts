import type { StudentData } from '@/interfaces/StudentData';
import { PAPEIS_DO_FORMULARIO, ROTULO_DO_PAPEL, temPapel } from './papeis';

export type FiltroPapel = number | 'TODOS';

// O administrador filtra a lista de usuários pelos papéis do sistema, os
// mesmos do formulário de cadastro. O filtro de atendimento é dos
// profissionais, e não diz nada sobre o que o administrador gerencia.
export const OPCOES_FILTRO_PAPEL: readonly { value: FiltroPapel; label: string }[] = [
  { value: 'TODOS', label: 'Todos' },
  ...PAPEIS_DO_FORMULARIO.map((papel) => ({
    value: papel,
    label: ROTULO_DO_PAPEL[papel],
  })),
];

// O valor de um select chega como texto. Qualquer coisa que não seja uma das
// opções volta para "Todos", em vez de esvaziar a lista.
export function lerFiltroPapel(valor: string): FiltroPapel {
  const papel = Number(valor);
  return PAPEIS_DO_FORMULARIO.includes(papel) ? papel : 'TODOS';
}

// Com "TODOS" a lista segue como veio da API. Com um papel, ficam as contas que
// o têm, inclusive as que acumulam outros papéis.
export function filtrarPorPapel(
  usuarios: readonly StudentData[],
  filtro: FiltroPapel,
): StudentData[] {
  if (filtro === 'TODOS') return [...usuarios];
  return usuarios.filter((usuario) => temPapel(usuario.roles, filtro));
}
