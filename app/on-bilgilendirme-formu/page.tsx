export const dynamic = "force-static";

export default function OnBilgilendirmeFormuPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">ON BILGILENDIRME FORMU</h1>

      <div className="mt-6 space-y-3 text-sm leading-7 text-slate-700">
        <p>Alici, siparis oncesinde asagidaki hususlarda bilgilendirildigini kabul eder:</p>
        <p>Satici bilgileri yukarida belirtilmistir.</p>
        <p>Urun bedeli ve varsa kargo bedeli siparis ekraninda gosterilmektedir.</p>
        <p>Teslim suresi 1-3 is gunudur.</p>
        <p>14 gun cayma hakki vardir.</p>
        <p>Iade kargo ucreti musteriye aittir.</p>
        <p>Odeme PAYTR guvenli odeme sistemi uzerinden yapilmaktadir.</p>
        <p>Alici, odeme yapmadan once bu bilgileri okudugunu ve kabul ettigini beyan eder.</p>
      </div>
    </main>
  );
}
