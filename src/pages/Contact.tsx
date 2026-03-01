import { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
      <div className="w-full px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light mb-4">
            İletişime Geçin
          </h1>
          <p className="text-gray-600 mb-12 max-w-xl">
            Sizden haber almayı çok isteriz. Ürünlerimiz hakkında sorularınız, sipariş 
            yardımı veya sadece merhaba demek için bize ulaşabilirsiniz.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Ad Soyad</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">E-posta</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Konu</label>
                  <input
                    type="text"
                    required
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Mesaj</label>
                  <textarea
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitted}
                  className="w-full bg-black text-white py-4 rounded-full font-medium text-sm hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitted ? (
                    <>Mesaj Gönderildi!</>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Mesaj Gönder
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Contact Info */}
            <div className="md:pl-8">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium mb-4">E-posta</h3>
                  <a 
                    href="mailto:info@parismove.com.tr"
                    className="flex items-center gap-3 text-gray-600 hover:text-black transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                    info@parismove.com.tr
                  </a>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Telefon</h3>
                  <a 
                    href="tel:+902121234567"
                    className="flex items-center gap-3 text-gray-600 hover:text-black transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                    +90 212 123 45 67
                  </a>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Adres</h3>
                  <div className="flex items-start gap-3 text-gray-600">
                    <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p>Nişantaşı Mah. Abdi İpekçi Cad. No: 45</p>
                      <p>Şişli / İstanbul</p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-medium mb-4">Müşteri Hizmetleri Saatleri</h3>
                  <div className="space-y-2 text-gray-600">
                    <p>Pazartesi - Cuma: 09:00 - 18:00</p>
                    <p>Cumartesi: 10:00 - 16:00</p>
                    <p>Pazar: Kapalı</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
