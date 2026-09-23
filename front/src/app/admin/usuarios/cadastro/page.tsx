"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { createUserByAdmin } from "@/services/auth/login";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN } from "@/consts";
import TermoConsentimento from "@/components/TermoConsentimento";
import Loading from "@/components/Loading";
import {
  PasswordField,
  TextField,
  fieldBoxClass,
  fieldInputClass,
  fieldLabelClass,
} from "@/components/auth/AuthFields";
import { buildRegisterData } from "@/utils/registerForm";

const NIVEIS = [
  { value: "1", label: "Administrador" },
  { value: "2", label: "Pais/Responsáveis e Estudante" },
  { value: "3", label: "Profissional da Educação" },
  { value: "4", label: "Profissional da Saúde" },
];

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
    senha: "",
    confirmarSenha: "",
    id_level: "2",
  });
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [mostrarTermos, setMostrarTermos] = useState(false);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!loading && user?.id_level !== ADMIN) {
      router.push("/home");
    }
  }, [loading, router, user]);

  const setCampo = (campo: keyof typeof formData) => (valor: string) =>
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

      await Swal.fire({
        icon: "success",
        title: "Cadastro realizado com sucesso!",
        confirmButtonColor: "#047857",
        confirmButtonText: "Ok",
      });
      router.push("/home");
    } catch (error) {
      avisarErro(
        error instanceof Error ? error.message : "Erro desconhecido no cadastro.",
      );
    } finally {
      setEnviando(false);
    }
  };

  if (loading || !user || user.id_level !== ADMIN) {
    return <Loading />;
  }

  return (
    <main className="relative min-h-[100svh] overflow-y-auto bg-sky-50 text-[#061542]">
      <Image src="/fundo.png" alt="" fill priority sizes="100vw" className="object-cover" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1220px] flex-col px-2 py-2 sm:px-8 sm:py-5 lg:px-10">
        <Link
          href="/home"
          className="inline-flex w-fit items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-[14px] font-bold text-[#006dff] shadow-[0_6px_16px_rgba(33,91,140,0.12)] transition hover:bg-white"
        >
          <span aria-hidden="true">&larr;</span>
          Home
        </Link>

        <div className="grid flex-1 items-center gap-7 lg:grid-cols-[minmax(460px,1fr)_430px] xl:gap-24">
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
            <div className="w-full max-w-[390px] rounded-[18px] border border-[#d8e5f6] bg-white/86 shadow-[0_18px_60px_rgba(33,91,140,0.13)] backdrop-blur-sm sm:max-w-[430px] sm:rounded-[20px]">
              <form
                onSubmit={handleSubmit}
                className="flex w-full flex-col px-4 pb-4 pt-4 sm:px-9 sm:pb-8 sm:pt-9"
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

                <h1 className="text-[25px] font-extrabold leading-tight tracking-normal text-[#061542] sm:text-[38px]">
                  Cadastrar pessoas
                </h1>
                <p className="mt-2.5 text-[14px] font-medium leading-5 text-[#5872a8] sm:mt-5 sm:text-[16px] sm:leading-6">
                  Crie a conta e defina o nível de acesso.
                </p>

                <div className="mt-4 space-y-2.5 sm:mt-7 sm:space-y-4">
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
                    pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
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

                  <label className="block">
                    <span className={fieldLabelClass}>Nível de acesso</span>
                    <span className={fieldBoxClass}>
                      <Image
                        width={23}
                        height={23}
                        src="/user.svg"
                        alt=""
                        className="mr-3 h-[20px] w-[20px] opacity-80"
                      />
                      <select
                        name="id_level"
                        required
                        value={formData.id_level}
                        onChange={(e) => setCampo("id_level")(e.target.value)}
                        className={fieldInputClass}
                      >
                        {NIVEIS.map((nivel) => (
                          <option key={nivel.value} value={nivel.value}>
                            {nivel.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </label>

                  <PasswordField
                    label="Senha"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={formData.senha}
                    onChange={setCampo("senha")}
                    visible={showPassword}
                    onToggle={() => setShowPassword((valor) => !valor)}
                  />

                  <PasswordField
                    label="Confirmar senha"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={formData.confirmarSenha}
                    onChange={setCampo("confirmarSenha")}
                    visible={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((valor) => !valor)}
                  />
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

        <p className="pointer-events-none hidden self-end pr-2 text-right text-[15px] font-medium leading-6 text-[#5571a6] lg:block">
          Juntos por uma
          <br />
          educação sem barreiras.
          <span className="mt-3 ml-auto block h-1 w-16 rounded-full bg-[#7edbd0]" />
        </p>
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
    </main>
  );
}
