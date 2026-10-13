"use client";

import dynamic from "next/dynamic";
import Loading from "@/components/Loading";

const DefinirSenhaClient = dynamic(() => import("./DefinirSenhaClient"), {
  ssr: false,
  loading: () => <Loading />,
});

export default function DefinirSenhaPage() {
  return <DefinirSenhaClient />;
}
