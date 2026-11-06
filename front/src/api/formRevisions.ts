import type {
  TipoDeFormulario,
  VersaoCompleta,
  VersaoResumida,
} from "@/utils/historicoDeEdicoes";
import { apiRequest } from "@/services/http";

// O PAEE tem um formulário por período letivo, que vai na query; os demais são
// únicos por estudante.
function caminho(tipo: TipoDeFormulario, email: string, periodo?: string, versao?: number) {
  const base = `/form-revisions/${tipo}/${encodeURIComponent(email)}`;
  const comVersao = versao === undefined ? base : `${base}/${versao}`;

  return periodo ? `${comVersao}?record=${encodeURIComponent(periodo)}` : comVersao;
}

export async function listarVersoes(
  tipo: TipoDeFormulario,
  email: string,
  periodo?: string,
): Promise<VersaoResumida[]> {
  return apiRequest(caminho(tipo, email, periodo));
}

export async function buscarVersao<T = unknown>(
  tipo: TipoDeFormulario,
  email: string,
  versao: number,
  periodo?: string,
): Promise<VersaoCompleta<T>> {
  return apiRequest(caminho(tipo, email, periodo, versao));
}
