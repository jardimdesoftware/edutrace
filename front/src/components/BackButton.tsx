"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();

  return (
    <div className="bg-white px-4 py-2">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 rounded-lg border border-[#006ee8] bg-white px-4 py-2 text-sm font-semibold text-[#006ee8] shadow-sm transition-colors hover:bg-[#006ee8] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#b8dcff]"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>
    </div>
  );
}
