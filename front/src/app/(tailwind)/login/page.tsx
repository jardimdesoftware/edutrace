"use client";

import { Suspense, useCallback, useState } from "react";
import Image from "next/image";
import { login, loginWithGoogle } from "@/services/auth/login";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchSessionUser } from "@/services/auth/sessionUser";
import Swal from "sweetalert2";
import Loading from "@/components/Loading";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import { EMAIL_PATTERN } from "@/utils/emailPattern";
import { describeAppVersion } from "@/utils/appVersion";

const APP_VERSION = describeAppVersion(process.env.NEXT_PUBLIC_APP_VERSION);

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();

  const finishLogin = useCallback(async () => {
    setUser(await fetchSessionUser());
    router.push("/home");
  }, [router, setUser]);

  const showLoginError = useCallback((error: unknown) => {
    void Swal.fire({
      icon: "error",
      title: "Erro ao entrar",
      text: error instanceof Error ? error.message : String(error),
      confirmButtonColor: "#047857",
      confirmButtonText: "Entendi",
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await login(email, password);
      await finishLogin();
    } catch (error) {
      showLoginError(error);
    }
  };

  const handleGoogleCredential = useCallback(async (credential: string) => {
    try {
      await loginWithGoogle(credential);
      await finishLogin();
    } catch (error) {
      showLoginError(error);
    }
  }, [finishLogin, showLoginError]);

  return (
    <main className="relative min-h-[100svh] overflow-y-auto bg-sky-50 text-[#061542] lg:overflow-hidden">
      <Image
        src="/fundo.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

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
                <h1 className="text-[27px] font-extrabold leading-none tracking-normal text-[#061542] sm:text-[44px]">
                  Login
                </h1>
                <p className="mt-2.5 text-[14px] font-medium leading-5 text-[#5872a8] sm:mt-6 sm:text-[17px] sm:leading-6">
                  Acesse sua conta para continuar.
                </p>

                <div className="mt-3.5 space-y-2 sm:mt-8 sm:space-y-5">
                  <label className="block">
                    <span className="mb-1 block text-[14px] font-bold leading-5 text-[#0b2455] sm:mb-2 sm:text-[16px] sm:leading-6">
                      Email
                    </span>
                    <span className="flex h-[42px] items-center rounded-[10px] border-2 border-[#b9d0ee] bg-white/70 px-3 shadow-[inset_0_1px_2px_rgba(21,72,130,0.03)] focus-within:border-[#6ea7f4] focus-within:ring-4 focus-within:ring-[#dcecff] sm:h-[52px] sm:px-4">
                      <Image
                        width={25}
                        height={20}
                        src="/email.svg"
                        alt=""
                        className="mr-3 h-[17px] w-[21px] opacity-80"
                      />
                      <input
                        type="email"
                        required
                        pattern={EMAIL_PATTERN}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-full min-w-0 flex-1 bg-transparent text-base text-[#071640] outline-none"
                      />
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[14px] font-bold leading-5 text-[#0b2455] sm:mb-2 sm:text-[16px] sm:leading-6">
                      Senha
                    </span>
                    <span className="flex h-[42px] items-center rounded-[10px] border-2 border-[#b9d0ee] bg-white/70 px-3 shadow-[inset_0_1px_2px_rgba(21,72,130,0.03)] focus-within:border-[#6ea7f4] focus-within:ring-4 focus-within:ring-[#dcecff] sm:h-[52px] sm:px-4">
                      <Image
                        width={23}
                        height={23}
                        src="/locker.svg"
                        alt=""
                        className="mr-3 h-[20px] w-[20px] opacity-80"
                      />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-full min-w-0 flex-1 bg-transparent text-base text-[#071640] outline-none"
                      />
                      <button
                        type="button"
                        aria-label={
                          showPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        aria-pressed={showPassword}
                        onClick={() => setShowPassword((v) => !v)}
                        className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#edf5ff]"
                      >
                        <Image
                          width={22}
                          height={22}
                          src={showPassword ? "/eye-off.svg" : "/eye.svg"}
                          alt=""
                          className="h-[20px] w-[20px]"
                        />
                      </button>
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="mt-3.5 flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-[#006ee8] text-[15px] font-bold text-white shadow-[0_8px_18px_rgba(0,110,232,0.25)] transition hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff] sm:mt-6 sm:gap-4 sm:text-[16px]"
                >
                  Entrar
                  <span aria-hidden="true" className="text-[23px] leading-none">
                    &rarr;
                  </span>
                </button>

                <div className="mt-2.5 sm:mt-3">
                  <GoogleLoginButton
                    onCredential={handleGoogleCredential}
                    onError={showLoginError}
                  />
                </div>

                <div className="mt-2.5 flex w-full items-center justify-center sm:mt-4">
                  <a
                    className="text-[14px] font-bold leading-6 text-[#006dff] underline sm:text-[15px]"
                    href="/forgot-password"
                  >
                    Esqueci minha senha
                  </a>
                </div>
              </form>

              <div className="bg-[#f1f4f8]/92 px-4 py-2 text-center text-[10px] font-medium leading-4 text-[#5571a6] sm:px-5 sm:py-5 sm:text-[12px]">
                <p>
                  Versão{" "}
                  {APP_VERSION.url ? (
                    <a
                      className="hover:underline"
                      href={APP_VERSION.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {APP_VERSION.label}
                    </a>
                  ) : (
                    APP_VERSION.label
                  )}
                </p>
              </div>
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
