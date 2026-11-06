"use client";

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import Swal from "sweetalert2";
import { useAvisoAoSair } from "@/hooks/useAvisoAoSair";
import type { SecaoDeLeitura, SecaoDef, ErrosDoFormulario } from "@/utils/formularioPorTabela";
import { setNestedField } from "@/utils/nestedField";
import {
  houveAlteracao,
  limitarPasso,
  passoDoCaminho,
  passosDe,
  primeiroCaminhoComErro,
  situacaoDosPassos,
  textoDoBloqueio,
  type PassoDef,
} from "@/utils/passosDoFormulario";
import AssistenteDePassos from "./AssistenteDePassos";
import type { ModoDoFormulario } from "./AcoesDoAssistente";
import {
  GrupoDaTabela,
  idDoCampoCom,
  type AoAlterar,
  type AoDefinir,
  type ControleDoFormulario,
} from "./CamposDaTabela";
import LeituraDoPasso from "./LeituraDoPasso";
import { COR_CANCELAR, COR_EXCLUIR } from "./form/botoes";

export { DadosDoCadastro } from "./CamposDaTabela";
export type { AoAlterar, AoDefinir, ControleDoFormulario } from "./CamposDaTabela";

interface FormularioPorTabelaProps<F extends object> {
  // O documento e o estudante, no cabeçalho do cartão.
  titulo: string;
  estudante?: string;
  resumo?: ReactNode;
  // Botões do documento que não são do formulário, como Excluir.
  acoesDoDocumento?: ReactNode;
  // Autoria do documento, à direita do título.
  ladoDoTitulo?: ReactNode;
  // Aviso do documento, sob o título (por exemplo, uma versão antiga aberta).
  aviso?: ReactNode;
  secoes: readonly SecaoDef[];
  // Prefixo dos ids dos campos, para o rótulo e o foco de erro acharem o campo.
  prefixoDosIds: string;
  inicial: F;
  validar: (form: F) => ErrosDoFormulario;
  salvando: boolean;
  onSalvar: (form: F) => void;
  onCancelar: () => void;
  modo?: ModoDoFormulario;
  // Só no modo "ver": leva o usuário à edição do mesmo registro.
  onEditar?: () => void;
  // Só no modo "ver": as linhas de leitura das seções de um passo.
  leituraDoPasso?: (secoes: readonly SecaoDef[]) => SecaoDeLeitura[];
  // Conteúdo que abre uma seção, antes dos campos da tabela: o que o documento
  // mostra do cadastro e os campos que não estão na tabela.
  cabecalhoDaSecao?: (secao: SecaoDef, controle: ControleDoFormulario<F>) => ReactNode;
}

function tituloDoPasso(passo: PassoDef): string {
  return passo.secoes.length === 1 ? passo.secoes[0].titulo : passo.rotulo;
}

