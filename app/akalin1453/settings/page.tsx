"use client";

import { useEffect, useState } from "react";
import {
  adminApi,
  type AbTestsSettings,
  type MaintenanceSettings,
  type PagePalette,
  type PagePaletteKey,
  type PagePalettes,
  type SettingsData,
  type SitePalette,
} from "@/lib/api";

const DEFAULT_PALETTE: SitePalette = { primary: "#111827", accent: "#8b5cf6", background: "#ffffff" };
const DEFAULT_PAGE_PALETTES: PagePalettes = {
  home: { text: "#1f2937", accent: "#18a999", background: "#f3f4f6" },
  cart: { text: "#1f2937", accent: "#18a999", background: "#f3f4f6" },
  payment: { text: "#1f2937", accent: "#18a999", background: "#f3f4f6" },
  product: { text: "#1f2937", accent: "#18a999", background: "#f3f4f6" },
};
const DEFAULT_AB_TESTS: AbTestsSettings = {
  enabled: false,
  experiments: {
    home_hero_copy: {
      enabled: true,
      traffic: 100,
      variants: {
        A: {
          title: "Yeni sezon teknoloji",
          subtitle: "Secili urunlerde ucretsiz kargo ve hizli teslimat.",
          cta: "Firsatlari Gor",
        },
        B: {
          title: "Teknolojide mega kampanya",
          subtitle: "Bugune ozel indirimlerle hemen kesfet.",
          cta: "Hemen Incele",
        },
      },
    },
  },
};
const DEFAULT_MAINTENANCE: MaintenanceSettings = {
  enabled: false,
  title: "Bakim modundayiz",
  message: "Kisa bir teknik calisma yapiyoruz.",
  eta: "Kisa surede tekrar buradayiz.",
};

const PAGE_KEYS: PagePaletteKey[] = ["home", "cart", "payment", "product"];

type PagePaletteField = keyof PagePalette;
type SitePaletteField = keyof SitePalette;
type VariantKey = "A" | "B";
type VariantField = "title" | "subtitle" | "cta";

function mergePagePalette(base: PagePalette, partial?: Partial<PagePalette>): PagePalette {
  return {
    text: partial?.text ?? base.text,
    accent: partial?.accent ?? base.accent,
    background: partial?.background ?? base.background,
  };
}

