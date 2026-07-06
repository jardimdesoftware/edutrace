"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import "@govbr-ds/core/dist/core.min.css";
import { Suspense, useEffect, useState } from "react";
import { RegisterData } from "@/interfaces/RegisterData";
import { createUserByAdmin } from "@/services/auth/login";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { ADMIN } from "@/consts";
import TermoConsentimento from "@/components/TermoConsentimento";

const BrInput = dynamic(
  () =>
    import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrInput),
  { ssr: false },
);

const BrButton = dynamic(
  () =>
    import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrButton),
  { ssr: false },
);

export default function AdminUserCreatePageWrapper() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
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
  const [showPassword2, setShowPassword2] = useState(false);
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [mostrarTermos, setMostrarTermos] = useState(false);

  useEffect(() => {
    if (!loading && user?.id_level !== ADMIN) {
      router.push("/home");
    }
  }, [loading, router, user]);

  const handleChange = (e: React.FormEvent<HTMLBrInputElement>) => {
    const target = e.target as HTMLInputElement;
    setFormData({ ...formData, [target.name]: target.value });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!aceitouTermos) {
      alert("É necessário aceitar o Termo de Consentimento.");
      return;
    }

    if (formData.senha !== formData.confirmarSenha) {
      alert("As senhas nao coincidem.");
      return;
    }

    const cleanedCpf = formData.cpf.replace(/\D/g, "");

    const registerData: RegisterData = {
      full_name: formData.nome,
      email: formData.email,
      cpf: cleanedCpf,
      password: formData.senha,
      id_level: Number(formData.id_level),
    };

    try {
      const response = await createUserByAdmin(registerData);
      if (!response) {
        throw new Error("Erro ao realizar o cadastro.");
      }
      alert("Cadastro realizado com sucesso!");
      router.push("/estudantes");
    } catch (error: unknown) {
      if (error instanceof Error) {
        alert(error.message || "Erro no cadastro.");
      } else {
        alert("Erro desconhecido no cadastro.");
      }
    }
  };

  if (loading || !user || user.id_level !== ADMIN) {
    return <div>Carregando...</div>;
  }

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-gradient-to-b from-emerald-100 to-white md:min-h-screen md:flex-row md:bg-gradient-to-r">
      <Link
        href="/home"
        className="br-button primary absolute left-4 top-4 z-20 inline-block min-w-max whitespace-nowrap text-sm sm:left-6 sm:top-5 md:left-8 md:top-6 md:text-base"
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">&larr;</span>
          <span>Home</span>
        </span>
      </Link>

      <section className="hidden items-center justify-center md:flex md:min-w-1/2 md:px-6 lg:px-10">
        <Image
          src="/login.svg"
          alt="Imagem login"
          width={728}
          height={562}
          priority
        />
      </section>

      <section className="flex min-h-dvh w-full flex-col items-center justify-center px-4 pb-8 pt-20 sm:px-6 md:min-h-screen md:min-w-1/2 md:px-8 md:pt-24">

        <form
          className="flex w-full max-w-xl flex-col items-center justify-center space-y-5 rounded-2xl bg-white/70 p-5 backdrop-blur-[1px] sm:p-6 md:max-w-md md:space-y-6 md:p-8"
          onSubmit={handleSubmit}
        >
          <h1 className="text-center text-xl font-bold sm:text-2xl">Cadastrar novas pessoas</h1>

          <BrInput
            label="Nome completo"
            name="nome"
            required
            class="w-full"
            icon
            onInput={handleChange}
          >
            <Image width={15} height={10} slot="icon" src="/user.svg" alt="Icone nome" />
          </BrInput>

          <BrInput
            label="Email"
            type="email"
            name="email"
            required
            pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
            icon
            class="w-full"
            onInput={handleChange}
          >
            <Image width={15} height={10} slot="icon" src="/email.svg" alt="Icone email" />
          </BrInput>

          <BrInput
            label="CPF"
            name="cpf"
            required
            pattern="[0-9]{11}"
            icon
            class="w-full"
            onInput={handleChange}
          >
            <Image width={15} height={10} slot="icon" src="/cpf.svg" alt="Icone CPF" />
          </BrInput>

          <div className="w-full">
            <label
              htmlFor="id_level"
              className="mb-2 block text-sm font-semibold text-slate-700"
            >
              Nivel de acesso
            </label>

            <select
              id="id_level"
              name="id_level"
              value={formData.id_level}
              onChange={(e) => setFormData({ ...formData, id_level: e.target.value })}
              required
              className="br-select h-10 w-full rounded border border-gray-400 px-4 focus:border-yellow-600"
            >
              <option value="1">Administrador</option>
              <option value="2">Pais/Responsaveis e Estudante</option>
              <option value="3">Profissional de Educacao</option>
              <option value="4">Profissional de Saude</option>
            </select>
          </div>

          <div className="w-full">
            <BrInput
              label="Senha"
              type={showPassword ? "text" : "password"}
              name="senha"
              required
              pattern=".{8,}"
              icon
              button
              class="w-full"
              onInput={handleChange}
            >
              <Image width={15} height={10} slot="icon" src="/locker.svg" alt="Icone senha" />
              <button
                slot="action"
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
                className="br-button circle"
              >
                <Image
                  width={16}
                  height={16}
                  src={showPassword ? "/eye-off.svg" : "/eye.svg"}
                  alt=""
                />
              </button>
            </BrInput>
          </div>

          <div className="w-full">
            <BrInput
              label="Confirmar Senha"
              type={showPassword2 ? "text" : "password"}
              name="confirmarSenha"
              required
              pattern=".{8,}"
              icon
              button
              class="w-full"
              onInput={handleChange}
            >
              <Image
                width={15}
                height={10}
                slot="icon"
                src="/locker.svg"
                alt="Icone confirmar senha"
              />
              <button
                slot="action"
                type="button"
                aria-label={showPassword2 ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword2}
                onClick={() => setShowPassword2((v) => !v)}
                className="br-button circle"
              >
                <Image
                  width={16}
                  height={16}
                  src={showPassword2 ? "/eye-off.svg" : "/eye.svg"}
                  alt=""
                />
              </button>
            </BrInput>
          </div>

          <div className="w-full">
            <div className="flex items-start gap-2">
              <input
                id="aceiteTermos"
                type="checkbox"
                checked={aceitouTermos}
                onChange={(e) => setAceitouTermos(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-emerald-600"
              />
              <label htmlFor="aceiteTermos" className="text-sm text-slate-700">
                Li e concordo com o{" "}
                <button
                  type="button"
                  onClick={() => setMostrarTermos(true)}
                  className="font-semibold text-blue-700 underline hover:text-blue-900"
                >
                  Termo de Consentimento Livre e Esclarecido
                </button>
                .
              </label>
            </div>
          </div>

          <BrButton
            type="submit"
            active={aceitouTermos}
            disabled={!aceitouTermos}
            block
            class="w-full"
          >
            Finalizar
          </BrButton>
        </form>
      </section>

      {mostrarTermos && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setMostrarTermos(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-lg"
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

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="br-button"
                onClick={() => setMostrarTermos(false)}
              >
                Fechar
              </button>
              <button
                type="button"
                className="br-button primary"
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
  );
}
