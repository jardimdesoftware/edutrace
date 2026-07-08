"use client";

import dynamic from "next/dynamic";
import { Suspense, useState } from "react";
import Image from "next/image";
import "@govbr-ds/core/dist/core.min.css";
import { forgotPassword, verifyResetCode, resetPassword } from "@/services/auth/passwordReset";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

// Importação dinâmica para evitar erro de hydration
const BrInput = dynamic(() =>
  import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrInput), { ssr: false }
);

const BrButton = dynamic(() =>
  import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrButton), { ssr: false }
);

type Step = "email" | "code" | "password";

export default function ForgotPasswordPageWrapper() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
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
      Swal.fire({
        icon: "error",
        title: "Erro ao enviar o código",
        text: String(error),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);

    try {
      const data = await forgotPassword(email);

      Swal.fire({
        icon: "success",
        title: "Código reenviado",
        text: data.message,
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Erro ao reenviar o código",
        text: String(error),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!/^\d{6}$/.test(code)) {
      Swal.fire({
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
      Swal.fire({
        icon: "error",
        title: "Código inválido",
        text: String(error),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (password.length < 6) {
      Swal.fire({
        icon: "error",
        title: "Senha inválida",
        text: "A senha deve ter no mínimo 6 caracteres.",
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      return;
    }

    if (password !== confirmPassword) {
      Swal.fire({
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
      Swal.fire({
        icon: "error",
        title: "Erro ao redefinir a senha",
        text: String(error),
        confirmButtonColor: "#047857",
        confirmButtonText: "Entendi",
      });
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-row bg-gradient-to-r from-emerald-100 to-white">
      <section className="items-center justify-center min-w-1/2 md:flex hidden">
        <Image
          src="/login.svg"
          alt="Imagem recuperação de senha"
          width={728}
          height={562}
          priority
        />
      </section>

      <section className="h-screen flex flex-col items-center justify-between md:min-w-1/2 min-w-full py-4">
        <div></div>

        {step === "email" && (
          <form
            onSubmit={handleSendEmail}
            className="p-8 w-full max-w-md space-y-6 flex flex-col items-center justify-center"
          >
            <h1 className="text-2xl font-bold text-center">Esqueci minha senha</h1>
            <p className="text-sm text-center">
              Informe o e-mail cadastrado para receber um código de recuperação.
            </p>

            <BrInput
              label="Email"
              type="email"
              required
              pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
              icon
              class="w-full"
              onInput={(e: React.FormEvent<HTMLBrInputElement>) => {
                const target = e.target as HTMLInputElement;
                setEmail(target.value);
              }}
            >
              <Image width={15} height={10} slot="icon" src="/email.svg" alt="Ícone email" />
            </BrInput>

            <BrButton
              type="submit"
              active
              block
              disabled={loading}
              class="w-full"
            >
              Enviar código
            </BrButton>
          </form>
        )}

        {step === "code" && (
          <form
            onSubmit={handleVerifyCode}
            className="p-8 w-full max-w-md space-y-6 flex flex-col items-center justify-center"
          >
            <h1 className="text-2xl font-bold text-center">Verificação</h1>
            <p className="text-sm text-center">
              Digite o código de 6 dígitos enviado para {email}. Ele expira em 15 minutos.
            </p>

            <BrInput
              label="Código"
              type="text"
              required
              inputMode="numeric"
              maxlength={6}
              pattern="[0-9]{6}"
              icon
              class="w-full"
              onInput={(e: React.FormEvent<HTMLBrInputElement>) => {
                const target = e.target as HTMLInputElement;
                setCode(target.value);
              }}
            >
              <Image width={15} height={10} slot="icon" src="/locker.svg" alt="Ícone código" />
            </BrInput>

            <BrButton
              type="submit"
              active
              block
              disabled={loading}
              class="w-full"
            >
              Verificar código
            </BrButton>

            <div className="flex items-center justify-center w-full text-center">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={loading}
                className="text-sm font-semibold text-emerald-800 underline"
              >
                Reenviar código
              </button>
            </div>
          </form>
        )}

        {step === "password" && (
          <form
            onSubmit={handleResetPassword}
            className="p-8 w-full max-w-md space-y-6 flex flex-col items-center justify-center"
          >
            <h1 className="text-2xl font-bold text-center">Nova senha</h1>
            <p className="text-sm text-center">
              Defina a nova senha da sua conta.
            </p>

            <div className="w-full">
              <BrInput
                label="Nova senha"
                type={showPassword ? "text" : "password"}
                required
                minlength={6}
                icon
                button
                class="w-full"
                onInput={(e: React.FormEvent<HTMLBrInputElement>) => {
                  const target = e.target as HTMLInputElement;
                  setPassword(target.value);
                }}
              >
                <Image
                  width={15}
                  height={10}
                  slot="icon"
                  src="/locker.svg"
                  alt="Ícone senha"
                />
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
                label="Confirmar senha"
                type={showConfirmPassword ? "text" : "password"}
                required
                minlength={6}
                icon
                button
                class="w-full"
                onInput={(e: React.FormEvent<HTMLBrInputElement>) => {
                  const target = e.target as HTMLInputElement;
                  setConfirmPassword(target.value);
                }}
              >
                <Image
                  width={15}
                  height={10}
                  slot="icon"
                  src="/locker.svg"
                  alt="Ícone senha"
                />
                <button
                  slot="action"
                  type="button"
                  aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="br-button circle"
                >
                  <Image
                    width={16}
                    height={16}
                    src={showConfirmPassword ? "/eye-off.svg" : "/eye.svg"}
                    alt=""
                  />
                </button>
              </BrInput>
            </div>

            <BrButton
              type="submit"
              active
              block
              disabled={loading}
              class="w-full"
            >
              Redefinir senha
            </BrButton>
          </form>
        )}

        <div className="flex items-center justify-center w-full">
          <a className="text-sm font-semibold text-emerald-800 underline" href="/login">
            Voltar para o login
          </a>
        </div>
      </section>
    </div>
  );
}
