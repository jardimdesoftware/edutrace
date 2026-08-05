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
        className="inline-flex items-center gap-2 rounded-md border border-emerald-700 bg-white px-4 py-2 text-sm font-medium text-emerald-700 shadow-sm transition-colors hover:bg-emerald-700 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar
      </button>
    </div>
  );
}
