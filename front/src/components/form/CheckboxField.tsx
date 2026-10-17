import { useIdDoCampo } from "./Campo";

interface CheckboxFieldProps {
  rotulo: string;
  marcado: boolean;
  onChange: (marcado: boolean) => void;
  id?: string;
  disabled?: boolean;
}

export default function CheckboxField({
  rotulo,
  marcado,
  onChange,
  id: idDaProp,
  disabled,
}: CheckboxFieldProps) {
  const id = useIdDoCampo(idDaProp);

  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={marcado}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
      />
      <label htmlFor={id} className="text-sm text-gray-900">
        {rotulo}
      </label>
    </div>
  );
}
