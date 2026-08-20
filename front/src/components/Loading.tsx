type LoadingProps = {
  label?: string;
  fullScreen?: boolean;
};

export default function Loading({
  label = "Carregando...",
  fullScreen = true,
}: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full flex-col items-center justify-center gap-4 ${
        fullScreen ? "min-h-screen" : "py-16"
      }`}
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700" />
      <span className="text-sm font-medium text-emerald-700">{label}</span>
    </div>
  );
}
