"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { forgotPassword, resetPassword, verifyResetCode } from "@/services/auth/passwordReset";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import Loading from "@/components/Loading";

type Step = "email" | "code" | "password";

type TextFieldProps = {
  label: string;
  icon: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  pattern?: string;
  inputMode?: "numeric" | "text" | "email";
  maxLength?: number;
  minLength?: number;
  autoComplete?: string;
};

type PasswordFieldProps = Omit<TextFieldProps, "icon" | "type"> & {
  visible: boolean;
  onToggle: () => void;
};

export default function ForgotPasswordPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <ForgotPasswordPage />
    </Suspense>
  );
}

function TextField({
  label,
  icon,
  type = "text",
  value,
  onChange,
  required,
  pattern,
  inputMode,
  maxLength,
  minLength,
  autoComplete,
}: TextFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-[16px] font-bold leading-6 text-[#0b2455]">
        {label}
      </span>
      <span className="flex h-[52px] items-center rounded-[10px] border-2 border-[#b9d0ee] bg-white/70 px-4 shadow-[inset_0_1px_2px_rgba(21,72,130,0.03)] focus-within:border-[#6ea7f4] focus-within:ring-4 focus-within:ring-[#dcecff]">
        <Image width={23} height={23} src={icon} alt="" className="mr-3 h-[20px] w-[20px] opacity-80" />
        <input
          type={type}
          required={required}
          pattern={pattern}
          inputMode={inputMode}
          maxLength={maxLength}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-[#071640] outline-none"
        />
      </span>
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  required,
  minLength,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <label className="block">
      <span className="mb-2 block text-[16px] font-bold leading-6 text-[#0b2455]">
        {label}
      </span>
      <span className="flex h-[52px] items-center rounded-[10px] border-2 border-[#b9d0ee] bg-white/70 px-4 shadow-[inset_0_1px_2px_rgba(21,72,130,0.03)] focus-within:border-[#6ea7f4] focus-within:ring-4 focus-within:ring-[#dcecff]">
        <Image width={23} height={23} src="/locker.svg" alt="" className="mr-3 h-[20px] w-[20px] opacity-80" />
        <input
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-[#071640] outline-none"
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          onClick={onToggle}
          className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#edf5ff]"
        >
          <Image
            width={22}
            height={22}
            src={visible ? "/eye-off.svg" : "/eye.svg"}
            alt=""
            className="h-[20px] w-[20px]"
          />
        </button>
      </span>
    </label>
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
    <main className="relative min-h-screen overflow-hidden bg-sky-50 text-[#061542]">
      <Image src="/fundo.png" alt="" fill priority sizes="100vw" className="object-cover" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1220px] flex-col px-4 py-5 sm:px-8 lg:px-10">
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

          <section className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center lg:min-h-0 lg:justify-end">
            <div className="w-full max-w-[430px] overflow-hidden rounded-[20px] border border-[#d8e5f6] bg-white/86 shadow-[0_18px_60px_rgba(33,91,140,0.13)] backdrop-blur-sm">
              <form
                onSubmit={
                  step === "email"
                    ? handleSendEmail
                    : step === "code"
                      ? handleVerifyCode
                      : handleResetPassword
                }
                className="flex w-full flex-col px-5 pb-7 pt-7 sm:px-9 sm:pb-8 sm:pt-9"
              >
                <div className="mb-6 flex justify-center lg:hidden">
                  <Image
                    src="/login.svg"
                    alt="Edutrace"
                    width={364}
                    height={281}
                    priority
                    className="h-auto w-52 sm:w-60"
                  />
                </div>

                <h1 className="text-[31px] font-extrabold leading-tight tracking-normal text-[#061542] sm:text-[38px]">
                  {title}
                </h1>
                <p className="mt-5 text-[15px] font-medium leading-6 text-[#5872a8] sm:text-[16px]">
                  {description}
                </p>

                <div className="mt-8 space-y-5">
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
                  className="mt-6 flex h-[56px] w-full items-center justify-center gap-4 rounded-[12px] bg-[#006ee8] text-[17px] font-bold text-white shadow-[0_10px_20px_rgba(0,110,232,0.25)] transition hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {step === "email"
                    ? "Enviar código"
                    : step === "code"
                      ? "Verificar código"
                      : "Redefinir senha"}
                  <span aria-hidden="true" className="text-[26px] leading-none">&rarr;</span>
                </button>

                {step === "code" && (
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="mt-5 text-[15px] font-bold leading-6 text-[#006dff] underline disabled:opacity-60"
                  >
                    Reenviar código
                  </button>
                )}

                <div className="mt-7 flex w-full items-center gap-4 px-10 sm:px-14" aria-hidden="true">
                  <span className="h-px flex-1 bg-[#d9e1ee]" />
                  <span className="text-[15px] font-bold text-[#7182aa]">ou</span>
                  <span className="h-px flex-1 bg-[#d9e1ee]" />
                </div>

                <a
                  className="mt-5 text-center text-[15px] font-bold leading-6 text-[#00866b] underline"
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
