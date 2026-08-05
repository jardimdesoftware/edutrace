'use client';

import { useAuth } from '@/contexts/AuthContext';
import { LogOut, UserCog } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const levelNames: Record<number, string> = {
    1: "Admin",
    2: "Aluno/Estudante",
    3: "Profissional Educação",
    4: "Profissional Saúde",
  };

  const router = useRouter();
  const { user, setUser } = useAuth();
  const levelLabel = user?.id_level ? levelNames[user.id_level] : "Não informado";

  // Função para limpar todos os cookies acessíveis pelo cliente
  const clearAllCookies = () => {
    // 1. Pega todos os cookies como uma única string
    const cookies = document.cookie.split(";");

    // 2. Itera sobre cada cookie
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        // 3. Sobrescreve o cookie com uma data de expiração no passado,
        //    fazendo com que o navegador o delete.
        //    É importante especificar o path=/ para garantir que funcione em todo o site.
        document.cookie = name.trim() + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }
  }

  // Função de logout aprimorada
  const handleLogout = () => {
    // 1. Limpa o localStorage
    localStorage.removeItem('token');
    localStorage.clear();

    // 2. Limpa todos os cookies acessíveis pelo cliente
    clearAllCookies();

    // 3. Redireciona o usuário para a página de login
    //    Usar replace: true é melhor para logout, pois impede o usuário
    //    de clicar no botão "voltar" do navegador e retornar a uma página protegida.
    setUser(null);
    router.replace('/login');
  };

  return (
    <div className="bg-emerald-700 text-white w-full shadow-md p-4">
      <div className="flex justify-between items-center">

        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => router.push('/home')}
            aria-label="Ir para a página inicial"
            className="w-44 h-16 -ml-2 cursor-pointer"
          >
            <Image src="/logo.svg" width="100" height="100" alt="logo" className="w-full h-full object-contain"/>
          </button>
          <div className="hidden md:block text-lg font-semibold text-white mt-2">
            <span>Prontuário Eletrônico para Estudantes com Necessidades Educacionais Específicas</span>
          </div>
        </div>

        <div className="flex flex-col items-end text-right">
          <span className="text-lg font-semibold text-white mt-1">
            Perfil: {levelLabel}
          </span>

          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => router.push('/alterar-dados')}
              className="flex items-center px-4 py-2 rounded-md text-white font-semibold hover:bg-emerald-600 transition-colors"
            >
              <UserCog className="mr-2 h-5 w-5" />
              Meus dados
            </button>

            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 rounded-md text-white font-semibold hover:bg-emerald-600 transition-colors"
            >
              <LogOut className="mr-2 h-5 w-5" />
              Sair
            </button>
          </div>
        </div>


      </div>
    </div>
  );
}
