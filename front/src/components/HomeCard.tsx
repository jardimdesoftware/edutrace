// components/HomeCard.tsx
import Link from 'next/link';
import { ArrowRight, LucideIcon } from 'lucide-react';

type HomeCardProps = {
  label: string;
  icon: LucideIcon;
  href: string;
  description: string;
};

export default function HomeCard({ label, icon: Icon, href, description }: HomeCardProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-40 flex-col rounded-2xl border border-[#dce8f4] bg-white p-5 text-left shadow-[0_8px_24px_rgba(28,67,112,0.07)] transition hover:-translate-y-0.5 hover:border-[#9cc8f5] hover:shadow-[0_14px_30px_rgba(28,67,112,0.12)] focus:outline-none focus:ring-4 focus:ring-[#b8dcff]"
    >
      <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf4ff] text-[#006ee8]">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="font-bold text-[#0b2455]">{label}</span>
      <span className="mt-1.5 text-sm leading-5 text-slate-600">{description}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-bold text-[#006ee8]">
        Acessar
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </Link>
  );
}
