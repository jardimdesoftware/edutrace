import Campo, { estiloDoControle, useIdDoCampo } from "./Campo";

interface CampoBasicoProps {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  id?: string;
  ajuda?: string;
  erro?: string;
  disabled?: boolean;
  obrigatorio?: boolean;
}

type InputProps = CampoBasicoProps & {
  tipo: "text" | "date" | "number";
  max?: number;
  min?: number;
  tamanhoMaximo?: number;
};

function InputField({
  rotulo,
  valor,
  onChange,
  id: idDaProp,
  ajuda,
  erro,
  disabled,
  obrigatorio,
  tipo,
  max,
  min,
  tamanhoMaximo,
}: InputProps) {
  const id = useIdDoCampo(idDaProp);

  return (
    <Campo id={id} rotulo={rotulo} ajuda={ajuda} erro={erro} obrigatorio={obrigatorio}>
      {(controle) => (
        <input
          {...controle}
          type={tipo}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          max={max}
          min={min}
          maxLength={tamanhoMaximo}
          step={tipo === "number" ? 1 : undefined}
          inputMode={tipo === "number" ? "numeric" : undefined}
          autoComplete="off"
          className={estiloDoControle(!!erro)}
        />
      )}
    </Campo>
  );
}

export function TextField(props: CampoBasicoProps & { tamanhoMaximo?: number }) {
  return <InputField {...props} tipo="text" />;
}

// O navegador devolve a data como AAAA-MM-DD, vazia quando incompleta.
export function DateField(props: CampoBasicoProps) {
  return <InputField {...props} tipo="date" />;
}

export function NumberField(props: CampoBasicoProps & { min?: number; max?: number }) {
  return <InputField {...props} tipo="number" />;
}
