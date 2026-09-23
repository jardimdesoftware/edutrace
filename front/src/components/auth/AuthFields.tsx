"use client";

import Image from "next/image";

export type TextFieldProps = {
  label: string;
  icon: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  pattern?: string;
  inputMode?: "numeric" | "text" | "email";
  maxLength?: number;
  minLength?: number;
  autoComplete?: string;
};

export type PasswordFieldProps = Omit<TextFieldProps, "icon" | "type"> & {
  visible: boolean;
  onToggle: () => void;
};

export const fieldLabelClass =
  "mb-1 block text-[14px] font-bold leading-5 text-[#0b2455] sm:mb-2 sm:text-[16px] sm:leading-6";

export const fieldBoxClass =
  "flex h-[42px] items-center rounded-[10px] border-2 border-[#b9d0ee] bg-white/70 px-3 shadow-[inset_0_1px_2px_rgba(21,72,130,0.03)] focus-within:border-[#6ea7f4] focus-within:ring-4 focus-within:ring-[#dcecff] sm:h-[52px] sm:px-4";

export const fieldInputClass =
  "h-full min-w-0 flex-1 bg-transparent text-base text-[#071640] outline-none";

export function TextField({
  label,
  icon,
  type = "text",
  value,
  onChange,
  required,
  pattern,
  inputMode,
  maxLength,
  minLength,
  autoComplete,
}: TextFieldProps) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      <span className={fieldBoxClass}>
        <Image width={23} height={23} src={icon} alt="" className="mr-3 h-[20px] w-[20px] opacity-80" />
        <input
          type={type}
          required={required}
          pattern={pattern}
          inputMode={inputMode}
          maxLength={maxLength}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldInputClass}
        />
      </span>
    </label>
  );
}

export function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggle,
  required,
  minLength,
  autoComplete,
}: PasswordFieldProps) {
  return (
    <label className="block">
      <span className={fieldLabelClass}>{label}</span>
      <span className={fieldBoxClass}>
        <Image width={23} height={23} src="/locker.svg" alt="" className="mr-3 h-[20px] w-[20px] opacity-80" />
        <input
          type={visible ? "text" : "password"}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={fieldInputClass}
        />
        <button
          type="button"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          onClick={onToggle}
          className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-[#edf5ff]"
        >
          <Image
            width={22}
            height={22}
            src={visible ? "/eye-off.svg" : "/eye.svg"}
            alt=""
            className="h-[20px] w-[20px]"
          />
        </button>
      </span>
    </label>
  );
}
