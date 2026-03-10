import { useState } from 'react';
import { Mail, Phone, MapPin, Send } from 'lucide-react';
import { submitContactRequest } from '@/lib/api';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitted(true);
    try {
      await submitContactRequest(formData);
      setFormData({ name: '', email: '', subject: '', message: '' });
      setSuccessMessage("Mesajınız başarıyla gönderildi.");
      setTimeout(() => {
        setIsSubmitted(false);
        setSuccessMessage("");
      }, 2000);
    } catch (error) {
      setIsSubmitted(false);
      setErrorMessage(error instanceof Error ? error.message : "Mesaj gönderilemedi.");
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
      <div className="w-full px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-light mb-4">İletişime Geçin</h1>
          <p className="text-gray-600 mb-12 max-w-xl">
            Sizden haber almayı çok isteriz. Ürünlerimiz hakkında sorularınız, sipariş yardımı veya sadece merhaba
            demek için bize ulaşabilirsiniz.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <form onSubmit={handleSubmit} className="space-y-4" autoComplete="on">
                {successMessage && (
                  <p className="text-sm text-green-700 bg-green-50 rounded p-3">{successMessage}</p>
                )}
                {errorMessage && (
                  <p className="text-sm text-red-600 bg-red-50 rounded p-3">{errorMessage}</p>
                )}
                <div>
                  <label className="block text-sm font-medium mb-2">Ad Soyad</label>
                  <input
                    type="text"
                    required
                    name="name"
                    autoComplete="name"
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
                    name="email"
                    autoComplete="email"
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
                    name="subject"
                    autoComplete="off"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Mesaj</label>
                  <textarea
                    required
                    name="message"
                    autoComplete="off"
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

            <div className="md:pl-8">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-medium mb-4">E-posta</h3>
                  <a
                    href="mailto:destek@stilbagsfashion.com"
                    className="flex items-center gap-3 text-gray-600 hover:text-black transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                    destek@stilbagsfashion.com
                  </a>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Telefon</h3>
                  <a
                    href="tel:+905369536886"
                    className="flex items-center gap-3 text-gray-600 hover:text-black transition-colors"
                  >
                    <Phone className="w-5 h-5" />
                    0536 953 68 86
                  </a>
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">Adres</h3>
                  <div className="flex items-start gap-3 text-gray-600">
                    <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p>Kuletepe Mahallesi 4858. Sokak No: 8</p>
                      <p>Hatay / Reyhanlı</p>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-gray-200">
                  <h3 className="text-lg font-medium mb-4">Müşteri Hizmetleri Saatleri</h3>
                  <div className="space-y-2 text-gray-600">
                    <p>7/24 10:00 - 18:00</p>
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
