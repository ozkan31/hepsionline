import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft, FileText, HelpCircle, Home, LifeBuoy, PackageSearch, RotateCcw, Search, Truck } from 'lucide-react';

const HELP_EMAIL = 'destek@stilbagsfashion.com';
const HELP_PHONE = '0536 953 68 86';

function SupportLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-24 pb-16">
      <div className="w-full px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-[28px] border border-[#E6DFD4] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.95),_rgba(248,247,244,0.98))] p-6 md:p-10 shadow-[0_18px_60px_rgba(0,0,0,0.06)]">
            <p className="text-[11px] uppercase tracking-[0.35em] text-gray-500">{eyebrow}</p>
            <h1 className="mt-4 max-w-3xl font-serif text-3xl md:text-5xl leading-tight text-black">{title}</h1>
            <p className="mt-4 max-w-2xl text-sm md:text-base leading-7 text-gray-600">{description}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLinkCard({
  to,
  icon,
  title,
  description,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-[#E7E2D8] bg-white px-5 py-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-black hover:shadow-[0_12px_30px_rgba(0,0,0,0.08)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F3EFE7] text-black transition-colors group-hover:bg-black group-hover:text-white">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-medium text-black">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
        </div>
      </div>
    </Link>
  );
}

export function HelpCenterPage() {
  return (
    <SupportLayout
      eyebrow="Yardım Merkezi"
      title="Sipariş, teslimat ve hesap işlemlerinde size hızlıca yol gösterelim."
      description="Sık sorulan sorular, kargo, iade ve sipariş takibi gibi en çok ihtiyaç duyulan alanları tek yerde topladık. Aradığınız konu burada yoksa doğrudan bize ulaşabilirsiniz."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <QuickLinkCard
          to="/sss"
          icon={<HelpCircle className="h-5 w-5" />}
          title="Sık Sorulan Sorular"
          description="Sipariş, ödeme ve üyelik süreçlerinde en çok sorulan soruların yanıtlarını görün."
        />
        <QuickLinkCard
          to="/kargo"
          icon={<Truck className="h-5 w-5" />}
          title="Kargo Bilgileri"
          description="Hazırlık süresi, teslimat akışı ve gönderi detaylarını inceleyin."
        />
        <QuickLinkCard
          to="/iade"
          icon={<RotateCcw className="h-5 w-5" />}
          title="Teslimat ve İade"
          description="Teslimat akışı, cayma hakkı, iade koşulları ve destek süreci hakkında bilgi alın."
        />
        <QuickLinkCard
          to="/mesafeli-satis-sozlesmesi"
          icon={<FileText className="h-5 w-5" />}
          title="Mesafeli Satış Sözleşmesi"
          description="Sipariş öncesi sözleşme metnini, taraf bilgilerini ve cayma koşullarını inceleyin."
        />
        <QuickLinkCard
          to="/hesabim"
          icon={<PackageSearch className="h-5 w-5" />}
          title="Siparişlerim"
          description="Hesabınıza girip sipariş durumunuzu, kargo takibini ve geçmiş işlemleri görüntüleyin."
        />
        <QuickLinkCard
          to="/shop"
          icon={<Search className="h-5 w-5" />}
          title="Ürünlere Dön"
          description="Aradığınız ürün sayfasına dönmek veya yeni ürünleri keşfetmek için mağazayı açın."
        />
        <QuickLinkCard
          to="/iletisim"
          icon={<LifeBuoy className="h-5 w-5" />}
          title="Canlı Destek ve İletişim"
          description="Bize e-posta veya telefon üzerinden ulaşıp doğrudan destek alın."
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-[#E7E2D8] bg-white px-5 py-5">
          <h2 className="text-lg font-medium text-black">En hızlı çözüm için</h2>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
            <li>Hesabınıza giriş yaptıktan sonra <strong>Hesabım</strong> alanından sipariş durumunu ve kargo linkini görüntüleyin.</li>
            <li>Gönderiniz kargoya verildiyse sipariş kartında doğrudan <strong>Kargo Takip</strong> butonu görünür.</li>
            <li>Ürün, iade veya ödeme konusunda takıldığınız noktada bize kısa bir mesaj bırakmanız yeterlidir.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-black bg-black px-5 py-5 text-white">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/60">Destek</p>
          <h2 className="mt-3 text-xl font-medium">Bizimle doğrudan iletişime geçin</h2>
          <p className="mt-3 text-sm leading-6 text-white/75">
            Siparişinizde özel bir durum varsa doğrudan ekibimize ulaşabilirsiniz.
          </p>
          <div className="mt-5 space-y-2 text-sm">
            <p>{HELP_EMAIL}</p>
            <p>{HELP_PHONE}</p>
          </div>
          <Link
            to="/iletisim"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-[#F1ECE2]"
          >
            <ArrowLeft className="h-4 w-4 rotate-[135deg]" />
            İletişim Sayfasını Aç
          </Link>
        </div>
      </div>
    </SupportLayout>
  );
}

export function NotFoundPage() {
  const location = useLocation();
  const missingPath = `${location.pathname}${location.search || ''}`.trim() || '/';

  return (
    <SupportLayout
      eyebrow="404"
      title="Aradığınız sayfayı bulamadık."
      description="Bağlantı eski olabilir, sayfa taşınmış olabilir ya da adres yanlış yazılmış olabilir. Hızlıca doğru sayfaya dönebilmeniz için en faydalı yolları aşağıya bıraktık."
    >
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-[#E7E2D8] bg-white px-5 py-5">
          <p className="text-[11px] uppercase tracking-[0.3em] text-gray-500">İstenen Adres</p>
          <p className="mt-3 break-all rounded-2xl bg-[#F6F2EA] px-4 py-3 font-mono text-sm text-gray-700">
            {missingPath}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-[#1D1D1D]"
            >
              <Home className="h-4 w-4" />
              Ana Sayfaya Dön
            </Link>
            <Link
              to="/yardim-merkezi"
              className="inline-flex items-center gap-2 rounded-full border border-[#D3CCBE] bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:border-black"
            >
              <LifeBuoy className="h-4 w-4" />
              Yardım Merkezi
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <QuickLinkCard
            to="/shop"
            icon={<Search className="h-5 w-5" />}
            title="Mağazayı Aç"
            description="Ürünlere ve kategorilere yeniden dönün."
          />
          <QuickLinkCard
            to="/hesabim"
            icon={<PackageSearch className="h-5 w-5" />}
            title="Siparişlerimi Gör"
            description="Kargo veya siparişiniz için hesabınıza geçin."
          />
          <QuickLinkCard
            to="/iletisim"
            icon={<HelpCircle className="h-5 w-5" />}
            title="Destek Al"
            description="Doğrudan bize ulaşıp doğru bağlantıyı isteyin."
          />
        </div>
      </div>
    </SupportLayout>
  );
}
