import { LEGAL_ADDRESS, LEGAL_BRAND, LEGAL_EMAIL, LEGAL_PHONE, LEGAL_SELLER_TITLE, LEGAL_WEBSITE } from "@/lib/legalInfo";

type ContractParty = {
  fullName?: string;
  address?: string;
  phone?: string;
  email?: string;
};

type ContractLineItem = {
  name: string;
  quantity: number;
  unitPrice: number;
};

type DistanceSalesContractProps = {
  buyer?: ContractParty;
  orderer?: ContractParty;
  invoice?: ContractParty;
  items?: ContractLineItem[];
  shippingCost?: number;
  total?: number;
  className?: string;
};

function formatCurrency(value: number) {
  return `${Number(value || 0).toLocaleString("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function getSafeParty(party?: ContractParty): Required<ContractParty> {
  return {
    fullName: String(party?.fullName ?? "").trim() || "Sipariş sırasında girilen bilgiler esas alınacaktır.",
    address: String(party?.address ?? "").trim() || "Sipariş sırasında girilen teslimat / fatura adresi esas alınacaktır.",
    phone: String(party?.phone ?? "").trim() || "Sipariş sırasında girilen telefon bilgisi esas alınacaktır.",
    email: String(party?.email ?? "").trim() || "Sipariş sırasında girilen e-posta bilgisi esas alınacaktır.",
  };
}

export function DistanceSalesContract({
  buyer,
  orderer,
  invoice,
  items = [],
  shippingCost = 0,
  total = 0,
  className = "",
}: DistanceSalesContractProps) {
  const safeBuyer = getSafeParty(buyer);
  const safeOrderer = getSafeParty(orderer ?? buyer);
  const safeInvoice = getSafeParty(invoice ?? buyer);
  const normalizedItems = items
    .map((item) => ({
      name: String(item?.name ?? "").trim(),
      quantity: Math.max(1, Number(item?.quantity ?? 1) || 1),
      unitPrice: Number(item?.unitPrice ?? 0) || 0,
    }))
    .filter((item) => item.name);
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const resolvedTotal = Number(total || 0) > 0 ? Number(total || 0) : subtotal + Number(shippingCost || 0);

  return (
    <div className={`space-y-5 text-sm text-gray-700 leading-6 ${className}`.trim()}>
      <p>
        <strong>MESAFELİ SATIŞ SÖZLEŞMESİ</strong>
      </p>

      <section>
        <p>
          <strong>1. TARAFLAR</strong>
        </p>
        <p className="mt-2">
          İşbu Sözleşme aşağıdaki taraflar arasında aşağıda belirtilen hüküm ve şartlar çerçevesinde elektronik ortamda
          kurulmuştur.
        </p>
        <div className="mt-3 space-y-3">
          <div>
            <p>
              <strong>ALICI</strong>
            </p>
            <p>AD-SOYAD: {safeBuyer.fullName}</p>
            <p>ADRES: {safeBuyer.address}</p>
          </div>
          <div>
            <p>
              <strong>SATICI</strong>
            </p>
            <p>ÜNVANI / AD-SOYAD: {LEGAL_SELLER_TITLE}</p>
            <p>ADRES: {LEGAL_ADDRESS}</p>
          </div>
        </div>
        <p className="mt-3">
          İşbu sözleşmeyi kabul etmekle ALICI, sipariş konusu bedeli ve varsa kargo ücreti, vergi gibi belirtilen ek
          ücretleri ödeme yükümlülüğü altına gireceğini ve bu konuda bilgilendirildiğini peşinen kabul eder.
        </p>
      </section>

      <section>
        <p>
          <strong>2. TANIMLAR</strong>
        </p>
        <p className="mt-2">
          İşbu sözleşmenin uygulanmasında ve yorumlanmasında aşağıda yazılı terimler karşılarındaki açıklamaları ifade eder:
          BAKAN: Ticaret Bakanı&apos;nı, BAKANLIK: Ticaret Bakanlığı&apos;nı, KANUN: 6502 sayılı Tüketicinin Korunması
          Hakkında Kanun&apos;u, YÖNETMELİK: Mesafeli Sözleşmeler Yönetmeliği&apos;ni, SATICI: {LEGAL_BRAND} markası ile
          satış yapan işletmeyi, ALICI: ticari veya mesleki olmayan amaçlarla mal veya hizmet edinen kişiyi, SİTE:{" "}
          {LEGAL_WEBSITE} alan adlı internet sitesini, SİPARİŞ VEREN: site üzerinden sipariş oluşturan kişiyi, MAL:
          alışverişe konu taşınır eşyayı ifade eder.
        </p>
      </section>

      <section>
        <p>
          <strong>3. KONU</strong>
        </p>
        <p className="mt-2">
          İşbu sözleşme, ALICI&apos;nın {LEGAL_WEBSITE} internet sitesi üzerinden elektronik ortamda sipariş verdiği
          aşağıda nitelikleri ve satış fiyatı belirtilen ürünün satışı ve teslimi ile ilgili olarak tarafların hak ve
          yükümlülüklerini düzenler.
        </p>
        <p className="mt-2">
          Listelenen ve sitede ilan edilen fiyatlar satış fiyatıdır. İlan edilen fiyatlar ve vaatler güncelleme yapılana
          ve değiştirilene kadar geçerlidir. Süreli olarak ilan edilen fiyatlar ise belirtilen süre sonuna kadar geçerlidir.
        </p>
      </section>

      <section>
        <p>
          <strong>4. SATICI BİLGİLERİ</strong>
        </p>
        <div className="mt-2 space-y-1">
          <p>Ünvanı: {LEGAL_SELLER_TITLE}</p>
          <p>Adres: {LEGAL_ADDRESS}</p>
          <p>Telefon: {LEGAL_PHONE}</p>
          <p>Faks: -</p>
          <p>E-posta: {LEGAL_EMAIL}</p>
          <p>Web Sitesi: {LEGAL_WEBSITE}</p>
        </div>
      </section>

      <section>
        <p>
          <strong>5. ALICI BİLGİLERİ</strong>
        </p>
        <div className="mt-2 space-y-1">
          <p>Teslim edilecek kişi: {safeBuyer.fullName}</p>
          <p>Teslimat Adresi: {safeBuyer.address}</p>
          <p>Telefon: {safeBuyer.phone}</p>
          <p>E-posta / kullanıcı adı: {safeBuyer.email}</p>
        </div>
      </section>

      <section>
        <p>
          <strong>6. SİPARİŞ VEREN KİŞİ BİLGİLERİ</strong>
        </p>
        <div className="mt-2 space-y-1">
          <p>Ad / Soyad / Ünvan: {safeOrderer.fullName}</p>
          <p>Adres: {safeOrderer.address}</p>
          <p>Telefon: {safeOrderer.phone}</p>
          <p>E-posta / kullanıcı adı: {safeOrderer.email}</p>
        </div>
      </section>

      <section>
        <p>
          <strong>7. SÖZLEŞME KONUSU ÜRÜN / ÜRÜNLER BİLGİLERİ</strong>
        </p>
        <p className="mt-2">
          7.1. Malın / ürünlerin temel özellikleri; türü, miktarı, marka / modeli, rengi ve adedi ile birlikte sitede
          yayınlanmaktadır. Satıcı tarafından kampanya düzenlenmiş ise ilgili ürünün temel özellikleri kampanya süresince
          incelenebilir.
        </p>
        <p className="mt-2">
          7.2. Listelenen ve sitede ilan edilen fiyatlar satış fiyatıdır. Tüm fiyatlar aksi belirtilmedikçe KDV dahildir.
        </p>
        <p className="mt-2">
          7.3. Sözleşme konusu mal ya da hizmetin tüm vergiler dahil satış fiyatı aşağıda gösterilmiştir.
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Ürün Açıklaması</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Adet</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Birim Fiyatı</th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">Ara Toplam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {normalizedItems.length > 0 ? (
                normalizedItems.map((item) => (
                  <tr key={`${item.name}-${item.quantity}-${item.unitPrice}`}>
                    <td className="px-3 py-3">{item.name}</td>
                    <td className="px-3 py-3">{item.quantity}</td>
                    <td className="px-3 py-3">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-3">{formatCurrency(item.unitPrice * item.quantity)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-3 py-3" colSpan={4}>
                    Sipariş kalemleri ödeme adımında otomatik olarak bu alana yansıtılır.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 space-y-1">
          <p>Kargo Tutarı: {formatCurrency(shippingCost)}</p>
          <p>Toplam: {formatCurrency(resolvedTotal)}</p>
        </div>
      </section>

      <section>
        <p>
          <strong>8. FATURA BİLGİLERİ</strong>
        </p>
        <div className="mt-2 space-y-1">
          <p>Ad / Soyad / Ünvan: {safeInvoice.fullName}</p>
          <p>Adres: {safeInvoice.address}</p>
          <p>Telefon: {safeInvoice.phone}</p>
          <p>E-posta / kullanıcı adı: {safeInvoice.email}</p>
          <p>Fatura teslim: E-Arşiv fatura sipariş sonrası elektronik olarak paylaşılır.</p>
        </div>
      </section>

      <section>
        <p>
          <strong>9. GENEL HÜKÜMLER</strong>
        </p>
        <p className="mt-2">
          9.1. ALICI, {LEGAL_WEBSITE} internet sitesinde sözleşme konusu ürünün temel nitelikleri, satış fiyatı, ödeme
          şekli ve teslimata ilişkin ön bilgileri okuyup bilgi sahibi olduğunu, elektronik ortamda gerekli teyidi verdiğini
          kabul, beyan ve taahhüt eder.
        </p>
        <p className="mt-2">
          9.2. Sözleşme konusu her bir ürün, yasal 30 günlük süreyi aşmamak kaydıyla, ALICI&apos;nın yerleşim yeri
          uzaklığına bağlı olarak sipariş öncesi bilgilendirme alanında belirtilen süre içinde teslim edilir.
        </p>
      </section>

      <section>
        <p>
          <strong>10. CAYMA HAKKI</strong>
        </p>
        <p className="mt-2">
          ALICI, mesafeli sözleşmenin mal satışına ilişkin olması durumunda, ürünün kendisine veya gösterdiği adresteki
          kişi / kuruluşa teslim tarihinden itibaren 14 gün içerisinde, SATICI&apos;ya bildirmek şartıyla hiçbir gerekçe
          göstermeksizin malı reddederek sözleşmeden cayma hakkını kullanabilir.
        </p>
      </section>

      <section>
        <p>
          <strong>11. CAYMA HAKKI KULLANILAMAYACAK ÜRÜNLER</strong>
        </p>
        <p className="mt-2">
          ALICI&apos;nın isteği veya açıkça kişisel ihtiyaçları doğrultusunda hazırlanan ürünler, hijyen açısından iadesi
          uygun olmayan ürünler, tek kullanımlık ürünler ve tekrar satışı mümkün olmayan ürünler cayma hakkı kapsamı dışında
          değerlendirilebilir.
        </p>
      </section>

      <section>
        <p>
          <strong>12. TEMERRÜT HALİ VE HUKUKİ SONUÇLARI</strong>
        </p>
        <p className="mt-2">
          ALICI, ödeme işlemlerini kredi kartı ile yaptığı durumda temerrüde düştüğü takdirde, kart sahibi banka ile
          arasındaki kredi kartı sözleşmesi çerçevesinde faiz ödeyeceğini ve bankaya karşı sorumlu olacağını kabul, beyan
          ve taahhüt eder.
        </p>
      </section>

      <section>
        <p>
          <strong>13. YETKİLİ MAHKEME</strong>
        </p>
        <p className="mt-2">
          İşbu sözleşmeden doğan uyuşmazlıklarda şikayet ve itirazlar, tüketicinin yerleşim yerinin bulunduğu veya tüketici
          işleminin yapıldığı yerdeki tüketici hakem heyetine veya tüketici mahkemesine yapılacaktır.
        </p>
      </section>

      <section>
        <p>
          <strong>14. YÜRÜRLÜK</strong>
        </p>
        <p className="mt-2">
          ALICI, site üzerinden verdiği siparişe ait ödemeyi gerçekleştirdiğinde işbu sözleşmenin tüm şartlarını kabul etmiş
          sayılır.
        </p>
      </section>
    </div>
  );
}
