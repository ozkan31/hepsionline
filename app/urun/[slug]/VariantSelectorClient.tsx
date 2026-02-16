"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type VariantValue = {
  value: string;
  inStock: boolean;
};

type VariantOptionGroup = {
  name: string;
  values: VariantValue[];
};

type ColorLink = {
  label: string;
  href: string;
  isActive: boolean;
};

type Props = {
  optionGroups: VariantOptionGroup[];
  colorLinks: ColorLink[];
};

function normalizeOptionName(value: string) {
  return value.toLocaleLowerCase("tr");
}

export default function VariantSelectorClient({ optionGroups, colorLinks }: Props) {
  const initialSelection = useMemo(() => {
    const state: Record<string, string> = {};
    for (const group of optionGroups) {
      const firstInStock = group.values.find((item) => item.inStock);
      const first = firstInStock ?? group.values[0];
      if (first) {
        state[group.name] = first.value;
      }
    }
    return state;
  }, [optionGroups]);

  const [selected, setSelected] = useState<Record<string, string>>(initialSelection);

  return (
    <div className="mt-3 space-y-3">
      {optionGroups.map((group) => {
        const optionName = normalizeOptionName(group.name);
        const isColorGroup =
          optionName.includes("renk") || optionName.includes("color");

        return (
          <div key={`variant-group-${group.name}`}>
            <div className="mb-1 text-sm font-medium text-slate-700">{group.name}</div>

            {isColorGroup && colorLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {colorLinks.map((item) => (
                  <Link
                    key={`color-link-${item.label}`}
                    href={item.href}
                    className={[
                      "rounded-xl border px-3 py-1.5 text-sm transition",
                      item.isActive
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {group.values.map((item) => {
                  const isActive = selected[group.name] === item.value;
                  return (
                    <button
                      key={`variant-value-${group.name}-${item.value}`}
                      type="button"
                      onClick={() => setSelected((prev) => ({ ...prev, [group.name]: item.value }))}
                      disabled={!item.inStock}
                      className={[
                        "rounded-xl border px-3 py-1.5 text-sm transition",
                        !item.inStock
                          ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through"
                          : isActive
                          ? "border-teal-600 bg-teal-600 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {item.value}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

