import type { StudentData } from '@/interfaces/StudentData';
import { listarUsuariosDaTabela } from './tabelaUsuarios';
import { errorAlertOptions } from './errorAlert';
import type { Papeis } from './papeis';

// As telas do estudante levam só o id na URL. O Microsoft Clarity registra o
// endereço de cada página visitada, então e-mail, nome e CPF do estudante não
// podem ir na query string.
export function rotaDoEstudante(caminho: string, id?: number | string | null) {
  if (id === null || id === undefined || id === '') return caminho;
  return `${caminho}?id=${encodeURIComponent(String(id))}`;
}

// Resolve o usuário a partir do id da URL na mesma lista que a tabela da home
// exibe para os papéis da sessão: o administrador procura entre todos os
// usuários, e os profissionais, entre os estudantes.
export async function buscarUsuarioPorId(
  id: string | null,
  roles?: Papeis,
): Promise<StudentData | null> {
  const idNumerico = Number(id);
  if (!id || !Number.isInteger(idNumerico) || idNumerico <= 0) return null;

  const usuarios: StudentData[] = await listarUsuariosDaTabela(roles);
  return usuarios.find((usuario) => usuario.id === idNumerico) ?? null;
}

type Alerta = ReturnType<typeof errorAlertOptions>;

export type EstudanteDaUrl =
  | { registro: StudentData }
  | { tipo: 'nao-encontrado'; alerta: Alerta }
  | { tipo: 'falha'; alerta: Alerta };

// Sem estudante, a tela não tem o que exibir. O id inválido, inexistente ou
// fora da lista dos papéis da sessão vira o alerta "não encontrado", mostrado
// antes de voltar para a home; o front não distingue "não existe" de "sem
// acesso", porque a lista do profissional só traz estudantes. A falha da API é
// outro caso: o estudante pode existir, então o alerta oferece nova tentativa
// em vez de tirar o profissional da tela.
export async function resolverEstudanteDaUrl(
  id: string | null,
  roles?: Papeis,
): Promise<EstudanteDaUrl> {
  let falha: unknown;
  const registro = await buscarUsuarioPorId(id, roles).catch((erro) => {
    console.error('Erro ao identificar o estudante:', erro);
    falha = erro;
    return null;
  });

  if (registro) return { registro };

  if (falha !== undefined) {
    return {
      tipo: 'falha',
      alerta: errorAlertOptions(
        'Não foi possível carregar o estudante',
        falha,
        'Tente novamente em instantes.',
      ),
    };
  }

  return {
    tipo: 'nao-encontrado',
    alerta: errorAlertOptions(
      'Estudante não encontrado',
      undefined,
      'O estudante não existe ou você não tem acesso a ele.',
    ),
  };
}
