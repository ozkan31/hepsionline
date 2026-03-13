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
      gsap.fromTo(elements,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
          scrollTrigger: {
            trigger: section,
            start: 'top 70%',
            toggleActions: 'play none none reverse'
          }
        }
      );
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F7F4] pt-20 md:pt-24 pb-20">
      <div ref={sectionRef} className="w-full px-4 md:px-8 max-w-3xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-light mb-12 animate-in">
          Hikayemiz
        </h1>

        <div className="space-y-8 text-base md:text-lg text-gray-600 leading-relaxed">
          <p className="animate-in">
            StilBags&Fashion, zarafetin konforla buluþtuðu bir inançtan doðdu. Paris'in kalbinde kurulan
            markamýz, sizinle birlikte hareket eden çantalar yaratýyor - kalabalýk þehir sokaklarýnda,
            sessiz kafe köþelerinde ve aradaki her anýnýzda.
          </p>

          <div className="py-8 animate-in">
            <img 
              src="/banner1.jpg" 
              alt="StilBags&Fashion" 
              className="w-full h-[40vh] md:h-[50vh] object-cover rounded-lg"
            />
          </div>

          <p className="animate-in">
            Her StilBags&Fashion çantasý modern kadýn düþünülerek özenle tasarlanýr. Sadeliðin gücüne
            inanýyoruz - temiz çizgiler, kaliteli malzemeler ve kusursuz iþçilik. Çantalarýmýz
            sadece aksesuar deðil, günlük yolculuðunuzun yoldaþlarýdýr.
          </p>

          <h2 className="text-xl md:text-2xl font-medium text-gray-900 mt-12 mb-6 animate-in">
            Özenle Üretilmiþ
          </h2>

          <p className="animate-in">
            Mükemmelliðe olan baðlýlýðýmýzý paylaþan yetenekli zanaatkârlarla çalýþýyoruz. Her dikiþ,
            her dikiþ hattý, her detay özenle düþünülüyor. Avrupa'nýn dört bir yanýndan güvenilir
            tedarikçilerden sadece en kaliteli deri ve malzemeleri kullanýyoruz.
          </p>

          <p className="animate-in">
            Tasarým felsefemiz Paris zarafetine kök salýyor - abartýsýz, kendinden emin ve zamansýz.
            Mevsimleri ve trendleri aþan parçalar yaratýyoruz, zamanla daha da güzelleþen çantalar.
          </p>

          <h2 className="text-xl md:text-2xl font-medium text-gray-900 mt-12 mb-6 animate-in">
            Zarafetle Hareket Edin
          </h2>

          <p className="animate-in">
            Ýster yoðun bir iþ günü, ister yeni bir þehir keþfi, ister keyifli bir hafta sonu olsun,
            StilBags&Fashion yanýnýzda olmak için tasarlandý - hafif, konforlu ve þýk.
          </p>

          <p className="animate-in">
            Hikayemizin bir parçasý olduðunuz için teþekkür ederiz. Koleksiyonu keþfetmenizi ve
            mükemmel yoldaþýnýzý bulmanýzý dileriz.
          </p>
        </div>

        <div className="mt-16 pt-16 border-t border-gray-200 animate-in">
          <div className="grid grid-cols-1 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-light text-gray-900 mb-2">2026</p>
              <p className="text-sm text-gray-500">Kuruluþ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


