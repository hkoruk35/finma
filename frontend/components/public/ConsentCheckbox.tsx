"use client";

import { copy, type Locale } from "@/lib/i18n/copy";

export default function ConsentCheckbox({
  locale,
  checked,
  onChange,
  showError = false,
}: {
  locale: Locale;
  checked: boolean;
  onChange: (checked: boolean) => void;
  showError?: boolean;
}) {
  const t = copy[locale].consent;

  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 w-4 h-4 flex-shrink-0 accent-[#3b82f6] cursor-pointer"
        />
        <span className="text-xs text-white/50 leading-relaxed">
          {t.disclaimer}
          <br />
          <span className="text-white/30">{t.cardNotice}</span>
        </span>
      </label>
      {showError && !checked && (
        <p className="text-xs text-red-400 mt-2 ml-7">{t.required}</p>
      )}
    </div>
  );
}
