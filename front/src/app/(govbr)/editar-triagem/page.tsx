/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import dynamic from "next/dynamic";
import "@govbr-ds/core/dist/core.min.css";
import AppLayout from "@/components/AppLayout";
import Loading from "@/components/Loading";
import { Suspense, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ESTUDANTE } from "@/consts";
import { canAccessPage } from "@/utils/pageAccess";
import { ScreeningData } from "@/interfaces/ScreeningData";
import { getScreeningByEmail, patchScreening } from "@/api/screenings"; // Importe o postScreening
import { pickFields, SCREENING_EDIT_FIELDS } from "@/utils/editPayload";
import { useRouter } from "next/navigation";
import { useEstudanteDaUrl } from "@/hooks/useEstudanteDaUrl";
import { rotaDoEstudante } from "@/utils/estudanteDaUrl";
import { setNestedField, toggleNestedField } from "@/utils/nestedField";

const BrInput = dynamic(() =>
  import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrInput), { ssr: false }
);
const BrCheckbox = dynamic(() =>
  import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrCheckbox), { ssr: false }
);

// Estado inicial para um novo formulário de triagem
const initialScreeningState: ScreeningData = {
  full_name: '',
  email: '',
  report: '',
  specific_need: {
    deficiencia_fisica: false,
    deficiencia_auditiva: false,
    baixa_visao: false,
    cegueira: false,
    surdocegueira: false,
    transtornos_globais_de_desenvolvimento: false,
    superdotacao: false,
    disturbio_de_aprendizagem: false,
    outros: '',
  },
  special_service: false,
  physical_disability: {
    necessita_de_transcritor: false,
    acesso_para_cadeirante: false,
    outros: '',
  },
  visual_impairment: {
    necessita_de_braille: false,
    material_com_fonte_aumentada: false,
    necessita_de_transcritor: false,
    outros: '',
  },
  hearing_impairment: {
    necessita_de_interprete_de_lingua_de_sinais: false,
    necessita_de_interprete_oralizador: false,
    outros: '',
  },
  global_disorder: {
    necessita_de_ledor: false,
    necessita_de_transcritor: false,
    outros: '',
  },
  other_disabilities: '',
};

export default function TriagemPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <TriagemPage />
    </Suspense>
  );
}

