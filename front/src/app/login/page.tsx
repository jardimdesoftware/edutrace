"use client";

import dynamic from "next/dynamic";
import { Suspense, useState, useEffect } from "react";
import Image from "next/image";
import "@govbr-ds/core/dist/core.min.css";
import { login } from "@/services/auth/login";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { decodeToken } from "@/services/auth/decodeToken";
import Swal from "sweetalert2"; // 🟢 importação adicionada
import Loading from "@/components/Loading";

// Importação dinâmica para evitar erro de hydration
const BrInput = dynamic(() =>
  import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrInput), { ssr: false }
);

const BrButton = dynamic(() =>
  import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrButton), { ssr: false }
);

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
  const [version, setVersion] = useState("");

  useEffect(() => {
    fetch("https://api.github.com/repos/ifpebj-ti/pe-estudantes/releases/latest")
      .then((res) => res.json())
      .then((data) => {
        const tag = data.tag_name;
        const date = new Date(data.published_at).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        });
        setVersion(`${tag} (${date})`);
      });
  }, []);


  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      await login(email, password);

      setUser(decodeToken());
      router.push("/home");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Erro ao entrar",
        text: String(error),
        confirmButtonColor: "#047857", // verde gov.br
        confirmButtonText: "Entendi",
      });
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen flex flex-row bg-gradient-to-r from-emerald-100 to-white">
      <section className="items-center justify-center min-w-1/2 md:flex hidden">
        <Image
          src="/login.svg"
          alt="Imagem login"
          width={728}
          height={562}
          priority
        />
      </section>

      <section className="h-screen flex flex-col items-center justify-between md:min-w-1/2 min-w-full py-4">
        <div></div>
        <form
          onSubmit={handleSubmit}
          className="p-8 w-full max-w-md space-y-6 flex flex-col items-center justify-center"
        >
          <h1 className="text-2xl font-bold text-center">Login</h1>

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
            <Image width={15} height={10} slot="icon" src="/email.svg" alt="Ícone usuário" />
          </BrInput>

          <div className="w-full">
            <BrInput
              label="Senha"
              type={showPassword ? "text" : "password"}
              required
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


          <BrButton
            type="submit"
            active
            block
            class="w-full"
          >
            Entrar
          </BrButton>
          <div className="flex items-center justify-center w-full">
            <a
              className="text-sm font-semibold text-emerald-800 underline"
              href="/forgot-password"
            >
              Esqueci minha senha
            </a>
          </div>
          <div className="flex items-center justify-center w-full text-center">
            <div className="text-sm">
              <button
                type="button"
                onClick={() => setShowFirstAccessInfo((current) => !current)}
                className="font-semibold text-emerald-800 underline"
              >
                Primeiro acesso?
              </button>

              {showFirstAccessInfo && (
                <p className="mt-2">
                  Entre em contato com um administrador pelo e-mail {" "}
                  <a className="text-emerald-800 underline" href={`mailto:${contactEmail}`}>
                    {contactEmail}
                  </a>
                  .
                </p>
              )}
            </div>
          </div>
        </form>
        <div>
          <p className="text-sm ">Versão {version}</p>
        </div>
      </section>
    </div>
  );
}
