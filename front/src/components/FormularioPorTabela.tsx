"use client";

import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import Swal from "sweetalert2";
import {
  NAO_INFORMADO,
  lerCaminho,
  type CampoDef,
  type ErrosDoFormulario,
  type GrupoDef,
  type SecaoDef,
} from "@/utils/formularioPorTabela";
import { setNestedField } from "@/utils/nestedField";
import CheckboxField from "./form/CheckboxField";
import { COR_CANCELAR, COR_CONFIRMAR } from "./form/botoes";
import { FormFieldset, FormSection } from "./form/FormSection";
import { DateField, NumberField, TextField } from "./form/InputField";
import TextAreaField from "./form/TextAreaField";

const VALOR_MINIMO = 0;

export type AoAlterar = (caminho: string, valor: string | boolean) => void;

// O que o cabeçalho de uma seção precisa para ler e alterar o formulário.
export interface ControleDoFormulario<F> {
  valores: F;
  erros: ErrosDoFormulario;
  alterar: AoAlterar;
  idDoCampo: (caminho: string) => string;
}

interface FormularioPorTabelaProps<F extends object> {
  secoes: readonly SecaoDef[];
  // Prefixo dos ids dos campos, para o rótulo e o foco de erro acharem o campo.
  prefixoDosIds: string;
  inicial: F;
  validar: (form: F) => ErrosDoFormulario;
  rotuloSalvar: string;
  salvando: boolean;
  onSalvar: (form: F) => void;
  onCancelar: () => void;
  // Conteúdo que abre uma seção, antes dos campos da tabela: o que o documento
  // mostra do cadastro e os campos que não estão na tabela.
  cabecalhoDaSecao?: (secao: SecaoDef, controle: ControleDoFormulario<F>) => ReactNode;
}

function idDoCampoCom(prefixo: string, caminho: string): string {
  return `${prefixo}-${caminho.replaceAll(".", "-")}`;
}

interface CampoDaTabelaProps {
  campo: CampoDef;
  id: string;
  valor: unknown;
  erro?: string;
  onChange: AoAlterar;
  rotuloOculto?: boolean;
}

function CampoDaTabela({ campo, id, valor, erro, onChange, rotuloOculto }: CampoDaTabelaProps) {
  const texto = typeof valor === "string" ? valor : "";
  const alterar = (novo: string) => onChange(campo.caminho, novo);

  switch (campo.tipo) {
    case "marcacao":
      return (
        <CheckboxField
          id={id}
          rotulo={campo.rotulo}
          marcado={valor === true}
          onChange={(marcado) => onChange(campo.caminho, marcado)}
        />
      );
    case "textoLongo":
      return (
        <TextAreaField
          id={id}
          rotulo={campo.rotulo}
          rotuloOculto={rotuloOculto}
          valor={texto}
          tamanhoMaximo={campo.max}
          erro={erro}
          onChange={alterar}
        />
      );
    case "texto":
      return (
        <TextField
          id={id}
          rotulo={campo.rotulo}
          valor={texto}
          tamanhoMaximo={campo.max}
          ajuda={`Até ${campo.max} caracteres.`}
          erro={erro}
          onChange={alterar}
        />
      );
    case "numero":
      return (
        <NumberField
          id={id}
          rotulo={campo.rotulo}
          valor={texto}
          min={VALOR_MINIMO}
          max={campo.max}
          erro={erro}
          onChange={alterar}
        />
      );
    case "data":
      return (
        <DateField id={id} rotulo={campo.rotulo} valor={texto} erro={erro} onChange={alterar} />
      );
  }
}

interface GrupoDaTabelaProps<F> {
  grupo: GrupoDef;
  tituloDaSecao: string;
  controle: ControleDoFormulario<F>;
}

function GrupoDaTabela<F>({ grupo, tituloDaSecao, controle }: GrupoDaTabelaProps<F>) {
  const { valores, erros, alterar, idDoCampo } = controle;
  const renderizar = (campo: CampoDef) => (
    <CampoDaTabela
      key={campo.caminho}
      campo={campo}
      id={idDoCampo(campo.caminho)}
      valor={lerCaminho(valores, campo.caminho)}
      erro={erros[campo.caminho]}
      onChange={alterar}
      rotuloOculto={campo.rotulo === tituloDaSecao}
    />
  );

  if (grupo.lista) {
    return (
      <FormFieldset legenda={grupo.titulo} legendaOculta={grupo.titulo === tituloDaSecao}>
        <div className="grid gap-2 sm:grid-cols-2">
          {grupo.campos.filter((campo) => campo.tipo === "marcacao").map(renderizar)}
        </div>
        {grupo.campos.filter((campo) => campo.tipo !== "marcacao").map(renderizar)}
      </FormFieldset>
    );
  }

  const curtos = grupo.campos.every((campo) => campo.tipo !== "textoLongo" && campo.tipo !== "marcacao");
  const campos = (
    <div className={curtos ? "grid gap-4 sm:grid-cols-3" : "space-y-5"}>
      {grupo.campos.map(renderizar)}
    </div>
  );

  return grupo.titulo ? <FormFieldset legenda={grupo.titulo}>{campos}</FormFieldset> : campos;
}