export default function SettingsPage() {
  const [s, setS] = useState<SettingsData | null>(null);
  const [siteName, setSiteName] = useState("");
  const [palette, setPalette] = useState<SitePalette>(DEFAULT_PALETTE);
  const [pages, setPages] = useState<PagePalettes>(DEFAULT_PAGE_PALETTES);
  const [abTests, setAbTests] = useState<AbTestsSettings>(DEFAULT_AB_TESTS);
  const [maintenance, setMaintenance] = useState<MaintenanceSettings>(DEFAULT_MAINTENANCE);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    adminApi
      .settingsGet()
      .then((x) => {
        setS(x);
        setSiteName(x.site_name ?? "");
        setPalette({
          primary: x.palette?.primary ?? DEFAULT_PALETTE.primary,
          accent: x.palette?.accent ?? DEFAULT_PALETTE.accent,
          background: x.palette?.background ?? DEFAULT_PALETTE.background,
        });

        const incomingPages = x.page_palettes;
        setPages({
          home: mergePagePalette(DEFAULT_PAGE_PALETTES.home, incomingPages?.home),
          cart: mergePagePalette(DEFAULT_PAGE_PALETTES.cart, incomingPages?.cart),
          payment: mergePagePalette(DEFAULT_PAGE_PALETTES.payment, incomingPages?.payment),
          product: mergePagePalette(DEFAULT_PAGE_PALETTES.product, incomingPages?.product),
        });

        if (x.ab_tests) setAbTests(x.ab_tests);

        if (x.maintenance) {
          setMaintenance({
            enabled: Boolean(typeof x.maintenance.enabled === "boolean" ? x.maintenance.enabled : x.feature_toggles?.maintenance_mode),
            title: x.maintenance.title ?? DEFAULT_MAINTENANCE.title,
            message: x.maintenance.message ?? DEFAULT_MAINTENANCE.message,
            eta: x.maintenance.eta ?? DEFAULT_MAINTENANCE.eta,
          });
        } else {
          setMaintenance((prev) => ({
            ...prev,
            enabled: Boolean(x.feature_toggles?.maintenance_mode),
          }));
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Ayarlar yuklenemedi.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const updatePalette = (field: SitePaletteField, value: string) => {
    setPalette((prev) => ({ ...prev, [field]: value }));
  };

  const updatePagePalette = (page: PagePaletteKey, field: PagePaletteField, value: string) => {
    setPages((prev) => ({
      ...prev,
      [page]: {
        ...prev[page],
        [field]: value,
      },
    }));
  };

  const updateAbEnabled = (enabled: boolean) => {
    setAbTests((prev) => ({ ...prev, enabled }));
  };

  const updateHomeHero = (patch: Partial<AbTestsSettings["experiments"]["home_hero_copy"]>) => {
    setAbTests((prev) => ({
      ...prev,
      experiments: {
        ...prev.experiments,
        home_hero_copy: {
          ...prev.experiments.home_hero_copy,
          ...patch,
        },
      },
    }));
  };

  const updateVariantField = (variant: VariantKey, field: VariantField, value: string) => {
    setAbTests((prev) => ({
      ...prev,
      experiments: {
        ...prev.experiments,
        home_hero_copy: {
          ...prev.experiments.home_hero_copy,
          variants: {
            ...prev.experiments.home_hero_copy.variants,
            [variant]: {
              ...prev.experiments.home_hero_copy.variants[variant],
              [field]: value,
            },
          },
        },
      },
    }));
  };

  const updateMaintenance = (patch: Partial<MaintenanceSettings>) => {
    setMaintenance((prev) => ({ ...prev, ...patch }));
  };

  return (
    <div>
      <h1>Site Ayarlari</h1>
      {loading ? <div className="card">Yukleniyor...</div> : null}
      {error ? <div className="card" style={{ color: "#b91c1c" }}>Hata: {error}</div> : null}

      {!loading && !error ? <div className="settings-head card" style={{ marginBottom: 14 }}>
        <div>
          <div className="settings-title">Magazani buradan yonet</div>
          <div className="settings-sub">Site adi ve renk paletlerini kolayca guncelle.</div>
        </div>
        <button
          className="btn btnPrimary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setSaved(false);
            try {
              const updated = await adminApi.settingsPatch({
                site_name: siteName,
                palette,
                page_palettes: pages,
                ab_tests: abTests,
                maintenance,
                feature_toggles: {
                  ...(s?.feature_toggles ?? {}),
                  ab_test: Boolean(abTests.enabled),
                  maintenance_mode: Boolean(maintenance.enabled),
                },
              });
              setS(updated);
              setSaved(true);
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Ayarlar kaydedilemedi.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Kaydediliyor..." : "Kaydet"}
        </button>
      </div> : null}

      {!loading && !error && saved ? <div className="settings-saved">Ayarlar kaydedildi.</div> : null}

      {!loading && !error ? <div className="settings-grid">
        <div className="card settings-card">
          <div className="settings-card-title">Genel</div>
          <label className="settings-field">
            <span>Site Adi</span>
            <input className="input" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
          </label>

          <div className="settings-section-title">Marka Renkleri</div>
          {(["primary", "accent", "background"] as SitePaletteField[]).map((k) => (
            <label key={k} className="settings-field">
              <span>{k === "primary" ? "Primary" : k === "accent" ? "Accent" : "Background"}</span>
              <div className="settings-color">
                <input type="color" value={palette[k]} onChange={(e) => updatePalette(k, e.target.value)} />
                <input className="input" value={palette[k]} onChange={(e) => updatePalette(k, e.target.value)} />
              </div>
            </label>
          ))}
        </div>

        <div className="card settings-card">
          <div className="settings-card-title">Sayfa Renk Paletleri</div>
          {PAGE_KEYS.map((k) => (
            <div key={k} className="settings-page">
              <div className="settings-page-title">
                {k === "home" ? "Ana Sayfa" : k === "cart" ? "Sepet Sayfasi" : k === "payment" ? "Odeme Sayfasi" : "Urun Detay Sayfasi"}
              </div>
              <div className="settings-page-grid">
                <label className="settings-field">
                  <span>Metin Rengi</span>
                  <div className="settings-color">
                    <input type="color" value={pages[k].text} onChange={(e) => updatePagePalette(k, "text", e.target.value)} />
                    <input className="input" value={pages[k].text} onChange={(e) => updatePagePalette(k, "text", e.target.value)} />
                  </div>
                </label>
                <label className="settings-field">
                  <span>Vurgu Rengi</span>
                  <div className="settings-color">
                    <input type="color" value={pages[k].accent} onChange={(e) => updatePagePalette(k, "accent", e.target.value)} />
                    <input className="input" value={pages[k].accent} onChange={(e) => updatePagePalette(k, "accent", e.target.value)} />
                  </div>
                </label>
                <label className="settings-field">
                  <span>Arka Plan</span>
                  <div className="settings-color">
                    <input type="color" value={pages[k].background} onChange={(e) => updatePagePalette(k, "background", e.target.value)} />
                    <input className="input" value={pages[k].background} onChange={(e) => updatePagePalette(k, "background", e.target.value)} />
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div> : null}

      {!loading && !error ? <div className="card settings-card" style={{ marginTop: 14 }}>
        <div className="settings-card-title">A/B Test Ayarlari</div>
        <label className="settings-field">
          <span>A/B Test Sistemi</span>
          <select className="input" value={abTests.enabled ? "1" : "0"} onChange={(e) => updateAbEnabled(e.target.value === "1")}>
            <option value="0">Kapali</option>
            <option value="1">Acik</option>
          </select>
        </label>

        <div className="settings-page">
          <div className="settings-page-title">Home Hero Copy (home_hero_copy)</div>
          <div className="settings-page-grid">
            <label className="settings-field">
              <span>Deney Durumu</span>
              <select
                className="input"
                value={abTests.experiments.home_hero_copy.enabled ? "1" : "0"}
                onChange={(e) => updateHomeHero({ enabled: e.target.value === "1" })}
              >
                <option value="1">Acik</option>
                <option value="0">Kapali</option>
              </select>
            </label>
            <label className="settings-field">
              <span>Trafik (%)</span>
              <input
                className="input"
                type="number"
                min={0}
                max={100}
                value={abTests.experiments.home_hero_copy.traffic}
                onChange={(e) => updateHomeHero({ traffic: Number(e.target.value || "0") })}
              />
            </label>
          </div>

          <div className="settings-page-grid" style={{ marginTop: 10 }}>
            <label className="settings-field">
              <span>Varyant A Baslik</span>
              <input
                className="input"
                value={abTests.experiments.home_hero_copy.variants.A.title}
                onChange={(e) => updateVariantField("A", "title", e.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>Varyant A Alt Baslik</span>
              <input
                className="input"
                value={abTests.experiments.home_hero_copy.variants.A.subtitle}
                onChange={(e) => updateVariantField("A", "subtitle", e.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>Varyant A CTA</span>
              <input
                className="input"
                value={abTests.experiments.home_hero_copy.variants.A.cta}
                onChange={(e) => updateVariantField("A", "cta", e.target.value)}
              />
            </label>
          </div>

          <div className="settings-page-grid" style={{ marginTop: 10 }}>
            <label className="settings-field">
              <span>Varyant B Baslik</span>
              <input
                className="input"
                value={abTests.experiments.home_hero_copy.variants.B.title}
                onChange={(e) => updateVariantField("B", "title", e.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>Varyant B Alt Baslik</span>
              <input
                className="input"
                value={abTests.experiments.home_hero_copy.variants.B.subtitle}
                onChange={(e) => updateVariantField("B", "subtitle", e.target.value)}
              />
            </label>
            <label className="settings-field">
              <span>Varyant B CTA</span>
              <input
                className="input"
                value={abTests.experiments.home_hero_copy.variants.B.cta}
                onChange={(e) => updateVariantField("B", "cta", e.target.value)}
              />
            </label>
          </div>
        </div>
      </div> : null}

      {!loading && !error ? <div className="card settings-card" style={{ marginTop: 14 }}>
        <div className="settings-card-title">Bakim Modu</div>
        <label className="settings-field">
          <span>Durum</span>
          <select className="input" value={maintenance.enabled ? "1" : "0"} onChange={(e) => updateMaintenance({ enabled: e.target.value === "1" })}>
            <option value="0">Kapali</option>
            <option value="1">Acik</option>
          </select>
        </label>
        <div className="settings-page-grid">
          <label className="settings-field">
            <span>Baslik</span>
            <input className="input" value={maintenance.title} onChange={(e) => updateMaintenance({ title: e.target.value })} />
          </label>
          <label className="settings-field">
            <span>Bilgi Mesaji</span>
            <input className="input" value={maintenance.message} onChange={(e) => updateMaintenance({ message: e.target.value })} />
          </label>
          <label className="settings-field">
            <span>Ek Not</span>
            <input className="input" value={maintenance.eta} onChange={(e) => updateMaintenance({ eta: e.target.value })} />
          </label>
        </div>
      </div> : null}

      {!loading && !error ? <div className="card settings-debug">
        <div className="settings-debug-head">
          <div>
            <div className="settings-card-title">Debug</div>
            <div className="settings-debug-sub">Ham ayar ciktisi (JSON)</div>
          </div>
          <button
            className="btn"
            onClick={async () => {
              if (!s) return;
              const text = JSON.stringify(s, null, 2);
              try {
                await navigator.clipboard.writeText(text);
              } catch {}
            }}
          >
            Kopyala
          </button>
        </div>
        <div className="settings-debug-box">
          <pre>{JSON.stringify(s, null, 2)}</pre>
        </div>
      </div> : null}
    </div>
  );
}
