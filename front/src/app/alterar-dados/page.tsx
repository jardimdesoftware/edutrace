"use client";

import AppLayout from "@/components/AppLayout";
import { updateProfile } from "@/api/user";
import { useAuth } from "@/contexts/AuthContext";
import { decodeToken } from "@/services/auth/decodeToken";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";

export default function AlterarDadosPage() {
  const { user, setUser } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [senhaAtual, setSenhaAtual] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;

    const emailLimpo = email.trim();
    const emailMudou = emailLimpo !== "" && emailLimpo !== user.email;
    const querTrocarSenha = novaSenha !== "" || confirmarSenha !== "";

    if (!emailMudou && !querTrocarSenha) {
      Swal.fire("Nada para salvar", "Altere o e-mail ou a senha antes de salvar.", "info");
      return;
    }

    if (querTrocarSenha) {
      if (novaSenha.length < 8) {
        Swal.fire("Senha muito curta", "A nova senha deve ter no mínimo 8 caracteres.", "warning");
        return;
      }
      if (novaSenha !== confirmarSenha) {
        Swal.fire("Senhas não coincidem", "A confirmação da nova senha está diferente.", "warning");
        return;
      }
    }

    if (!senhaAtual) {
      Swal.fire("Senha atual obrigatória", "Informe sua senha atual para confirmar a alteração.", "warning");
      return;
    }

    try {
      setSalvando(true);
      await updateProfile({
        email: emailMudou ? emailLimpo : undefined,
        password: querTrocarSenha ? novaSenha : undefined,
        currentPassword: senhaAtual,
      });

      // O token novo já foi persistido pela API; sincroniza o contexto global
      // para que Navbar, listagem e chamadas seguintes usem os dados atualizados.
      setUser(decodeToken());

      setNovaSenha("");
      setConfirmarSenha("");
      setSenhaAtual("");

      await Swal.fire("Dados atualizados!", "Suas informações foram alteradas com sucesso.", "success");
      router.push("/home");
    } catch (error) {
      const mensagem = error instanceof Error ? error.message : "Erro ao atualizar os dados.";
      Swal.fire("Não foi possível salvar", mensagem, "error");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6">
        <div className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-md sm:p-8">
          <h1 className="mb-1 text-2xl font-light">Alterar meus dados</h1>
          <p className="mb-6 text-sm text-gray-600">
            Atualize seu e-mail e/ou senha. Deixe os campos de senha em branco se
            quiser alterar apenas o e-mail.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="nome" className="mb-1 block text-sm font-semibold text-slate-700">
                Nome
              </label>
              <input
                id="nome"
                type="text"
                value={user?.name ?? ""}
                disabled
                className="w-full cursor-not-allowed rounded border border-gray-300 bg-gray-100 px-3 py-2 text-gray-500"
              />
            </div>

            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-semibold text-slate-700">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded border border-gray-400 px-3 py-2 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <hr className="my-2 border-gray-200" />

            <div>
              <label htmlFor="novaSenha" className="mb-1 block text-sm font-semibold text-slate-700">
                Nova senha
              </label>
              <input
                id="novaSenha"
                type="password"
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                autoComplete="new-password"
                className="w-full rounded border border-gray-400 px-3 py-2 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="confirmarSenha" className="mb-1 block text-sm font-semibold text-slate-700">
                Confirmar nova senha
              </label>
              <input
                id="confirmarSenha"
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded border border-gray-400 px-3 py-2 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="senhaAtual" className="mb-1 block text-sm font-semibold text-slate-700">
                Senha atual <span className="text-red-600">*</span>
              </label>
              <input
                id="senhaAtual"
                type="password"
                value={senhaAtual}
                onChange={(e) => setSenhaAtual(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="Confirme sua identidade"
                className="w-full rounded border border-gray-400 px-3 py-2 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={salvando}
              className="mt-2 w-full rounded bg-emerald-700 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {salvando ? "Salvando..." : "Salvar alterações"}
            </button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
