import { useId, type ReactNode } from "react";

interface FormSectionProps {
  titulo: string;
  children: ReactNode;
}

// Bloco do formulário com título na hierarquia da página (h2). Os grupos de
// campos dentro dele, como uma lista de verificação, usam FormFieldset.
export function FormSection({ titulo, children }: FormSectionProps) {
  const tituloId = useId();

  return (
    <section
      aria-labelledby={tituloId}
      className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
    >
      <h2 id={tituloId} className="text-lg font-semibold text-emerald-800">
        {titulo}
      </h2>
      <div className="mt-4 space-y-5">{children}</div>
    </section>
  );
}

interface FormFieldsetProps {
  legenda: string;
  // A legenda que repetiria o título da seção sai da tela e continua para o
  // leitor de tela.
  legendaOculta?: boolean;
  children: ReactNode;
}

// Grupo de campos que só fazem sentido juntos: o leitor de tela anuncia a
// legenda ao entrar em cada campo do grupo.
export function FormFieldset({ legenda, legendaOculta = false, children }: FormFieldsetProps) {
  return (
    <fieldset className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-4">
      <legend className={legendaOculta ? "sr-only" : "px-1 text-sm font-semibold text-gray-900"}>
        {legenda}
      </legend>
      {children}
    </fieldset>
  );
}
