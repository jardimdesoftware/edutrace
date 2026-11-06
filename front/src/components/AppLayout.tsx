'use client';

import Navbar from './Navbar';
import { useAuth } from '@/contexts/AuthContext';
import { showHeader } from '@/utils/registrationRedirect';
import BackButton from './BackButton';

// ocuparTela: em telas grandes, o conteúdo ocupa só a altura que sobra da tela
// (o formulário em passos rola por dentro, e a página não rola). Sem ela, a
// página cresce com o conteúdo.
export default function AppLayout({
  children,
  showBack = true,
  ocuparTela = false,
}: {
  children: React.ReactNode;
  showBack?: boolean;
  ocuparTela?: boolean;
}) {
  const { user } = useAuth();

  return (
    <div className={`edutrace-app-shell min-h-screen flex flex-col ${ocuparTela ? 'lg:h-dvh lg:min-h-0 lg:overflow-hidden' : ''}`}>
      {showHeader(user) && <Navbar />}
      <div className={`relative ${ocuparTela ? 'lg:flex lg:min-h-0 lg:flex-1 lg:flex-col' : ''}`}>
        {showBack && <BackButton />}

        <main className={ocuparTela ? 'lg:flex! lg:min-h-0 lg:flex-1 lg:flex-col' : ''}>{children}</main>
      </div>
    </div>
  );
}