export default function FormularioPorTabela<F extends object>({
  titulo,
  estudante,
  resumo,
  acoesDoDocumento,
  ladoDoTitulo,
  aviso,
  secoes,
  prefixoDosIds,
  inicial,
  validar,
  salvando,
  onSalvar,
  onCancelar,
  modo = "criar",
  onEditar,
  leituraDoPasso,
  cabecalhoDaSecao,
}: FormularioPorTabelaProps<F>) {
  const passos = passosDe(secoes);
  const [valores, setValores] = useState<F>(inicial);
  const [atual, setAtual] = useState(0);
  const [visitados, setVisitados] = useState<number[]>([0]);
  const [tentou, setTentou] = useState(false);
  const [pedidoDeFoco, setPedidoDeFoco] = useState<{ caminho: string; vez: number } | null>(null);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const focarOTitulo = useRef(false);

  const ver = modo === "ver";
  const alterado = houveAlteracao(inicial, valores);
  useAvisoAoSair(!ver && !salvando && alterado);

  // Os erros vêm sempre dos valores: corrigir o campo tira o erro sozinho. Só
  // aparecem nos passos que o usuário já deixou, ou depois de tentar concluir.
  const erros = validar(valores);
  const situacao = situacaoDosPassos(passos, erros);
  const aparece = (indice: number) => tentou || (visitados.includes(indice) && indice !== atual);
  const errosVisiveis = Object.fromEntries(
    Object.entries(erros).filter(([caminho]) => aparece(Math.max(0, passoDoCaminho(passos, caminho)))),
  );

  // O foco vai para o título do passo novo, para o leitor de tela anunciá-lo.
  useEffect(() => {
    if (focarOTitulo.current) {
      focarOTitulo.current = false;
      tituloRef.current?.focus();
    }
  }, [atual]);

  // Depois do render do passo que tem o campo inválido, o foco vai para ele.
  useEffect(() => {
    if (pedidoDeFoco) {
      document.getElementById(idDoCampoCom(prefixoDosIds, pedidoDeFoco.caminho))?.focus();
    }
  }, [pedidoDeFoco, prefixoDosIds]);

  const idDoCampo = (caminho: string) => idDoCampoCom(prefixoDosIds, caminho);

  const irPara = (indice: number, comFocoNoTitulo = true) => {
    const destino = limitarPasso(indice, passos.length);
    focarOTitulo.current = comFocoNoTitulo;
    setVisitados((anteriores) => (anteriores.includes(destino) ? anteriores : [...anteriores, destino]));
    setAtual(destino);
  };

  const definir: AoDefinir = (caminho, valor) => {
    setValores((atuais) => setNestedField(atuais, caminho, valor));
  };
  const alterar: AoAlterar = definir;

  const concluir = () => {
    if (!situacao.podeConcluir) {
      setTentou(true);
      const caminho = primeiroCaminhoComErro(passos, erros);
      if (caminho) {
        irPara(Math.max(0, passoDoCaminho(passos, caminho)), false);
        setPedidoDeFoco((anterior) => ({ caminho, vez: (anterior?.vez ?? 0) + 1 }));
      }
      return;
    }
    onSalvar(valores);
  };

  // Enter num campo avança o passo, e só no último passo conclui.
  const handleSubmit = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    if (ver) return;
    if (atual < passos.length - 1) irPara(atual + 1);
    else concluir();
  };

  const cancelar = async () => {
    if (!ver && alterado) {
      const confirmacao = await Swal.fire({
        icon: "warning",
        title: "Descartar dados",
        text: "Os dados preenchidos não serão salvos, pois este formulário não guarda rascunho.",
        showCancelButton: true,
        confirmButtonColor: COR_EXCLUIR,
        cancelButtonColor: COR_CANCELAR,
        confirmButtonText: "Descartar",
        cancelButtonText: "Continuar preenchendo",
      });
      if (!confirmacao.isConfirmed) return;
    }
    onCancelar();
  };

  const controle: ControleDoFormulario<F> = { valores, erros: errosVisiveis, alterar, definir, idDoCampo };
  const passo = passos[atual];
  const textoDeApoio = textoDoBloqueio(passos, erros);

  const corpo =
    ver && leituraDoPasso ? (
      <LeituraDoPasso secoes={leituraDoPasso(passo.secoes)} mostrarTitulos={passo.secoes.length > 1} />
    ) : (
      passo.secoes.map((secao) => (
        <section key={secao.titulo} className="space-y-5">
          {passo.secoes.length > 1 && (
            <h3 className="text-base font-semibold text-gray-900">{secao.titulo}</h3>
          )}
          {cabecalhoDaSecao?.(secao, controle)}
          {secao.grupos.map((grupo, indice) => (
            <GrupoDaTabela key={indice} grupo={grupo} controle={controle} />
          ))}
        </section>
      ))
    );

  return (
    <form onSubmit={handleSubmit} noValidate className="lg:h-full">
      <AssistenteDePassos
        titulo={titulo}
        estudante={estudante}
        resumo={resumo}
        acoesDoDocumento={acoesDoDocumento}
        ladoDoTitulo={ladoDoTitulo}
        aviso={aviso}
        passos={passos}
        atual={atual}
        comPendencia={situacao.comPendencia.map((pendente, indice) => pendente && aparece(indice))}
        visitados={passos.map((_, indice) => visitados.includes(indice))}
        onIrPara={irPara}
        tituloDoPasso={tituloDoPasso(passo)}
        tituloRef={tituloRef}
        acoes={{
          modo,
          temAnterior: atual > 0,
          temProximo: atual < passos.length - 1,
          onVoltar: () => irPara(atual - 1),
          onProximo: () => irPara(atual + 1),
          onCancelar: cancelar,
          onConcluir: concluir,
          onEditar,
          concluirBloqueado: !situacao.podeConcluir,
          textoDeApoio,
          idDoApoio: `${prefixoDosIds}-apoio`,
          salvando,
        }}
      >
        {corpo}
      </AssistenteDePassos>
    </form>
  );
}
