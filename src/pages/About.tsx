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
            Paris Move, zarafetin konforla buluştuğu bir inançtan doğdu. Paris'in kalbinde kurulan 
            markamız, sizinle birlikte hareket eden çantalar yaratıyor - kalabalık şehir sokaklarında, 
            sessiz kafe köşelerinde ve aradaki her anınızda.
          </p>

          <div className="py-8 animate-in">
            <img 
              src="/banner1.jpg" 
              alt="Paris Move" 
              className="w-full h-[40vh] md:h-[50vh] object-cover rounded-lg"
            />
          </div>

          <p className="animate-in">
            Her Paris Move çantası modern kadın düşünülerek özenle tasarlanır. Sadeliğin gücüne 
            inanıyoruz - temiz çizgiler, kaliteli malzemeler ve kusursuz işçilik. Çantalarımız 
            sadece aksesuar değil, günlük yolculuğunuzun yoldaşlarıdır.
          </p>

          <h2 className="text-xl md:text-2xl font-medium text-gray-900 mt-12 mb-6 animate-in">
            Özenle Üretilmiş
          </h2>

          <p className="animate-in">
            Mükemmelliğe olan bağlılığımızı paylaşan yetenekli zanaatkârlarla çalışıyoruz. Her dikiş, 
            her dikiş hattı, her detay özenle düşünülüyor. Avrupa'nın dört bir yanından güvenilir 
            tedarikçilerden sadece en kaliteli deri ve malzemeleri kullanıyoruz.
          </p>

          <p className="animate-in">
            Tasarım felsefemiz Paris zarafetine kök salıyor - abartısız, kendinden emin ve zamansız. 
            Mevsimleri ve trendleri aşan parçalar yaratıyoruz, zamanla daha da güzelleşen çantalar.
          </p>

          <h2 className="text-xl md:text-2xl font-medium text-gray-900 mt-12 mb-6 animate-in">
            Zarafetle Hareket Edin
          </h2>

          <p className="animate-in">
            İster yoğun bir iş günü, ister yeni bir şehir keşfi, ister keyifli bir hafta sonu olsun, 
            Paris Move yanınızda olmak için tasarlandı - hafif, konforlu ve şık.
          </p>

          <p className="animate-in">
            Hikayemizin bir parçası olduğunuz için teşekkür ederiz. Koleksiyonu keşfetmenizi ve 
            mükemmel yoldaşınızı bulmanızı dileriz.
          </p>
        </div>

        <div className="mt-16 pt-16 border-t border-gray-200 animate-in">
          <div className="grid grid-cols-3 gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-light text-gray-900 mb-2">2018</p>
              <p className="text-sm text-gray-500">Kuruluş</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-light text-gray-900 mb-2">50K+</p>
              <p className="text-sm text-gray-500">Mutlu Müşteri</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-light text-gray-900 mb-2">12</p>
              <p className="text-sm text-gray-500">Ülkeye Gönderim</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
