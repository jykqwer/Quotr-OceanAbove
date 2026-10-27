"use client";

import { useI18n } from "@/lib/i18n/lang-provider";

export interface CityGroups {
  hubs: string[];
  cities: string[];
  unserved: string[];
}

/** One city picker, grouped by how the network treats the city. */
export function CitySelect({
  id,
  label,
  value,
  onChange,
  groups,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  groups: CityGroups;
}) {
  const { t } = useI18n();

  return (
    <div className="min-w-0">
      <label htmlFor={id} className="col-head mb-1 block">
        {label}
      </label>
      <div className="relative">
        <select id={id} className="select" value={value} onChange={(event) => onChange(event.target.value)}>
          <option value="">{t("home.selectCity")}</option>
          <optgroup label={t("map.statHubs")}>
            {groups.hubs.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </optgroup>
          <optgroup label={t("map.statCities")}>
            {groups.cities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </optgroup>
          {groups.unserved.length > 0 && (
            <optgroup label={t("home.noServiceGroup")}>
              {groups.unserved.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-500"
        >
          ▾
        </span>
      </div>
    </div>
  );
}
