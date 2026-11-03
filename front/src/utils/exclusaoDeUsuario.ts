import { ADMIN } from '@/consts';
import type { StudentData } from '@/interfaces/StudentData';
import { temPapel, type UsuarioLogado } from './papeis';

// Mesmo prazo de USER_DELETION_GRACE_DAYS no back, que é quem apaga de vez.
export const DIAS_DE_CARENCIA = 7;

const DIA_EM_MS = 24 * 60 * 60 * 1000;

export const MOTIVO_PROPRIA_CONTA = 'Você não pode excluir a própria conta.';

export function estaMarcado(usuario: Pick<StudentData, 'deleted_at'>): boolean {
  return !!usuario.deleted_at;
}

// Dia em que o back apaga o usuário: a marcação mais a carência.
export function dataDaExclusao(marcadoEm: string): Date {
  return new Date(new Date(marcadoEm).getTime() + DIAS_DE_CARENCIA * DIA_EM_MS);
}

export function textoDaExclusao(marcadoEm: string): string {
  const data = dataDaExclusao(marcadoEm).toLocaleDateString('pt-BR', {
    timeZone: 'America/Recife',
  });
  return `Exclusão em ${data}`;
}

// A regra definitiva é do back (DELETE /users/:id é só do administrador, e
// recusa a própria conta e quem já está marcado). Aqui só decide se a lixeira
// aparece e se está ativa.
export function podeExcluir(
  usuario: UsuarioLogado | null | undefined,
  alvo: Pick<StudentData, 'id' | 'deleted_at'>,
): boolean {
  return (
    temPapel(usuario?.roles, ADMIN) &&
    usuario?.sub !== alvo.id &&
    !estaMarcado(alvo)
  );
}

export function podeRestaurar(
  usuario: UsuarioLogado | null | undefined,
  alvo: Pick<StudentData, 'deleted_at'>,
): boolean {
  return temPapel(usuario?.roles, ADMIN) && estaMarcado(alvo);
}

export function motivoDaLixeiraDesativada(
  usuario: UsuarioLogado | null | undefined,
  alvo: Pick<StudentData, 'id'>,
): string | null {
  return usuario?.sub === alvo.id ? MOTIVO_PROPRIA_CONTA : null;
}

// A janela de 10 minutos é do servidor. O navegador só guarda o fim que o back
// devolveu, para decidir se mostra o campo de senha; se o back discordar, ele
// responde 401 e o campo volta.
export function janelaDeSenhaAberta(
  ate: string | null | undefined,
  agora: Date,
): boolean {
  if (!ate) return false;
  const fim = new Date(ate).getTime();
  return Number.isFinite(fim) && fim > agora.getTime();
}

export function corpoDaExclusao(
  senha: string,
  lembrar: boolean,
): { currentPassword?: string; remember?: boolean } {
  if (!senha) return {};
  return lembrar ? { currentPassword: senha, remember: true } : { currentPassword: senha };
}
