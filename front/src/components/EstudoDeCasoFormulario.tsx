"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Swal from "sweetalert2";
import type { CaseStudyPayload } from "@/interfaces/CaseStudy";
import {
  NAO_INFORMADO,
  SECOES,
  TITULO_IDENTIFICACAO,
  lerCaminho,
  montarCorpo,
  validarFormulario,
  type CampoDef,
  type ErrosDoFormulario,
  type EstudoDeCasoForm,
  type GrupoDef,
} from "@/utils/estudoDeCaso";
import { setNestedField } from "@/utils/nestedField";
import CheckboxField from "./form/CheckboxField";
import { FormFieldset, FormSection } from "./form/FormSection";
import { DateField, NumberField, TextField } from "./form/InputField";
import TextAreaField from "./form/TextAreaField";

const COR_CONFIRMAR = "#047857";
const COR_CANCELAR = "#6b7280";
const IDADE_MINIMA = 0;

type AoAlterar = (caminho: string, valor: string | boolean) => void;

interface FormularioProps {
  inicial: EstudoDeCasoForm;
  // undefined é o curso que a tela não conhece; null é o cadastro sem curso.
  curso?: string | null;
  autor: string | null;
  salvando: boolean;
  onSalvar: (corpo: CaseStudyPayload) => void;
  onCancelar: () => void;
}

function idDoCampo(caminho: string): string {
  return `estudo-de-caso-${caminho.replaceAll(".", "-")}`;
}

interface CampoDoEstudoProps {
  campo: CampoDef;
  valor: unknown;
  erro?: string;
  onChange: AoAlterar;
  rotuloOculto?: boolean;
}

function CampoDoEstudo({ campo, valor, erro, onChange, rotuloOculto }: CampoDoEstudoProps) {
  const id = idDoCampo(campo.caminho);
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
          min={IDADE_MINIMA}
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

interface GrupoDoEstudoProps {
  grupo: GrupoDef;
  tituloDaSecao: string;
  valores: EstudoDeCasoForm;
  erros: ErrosDoFormulario;
  onChange: AoAlterar;
}

function GrupoDoEstudo({ grupo, tituloDaSecao, valores, erros, onChange }: GrupoDoEstudoProps) {
  const renderizar = (campo: CampoDef) => (
    <CampoDoEstudo
      key={campo.caminho}
      campo={campo}
      valor={lerCaminho(valores, campo.caminho)}
      erro={erros[campo.caminho]}
      onChange={onChange}
      rotuloOculto={campo.rotulo === tituloDaSecao}
    />
  );

  if (grupo.lista) {
    return (
      <FormFieldset legenda={grupo.titulo}>
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

function DadosDoCadastro({ curso, autor }: { curso?: string | null; autor: string | null }) {
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
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

export default function EstudoDeCasoFormulario({
  inicial,
  curso,
  autor,
  salvando,
  onSalvar,
  onCancelar,
}: FormularioProps) {
  const [valores, setValores] = useState<EstudoDeCasoForm>(inicial);
  const [erros, setErros] = useState<ErrosDoFormulario>({});
  const [tentativasInvalidas, setTentativasInvalidas] = useState(0);
  const primeiroComErro = useRef<string | null>(null);

  // O foco vai para o primeiro campo inválido depois que o erro foi desenhado,
  // para o leitor de tela ler a mensagem ligada ao campo.
  useEffect(() => {
    if (primeiroComErro.current) {
      document.getElementById(idDoCampo(primeiroComErro.current))?.focus();
    }
  }, [tentativasInvalidas]);

  const alterar: AoAlterar = (caminho, valor) => {
    setValores((atuais) => setNestedField(atuais, caminho, valor));
    setErros((atuais) => semErro(atuais, caminho));
  };

  const handleSubmit = (evento: FormEvent<HTMLFormElement>) => {
    evento.preventDefault();

    const encontrados = validarFormulario(valores);
    setErros(encontrados);

    const [primeiro] = Object.keys(encontrados);
    if (primeiro) {
      primeiroComErro.current = primeiro;
      setTentativasInvalidas((atual) => atual + 1);
      return;
    }

    onSalvar(montarCorpo(valores));
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

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      {SECOES.map((secao) => (
        <FormSection key={secao.titulo} titulo={secao.titulo}>
          {secao.titulo === TITULO_IDENTIFICACAO && <DadosDoCadastro curso={curso} autor={autor} />}
          {secao.grupos.map((grupo, indice) => (
            <GrupoDoEstudo
              key={indice}
              grupo={grupo}
              tituloDaSecao={secao.titulo}
              valores={valores}
              erros={erros}
              onChange={alterar}
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
            {salvando ? "Salvando..." : "Salvar estudo de caso"}
          </button>
        </div>
      </div>
    </form>
  );
}
