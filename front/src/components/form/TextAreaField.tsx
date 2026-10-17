import { anuncioDoContador, textoDoContador } from "@/utils/contadorDeCaracteres";
import Campo, { estiloDoControle, useIdDoCampo } from "./Campo";

interface TextAreaFieldProps {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  tamanhoMaximo: number;
  id?: string;
  ajuda?: string;
  erro?: string;
  rotuloOculto?: boolean;
  linhas?: number;
  disabled?: boolean;
}

const LINHAS_PADRAO = 4;

// O contador visível entra no aria-describedby e é lido uma vez, ao focar o
// campo. O aviso ao vivo é uma região separada, que só muda perto do limite e
// no limite (ver anuncioDoContador), para não anunciar cada tecla.
export default function TextAreaField({
  rotulo,
  valor,
  onChange,
  tamanhoMaximo,
  id: idDaProp,
  ajuda,
  erro,
  rotuloOculto,
  linhas = LINHAS_PADRAO,
  disabled,
}: TextAreaFieldProps) {
  const id = useIdDoCampo(idDaProp);
  const contadorId = `${id}-contador`;

  return (
    <Campo
      id={id}
      rotulo={rotulo}
      rotuloOculto={rotuloOculto}
      ajuda={ajuda}
      erro={erro}
      descricaoExtra={contadorId}
      rodape={
        <>
          <p
            id={contadorId}
            className="mt-1 text-right text-xs tabular-nums text-gray-600"
          >
            {textoDoContador(valor.length, tamanhoMaximo)}
          </p>
          <p role="status" className="sr-only">
            {anuncioDoContador(valor.length, tamanhoMaximo)}
          </p>
        </>
      }
    >
      {(controle) => (
        <textarea
          {...controle}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          maxLength={tamanhoMaximo}
          rows={linhas}
          disabled={disabled}
          className={`${estiloDoControle(!!erro)} resize-y`}
        />
      )}
    </Campo>
  );
}
