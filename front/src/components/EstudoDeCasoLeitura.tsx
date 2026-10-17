import type { CaseStudy } from "@/interfaces/CaseStudy";
import { secoesParaLeitura } from "@/utils/estudoDeCaso";
import LeituraPorTabela from "./LeituraPorTabela";

interface LeituraProps {
  estudo: CaseStudy;
  // undefined é o curso que a tela não conhece; null é o cadastro sem curso.
  curso?: string | null;
}

export default function EstudoDeCasoLeitura({ estudo, curso }: LeituraProps) {
  return (
    <LeituraPorTabela
      secoes={secoesParaLeitura(estudo, curso)}
      prefixoDosIds="estudo-de-caso"
      criadoEm={estudo.created_at}
      atualizadoEm={estudo.updated_at}
      autor={estudo.author?.full_name ?? null}
    />
  );
}
