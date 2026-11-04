"use client";

import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { createUserByAdmin } from "@/services/auth/login";
import { useAuth } from "@/contexts/AuthContext";
import TermoConsentimento from "@/components/TermoConsentimento";
import Loading from "@/components/Loading";
import {
  SelectField,
  TextField,
  fieldBoxClass,
  fieldInputClass,
  fieldLabelClass,
} from "@/components/auth/AuthFields";
import { CURSOS } from "@/utils/cursos";
import {
  MATRICULA_MAX_LENGTH,
  MATRICULA_PATTERN,
  buildRegisterData,
  cadastraEstudante,
} from "@/utils/registerForm";
import { EMAIL_PATTERN } from "@/utils/emailPattern";
import SeletorDePapeis from "@/components/SeletorDePapeis";
import { papeisDoCadastro } from "@/utils/papeisDoCadastro";
import { ROTULO_DO_PAPEL } from "@/utils/papeis";
import { canAccessPage } from "@/utils/pageAccess";
import { ESTUDANTE } from "@/consts";
import AppLayout from "@/components/AppLayout";

const ROTA_CADASTRO = "/admin/usuarios/cadastro";

export default function AdminUserCreatePageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <AdminUserCreatePage />
    </Suspense>
  );
}

function AdminUserCreatePage() {
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    cpf: "",
    roles: [ESTUDANTE] as number[],
    matricula: "",
    curso: "",
  });
  const router = useRouter();
  const { user, loading } = useAuth();
  const podeCadastrar = !!user && canAccessPage(ROTA_CADASTRO, user.roles);
  const papeis = papeisDoCadastro(user?.roles);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [mostrarTermos, setMostrarTermos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!loading && !podeCadastrar) {
      router.push("/home");
    }
  }, [loading, podeCadastrar, router]);

  const setCampo = (campo: Exclude<keyof typeof formData, "roles">) => (valor: string) =>
    setFormData((atual) => ({ ...atual, [campo]: valor }));

  const avisarErro = (mensagem: string) => {
    void Swal.fire({
      icon: "error",
      title: "Erro no cadastro",
      text: mensagem,
      confirmButtonColor: "#047857",
      confirmButtonText: "Entendi",
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const resultado = buildRegisterData(formData, aceitouTermos);

    if (!resultado.ok) {
      avisarErro(resultado.error);
      return;
    }

    setEnviando(true);

    try {
      const response = await createUserByAdmin(resultado.data);

      if (!response) {
        throw new Error("Erro ao realizar o cadastro.");
      }

      await Swal.fire(
        response.activation_email_sent
          ? {
              icon: "success",
              title: "Cadastro realizado com sucesso!",
              text: `Enviamos para ${resultado.data.email} um link para definir a senha. Ele vale por 24 horas.`,
              confirmButtonColor: "#047857",
              confirmButtonText: "Ok",
            }
          : {
              icon: "warning",
              title: "Conta criada, mas o e-mail não foi enviado",
              text: `Oriente ${resultado.data.email} a usar a opção "Esqueci minha senha" na tela de login para definir a senha.`,
              confirmButtonColor: "#047857",
              confirmButtonText: "Entendi",
            },
      );
      router.push("/home");
    } catch (error) {
      avisarErro(
        error instanceof Error ? error.message : "Erro desconhecido no cadastro.",
      );
    } finally {
      setEnviando(false);
    }
  };

  if (loading || !podeCadastrar) {
    return <Loading />;
  }

  return (
    <AppLayout ocuparTela>
    <div className="relative min-h-[70vh] overflow-y-auto bg-sky-50 text-[#061542] lg:min-h-0 lg:flex-1">
      <Image src="/fundo.png" alt="" fill priority sizes="100vw" className="object-cover" />

      <div className="relative z-10 mx-auto flex min-h-[70vh] w-full lg:min-h-full max-w-[1220px] flex-col px-2 py-2 sm:px-8 sm:py-5 lg:px-10">
        <div className="grid flex-1 items-center gap-7 lg:grid-cols-[minmax(300px,1fr)_680px] xl:gap-16">
          <section className="hidden items-center justify-center pb-8 lg:flex">
            <Image
              src="/login.svg"
              alt="Edutrace"
              width={728}
              height={562}
              priority
              className="h-auto w-full max-w-[540px] drop-shadow-[0_8px_16px_rgba(15,71,140,0.14)] xl:max-w-[590px]"
            />
          </section>

          <section className="flex min-h-0 items-start justify-center py-1 sm:items-center sm:py-6 lg:justify-end lg:py-0">
            <div className="w-full max-w-[390px] rounded-[18px] border border-[#d8e5f6] bg-white/86 shadow-[0_18px_60px_rgba(33,91,140,0.13)] backdrop-blur-sm sm:max-w-[680px] sm:rounded-[20px]">
              <form
                onSubmit={handleSubmit}
                className="flex w-full flex-col px-4 pb-4 pt-4 sm:px-9 sm:pb-7 sm:pt-7"
              >
                <div className="mb-3 flex justify-center sm:mb-6 lg:hidden">
                  <Image
                    src="/login.svg"
                    alt="Edutrace"
                    width={364}
                    height={281}
                    priority
                    className="h-auto w-24 min-[390px]:w-28 sm:w-48"
                  />
                </div>

                <h1 className="edutrace-page-title">
                  {papeis.length > 1 ? "Cadastrar pessoas" : "Cadastrar novos estudantes"}
                </h1>
                <p className="mt-2.5 text-[14px] font-medium leading-5 text-[#5872a8] sm:mt-5 sm:text-[16px] sm:leading-6">
                  {papeis.length > 1
                    ? "Crie a conta e defina os papéis. A pessoa recebe por e-mail um link para definir a própria senha."
                    : "Crie a conta do estudante. A pessoa recebe por e-mail um link para definir a própria senha."}
                </p>

                <div className="mt-4 grid gap-x-5 gap-y-2.5 sm:mt-5 sm:grid-cols-2 sm:gap-y-4">
                  <TextField
                    label="Nome completo"
                    icon="/user.svg"
                    required
                    autoComplete="name"
                    value={formData.nome}
                    onChange={setCampo("nome")}
                  />

                  <TextField
                    label="Email"
                    icon="/email.svg"
                    type="email"
                    required
                    pattern={EMAIL_PATTERN}
                    inputMode="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={setCampo("email")}
                  />

                  <TextField
                    label="CPF"
                    icon="/cpf.svg"
                    required
                    pattern="[0-9]{11}"
                    inputMode="numeric"
                    maxLength={11}
                    value={formData.cpf}
                    onChange={setCampo("cpf")}
                  />

                  {papeis.length === 1 ? (
                    <div className="block">
                      <span className={fieldLabelClass}>Papel</span>
                      <span className={fieldBoxClass}>
                        <Image
                          width={23}
                          height={23}
                          src="/user.svg"
                          alt=""
                          className="mr-3 h-[20px] w-[20px] opacity-80"
                        />
                        <output className={`${fieldInputClass} flex items-center`}>
                          <span className="min-w-0 truncate">{ROTULO_DO_PAPEL[papeis[0]]}</span>
                        </output>
                      </span>
                    </div>
                  ) : (
                    <SeletorDePapeis
                      legenda="Papéis"
                      retratil
                      opcoes={papeis}
                      valor={formData.roles}
                      onChange={(roles) => setFormData((atual) => ({ ...atual, roles }))}
                    />
                  )}

                  {cadastraEstudante(formData.roles) && (
                    <>
                      <TextField
                        label="Matrícula"
                        icon="/cpf.svg"
                        required
                        pattern={MATRICULA_PATTERN}
                        maxLength={MATRICULA_MAX_LENGTH}
                        autoComplete="off"
                        value={formData.matricula}
                        onChange={setCampo("matricula")}
                      />

                      <SelectField
                        label="Curso"
                        required
                        placeholder="Selecione o curso"
                        options={CURSOS}
                        value={formData.curso}
                        onChange={setCampo("curso")}
                      />
                    </>
                  )}
                </div>

                <div className="mt-4 flex items-start gap-2 sm:mt-5">
                  <input
                    id="aceiteTermos"
                    type="checkbox"
                    checked={aceitouTermos}
                    onChange={(e) => setAceitouTermos(e.target.checked)}
                    className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#006ee8]"
                  />
                  <label htmlFor="aceiteTermos" className="text-[13px] leading-5 text-[#5571a6] sm:text-[14px]">
                    Li e concordo com o{" "}
                    <button
                      type="button"
                      onClick={() => setMostrarTermos(true)}
                      className="font-bold text-[#006dff] underline"
                    >
                      Termo de Consentimento Livre e Esclarecido
                    </button>
                    .
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={!aceitouTermos || enviando}
                  className="mt-4 flex h-[46px] w-full items-center justify-center gap-3 rounded-[12px] bg-[#006ee8] text-[15px] font-bold text-white shadow-[0_10px_20px_rgba(0,110,232,0.25)] transition hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-6 sm:h-[56px] sm:gap-4 sm:text-[17px]"
                >
                  {enviando ? "Cadastrando..." : "Finalizar"}
                  <span aria-hidden="true" className="text-[24px] leading-none sm:text-[26px]">
                    &rarr;
                  </span>
                </button>
              </form>
            </div>
          </section>
        </div>

      </div>

      {mostrarTermos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setMostrarTermos(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-[18px] bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setMostrarTermos(false)}
                className="text-2xl leading-none text-slate-500 hover:text-slate-800"
              >
                &times;
              </button>
            </div>

            <TermoConsentimento />

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-[12px] border-2 border-[#b9d0ee] px-4 py-2 text-[15px] font-bold text-[#0b2455] transition hover:bg-[#edf5ff]"
                onClick={() => setMostrarTermos(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="rounded-[12px] bg-[#006ee8] px-4 py-2 text-[15px] font-bold text-white transition hover:bg-[#005fc9]"
                onClick={() => {
                  setAceitouTermos(true);
                  setMostrarTermos(false);
                }}
              >
                Li e concordo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AppLayout>
  );
}
