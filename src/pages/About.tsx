import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function About() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      const elements = section.querySelectorAll('.animate-in');
      gsap.fromTo(
        elements,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          scrollTrigger: {
            trigger: section,
            start: 'top 70%',
            toggleActions: 'play none none reverse',
          },
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
      <div ref={sectionRef} className="w-full px-4 md:px-8 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-light mb-12 animate-in">Hikayemiz</h1>

        <div className="space-y-8 text-base md:text-lg text-gray-600 leading-relaxed">
          <p className="animate-in">
            StilBags&Fashion, günlük yaşamda şıklık ve işlevselliği bir araya getirme fikriyle doğdu.
            Koleksiyonlarımızı; modern şehir hayatına uyum sağlayan, uzun süre keyifle kullanılabilen ve
            zamansız çizgisini koruyan parçalar oluşturmak için hazırlıyoruz.
          </p>

          <div className="py-8 animate-in">
            <img src="/banner1.jpg" alt="StilBags&Fashion" className="w-full h-[40vh] md:h-[50vh] object-cover rounded-lg" />
          </div>

          <p className="animate-in">
            Her StilBags&Fashion çantası; kullanım kolaylığı, dengeli oranlar ve temiz tasarım dili düşünülerek
            şekillenir. Bizim için bir çanta yalnızca bir aksesuar değil, günün farklı anlarına eşlik eden güvenilir
            bir parçadır.
          </p>

          <h2 className="text-xl md:text-2xl font-medium text-gray-900 mt-12 mb-6 animate-in">Özenli Tasarım</h2>

          <p className="animate-in">
            Koleksiyonlarımızda sade çizgileri, dengeli detayları ve güçlü malzeme hissini ön planda tutuyoruz.
            Her modelde amaç; hem günlük kullanımda rahat hissettiren hem de stilinizi tamamlayan bir denge kurmak.
          </p>

          <p className="animate-in">
            Trendlerin hızla değiştiği bir dünyada, uzun ömürlü bir görünüme sahip ürünler tasarlamayı önemsiyoruz.
            Bu yüzden StilBags&Fashion seçkisi; zamansız, kombinlemesi kolay ve farklı anlara uyum sağlayan parçalardan oluşur.
          </p>

          <h2 className="text-xl md:text-2xl font-medium text-gray-900 mt-12 mb-6 animate-in">Günlük Hayata Uyum</h2>

          <p className="animate-in">
            İster yoğun bir iş günü, ister kısa bir şehir gezisi, ister planlı bir akşam buluşması olsun;
            çantalarımızın hafif, kullanışlı ve stil sahibi bir eşlikçi olmasını istiyoruz.
          </p>

          <p className="animate-in">
            StilBags&Fashion dünyasının bir parçası olduğunuz için teşekkür ederiz. Koleksiyonumuzu keşfederken
            size en iyi eşlik edecek modeli bulmanızı dileriz.
          </p>
        </div>

        <div className="mt-16 pt-16 border-t border-gray-200 animate-in">
          <div className="grid grid-cols-1 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-light text-gray-900 mb-2">2026</p>
              <p className="text-sm text-gray-500">Kuruluş</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
