"use client";

import React from "react";
import { AccountSidebar } from "@/components/account-sidebar";
import { deletePrimaryAddressAction, upsertPrimaryAddressAction } from "@/lib/user-auth-actions";
import { ChevronRight, MapPin, Plus, Trash2, X } from "lucide-react";

const TEAL = "#1BA7A6";

function classNames(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}

function ModalInput({
  label,
  name,
  defaultValue,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-[15px] font-semibold text-slate-700">{label}</div>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] outline-none placeholder:text-slate-400 focus:border-[#1BA7A6]/60 focus:ring-4 focus:ring-[#1BA7A6]/10"
      />
    </div>
  );
}

function ModalSelect({ name, defaultValue, placeholder }: { name: string; defaultValue?: string; placeholder: string }) {
  return (
    <div className="flex w-full items-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-[15px] text-slate-700 outline-none focus-within:border-[#1BA7A6]/60 focus-within:ring-4 focus-within:ring-[#1BA7A6]/10">
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} className="w-full bg-transparent outline-none placeholder:text-slate-400" />
      <ChevronRight className="h-5 w-5 text-slate-300" />
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={classNames("relative h-9 w-16 rounded-full transition", checked ? "bg-[#1BA7A6]" : "bg-slate-200")}
        aria-label={label}
      >
        <span className={classNames("absolute top-1 h-7 w-7 rounded-full bg-white shadow-sm transition", checked ? "left-8" : "left-1")} />
      </button>
      <div className="text-[15px] text-slate-700">{label}</div>
    </div>
  );
}

type EditableAddress = {
  id: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  district: string;
  postalCode: string;
  country: string;
};

function NewAddressModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial: EditableAddress | null }) {
  const [isDefault, setIsDefault] = React.useState(false);
  const isEdit = Boolean(initial);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-[#1b2a3a]/30 backdrop-blur-md" onClick={onClose} />

      <div className="absolute inset-0 flex items-center justify-center p-4 md:p-6">
        <div
          className="relative w-[700px] max-h-[88vh] max-w-[94vw] overflow-y-auto rounded-[24px] bg-white shadow-2xl ring-1 ring-black/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ boxShadow: "0 30px 80px rgba(15, 23, 42, 0.35), 0 1px 0 rgba(255,255,255,0.5) inset" }}
        >
          <form action={upsertPrimaryAddressAction}>
            <div className="relative border-b border-slate-200/70 bg-gradient-to-b from-white to-slate-50 px-6 py-5 md:px-8">
              <div className="text-center text-2xl font-semibold text-slate-800">{isEdit ? "Adresi Düzenle" : "Yeni Adres Ekle"}</div>
              <button
                type="button"
                onClick={onClose}
                className="absolute right-5 top-4 grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:text-slate-600"
                aria-label="Kapat"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="px-6 py-6 md:px-8">
              <div className="grid grid-cols-1 gap-6">
                <ModalInput label="Ad Soyad" name="fullName" defaultValue={initial?.fullName} placeholder="Ad Soyad" />

                <div className="space-y-2">
                  <div className="text-[15px] font-semibold text-slate-700">Telefon Numarası</div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 focus-within:border-[#1BA7A6]/60 focus-within:ring-4 focus-within:ring-[#1BA7A6]/10">
                      <div className="flex items-center gap-2 text-slate-600">
                        <span className="inline-flex h-6 w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-[12px]">TR</span>
                        <span className="text-[15px] font-semibold">+90</span>
                      </div>
                      <div className="h-6 w-px bg-slate-200" />
                      <input
                        name="phone"
                        defaultValue={initial?.phone}
                        className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
                        placeholder="5xx xxx xx xx"
                      />
                      <ChevronRight className="h-5 w-5 text-slate-300" />
                    </div>
                    <ModalSelect name="city" defaultValue={initial?.city} placeholder="İl seçiniz" />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ModalSelect name="district" defaultValue={initial?.district} placeholder="İlçe" />
                  <ModalInput label="Posta Kodu" name="postalCode" defaultValue={initial?.postalCode} placeholder="Posta Kodu" />
                </div>

                <ModalInput label="Adres Satırı 1" name="addressLine1" defaultValue={initial?.addressLine1} placeholder="Mahalle, cadde, sokak, no" />
                <ModalInput label="Adres Satırı 2 (Opsiyonel)" name="addressLine2" defaultValue={initial?.addressLine2} placeholder="Daire, kat, blok vb." />

                <Toggle checked={isDefault} onChange={setIsDefault} label="Varsayılan adres olarak belirle" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 border-t border-slate-200/70 bg-gradient-to-b from-white to-slate-50 px-6 py-5 md:px-8">
              <button type="button" onClick={onClose} className="h-11 rounded-xl border border-slate-200 bg-white px-8 text-base font-semibold text-slate-600 shadow-sm hover:bg-slate-50">
                Vazgeç
              </button>
              <button type="submit" className="h-11 rounded-xl px-8 text-base font-semibold text-white shadow-sm hover:brightness-95 active:brightness-90" style={{ background: TEAL }}>
                Adresi Kaydet
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

type AddressCard = EditableAddress;

export function AdreslerContent({
  fullName,
  favoriteCount,
  orderCount,
  couponCount,
  addresses,
}: {
  fullName: string;
  favoriteCount: number;
  orderCount: number;
  couponCount: number;
  addresses: AddressCard[];
}) {
  const [open, setOpen] = React.useState(false);
  const [editingAddress, setEditingAddress] = React.useState<AddressCard | null>(null);

  return (
    <>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-[300px_1fr]">
        <AccountSidebar fullName={fullName} active="adresler" favoriteCount={favoriteCount} orderCount={orderCount} couponCount={couponCount} />

        <section>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Adreslerim</h1>
              <p className="text-slate-500">{addresses.length} kayıtlı adresiniz var</p>
            </div>
            <button
              onClick={() => {
                setEditingAddress(null);
                setOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl px-5 py-3 font-semibold text-white"
              style={{ background: TEAL }}
            >
              <Plus className="h-4 w-4" />
              Yeni Adres Ekle
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600 shadow-sm">Kayıtlı adres bulunamadı.</div>
          ) : null}

          {addresses.map((address, index) => (
            <div key={address.id} className={`${index === 0 ? "mb-6" : ""} rounded-2xl border border-dashed border-slate-300 bg-white p-6 shadow-sm`}>
              <div className="flex items-start justify-between gap-4">
                <MapPin className="h-7 w-7" style={{ color: TEAL }} />
                <div>
                  <div className="text-lg font-semibold">{address.fullName}</div>
                  <div className="mt-1 text-slate-600">{address.phone}</div>
                  <div className="mt-2 text-sm leading-6 text-slate-600">
                    {address.addressLine1}
                    <br />
                    {address.addressLine2 ? (
                      <>
                        {address.addressLine2}
                        <br />
                      </>
                    ) : null}
                    {address.district} / {address.city}
                    <br />
                    {address.postalCode}
                    <br />
                    {address.country}
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAddress(address);
                      setOpen(true);
                    }}
                    className="inline-flex items-center rounded-lg bg-[#1BA7A6] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-95"
                  >
                    Düzenle
                  </button>

                  <form action={deletePrimaryAddressAction}>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Sil
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>

      <NewAddressModal
        open={open}
        initial={editingAddress}
        onClose={() => {
          setOpen(false);
          setEditingAddress(null);
        }}
      />
    </>
  );
}
