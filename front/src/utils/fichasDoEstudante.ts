import { canAccessPage } from "./pageAccess";

export interface FichaDoEstudante {
  label: string;
  rota: string;
}

const FICHAS: readonly FichaDoEstudante[] = [
  { label: "Triagem", rota: "/triagem" },
  { label: "Anamnese", rota: "/anamnese" },
  { label: "Anotações Multiprofissionais", rota: "/comentarios" },
  { label: "PEI", rota: "/pei" },
];

// Só as fichas que o nível abre: o cartão de uma página que o middleware nega
// levaria o usuário a um redirecionamento para a home.
export function fichasDoEstudante(idLevel: number): FichaDoEstudante[] {
  return FICHAS.filter((ficha) => canAccessPage(ficha.rota, idLevel));
}
