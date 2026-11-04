'use client';

import { useAuth } from '@/contexts/AuthContext';
import { rotulosDosPapeis } from '@/utils/papeis';
import { LogOut, UserCog } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { clearCookie } from '@/services/auth/tokenCookie';
import { logout } from '@/services/auth/login';

export default function Navbar({ previewLevelLabel }: { previewLevelLabel?: string } = {}) {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const levelLabel = previewLevelLabel || rotulosDosPapeis(user?.roles).join(", ") || "Não informado";

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
        clearCookie(name.trim());
    }
  }

  // Função de logout aprimorada
  const handleLogout = async () => {
    // 0. Encerra a sessão no servidor, para que o token deixe de valer também
    //    para quem tenha uma cópia dele. A limpeza local segue mesmo se a
    //    chamada falhar, senão uma API fora do ar prenderia o usuário na conta.
    try {
      await logout();
    } catch (error) {
      console.error('Falha ao encerrar a sessão no servidor:', error);
    }

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
    <header className="edutrace-app-header">
      <div className="edutrace-app-header__shape edutrace-app-header__shape--left" aria-hidden="true" />
      <div className="edutrace-app-header__shape edutrace-app-header__shape--right" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-[1920px] flex-col gap-5 px-5 py-5 sm:px-8 md:flex-row md:items-center md:justify-between md:gap-8 lg:px-12 lg:py-5">
        <button
          type="button"
          onClick={() => router.push('/home')}
          aria-label="Ir para a página inicial"
          className="group flex min-w-0 items-center gap-3 rounded-2xl text-left outline-none focus-visible:ring-4 focus-visible:ring-[#b8dcff] sm:gap-4"
        >
          <span className="flex h-16 w-16 shrink-0 items-center justify-center transition-transform group-hover:scale-[1.03] sm:h-[4.5rem] sm:w-[4.5rem]">
            <Image
              src="/edutrace-symbol.png"
              width={80}
              height={80}
              priority
              alt="Símbolo do Edutrace"
              className="h-full w-full object-contain drop-shadow-[0_8px_18px_rgba(0,110,232,0.16)]"
            />
          </span>

          <span className="min-w-0">
            <span className="block text-[1.65rem] font-extrabold leading-none tracking-[-0.035em] text-[#0b2455] sm:text-[1.9rem]">
              Edutrace
            </span>
            <span className="mt-1.5 hidden max-w-3xl text-sm font-medium leading-snug text-[#315a91] sm:block lg:text-base">
              Prontuário Eletrônico para Estudantes com Necessidades Educacionais Específicas
            </span>
          </span>
        </button>

        <div className="flex min-w-0 shrink-0 flex-col items-start gap-1.5 md:items-end">
          {user?.name && (
            <span
              className="max-w-[18rem] truncate text-lg font-extrabold leading-tight text-[#0b2455] sm:text-xl"
              title={user.name}
            >
              {user.name}
            </span>
          )}
          <span
            className="inline-flex max-w-full items-center rounded-full bg-[#ddf8ee] px-3 py-1 text-xs font-bold text-[#0b2455] shadow-[inset_0_0_0_1px_rgba(42,169,143,0.08)] sm:text-sm"
            aria-label={`Perfil: ${levelLabel}`}
          >
            {levelLabel}
          </span>

          <nav aria-label="Ações da conta" className="flex items-center text-[#0b2455]">
            <button
              type="button"
              onClick={() => router.push('/alterar-dados')}
              className="edutrace-header-action"
            >
              <UserCog className="h-5 w-5" aria-hidden="true" />
              Meus dados
            </button>

            <span className="mx-1 h-7 w-px bg-[#bfd3ec] sm:mx-2" aria-hidden="true" />

            <button
              type="button"
              onClick={handleLogout}
              className="edutrace-header-action"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
              Sair
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
