"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { PasswordField } from "@/components/auth/AuthFields";
import { activateAccount } from "@/services/auth/passwordReset";
import {
  describeActivationError,
  readActivationToken,
} from "@/utils/activationToken";

export default function DefinirSenhaClient() {
  const [token] = useState(() => readActivationToken(window.location.hash));
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!token) return;

    if (password.length < 8) {
      void Swal.fire({
        icon: "error",
        title: "Senha inválida",
        text: "A senha deve ter no mínimo 8 caracteres.",
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      return;
    }

    if (password !== confirmPassword) {
      void Swal.fire({
        icon: "error",
        title: "Senhas diferentes",
        text: "As senhas não coincidem.",
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      return;
    }

    setLoading(true);

    try {
      await activateAccount(token, password);

      await Swal.fire({
        icon: "success",
        title: "Senha definida",
        text: "Entre com o seu e-mail e a senha que você acabou de definir.",
        confirmButtonColor: "#047857",
        confirmButtonText: "Ir para o login",
      });
      router.push("/login");
    } catch (error) {
      void Swal.fire({
        icon: "error",
        title: "Não foi possível definir a senha",
        text: describeActivationError(
          error instanceof Error ? error.message : String(error),
        ),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-[100svh] overflow-y-auto bg-sky-50 text-[#061542] lg:overflow-hidden">
      <Image src="/fundo.png" alt="" fill priority sizes="100vw" className="object-cover" />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-[1220px] flex-col px-2 py-2 sm:px-8 sm:py-5 lg:px-10">
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

          <section className="flex min-h-0 flex-col items-center justify-center py-2 sm:py-6 lg:min-h-0 lg:items-end lg:py-0">
            <div className="flex shrink-0 justify-center lg:hidden">
              <Image
                src="/login.svg"
                alt="Edutrace"
                width={364}
                height={281}
                priority
                className="h-auto w-52 min-[390px]:w-56 sm:w-64"
              />
            </div>

            <div className="mt-2 w-full max-w-[390px] overflow-hidden rounded-[18px] border border-[#d8e5f6] bg-white/86 shadow-[0_18px_60px_rgba(33,91,140,0.13)] backdrop-blur-sm sm:mt-3 sm:max-w-[430px] sm:rounded-[20px] lg:mt-0">
              <form
                onSubmit={handleSubmit}
                className="flex w-full flex-col px-4 pb-4 pt-4 sm:px-9 sm:pb-8 sm:pt-9"
              >
                <h1 className="text-[25px] font-extrabold leading-tight tracking-normal text-[#061542] sm:text-[38px]">
                  {token ? "Definir senha" : "Link inválido"}
                </h1>
                <p className="mt-3 text-[13px] font-medium leading-5 text-[#5872a8] sm:mt-5 sm:text-[16px] sm:leading-6">
                  {token
                    ? "Escolha a senha que você vai usar para entrar no EduTrace. Ela precisa ter no mínimo 8 caracteres."
                    : "Este link de definição de senha está incompleto. Abra novamente o link recebido por e-mail ou use a opção \"Esqueci minha senha\"."}
                </p>

                {token && (
                  <>
                    <div className="mt-4 space-y-2.5 sm:mt-8 sm:space-y-5">
                      <PasswordField
                        label="Nova senha"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={password}
                        onChange={setPassword}
                        visible={showPassword}
                        onToggle={() => setShowPassword((value) => !value)}
                      />
                      <PasswordField
                        label="Confirmar senha"
                        required
                        minLength={8}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        visible={showConfirmPassword}
                        onToggle={() => setShowConfirmPassword((value) => !value)}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-4 flex h-[46px] w-full items-center justify-center gap-3 rounded-[12px] bg-[#006ee8] text-[15px] font-bold text-white shadow-[0_10px_20px_rgba(0,110,232,0.25)] transition hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-6 sm:h-[56px] sm:gap-4 sm:text-[17px]"
                    >
                      Definir senha
                      <span aria-hidden="true" className="text-[24px] leading-none sm:text-[26px]">&rarr;</span>
                    </button>
                  </>
                )}

                <div className="mt-5 hidden w-full items-center gap-4 px-10 sm:mt-7 sm:flex sm:px-14" aria-hidden="true">
                  <span className="h-px flex-1 bg-[#d9e1ee]" />
                  <span className="text-[15px] font-bold text-[#7182aa]">ou</span>
                  <span className="h-px flex-1 bg-[#d9e1ee]" />
                </div>

                <a
                  className="mt-3 text-center text-[15px] font-bold leading-6 text-[#006dff] underline sm:mt-5"
                  href="/forgot-password"
                >
                  Esqueci minha senha
                </a>
                <a
                  className="mt-2 text-center text-[15px] font-bold leading-6 text-[#00866b] underline"
                  href="/login"
                >
                  Voltar para o login
                </a>
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
    </main>
  );
}
