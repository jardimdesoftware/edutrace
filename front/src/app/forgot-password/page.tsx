"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { forgotPassword, resetPassword, verifyResetCode } from "@/services/auth/passwordReset";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Loading from "@/components/Loading";
import { PasswordField, TextField } from "@/components/auth/AuthFields";

type Step = "email" | "code" | "password";

export default function ForgotPasswordPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <ForgotPasswordPage />
    </Suspense>
  );
}


function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSendEmail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = await forgotPassword(email);

      await Swal.fire({
        icon: "success",
        title: "Verifique seu e-mail",
        text: data.message,
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      setStep("code");
    } catch (error) {
      void Swal.fire({
        icon: "error",
        title: "Erro ao enviar o código",
        text: String(error),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);

    try {
      const data = await forgotPassword(email);

      void Swal.fire({
        icon: "success",
        title: "Código reenviado",
        text: data.message,
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    } catch (error) {
      void Swal.fire({
        icon: "error",
        title: "Erro ao reenviar o código",
        text: String(error),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      void Swal.fire({
        icon: "error",
        title: "Código inválido",
        text: "O código deve conter exatamente 6 dígitos numéricos.",
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      return;
    }

    setLoading(true);

    try {
      await verifyResetCode(email, code);
      setStep("password");
    } catch (error) {
      void Swal.fire({
        icon: "error",
        title: "Código inválido",
        text: String(error),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

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
      const data = await resetPassword(email, code, password);

      await Swal.fire({
        icon: "success",
        title: "Senha redefinida",
        text: data.message,
        confirmButtonColor: "#047857",
        confirmButtonText: "Ir para o login",
      });
      router.push("/login");
    } catch (error) {
      void Swal.fire({
        icon: "error",
        title: "Erro ao redefinir a senha",
        text: String(error),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    } finally {
      setLoading(false);
    }
  };

  const title =
    step === "email" ? "Esqueci minha senha" : step === "code" ? "Verificação" : "Nova senha";
  const description =
    step === "email"
      ? "Informe o e-mail cadastrado para receber um código de recuperação."
      : step === "code"
        ? `Digite o código de 6 dígitos enviado para ${email}.`
        : "Defina a nova senha da sua conta.";

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

          <section className="flex min-h-0 items-start justify-center py-1 sm:items-center sm:py-6 lg:min-h-0 lg:justify-end lg:py-0">
            <div className="max-h-[calc(100svh-1rem)] w-full max-w-[390px] overflow-y-auto rounded-[18px] border border-[#d8e5f6] bg-white/86 shadow-[0_18px_60px_rgba(33,91,140,0.13)] backdrop-blur-sm sm:max-h-none sm:max-w-[430px] sm:overflow-hidden sm:rounded-[20px]">
              <form
                onSubmit={
                  step === "email"
                    ? handleSendEmail
                    : step === "code"
                      ? handleVerifyCode
                      : handleResetPassword
                }
                className="flex w-full flex-col px-4 pb-4 pt-4 sm:px-9 sm:pb-8 sm:pt-9"
              >
                <div className="mb-3 flex justify-center sm:mb-6 lg:hidden">
                  <Image
                    src="/login.svg"
                    alt="Edutrace"
                    width={364}
                    height={281}
                    priority
                    className="h-auto w-28 min-[390px]:w-32 sm:w-60"
                  />
                </div>

                <h1 className="text-[25px] font-extrabold leading-tight tracking-normal text-[#061542] sm:text-[38px]">
                  {title}
                </h1>
                <p className="mt-3 text-[13px] font-medium leading-5 text-[#5872a8] sm:mt-5 sm:text-[16px] sm:leading-6">
                  {description}
                </p>

                <div className="mt-4 space-y-2.5 sm:mt-8 sm:space-y-5">
                  {step === "email" && (
                    <TextField
                      label="Email"
                      icon="/email.svg"
                      type="email"
                      required
                      pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={setEmail}
                    />
                  )}

                  {step === "code" && (
                    <TextField
                      label="Código"
                      icon="/locker.svg"
                      required
                      pattern="[0-9]{6}"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={setCode}
                    />
                  )}

                  {step === "password" && (
                    <>
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
                    </>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-4 flex h-[46px] w-full items-center justify-center gap-3 rounded-[12px] bg-[#006ee8] text-[15px] font-bold text-white shadow-[0_10px_20px_rgba(0,110,232,0.25)] transition hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff] disabled:cursor-not-allowed disabled:opacity-60 sm:mt-6 sm:h-[56px] sm:gap-4 sm:text-[17px]"
                >
                  {step === "email"
                    ? "Enviar código"
                    : step === "code"
                      ? "Verificar código"
                      : "Redefinir senha"}
                  <span aria-hidden="true" className="text-[24px] leading-none sm:text-[26px]">&rarr;</span>
                </button>

                {step === "code" && (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="mt-4 text-[15px] font-bold leading-6 text-[#006dff] underline disabled:opacity-60 sm:mt-5"
                  >
                    Reenviar código
                  </button>
                )}

                <div className="mt-5 hidden w-full items-center gap-4 px-10 sm:mt-7 sm:flex sm:px-14" aria-hidden="true">
                  <span className="h-px flex-1 bg-[#d9e1ee]" />
                  <span className="text-[15px] font-bold text-[#7182aa]">ou</span>
                  <span className="h-px flex-1 bg-[#d9e1ee]" />
                </div>

                <a
                  className="mt-3 text-center text-[15px] font-bold leading-6 text-[#00866b] underline sm:mt-5"
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
