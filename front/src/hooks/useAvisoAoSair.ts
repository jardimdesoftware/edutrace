import { useEffect } from "react";

// Pede ao navegador que confirme antes de fechar a aba ou recarregar a página
// enquanto `ativo`. Não pega o botão voltar do navegador nem a navegação
// interna do Next: para sair do formulário com aviso, o caminho é o Cancelar.
export function useAvisoAoSair(ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return;

    const avisar = (evento: BeforeUnloadEvent) => {
      evento.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [ativo]);
}
