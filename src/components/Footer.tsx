import { Link } from 'react-router-dom';
import { Instagram } from 'lucide-react';
import { useEffect, useState } from 'react';
import { fetchPublicSettings } from '@/lib/api';

export function Footer() {
  const [siteName, setSiteName] = useState('StilBags&Fashion');

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
    <footer className="w-full bg-black text-white py-12 md:py-16 overflow-x-hidden">
      <div className="w-full px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 py-12">
            {/* Müşteri Hizmetleri */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-white/50 mb-4">Müşteri Hizmetleri</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/yardim-merkezi" className="text-sm text-white/80 hover:text-white transition-colors">
                    Yardım Merkezi
                  </Link>
                </li>
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
                    href="https://www.instagram.com/stilbagsfashion?igsh=ZWtrZ2RuYjQ2eWZ2"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/80 hover:text-white transition-colors flex items-center gap-2"
                  >
                    <Instagram className="w-4 h-4" />
                    Instagram
                  </a>
                </li>
              </ul>
            </div>

            {/* İletişim */}
            <div>
              <h4 className="text-xs uppercase tracking-wider text-white/50 mb-4">İletişim</h4>
              <ul className="space-y-3">
                <li className="text-sm text-white/80 break-all">
                  destek@stilbagsfashion.com
                </li>
                <li className="text-sm text-white/80">
                  0536 953 68 86
                </li>
                <li className="text-sm text-white/80">
                  Kuletepe Mahallesi 4858. Sokak No: 8<br />
                  Hatay / Reyhanlı
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
              © 2026 {siteName}. Tüm hakları saklıdır.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}


