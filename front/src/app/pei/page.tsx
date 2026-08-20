/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import dynamic from "next/dynamic";
import "@govbr-ds/core/dist/core.min.css";
import AppLayout from "@/components/AppLayout";
import Loading from "@/components/Loading";
import { Suspense, useEffect, useState } from "react";
import { PlansEducationData } from "@/interfaces/PlansEducationData";
import { useAuth } from "@/contexts/AuthContext";

import { decodeToken } from "@/services/auth/decodeToken";
import { getPEIByEmail, postPEI, deletePEI } from "@/api/plans-education";
import { ESTUDANTE, PROFISSIONAL_SAUDE } from "@/consts";
import { useRouter, useSearchParams } from "next/navigation";

const BrInput = dynamic(() =>
  import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrInput), { ssr: false }
);

const BrCheckbox = dynamic(() =>
  import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrCheckbox), { ssr: false }
);

// Estado inicial para um novo formulário de PEI, correspondendo ao payload
const initialPEIState: PlansEducationData = {
  professor_email: '',
  professor_name: '',
  student_email: '',
  student_name: '',
  academic_semester: { primeiro_semestre: false, segundo_semestre: false },
  service_modality: { turma_regular: false, atendimento_pedagogico_domiciliar: false, atendimento_pedagogico_hospitalar: false },
  support_service: { agente_educacao_especial_neuropsicopedagoro: false, interprete: false, instrutor: false, voluntario: false, outro: '' },
  skills: { atencao_em_sala_de_aula: false, interesse_ambiente_escolar: false, concentracao_atividades: false, memoria_auditiva_visual_sequencial: false, raciocinio_logico_matematico: false, sequencia_logica_fatos: false, interesse_por_objetos: false, exploracao_adequada_objetos: false, comparacao_associacao_classificacao: false, abstracao_conduta_simbolica: false, discriminacao_visual_auditiva_tatil: false, organizacao: false, nocao_autopreservacao_higiene: false, estrategias_aprendizado: false, planejamento_acoes: false, correcoes: false, julgamento_situacoes: false, relacionamento_social: false, autoestima_resistencia_frustracao: false, cooperacao_humor_agressividade: false, autoagressao: false, timidez_iniciativa_respeito: false, colaboracao_motivacao_isolamento: false, respeito_regras_rotina: false, iniciativa_social: false, comportamento_publico: false, permanencia_sala: false, foco_atividades: false, atencao_solicitacoes: false, compreensao_linguagem: false, comunicacao_nao_verbal: false, fala_inteligivel: false, adequacao_comunicacao: false, esforco_comunicacao: false, correspondencia_pensamento_fala: false, relato_experiencias: false, transmissao_recados: false, controle_salivacao: false, permanencia_sentado: false, locomocao: false, equilibrio_estatico_dinamico: false, dominancia_manual_esquema_corporal: false, discriminacao_direita_esquerda: false, coordenacao_motora_grossa_fina: false, coordenacao_grafomotora_visomotora: false, conceitos_basicos: false, agitacao_psicomotora: false, adequacao_postural: false, coordenacao_motora_equilibrio: false, alimentacao_independente: false },
  resource_equipment_used: { reduzir_quantidade_material_atividade: false, provas_orais_escrita_minima: false, mais_tempo_conclusao_trabalhos: false, avaliacao_multipla_escolha: false, orientacoes_diretas_instrucoes_claras: false, nao_avaliar_caligrafia_ortografia: false, concentrar_notas_originalidade_ideias: false, encorajar_pratica_escrita: false, outro: '' },
  resource_equipment_needs: { acompanhante_sala_aula: false, adaptacao_metodologia_professor: false, compreensao_companheirismo_turma: false, outro: '' },
  curriculum_accessibility: { leitura_sem_entonacao: false, pronuncia_trocas_omissoes: false, confusao_palavras_parecidas: false, escrita_incorreta_ordem_letras: false, tempo_maior_trabalhos_escritos: false, disfuncao_linguagem_comunicacao: false, outro: '' },
  school_content: '',
  activities_to_be_developed: { comunicacao_alternativa: false, informatica_acessivel: false, adequacao_material: false, outro: '' },
  objectives: '',
  work_methodology: { aulas_praticas: false, aulas_expositivas_midia: false, dialogos: false, visitas_tecnicas: false, atividades_grupo: false, atividades_corte_colagem: false },
  materials_used: { data_show: false, celular: false, cartolinas_pinceis: false, apostilas: false, artigos: false, tablet: false, outro: '' },
  evaluation_criteria: { participacao_coletiva: false, observacao_interacoes: false, atividades_paralelas: false, participacao_individual: false, uso_ferramentas_tecnologicas: false, fotos_videos_relatos: false, outro: '' },
};

