"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { login } from "@/services/auth/login";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { decodeToken } from "@/services/auth/decodeToken";
import Swal from "sweetalert2";
import Loading from "@/components/Loading";

const GITHUB_LATEST_RELEASE_API =
  "https://api.github.com/repos/jardimdesoftware/edutrace/releases/latest";
const GITHUB_RELEASE_TAG_PREFIX =
  "https://github.com/jardimdesoftware/edutrace/releases/tag/";

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<Loading />}>
      <LoginPage />
    </Suspense>
  );
}

function LoginPage() {
  const contactEmail = "admin@pe-estudantes.edu.br";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showFirstAccessInfo, setShowFirstAccessInfo] = useState(false);
  const router = useRouter();
  const { setUser } = useAuth();
  const [release, setRelease] = useState<{ label: string; url: string | null }>(
    {
      label: "",
      url: null,
    },
  );

  useEffect(() => {
    fetch(GITHUB_LATEST_RELEASE_API)
      .then((res) => res.json())
      .then((data) => {
        const tag = data.tag_name;
        const date = new Date(data.published_at).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        });
        const url =
          typeof data.html_url === "string" &&
          data.html_url.startsWith(GITHUB_RELEASE_TAG_PREFIX)
            ? data.html_url
            : null;
        setRelease({ label: `${tag} (${date})`, url });
      })
      .catch(() => setRelease({ label: "", url: null }));
  }, []);

  const finishLogin = useCallback(() => {
    setUser(decodeToken());
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
      finishLogin();
    } catch (error) {
      showLoginError(error);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-sky-50 text-[#061542]">
      <Image
        src="/fundo.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />

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
                onSubmit={handleSubmit}
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

                <h1 className="text-[36px] font-extrabold leading-none tracking-normal text-[#061542] sm:text-[44px]">
                  Login
                </h1>
                <p className="mt-6 text-[16px] font-medium leading-6 text-[#5872a8] sm:text-[17px]">
                  Acesse sua conta para continuar.
                </p>

                <div className="mt-8 space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-[16px] font-bold leading-6 text-[#0b2455]">
                      Email
                    </span>
                    <span className="flex h-[52px] items-center rounded-[10px] border-2 border-[#b9d0ee] bg-white/70 px-4 shadow-[inset_0_1px_2px_rgba(21,72,130,0.03)] focus-within:border-[#6ea7f4] focus-within:ring-4 focus-within:ring-[#dcecff]">
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
                        pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-full min-w-0 flex-1 bg-transparent text-base text-[#071640] outline-none"
                      />
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[16px] font-bold leading-6 text-[#0b2455]">
                      Senha
                    </span>
                    <span className="flex h-[52px] items-center rounded-[10px] border-2 border-[#b9d0ee] bg-white/70 px-4 shadow-[inset_0_1px_2px_rgba(21,72,130,0.03)] focus-within:border-[#6ea7f4] focus-within:ring-4 focus-within:ring-[#dcecff]">
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
                  className="mt-6 flex h-[56px] w-full items-center justify-center gap-4 rounded-[12px] bg-[#006ee8] text-[18px] font-bold text-white shadow-[0_10px_20px_rgba(0,110,232,0.25)] transition hover:bg-[#005fc9] focus:outline-none focus:ring-4 focus:ring-[#b8dcff]"
                >
                  Entrar
                  <span aria-hidden="true" className="text-[28px] leading-none">
                    &rarr;
                  </span>
                </button>

                <div className="mt-5 flex w-full items-center justify-center">
                  <a
                    className="text-[15px] font-bold leading-6 text-[#006dff] underline"
                    href="/forgot-password"
                  >
                    Esqueci minha senha
                  </a>
                </div>

                <div
                  className="mt-7 flex w-full items-center gap-4 px-10 sm:px-14"
                  aria-hidden="true"
                >
                  <span className="h-px flex-1 bg-[#d9e1ee]" />
                  <span className="text-[15px] font-bold text-[#7182aa]">
                    ou
                  </span>
                  <span className="h-px flex-1 bg-[#d9e1ee]" />
                </div>

                <div className="mt-5 flex w-full items-center justify-center text-center">
                  <div className="text-[15px]">
                    <button
                      type="button"
                      onClick={() =>
                        setShowFirstAccessInfo((current) => !current)
                      }
                      className="font-bold text-[#00866b] underline"
                    >
                      Primeiro acesso?
                    </button>

                    {showFirstAccessInfo && (
                      <p className="mt-3 text-sm font-medium text-[#5571a6]">
                        Entre em contato com um administrador pelo e-mail{" "}
                        <a
                          className="font-bold text-[#00866b] underline"
                          href={`mailto:${contactEmail}`}
                        >
                          {contactEmail}
                        </a>
                        .
                      </p>
                    )}
                  </div>
                </div>
              </form>

              <div className="bg-[#f1f4f8]/92 px-5 py-5 text-center text-[14px] font-medium text-[#5571a6]">
                {release.label && (
                  <p>
                    Versão{" "}
                    {release.url ? (
                      <a
                        className="font-bold text-[#006dff] underline"
                        href={release.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {release.label}
                      </a>
                    ) : (
                      release.label
                    )}
                  </p>
                )}
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