function TriagemPage() {
  const { id, email, nome, carregando } = useEstudanteDaUrl();

  const { user, loading } = useAuth();
  const router = useRouter();

  const [screening, setScreening] = useState<ScreeningData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Estado para o formulário de criação
  const [formData, setFormData] = useState<ScreeningData>(initialScreeningState);

  useEffect(() => {
    if (loading) return;

    async function fetchData() {
      setIsLoading(true);
      try {
        const token = user;
        if (!token) {
          router.push('/login');
          return;
        }

        const isStudent = token.id_level === ESTUDANTE;

        if (!canAccessPage("/editar-triagem", token.id_level)) {
          router.push(rotaDoEstudante('/triagem', id));
          return;
        }

        const target = isStudent ? token.email : email;
        
        if (target) {
          const data = await getScreeningByEmail(target);
          setScreening(data);
          setFormData(data);
        }
      } catch (error) {
        console.error("Triagem não encontrada, iniciando modo de criação.", error);
        setScreening(null); // Garante que o modo de criação seja ativado em caso de erro 404
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [email, id, router, user, loading]);

  // Manipulador para inputs de texto (BrInput)
  const handleInputChange = (name: string, value: string) => {
    setFormData(prevData => setNestedField(prevData, name, value));
  };

  // Manipulador para o CLIQUE no checkbox que inverte o valor no estado
  const handleCheckboxClick = (name: string) => {
    setFormData(prevData => toggleNestedField(prevData, name));
  };

  const handleEdit = async () => {
        if (!email) {
            alert("Email do estudante não encontrado para editar Triagem.");
            return;
        }
    
        try {
            const dadosAtualizados = pickFields(formData, SCREENING_EDIT_FIELDS);
            await patchScreening(dadosAtualizados, email);
            alert("Triagem atualizada com sucesso!");
            router.push(rotaDoEstudante('/estudantes/visualizar', id));
        } catch (error) {
            console.error("Erro ao atualizar Triagem: ", error);
            alert("Falha ao atualizar Triagem. Verifique o console para mais detalhes.");
        }
        };


  if (loading || isLoading || carregando) {
    return <Loading />;
  }

  if (screening === null) {
    return (
      <AppLayout
      >
        <div className="p-6 text-center">
                <h2 className="text-xl font-bold text-green-700">O estudante ainda não possui uma Triagem cadastrada</h2>
                <button className="mt-6 bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-full" onClick={() => router.push(rotaDoEstudante('/estudantes/visualizar', id))}>
                  Voltar
                </button>
        </div>
      </AppLayout>
    );
  }


    return (
      <AppLayout
      >
        <div className="p-6 space-y-8 w-full">
          <h1 className="text-2xl font-bold text-green-800">Criar Nova Triagem</h1>

          <div className="grid md:grid-cols-4 gap-4">
            <BrInput label="Nome completo" class="w-full" value={nome || ''} />
            <BrInput label="E-mail" class="w-full" value={email || ''}  />
            <BrInput label="Relatório médico" class="w-full" value={formData.report} onInput={(e: any) => handleInputChange('report', e.target.value)} />
          </div>

          <section className="border-t pt-4">
            <h2>Necessidade Específica</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <BrCheckbox name="" label="Deficiência Física" checked={formData.specific_need.deficiencia_fisica} onClick={() => handleCheckboxClick('specific_need.deficiencia_fisica')} />
              <BrCheckbox name="" label="Deficiência Auditiva/Surdez" checked={formData.specific_need.deficiencia_auditiva} onClick={() => handleCheckboxClick('specific_need.deficiencia_auditiva')} />
              <BrCheckbox name="" label="Baixa Visão" checked={formData.specific_need.baixa_visao} onClick={() => handleCheckboxClick('specific_need.baixa_visao')} />
              <BrCheckbox name="" label="Surdocegueira" checked={formData.specific_need.surdocegueira} onClick={() => handleCheckboxClick('specific_need.surdocegueira')} />
              <BrCheckbox name="" label="Cegueira" checked={formData.specific_need.cegueira} onClick={() => handleCheckboxClick('specific_need.cegueira')} />
              <BrCheckbox name="" label="Altas habilidades/superdotação" checked={formData.specific_need.superdotacao} onClick={() => handleCheckboxClick('specific_need.superdotacao')} />
              <BrCheckbox name="" label="Transtornos globais do desenvolvimento" checked={formData.specific_need.transtornos_globais_de_desenvolvimento} onClick={() => handleCheckboxClick('specific_need.transtornos_globais_de_desenvolvimento')} />
              <BrCheckbox name="" label="Distúrbios de aprendizagem" checked={formData.specific_need.disturbio_de_aprendizagem} onClick={() => handleCheckboxClick('specific_need.disturbio_de_aprendizagem')} />
              <BrInput label="Outro" class="w-full" value={formData.specific_need.outros} onInput={(e: any) => handleInputChange('specific_need.outros', e.target.value)} />
            </div>
          </section>

          <section className="border-t pt-4">
            <h2>Deficiência Física</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <BrCheckbox name="" label="Necessita de transcritor" checked={formData.physical_disability.necessita_de_transcritor} onClick={() => handleCheckboxClick('physical_disability.necessita_de_transcritor')} />
              <BrCheckbox name="" label="Necessita de acesso para cadeirante" checked={formData.physical_disability.acesso_para_cadeirante} onClick={() => handleCheckboxClick('physical_disability.acesso_para_cadeirante')} />
              <BrInput label="Outro" class="w-full" value={formData.physical_disability.outros} onInput={(e: any) => handleInputChange('physical_disability.outros', e.target.value)} />
            </div>
          </section>

          <section className="border-t pt-4">
            <h2>Deficiência Visual</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <BrCheckbox name="" label="Necessita de material didático em Braille" checked={formData.visual_impairment.necessita_de_braille} onClick={() => handleCheckboxClick('visual_impairment.necessita_de_braille')} />
              <BrCheckbox name="" label="Material com fonte aumentada" checked={formData.visual_impairment.material_com_fonte_aumentada} onClick={() => handleCheckboxClick('visual_impairment.material_com_fonte_aumentada')} />
              <BrCheckbox name="" label="Necessita de transcritor" checked={formData.visual_impairment.necessita_de_transcritor} onClick={() => handleCheckboxClick('visual_impairment.necessita_de_transcritor')} />
              <BrInput label="Outro" class="w-full" value={formData.visual_impairment.outros} onInput={(e: any) => handleInputChange('visual_impairment.outros', e.target.value)} />
            </div>
          </section>

          <section className="border-t pt-4">
            <h2>Deficiência Auditiva</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <BrCheckbox name="" label="Necessita de intérprete de língua de sinais" checked={formData.hearing_impairment.necessita_de_interprete_de_lingua_de_sinais} onClick={() => handleCheckboxClick('hearing_impairment.necessita_de_interprete_de_lingua_de_sinais')} />
              <BrCheckbox name="" label="Necessita de intérprete oralizador" checked={formData.hearing_impairment.necessita_de_interprete_oralizador} onClick={() => handleCheckboxClick('hearing_impairment.necessita_de_interprete_oralizador')} />
              <BrInput label="Outro" class="w-full" value={formData.hearing_impairment.outros} onInput={(e: any) => handleInputChange('hearing_impairment.outros', e.target.value)} />
            </div>
          </section>

          <section className="border-t pt-4">
            <h2>Transtornos Globais / Altas Habilidades</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <BrCheckbox name="" label="Necessita de ledor" checked={formData.global_disorder.necessita_de_ledor} onClick={() => handleCheckboxClick('global_disorder.necessita_de_ledor')} />
              <BrCheckbox name="" label="Necessita de transcritor" checked={formData.global_disorder.necessita_de_transcritor} onClick={() => handleCheckboxClick('global_disorder.necessita_de_transcritor')} />
              <BrInput label="Outro" class="w-full" value={formData.global_disorder.outros} onInput={(e: any) => handleInputChange('global_disorder.outros', e.target.value)} />
            </div>
          </section>

          <section className="border-t pt-4">
            <h2>Outros casos de deficiência</h2>
            <BrInput label="Descrição" class="w-full" value={formData.other_disabilities} onInput={(e: any) => handleInputChange('other_disabilities', e.target.value)} />
          </section>

          <div className="flex justify-center gap-4 mt-8">
            <button className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-full" onClick={() => router.push(rotaDoEstudante('/triagem', id))}>
              Cancelar
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-full" onClick={handleEdit}>
              Salvar Alterações
            </button>
          </div>
        </div>
      </AppLayout>
    );
}
