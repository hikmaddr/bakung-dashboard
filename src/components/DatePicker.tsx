"use client";

type Props = {
  value?: string; // 'yyyy-MM-dd'
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

export default function DatePicker({ value, onChange, placeholder = "yyyy-mm-dd", className = "", disabled }: Props) {
  return (
    <input
      type="date"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full rounded border px-2.5 py-1.5 text-sm bg-white disabled:cursor-not-allowed disabled:bg-gray-100 ${className}`}
    />
  );
}
