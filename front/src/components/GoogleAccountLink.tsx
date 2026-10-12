"use client";

import { useCallback, useEffect, useState } from "react";
import Swal from "sweetalert2";
import { GoogleLoginButton } from "@/components/GoogleLoginButton";
import {
  getGoogleLinkStatus,
  linkGoogleAccount,
  unlinkGoogleAccount,
  type GoogleLinkStatus,
} from "@/api/googleLink";

function mensagemDoErro(error: unknown, padrao: string) {
  return error instanceof Error ? error.message : padrao;
}

// O "Entrar com o Google" só abre a conta vinculada à Conta Google. Vincular
// exige a senha atual, porque acrescenta um meio de entrar na conta.
export function GoogleAccountLink() {
  const [status, setStatus] = useState<GoogleLinkStatus | null>(null);
  const [credential, setCredential] = useState<string | null>(null);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    getGoogleLinkStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const handleCredential = useCallback((value: string) => {
    setCredential(value);
  }, []);

  const handleGoogleError = useCallback((error: unknown) => {
    void Swal.fire(
      "Não foi possível usar o Google",
      mensagemDoErro(error, "Tente novamente."),
      "error",
    );
  }, []);

  if (!status?.enabled) return null;

  const vincular = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!credential) return;

    if (!senhaAtual) {
      Swal.fire("Senha atual obrigatória", "Informe sua senha atual para vincular a Conta Google.", "warning");
      return;
    }

    try {
      setEnviando(true);
      await linkGoogleAccount({ credential, currentPassword: senhaAtual });
      setStatus({ ...status, linked: true });
      setCredential(null);
      setSenhaAtual("");
      await Swal.fire("Conta Google vinculada!", "Agora você também pode entrar pelo botão do Google.", "success");
    } catch (error) {
      Swal.fire("Não foi possível vincular", mensagemDoErro(error, "Erro ao vincular a Conta Google."), "error");
    } finally {
      setEnviando(false);
    }
  };

  const desvincular = async () => {
    const { isConfirmed } = await Swal.fire({
      title: "Desvincular a Conta Google?",
      text: "O botão \"Entrar com o Google\" deixará de abrir a sua conta.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Desvincular",
      cancelButtonText: "Cancelar",
    });
    if (!isConfirmed) return;

    try {
      setEnviando(true);
      await unlinkGoogleAccount();
      setStatus({ ...status, linked: false });
      await Swal.fire("Conta Google desvinculada", "Use seu e-mail e senha para entrar.", "success");
    } catch (error) {
      Swal.fire("Não foi possível desvincular", mensagemDoErro(error, "Erro ao desvincular a Conta Google."), "error");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="mx-auto mt-6 max-w-lg rounded-lg bg-white p-6 shadow-md sm:p-8">
      <h2 className="mb-1 text-xl font-light">Entrar com o Google</h2>

      {status.linked ? (
        <>
          <p className="mb-4 text-sm text-gray-600">
            Sua conta está vinculada a uma Conta Google, e o botão &quot;Entrar com o Google&quot; abre a sua conta.
          </p>
          <button
            type="button"
            onClick={desvincular}
            disabled={enviando}
            className="w-full rounded border border-red-700 px-4 py-2 font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enviando ? "Desvinculando..." : "Desvincular Conta Google"}
          </button>
        </>
      ) : credential ? (
        <form onSubmit={vincular} className="space-y-4">
          <p className="text-sm text-gray-600">
            Conta Google escolhida. Confirme com sua senha atual para vincular.
          </p>
          <div>
            <label htmlFor="senhaAtualGoogle" className="mb-1 block text-sm font-semibold text-slate-700">
              Senha atual <span className="text-red-600">*</span>
            </label>
            <input
              id="senhaAtualGoogle"
              type="password"
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded border border-gray-400 px-3 py-2 focus:border-emerald-600 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCredential(null)}
              disabled={enviando}
              className="w-1/2 rounded border border-gray-400 px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="w-1/2 rounded bg-emerald-700 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? "Vinculando..." : "Vincular"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-600">
            Vincule sua Conta Google para entrar pelo botão do Google. Você vai confirmar com sua senha atual.
          </p>
          <GoogleLoginButton
            onCredential={handleCredential}
            onError={handleGoogleError}
            text="continue_with"
          />
        </>
      )}
    </div>
  );
}
