'use client';

import Navbar from './Navbar';
import BackButton from './BackButton';

export default function AppLayout({
  children,
  showBack = true,
}: {
  children: React.ReactNode;
  showBack?: boolean;
}) {

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="">
        {showBack && <BackButton />}

        <main className="">{children}</main>
      </div>
    </div>
  );
}
