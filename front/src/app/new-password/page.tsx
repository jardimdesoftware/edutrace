"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import Image from "next/image";
import React from "react";
import "@govbr-ds/core/dist/core.min.css";

// Importações dinâmicas
const BrButton = dynamic(() =>
  import("@govbr-ds-testing/webcomponents-react").then((mod) => mod.BrButton), { ssr: false }
);

export default function NewPasswordPageWrapper() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <NewPasswordPage />
    </Suspense>
  );
}

function NewPasswordPage() {
//   const [formData, setFormData] = useState({
//     senha: "",
//     confirmarSenha: ""
//   });

  const mensagem = "";


  return (
    <div className="min-h-screen flex flex-row bg-gradient-to-r from-emerald-100 to-white">
      <section className="items-center justify-center min-w-1/2 md:flex hidden">
        <Image
          src="/login.svg"
          alt="Imagem login"
          width={600}
          height={400}
          priority
        />
      </section>

      <section className="h-screen flex flex-col items-center justify-between md:min-w-1/2 min-w-full py-4">
        <div></div>

        {/* Formulário de nova senha */}
        <form className="p-8 w-full max-w-md space-y-6 flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-center">Nova Senha</h1>

          <BrButton
            type="submit"
            active
            block
            class="w-full"
          >
            Finalizar
          </BrButton>

          {mensagem && (
            <p className="text-center text-sm text-green-700">{mensagem}</p>
          )}
        </form>

        {/* <div className="flex items-center justify-center w-full" onClick={() => setMensagem("Senha alterada com sucesso!")}>
          <a className="text-sm" href="/forgot-password">
            Precisa de Ajuda?
          </a>
        </div> */}
      </section>
    </div>
  );
}
