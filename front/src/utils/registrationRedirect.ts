export const COMPLETE_REGISTRATION_PAGE = "/completar-cadastro";

// Conta criada pelo login com Google sem CPF e senha cadastrados: só a tela de
// cadastro fica acessível, e o back recusa as demais rotas de qualquer forma.
// Com o cadastro completo, a tela deixa de ter uso e leva à página inicial.
export function registrationRedirect(
  user: { must_complete_registration?: boolean },
  pathname: string,
): string | null {
  if (user.must_complete_registration) {
    return pathname === COMPLETE_REGISTRATION_PAGE
      ? null
      : COMPLETE_REGISTRATION_PAGE;
  }

  return pathname === COMPLETE_REGISTRATION_PAGE ? "/home" : null;
}

// O cabeçalho leva a páginas que a conta pendente não pode abrir, então só
// aparece depois do cadastro concluído.
export function showHeader(user: { must_complete_registration?: boolean } | null): boolean {
  return !user?.must_complete_registration;
}
