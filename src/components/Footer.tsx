import { Link } from 'react-router-dom';
import { Instagram, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchPublicSettings } from '@/lib/api';

export function Footer() {
  const [siteName, setSiteName] = useState('Paris move');

  useEffect(() => {
    let mounted = true;
    fetchPublicSettings()
      .then((data) => {
        if (!mounted) return;
        const name = String(data?.siteName ?? '').trim();
        if (name) setSiteName(name);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <footer className="bg-black text-white py-12 md:py-16">
      <div className="w-full px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Newsletter */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-12 border-b border-white/20">
            <div>
              <h3 className="text-xl md:text-2xl font-light mb-2">
                Bültenimize Katılın
              </h3>
              <p className="text-sm text-white/60">
                Yeni ürünler ve özel indirimlerden ilk siz haberdar olun.
              </p>
            </div>
            <form className="flex w-full md:w-auto gap-3" onSubmit={(e) => e.preventDefault()}>
              <input
                type="email"
                placeholder="E-posta adresiniz"
                className="flex-1 md:w-64 bg-transparent border-b border-white/30 focus:border-white text-white placeholder:text-white/40 py-3 outline-none text-sm"
              />
              <button
                type="submit"
                className="bg-white text-black px-6 py-3 rounded-full text-sm font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12">
            {/* Müşteri Hizmetleri */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-white/50 mb-4">Müşteri Hizmetleri</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/iletisim" className="text-sm text-white/80 hover:text-white transition-colors">
                    İletişim
                  </Link>
                </li>
                <li>
                  <Link to="/kargo" className="text-sm text-white/80 hover:text-white transition-colors">
                    Kargo Bilgileri
                  </Link>
                </li>
                <li>
                  <Link to="/iade" className="text-sm text-white/80 hover:text-white transition-colors">
                    İade Politikası
                  </Link>
                </li>
                <li>
                  <Link to="/sss" className="text-sm text-white/80 hover:text-white transition-colors">
                    SSS
                  </Link>
                </li>
              </ul>
            </div>

            {/* Hakkımızda */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-white/50 mb-4">Hakkımızda</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/hakkimizda" className="text-sm text-white/80 hover:text-white transition-colors">
                    Hikayemiz
                  </Link>
                </li>
                <li>
                  <Link to="/surdurulebilirlik" className="text-sm text-white/80 hover:text-white transition-colors">
                    Sürdürülebilirlik
                  </Link>
                </li>
                <li>
                  <Link to="/kariyer" className="text-sm text-white/80 hover:text-white transition-colors">
                    Kariyer
                  </Link>
                </li>
              </ul>
            </div>

            {/* Sosyal Medya */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-white/50 mb-4">Bizi Takip Edin</h4>
              <ul className="space-y-3">
                <li>
                  <a 
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/80 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Instagram className="w-4 h-4" />
                    Instagram
                  </a>
                </li>
                <li>
                  <a 
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/80 hover:text-white transition-colors"
                  >
                    Facebook
                  </a>
                </li>
                <li>
                  <a 
                    href="https://pinterest.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/80 hover:text-white transition-colors"
                  >
                    Pinterest
                  </a>
                </li>
              </ul>
            </div>

            {/* İletişim */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-white/50 mb-4">İletişim</h4>
              <ul className="space-y-3">
                <li className="text-sm text-white/80">
                  info@parismove.com.tr
                </li>
                <li className="text-sm text-white/80">
                  +90 212 123 45 67
                </li>
                <li className="text-sm text-white/80">
                  Nişantaşı Mah.<br />
                  Şişli / İstanbul
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-8 border-t border-white/10">
            <div className="flex gap-6">
              <Link to="/gizlilik" className="text-xs text-white/50 hover:text-white transition-colors">
                Gizlilik Politikası
              </Link>
              <Link to="/kullanim-kosullari" className="text-xs text-white/50 hover:text-white transition-colors">
                Kullanım Koşulları
              </Link>
            </div>
            <p className="font-serif text-lg">
              {siteName}
            </p>
            <p className="text-xs text-white/50">
              © 2024 {siteName}. Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

