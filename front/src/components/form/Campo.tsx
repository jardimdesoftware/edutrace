import { useId, type ReactNode } from "react";

const ESTILO_DO_CONTROLE =
  "block w-full rounded-lg border bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-600";

const BORDA_NORMAL = "border-gray-300";
const BORDA_COM_ERRO = "border-red-600";

export function estiloDoControle(comErro: boolean): string {
  return `${ESTILO_DO_CONTROLE} ${comErro ? BORDA_COM_ERRO : BORDA_NORMAL}`;
}

export function useIdDoCampo(id?: string): string {
  const gerado = useId();
  return id ?? gerado;
}

export interface PropsDoControle {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

interface CampoProps {
  id: string;
  rotulo: string;
  rotuloOculto?: boolean;
  ajuda?: string;
  erro?: string;
  descricaoExtra?: string;
  rodape?: ReactNode;
  children: (controle: PropsDoControle) => ReactNode;
}

// Rótulo, controle, ajuda e erro de um campo. O controle recebe o id que o
// rótulo aponta e o aria-describedby com o erro e a ajuda, nessa ordem, para o
// leitor de tela ler o erro primeiro ao entrar no campo.
export default function Campo({
  id,
  rotulo,
  rotuloOculto = false,
  ajuda,
  erro,
  descricaoExtra,
  rodape,
  children,
}: CampoProps) {
  const ajudaId = `${id}-ajuda`;
  const erroId = `${id}-erro`;
  const descricao = [erro && erroId, ajuda && ajudaId, descricaoExtra].filter(Boolean).join(" ");

  return (
    <div>
      <label
        htmlFor={id}
        className={rotuloOculto ? "sr-only" : "mb-1 block text-sm font-medium text-gray-900"}
      >
        {rotulo}
      </label>
      {children({
        id,
        "aria-describedby": descricao || undefined,
        "aria-invalid": erro ? true : undefined,
      })}
      {ajuda && (
        <p id={ajudaId} className="mt-1 text-xs text-gray-600">
          {ajuda}
        </p>
      )}
      {erro && (
        <p id={erroId} className="mt-1 text-sm text-red-700">
          {erro}
        </p>
      )}
      {rodape}
    </div>
  );
}
