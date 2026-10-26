// Única comparação de papéis do back: o usuário passa quando algum dos papéis
// dele está na lista permitida. Lista ausente ou vazia nega, e cada ponto de
// autorização usa esta função em vez de comparar o papel diretamente.
export function hasAnyRole(
  roles: readonly number[] | null | undefined,
  allowed: readonly number[],
): boolean {
  return !!roles && roles.some((role) => allowed.includes(role));
}
