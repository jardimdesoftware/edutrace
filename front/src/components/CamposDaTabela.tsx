"use client";

import {
  NAO_INFORMADO,
  lerCaminho,
  type CampoDef,
  type ErrosDoFormulario,
  type GrupoDef,
} from "@/utils/formularioPorTabela";
import CheckboxField from "./form/CheckboxField";
import { FormFieldset } from "./form/FormSection";
import { DateField, NumberField, TextField } from "./form/InputField";
import TextAreaField from "./form/TextAreaField";

const VALOR_MINIMO = 0;
// O texto longo ocupa a largura toda do passo; com menos linhas, um passo com
// vários textos cabe na altura da tela.
const LINHAS_DO_TEXTO_LONGO = 3;
const LARGURA_TODA = "sm:col-span-2 lg:col-span-3";
// O campo curto já impede passar do limite; o aviso só aparece quando o texto
// chega perto dele, para não gastar uma linha de altura em cada campo.
const FRACAO_DO_AVISO = 0.8;

function pertoDoLimite(valor: string, max: number): boolean {
  return valor.length >= max * FRACAO_DO_AVISO;
}

export type AoAlterar = (caminho: string, valor: string | boolean) => void;
// Troca o valor de um caminho por qualquer valor, como a lista inteira de um
// campo que o usuário aumenta e diminui.
export type AoDefinir = (caminho: string, valor: unknown) => void;

// O que o cabeçalho de uma seção precisa para ler e alterar o formulário.
export interface ControleDoFormulario<F> {
  valores: F;
  erros: ErrosDoFormulario;
  alterar: AoAlterar;
  definir: AoDefinir;
  idDoCampo: (caminho: string) => string;
}

export function idDoCampoCom(prefixo: string, caminho: string): string {
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
          obrigatorio={campo.obrigatorio}
          valor={texto}
          tamanhoMaximo={campo.max}
          linhas={LINHAS_DO_TEXTO_LONGO}
          erro={erro}
          onChange={alterar}
        />
      );
    case "texto":
      return (
        <TextField
          id={id}
          rotulo={campo.rotulo}
          obrigatorio={campo.obrigatorio}
          valor={texto}
          tamanhoMaximo={campo.max}
          ajuda={pertoDoLimite(texto, campo.max) ? `${texto.length} de ${campo.max} caracteres.` : undefined}
          erro={erro}
          onChange={alterar}
        />
      );
    case "numero":
      return (
        <NumberField
          id={id}
          rotulo={campo.rotulo}
          obrigatorio={campo.obrigatorio}
          valor={texto}
          min={VALOR_MINIMO}
          max={campo.max}
          erro={erro}
          onChange={alterar}
        />
      );
    case "data":
      return (
        <DateField
          id={id}
          rotulo={campo.rotulo}
          obrigatorio={campo.obrigatorio}
          valor={texto}
          erro={erro}
          onChange={alterar}
        />
      );
  }
}

interface GrupoDaTabelaProps<F> {
  grupo: GrupoDef;
  tituloDaSecao: string;
  controle: ControleDoFormulario<F>;
}

export function GrupoDaTabela<F>({ grupo, tituloDaSecao, controle }: GrupoDaTabelaProps<F>) {
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
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {grupo.campos.filter((campo) => campo.tipo === "marcacao").map(renderizar)}
        </div>
        {grupo.campos.filter((campo) => campo.tipo !== "marcacao").map(renderizar)}
      </FormFieldset>
    );
  }

  const campos = (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {grupo.campos.map((campo) => (
        <div key={campo.caminho} className={campo.tipo === "textoLongo" ? LARGURA_TODA : undefined}>
          {renderizar(campo)}
        </div>
      ))}
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