interface DadosDoCadastroProps {
  // undefined é o curso que a tela não conhece; null é o cadastro sem curso.
  curso?: string | null;
  autor: string | null;
  // Período letivo que o documento já tem e não muda; some quando o período
  // ainda vai ser escolhido.
  periodo?: string;
}

// O que o documento herda do cadastro e da sessão, e o usuário não digita.
export function DadosDoCadastro({ curso, autor, periodo }: DadosDoCadastroProps) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
      {periodo !== undefined && (
        <div>
          <dt className="text-gray-600">Período letivo (não pode ser alterado)</dt>
          <dd className="font-medium text-gray-900">{periodo}</dd>
        </div>
      )}
      {curso !== undefined && (
        <div>
          <dt className="text-gray-600">Curso (do cadastro do estudante)</dt>
          <dd className="font-medium text-gray-900">{curso?.trim() || NAO_INFORMADO}</dd>
        </div>
      )}
      <div>
        <dt className="text-gray-600">Professor(a) do AEE (autor)</dt>
        <dd className="font-medium text-gray-900">{autor?.trim() || NAO_INFORMADO}</dd>
      </div>
    </dl>
  );
}

function semErro(erros: ErrosDoFormulario, caminho: string): ErrosDoFormulario {
  return Object.fromEntries(Object.entries(erros).filter(([chave]) => chave !== caminho));
}

export default function FormularioPorTabela<F extends object>({
  secoes,
  prefixoDosIds,
  inicial,
  validar,
  rotuloSalvar,
  salvando,
  onSalvar,
  onCancelar,
  cabecalhoDaSecao,
}: FormularioPorTabelaProps<F>) {
  const [valores, setValores] = useState<F>(inicial);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [tentativasInvalidas, setTentativasInvalidas] = useState(0);
  const primeiroComErro = useRef<string | null>(null);

  const idDoCampo = (caminho: string) => idDoCampoCom(prefixoDosIds, caminho);

  // O foco vai para o primeiro campo inválido depois que o erro foi desenhado,
  // para o leitor de tela ler a mensagem ligada ao campo.
  useEffect(() => {
    if (primeiroComErro.current) {
      document.getElementById(idDoCampoCom(prefixoDosIds, primeiroComErro.current))?.focus();
    }
  }, [tentativasInvalidas, prefixoDosIds]);

  const alterar: AoAlterar = (caminho, valor) => {
    setValores((atuais) => setNestedField(atuais, caminho, valor));
    setErros((atuais) => semErro(atuais, caminho));
  };

  const handleSubmit = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const encontrados = validar(valores);
    setErros(encontrados);

    const [primeiro] = Object.keys(encontrados);
    if (primeiro) {
      primeiroComErro.current = primeiro;
      setTentativasInvalidas((atual) => atual + 1);
      return;
    }

    onSalvar(valores);
  };

  const handleCancelar = async () => {
    if (JSON.stringify(valores) !== JSON.stringify(inicial)) {
      const confirmacao = await Swal.fire({
        icon: "warning",
        title: "Descartar alterações",
        text: "As alterações que você não salvou serão perdidas.",
        showCancelButton: true,
        confirmButtonColor: COR_CONFIRMAR,
        cancelButtonColor: COR_CANCELAR,
        confirmButtonText: "Descartar",
        cancelButtonText: "Continuar editando",
      });
      if (!confirmacao.isConfirmed) return;
    }
    onCancelar();
  };

  const quantidadeDeErros = Object.keys(erros).length;
  const controle: ControleDoFormulario<F> = { valores, erros, alterar, idDoCampo };

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {secoes.map((secao) => (
        <FormSection key={secao.titulo} titulo={secao.titulo}>
          {cabecalhoDaSecao?.(secao, controle)}
          {secao.grupos.map((grupo, indice) => (
            <GrupoDaTabela
              key={indice}
              grupo={grupo}
              tituloDaSecao={secao.titulo}
              controle={controle}
            />
          ))}
        </FormSection>
      ))}

      <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white py-3">
        <p role="alert" className="text-sm text-red-700">
          {quantidadeDeErros > 0 &&
            `Há ${quantidadeDeErros} ${quantidadeDeErros === 1 ? "campo com erro" : "campos com erro"}. Corrija para salvar.`}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border px-4 py-2 text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-50"
            onClick={handleCancelar}
            disabled={salvando}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="rounded-full bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={salvando}
          >
            {salvando ? "Salvando..." : rotuloSalvar}
          </button>
        </div>
      </div>
    </form>
  );
}
