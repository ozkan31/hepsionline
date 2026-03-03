const BRAND = "StilBags&fashion";
const PHONE = "0536 953 68 86";
const EMAIL = "destek@stilbagsfashion.com";
const ADDRESS = "Kuletepe Mahallesi 4858. Sokak No: 8 Hatay/Reyhanlı";

function InfoLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-16">
      <div className="w-full px-4 md:px-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl border border-gray-200 p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-light mb-6">{title}</h1>
          <div className="space-y-6 text-sm md:text-base text-gray-700 leading-7">{children}</div>
        </div>
      </div>
    </div>
  );
}

export function CargoInfoPage() {
  return (
    <InfoLayout title="Kargo Bilgileri">
      <p>
        {BRAND} üzerinden verilen siparişler, ödeme onayı sonrası hazırlık sürecine alınır. Hazırlık tamamlandığında
        siparişiniz anlaşmalı kargo firmasına teslim edilir ve takip bilgisi tarafınıza iletilir.
      </p>
      <p>
        Siparişlerin kargoya teslim süresi dönemsel yoğunluk, resmi tatil günleri, kampanya dönemleri ve olumsuz hava
        koşulları gibi nedenlerle değişiklik gösterebilir. Bu gibi durumlarda süreçle ilgili bilgilendirme yapılır.
      </p>
      <p>
        Teslimat sırasında pakette ezilme, yırtılma veya açılma gibi bir hasar fark etmeniz halinde, kargo görevlisi
        yanında tutanak tutturmanız önerilir. Tutanaklı bildirimler, inceleme ve çözüm sürecinin daha hızlı ilerlemesini
        sağlar.
      </p>
      <p>
        Kargo ve teslimatla ilgili tüm sorularınız için bizimle iletişime geçebilirsiniz: {EMAIL} / {PHONE}
      </p>
    </InfoLayout>
  );
}

export function ReturnPolicyPage() {
  return (
    <InfoLayout title="İade Politikası">
      <p>
        {BRAND} üzerinden oluşturduğunuz siparişlerde, ürünün tarafınıza teslim edilmesinden itibaren <strong>14 gün</strong>{" "}
        içinde iade talebi oluşturabilirsiniz.
      </p>
      <p>
        İade edilecek ürünlerin kullanılmamış, yeniden satılabilir durumda, hasarsız ve eksiksiz olması gerekir.
        Ürünün varsa orijinal kutusu, ambalajı, etiketleri ve birlikte gönderilen tüm aksesuarları ile birlikte
        gönderilmesi beklenir.
      </p>
      <p>
        Kullanım izi bulunan, hijyen açısından uygun olmayan, kişiye özel hazırlanan veya tekrar satışı mümkün olmayan
        ürünlerde iade kabul edilmeyebilir. İade sürecinde nihai değerlendirme, ürünün depomuza ulaşmasının ardından
        yapılır.
      </p>
      <p>
        İade talebiniz onaylandıktan sonra ücret iadesi, ödeme yöntemine bağlı olarak bankanızın süreçlerine göre
        belirli bir süre içinde hesabınıza yansıtılır. İade süreci hakkında destek almak için: {EMAIL} / {PHONE}
      </p>
    </InfoLayout>
  );
}

export function FaqPage() {
  return (
    <InfoLayout title="Sık Sorulan Sorular (SSS)">
      <div>
        <p className="font-medium text-black mb-1">Siparişim ne zaman kargoya verilir?</p>
        <p>
          Siparişler, ödeme onayı sonrası hazırlanır ve en kısa sürede kargo firmasına teslim edilir. Yoğun dönemlerde
          bu süre uzayabilir.
        </p>
      </div>
      <div>
        <p className="font-medium text-black mb-1">İade süresi kaç gündür?</p>
        <p>Teslimattan itibaren 14 gün içinde iade talebinde bulunabilirsiniz.</p>
      </div>
      <div>
        <p className="font-medium text-black mb-1">Siparişime ait durum bilgisini nereden görebilirim?</p>
        <p>
          Üye girişi yaptıktan sonra hesabınız altındaki ilgili alanlardan sipariş durumunu ve varsa kargo takip
          bilgisini görüntüleyebilirsiniz.
        </p>
      </div>
      <div>
        <p className="font-medium text-black mb-1">Bize nasıl ulaşabilirim?</p>
        <p>
          E-posta: {EMAIL} | Telefon: {PHONE}
        </p>
      </div>
    </InfoLayout>
  );
}