export default function PEIPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <PEIPage />
    </Suspense>
  );
}

function PEIPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  const nome = searchParams.get("nome");

  const [pei, setPei] = useState<PlansEducationData | null>(null);
  const { user, loading } = useAuth();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [userIsReadOnly, setUserIsReadOnly] = useState(true);

  const [formData, setFormData] = useState<PlansEducationData>(initialPEIState);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const token = decodeToken();
        if (!token) {
          router.push('/login');
          return;
        }

        const isStudent = token.id_level === ESTUDANTE;
        const isReadOnly = isStudent || token.id_level === PROFISSIONAL_SAUDE;
        setUserIsReadOnly(isReadOnly);

        const target = isStudent ? token.email : email;
        if (target) {
          const data = await getPEIByEmail(target);
          setPei(data);
        } 
      } catch (error) {
        console.error("PEI não encontrado, iniciando modo de criação.", error);
        setPei(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, [email, router]);


  const handleInputChange = (name: string, value: string) => {
    const keys = name.split('.');
    setFormData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return newData;
    });
  };

  const handleCheckboxClick = (name: string) => {
    const keys = name.split('.');
    setFormData(prevData => {
      const newData = JSON.parse(JSON.stringify(prevData));
      let current = newData;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      const finalKey = keys[keys.length - 1];
      current[finalKey] = !current[finalKey];
      return newData;
    });
  };

  const handleSubmit = async () => {
    if (!email || !user) {
      alert("Dados do estudante ou professor não encontrados para criar o PEI.");
      return;
    }
    try {
      const peiParaEnviar: PlansEducationData = {
        ...formData,
        student_email: email,
        student_name: nome || 'Nome não encontrado',
        professor_email: user.email,
        professor_name: user.name,
      };
      await postPEI(peiParaEnviar);
      alert("PEI criado com sucesso!");
      router.push(`/estudantes/visualizar?email=${email}&nome=${nome}`);
    } catch (error) {
      console.error("Erro ao criar PEI:", error);
      alert(`Falha ao criar o PEI. ${error}. Verifique suas permissões de acesso.`);
    }
  };

  const handleDelete = async () => {
    if (!email) {
      alert("Email do estudante não encontrado para deletar o PEI.");
      return;
    }

    const confirmDelete = window.confirm("Tem certeza que deseja deletar este PEI?");
    if (!confirmDelete) {
      return;
    }

    try {
      await deletePEI(email);
      alert("PEI deletado com sucesso!");
      router.push(`/estudantes/visualizar?email=${email}&nome=${nome}`);
    } catch (error) {
      console.error("Erro ao deletar PEI: ", error);
      alert("Falha ao deletar PEI. Verifique o console para mais detalhes.");
    }
  };

  if (loading || isLoading) {
    return <Loading />;
  }

  if (pei === null && !userIsReadOnly) {
    return (
      <AppLayout
      >
        <div className="p-6 space-y-8 w-full">
          <h1 className="text-3xl font-bold text-gray-800">PEI - Criar Plano de Ensino Individualizado</h1>

          {/* Informações do Professor e Estudante */}
          <section>
            <h2 className="text-xl font-semibold mb-4">Informações Gerais</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <BrInput label="Email do Professor" placeholder={"Este campo é preenchido automaticamente"} value={formData.professor_email} onInput={(e: any) => handleInputChange('professor_email', e.target.value)} disabled/>
              <BrInput label="Nome do Professor" placeholder={"Este campo é preenchido automaticamente"} value={formData.professor_name} onInput={(e: any) => handleInputChange('professor_name', e.target.value)} disabled/>
              <BrInput label="Email do Estudante" placeholder={"Este campo é preenchido automaticamente"} value={formData.student_email} onInput={(e: any) => handleInputChange('student_email', e.target.value)} disabled/>
              <BrInput label="Nome do Estudante" placeholder={"Este campo é preenchido automaticamente"} value={formData.student_name} onInput={(e: any) => handleInputChange('student_name', e.target.value)} disabled/>
            </div>
          </section>

          {/* Semestre Acadêmico */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Semestre Acadêmico</h2>
            <div className="flex flex-wrap gap-4">
              <BrCheckbox name="" label="Primeiro Semestre" checked={formData.academic_semester.primeiro_semestre} onClick={() => handleCheckboxClick('academic_semester.primeiro_semestre')} />
              <BrCheckbox name="" label="Segundo Semestre" checked={formData.academic_semester.segundo_semestre} onClick={() => handleCheckboxClick('academic_semester.segundo_semestre')} />
            </div>
          </section>

          {/* Modalidade de Serviço */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Modalidade de Serviço</h2>
            <div className="flex flex-wrap gap-4">
              <BrCheckbox name="" label="Turma Regular" checked={formData.service_modality.turma_regular} onClick={() => handleCheckboxClick('service_modality.turma_regular')} />
              <BrCheckbox name="" label="Atendimento Pedagógico Domiciliar" checked={formData.service_modality.atendimento_pedagogico_domiciliar} onClick={() => handleCheckboxClick('service_modality.atendimento_pedagogico_domiciliar')} />
              <BrCheckbox name="" label="Atendimento Pedagógico Hospitalar" checked={formData.service_modality.atendimento_pedagogico_hospitalar} onClick={() => handleCheckboxClick('service_modality.atendimento_pedagogico_hospitalar')} />
            </div>
          </section>

          {/* Serviço de Apoio */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Serviço de Apoio</h2>
            <div className="flex flex-wrap gap-4">
              {Object.keys(formData.support_service).map((key) =>
                key !== 'outro' ? (
                  <BrCheckbox name=""
                    key={key}
                    label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    checked={formData.support_service[key as keyof Omit<typeof formData.support_service, 'outro'>]}
                    onClick={() => handleCheckboxClick(`support_service.${key}`)}
                  />
                ) : null
              )}
              <BrInput label="Outro" value={formData.support_service.outro} onInput={(e: any) => handleInputChange('support_service.outro', e.target.value)} />
            </div>
          </section>

          {/* Habilidades e Potencialidades */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Habilidades e Potencialidades</h2>
            <div className="grid md:grid-cols-3 gap-3">
              {Object.keys(formData.skills).map((key) => (
                <BrCheckbox name=""
                  key={key}
                  label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  checked={formData.skills[key as keyof typeof formData.skills]}
                  onClick={() => handleCheckboxClick(`skills.${key}`)}
                />
              ))}
            </div>
          </section>

          {/* Recursos/Equipamentos já utilizados */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Recursos/Equipamentos já utilizados</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.keys(formData.resource_equipment_used).map((key) =>
                key !== 'outro' ? (
                  <BrCheckbox name=""
                    key={key}
                    label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    checked={formData.resource_equipment_used[key as keyof Omit<typeof formData.resource_equipment_used, 'outro'>]}
                    onClick={() => handleCheckboxClick(`resource_equipment_used.${key}`)}
                  />
                ) : null
              )}
              <BrInput label="Outro" value={formData.resource_equipment_used.outro} onInput={(e: any) => handleInputChange('resource_equipment_used.outro', e.target.value)} />
            </div>
          </section>

          {/* Recursos/Equipamentos a providenciar */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Recursos/Equipamentos a providenciar</h2>
            <div className="flex flex-wrap gap-4">
              {Object.keys(formData.resource_equipment_needs).map((key) =>
                key !== 'outro' ? (
                  <BrCheckbox name=""
                    key={key}
                    label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    checked={formData.resource_equipment_needs[key as keyof Omit<typeof formData.resource_equipment_needs, 'outro'>]}
                    onClick={() => handleCheckboxClick(`resource_equipment_needs.${key}`)}
                  />
                ) : null
              )}
              <BrInput label="Outro" value={formData.resource_equipment_needs.outro} onInput={(e: any) => handleInputChange('resource_equipment_needs.outro', e.target.value)} />
            </div>
          </section>

          {/* Acessibilidade Curricular */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Acessibilidade Curricular</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.keys(formData.curriculum_accessibility).map((key) =>
                key !== 'outro' ? (
                  <BrCheckbox name=""
                    key={key}
                    label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    checked={formData.curriculum_accessibility[key as keyof Omit<typeof formData.curriculum_accessibility, 'outro'>]}
                    onClick={() => handleCheckboxClick(`curriculum_accessibility.${key}`)}
                  />
                ) : null
              )}
              <BrInput label="Outro" value={formData.curriculum_accessibility.outro} onInput={(e: any) => handleInputChange('curriculum_accessibility.outro', e.target.value)} />
            </div>
          </section>

          {/* Conteúdo Escolar */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Conteúdo Escolar</h2>
            <BrInput label="Descreva o conteúdo escolar" value={formData.school_content} onInput={(e: any) => handleInputChange('school_content', e.target.value)} />
          </section>

          {/* Atividades a serem desenvolvidas */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Atividades a serem desenvolvidas</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.keys(formData.activities_to_be_developed).map((key) =>
                key !== 'outro' ? (
                  <BrCheckbox name=""
                    key={key}
                    label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    checked={formData.activities_to_be_developed[key as keyof Omit<typeof formData.activities_to_be_developed, 'outro'>]}
                    onClick={() => handleCheckboxClick(`activities_to_be_developed.${key}`)}
                  />
                ) : null
              )}
              <BrInput label="Outro" value={formData.activities_to_be_developed.outro} onInput={(e: any) => handleInputChange('activities_to_be_developed.outro', e.target.value)} />
            </div>
          </section>

          {/* Objetivos */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Objetivos</h2>
            <BrInput label="Descreva os objetivos" value={formData.objectives} onInput={(e: any) => handleInputChange('objectives', e.target.value)} />
          </section>

          {/* Metodologia de Trabalho */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Metodologia de Trabalho</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.keys(formData.work_methodology).map((key) => (
                <BrCheckbox name=""
                  key={key}
                  label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  checked={formData.work_methodology[key as keyof typeof formData.work_methodology]}
                  onClick={() => handleCheckboxClick(`work_methodology.${key}`)}
                />
              ))}
            </div>
          </section>

          {/* Materiais Utilizados */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Materiais Utilizados</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.keys(formData.materials_used).map((key) =>
                key !== 'outro' ? (
                  <BrCheckbox name=""
                    key={key}
                    label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    checked={formData.materials_used[key as keyof Omit<typeof formData.materials_used, 'outro'>]}
                    onClick={() => handleCheckboxClick(`materials_used.${key}`)}
                  />
                ) : null
              )}
              <BrInput label="Outro" value={formData.materials_used.outro} onInput={(e: any) => handleInputChange('materials_used.outro', e.target.value)} />
            </div>
          </section>

          {/* Critérios de Avaliação */}
          <section className="border-t pt-6 mt-6">
            <h2 className="text-xl font-semibold mb-4">Critérios de Avaliação</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {Object.keys(formData.evaluation_criteria).map((key) =>
                key !== 'outro' ? (
                  <BrCheckbox name=""
                    key={key}
                    label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    checked={formData.evaluation_criteria[key as keyof Omit<typeof formData.evaluation_criteria, 'outro'>]}
                    onClick={() => handleCheckboxClick(`evaluation_criteria.${key}`)}
                  />
                ) : null
              )}
              <BrInput label="Outro" value={formData.evaluation_criteria.outro} onInput={(e: any) => handleInputChange('evaluation_criteria.outro', e.target.value)} />
            </div>
          </section>

          <div className="flex justify-center gap-4 mt-8">
            <button className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-full" onClick={() => router.push(`/estudantes/visualizar?email=${email}&nome=${nome}`)}>
              Cancelar
            </button>
            <button className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-full" onClick={handleSubmit}>
              Salvar PEI
            </button>
          </div>
        </div>
      </AppLayout>
    );
    } else if ( pei && !userIsReadOnly ) {
      return (
        <AppLayout
        >
          <div className="p-6 space-y-8 w-full">
            <h1 className="text-3xl font-bold text-gray-800">PEI - Plano de Ensino Individualizado</h1>
            
            {/* Informações Gerais */}
            <section>
              <h2 className="text-xl font-semibold mb-4">Informações Gerais</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <BrInput label="Email do Professor" class="w-full" value={pei?.professor_email || ''} disabled />
                <BrInput label="Nome do Professor" class="w-full" value={pei?.professor_name || ''} disabled />
                <BrInput label="Email do Estudante" class="w-full" value={pei?.student_email || ''} disabled />
                <BrInput label="Nome do Estudante" class="w-full" value={pei?.student_name || ''} disabled />
              </div>
            </section>

            {/* Semestre Acadêmico */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Semestre Acadêmico</h2>
              <div className="flex flex-wrap gap-4">
                <BrCheckbox label="Primeiro Semestre" name="semestre" checked={pei?.academic_semester?.primeiro_semestre || false} disabled />
                <BrCheckbox label="Segundo Semestre" name="semestre" checked={pei?.academic_semester?.segundo_semestre || false} disabled />
              </div>
            </section>

            {/* Modalidade de Serviço */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Modalidade de Serviço</h2>
              <div className="flex flex-wrap gap-4">
                <BrCheckbox label="Turma Regular" name="modalidade" checked={pei?.service_modality?.turma_regular || false} disabled />
                <BrCheckbox label="Atendimento Pedagógico Domiciliar" name="modalidade" checked={pei?.service_modality?.atendimento_pedagogico_domiciliar || false} disabled />
                <BrCheckbox label="Atendimento Pedagógico Hospitalar" name="modalidade" checked={pei?.service_modality?.atendimento_pedagogico_hospitalar || false} disabled />
              </div>
            </section>

            {/* Serviço de Apoio */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Serviço de Apoio</h2>
              <div className="flex flex-wrap gap-4">
                {pei?.support_service && Object.entries(pei.support_service).map(([key, value]) =>
                  key !== 'outro' ? (
                    <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
                  ) : (
                    <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
                  )
                )}
              </div>
            </section>

            {/* Habilidades e Potencialidades */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Habilidades e Potencialidades</h2>
              <div className="grid md:grid-cols-3 gap-3">
                {pei?.skills && Object.entries(pei.skills).map(([key, value]) => (
                  <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={value} disabled />
                ))}
              </div>
            </section>

            {/* Recursos/Equipamentos já utilizados */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Recursos/Equipamentos já utilizados</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {pei?.resource_equipment_used && Object.entries(pei.resource_equipment_used).map(([key, value]) =>
                  key !== "outro" ? (
                    <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
                  ) : (
                    <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
                  )
                )}
              </div>
            </section>

            {/* Recursos/Equipamentos a providenciar */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Recursos/Equipamentos a providenciar</h2>
              <div className="flex flex-wrap gap-4">
                {pei?.resource_equipment_needs && Object.entries(pei.resource_equipment_needs).map(([key, value]) =>
                  key !== "outro" ? (
                    <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
                  ) : (
                    <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
                  )
                )}
              </div>
            </section>

            {/* Acessibilidade Curricular */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Acessibilidade Curricular</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {pei?.curriculum_accessibility && Object.entries(pei.curriculum_accessibility).map(([key, value]) =>
                  key !== "outro" ? (
                    <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
                  ) : (
                    <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
                  )
                )}
              </div>
            </section>

            {/* Conteúdo Escolar */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Conteúdo Escolar</h2>
              <BrInput label="Descrição" class="w-full" value={pei?.school_content || ""} disabled />
            </section>

            {/* Atividades a serem desenvolvidas */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Atividades a serem desenvolvidas</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {pei?.activities_to_be_developed && Object.entries(pei.activities_to_be_developed).map(([key, value]) =>
                  key !== "outro" ? (
                    <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
                  ) : (
                    <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
                  )
                )}
              </div>
            </section>

            {/* Objetivos */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Objetivos</h2>
              <BrInput label="Descrição" class="w-full" value={pei?.objectives || ""} disabled />
            </section>

            {/* Metodologia de Trabalho */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Metodologia de Trabalho</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {pei?.work_methodology && Object.entries(pei.work_methodology).map(([key, value]) => (
                  <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
                ))}
              </div>
            </section>

            {/* Materiais Utilizados */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Materiais Utilizados</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {pei?.materials_used && Object.entries(pei.materials_used).map(([key, value]) =>
                  key !== "outro" ? (
                    <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
                  ) : (
                    <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
                  )
                )}
              </div>
            </section>

            {/* Critérios de Avaliação */}
            <section className="border-t pt-6 mt-6">
              <h2 className="text-xl font-semibold mb-4">Critérios de Avaliação</h2>
              <div className="grid md:grid-cols-2 gap-3">
                {pei?.evaluation_criteria && Object.entries(pei.evaluation_criteria).map(([key, value]) =>
                  key !== "outro" ? (
                    <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
                  ) : (
                    <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
                  )
                )}
              </div>
            </section>

            <div className="flex justify-center gap-4 mt-8">
              <button className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-full" onClick={() => router.push(`/estudantes/visualizar?email=${email}&nome=${nome}`)}>
                Voltar
              </button>
              <button className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded-full" onClick={() => router.push(`/editar-pei?email=${email}&nome=${nome}`)}>
                Editar PEI
              </button>
              <button className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-full" onClick={handleDelete}>
                Deletar PEI
              </button>
            </div>
          </div>
        </AppLayout>
      );
    } else if (pei === null && userIsReadOnly) {
      return (
        <AppLayout
        >
          <div className="p-6 text-center">
                <h2 className="text-xl font-bold text-green-700">O estudante ainda não possui um PEI cadastrado</h2>
        </div>
        </AppLayout>
      )
    }

  // Se o PEI EXISTE, renderiza o formulário de VISUALIZAÇÃO (sem alterações)
   return (
    <AppLayout
    >
      <div className="p-6 space-y-8 w-full">
        <h1 className="text-3xl font-bold text-gray-800">PEI - Plano de Ensino Individualizado</h1>
        
        {/* Informações Gerais */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Informações Gerais</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <BrInput label="Email do Professor" class="w-full" value={pei?.professor_email || ''} disabled />
            <BrInput label="Nome do Professor" class="w-full" value={pei?.professor_name || ''} disabled />
            <BrInput label="Email do Estudante" class="w-full" value={pei?.student_email || ''} disabled />
            <BrInput label="Nome do Estudante" class="w-full" value={pei?.student_name || ''} disabled />
          </div>
        </section>

        {/* Semestre Acadêmico */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Semestre Acadêmico</h2>
          <div className="flex flex-wrap gap-4">
            <BrCheckbox label="Primeiro Semestre" name="semestre" checked={pei?.academic_semester?.primeiro_semestre || false} disabled />
            <BrCheckbox label="Segundo Semestre" name="semestre" checked={pei?.academic_semester?.segundo_semestre || false} disabled />
          </div>
        </section>

        {/* Modalidade de Serviço */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Modalidade de Serviço</h2>
          <div className="flex flex-wrap gap-4">
            <BrCheckbox label="Turma Regular" name="modalidade" checked={pei?.service_modality?.turma_regular || false} disabled />
            <BrCheckbox label="Atendimento Pedagógico Domiciliar" name="modalidade" checked={pei?.service_modality?.atendimento_pedagogico_domiciliar || false} disabled />
            <BrCheckbox label="Atendimento Pedagógico Hospitalar" name="modalidade" checked={pei?.service_modality?.atendimento_pedagogico_hospitalar || false} disabled />
          </div>
        </section>

        {/* Serviço de Apoio */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Serviço de Apoio</h2>
          <div className="flex flex-wrap gap-4">
            {pei?.support_service && Object.entries(pei.support_service).map(([key, value]) =>
              key !== 'outro' ? (
                <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
              ) : (
                <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
              )
            )}
          </div>
        </section>

        {/* Habilidades e Potencialidades */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Habilidades e Potencialidades</h2>
          <div className="grid md:grid-cols-3 gap-3">
            {pei?.skills && Object.entries(pei.skills).map(([key, value]) => (
              <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={value} disabled />
            ))}
          </div>
        </section>

        {/* Recursos/Equipamentos já utilizados */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Recursos/Equipamentos já utilizados</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {pei?.resource_equipment_used && Object.entries(pei.resource_equipment_used).map(([key, value]) =>
              key !== "outro" ? (
                <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
              ) : (
                <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
              )
            )}
          </div>
        </section>

        {/* Recursos/Equipamentos a providenciar */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Recursos/Equipamentos a providenciar</h2>
          <div className="flex flex-wrap gap-4">
            {pei?.resource_equipment_needs && Object.entries(pei.resource_equipment_needs).map(([key, value]) =>
              key !== "outro" ? (
                <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
              ) : (
                <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
              )
            )}
          </div>
        </section>

        {/* Acessibilidade Curricular */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Acessibilidade Curricular</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {pei?.curriculum_accessibility && Object.entries(pei.curriculum_accessibility).map(([key, value]) =>
              key !== "outro" ? (
                <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
              ) : (
                <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
              )
            )}
          </div>
        </section>

        {/* Conteúdo Escolar */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Conteúdo Escolar</h2>
          <BrInput label="Descrição" class="w-full" value={pei?.school_content || ""} disabled />
        </section>

        {/* Atividades a serem desenvolvidas */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Atividades a serem desenvolvidas</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {pei?.activities_to_be_developed && Object.entries(pei.activities_to_be_developed).map(([key, value]) =>
              key !== "outro" ? (
                <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
              ) : (
                <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
              )
            )}
          </div>
        </section>

        {/* Objetivos */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Objetivos</h2>
          <BrInput label="Descrição" class="w-full" value={pei?.objectives || ""} disabled />
        </section>

        {/* Metodologia de Trabalho */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Metodologia de Trabalho</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {pei?.work_methodology && Object.entries(pei.work_methodology).map(([key, value]) => (
              <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
            ))}
          </div>
        </section>

        {/* Materiais Utilizados */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Materiais Utilizados</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {pei?.materials_used && Object.entries(pei.materials_used).map(([key, value]) =>
              key !== "outro" ? (
                <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
              ) : (
                <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
              )
            )}
          </div>
        </section>

        {/* Critérios de Avaliação */}
        <section className="border-t pt-6 mt-6">
          <h2 className="text-xl font-semibold mb-4">Critérios de Avaliação</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {pei?.evaluation_criteria && Object.entries(pei.evaluation_criteria).map(([key, value]) =>
              key !== "outro" ? (
                <BrCheckbox name="" key={key} label={key.replaceAll('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} checked={!!value} disabled />
              ) : (
                <BrInput key={key} label="Outro" class="w-full" value={String(value)} disabled />
              )
            )}
          </div>
        </section>

        <div className="flex justify-center gap-4 mt-8">
          <button className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-full" onClick={() => router.push(`/estudantes/visualizar?email=${email}&nome=${nome}`)}>
            Voltar
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