export function PrivacyPolicyPage() {
  return (
    <InfoLayout title="Gizlilik Politikası">
      <p>
        Bu politika, {BRAND} tarafından sunulan hizmetler kapsamında kullanıcı verilerinin nasıl toplandığını, işlendiğini,
        saklandığını ve korunduğunu açıklamak amacıyla hazırlanmıştır.
      </p>
      <p>
        Site kullanımı ve sipariş süreçlerinde ad-soyad, e-posta adresi, telefon numarası, teslimat adresi, sipariş
        bilgileri ve teknik kullanım verileri (ör. IP, cihaz bilgisi) işlenebilir. Bu veriler sipariş yönetimi, müşteri
        desteği, güvenlik ve hizmet kalitesini artırma amaçlarıyla kullanılır.
      </p>
      <p>
        Veriler, yasal yükümlülükler ve hizmet gereklilikleri kapsamında gerekli süre boyunca saklanır. Yetkisiz erişim,
        kayıp, kötüye kullanım ve hukuka aykırı işleme risklerine karşı uygun teknik ve idari önlemler uygulanır.
      </p>
      <p>
        Kullanıcılar; verilerine erişim, düzeltme, silme ve işleme faaliyetlerine ilişkin bilgi talebinde bulunma hakkına
        sahiptir. Bu kapsamda taleplerinizi {EMAIL} adresine iletebilirsiniz.
      </p>
      <p>İletişim adresi: {ADDRESS}</p>
    </InfoLayout>
  );
}

export function TermsPage() {
  return (
    <InfoLayout title="Kullanım Koşulları">
      <p>
        Bu siteyi ziyaret eden ve kullanan her kullanıcı, aşağıda belirtilen kullanım koşullarını kabul etmiş sayılır.
        {` ${BRAND}`}, site içeriği, ürün bilgileri, görseller ve hizmet şartlarında önceden bildirim yapmaksızın değişiklik
        yapma hakkını saklı tutar.
      </p>
      <p>
        Kullanıcı, üyelik bilgilerinin doğruluğundan ve hesap güvenliğinden sorumludur. Hesap bilgilerinin üçüncü kişiler
        ile paylaşılması durumunda doğabilecek sonuçlardan kullanıcı sorumludur.
      </p>
      <p>
        Site içeriğinin izinsiz kopyalanması, çoğaltılması, ticari amaçla kullanılması veya yanıltıcı şekilde paylaşılması
        yasaktır. Tespit edilmesi halinde yasal yollara başvurma hakkı saklıdır.
      </p>
      <p>
        Kullanıcı, siteyi hukuka ve genel ahlak kurallarına uygun şekilde kullanmayı kabul eder. Kötüye kullanım, sisteme
        zarar verme girişimi veya sahte işlem tespiti halinde ilgili hesaplar sınırlandırılabilir.
      </p>
      <p>
        Koşullar hakkında soru ve talepler için: {EMAIL} / {PHONE}
      </p>
    </InfoLayout>
  );
}

export function SustainabilityPage() {
  return (
    <InfoLayout title="Sürdürülebilirlik">
      <p>
        {BRAND}, üretim ve operasyon süreçlerinde kaynakların verimli kullanımını, atıkların azaltılmasını ve uzun ömürlü
        ürün yaklaşımını benimsemeyi hedefler.
      </p>
      <p>
        Ürün geliştirme sürecinde kalite ve dayanıklılık önceliklendirilir. Böylece daha uzun süre kullanılan ürünler ile
        gereksiz tüketimin azaltılması amaçlanır.
      </p>
      <p>
        Paketleme ve lojistik süreçlerinde daha verimli uygulamalar için düzenli iyileştirme çalışmaları yürütülür.
        Sürdürülebilirlik yaklaşımımız, zaman içinde güncellenen hedeflerle sürekli geliştirilir.
      </p>
    </InfoLayout>
  );
}

export function CareerPage() {
  return (
    <InfoLayout title="Kariyer">
      <p>
        {BRAND} ekibinde yer almak isterseniz özgeçmişinizi {EMAIL} adresine iletebilirsiniz.
      </p>
      <p>
        Başvurunuzda iletişim bilgilerinizi, ilgi duyduğunuz pozisyonu ve varsa ilgili deneyimlerinizi belirtmeniz,
        değerlendirme sürecinin daha hızlı ve sağlıklı ilerlemesini sağlar.
      </p>
      <p>
        Uygun görülen başvurular için tarafınıza geri dönüş sağlanır. Başvuru süreçlerinde paylaşılan kişisel veriler,
        yalnızca işe alım değerlendirmesi amacıyla işlenir.
      </p>
    </InfoLayout>
  );
}
