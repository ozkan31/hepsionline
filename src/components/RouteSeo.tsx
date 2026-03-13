import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { SEO_BRAND_NAME, SEO_DEFAULT_DESCRIPTION, getSiteOrigin, type SeoPayload } from "@/lib/seo";

const CATEGORY_LABELS: Record<string, string> = {
  crossbody: "Çapraz Çantalar",
  mini: "Mini Çantalar",
  shoulder: "Omuz Çantaları",
  new: "Yeni Gelenler",
};

function createBaseSchemas() {
  const baseUrl = getSiteOrigin();
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: SEO_BRAND_NAME,
      url: baseUrl,
      logo: `${baseUrl}/banner1.jpg`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SEO_BRAND_NAME,
      url: baseUrl,
      inLanguage: "tr-TR",
      potentialAction: {
        "@type": "SearchAction",
        target: `${baseUrl}/shop?search={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

function pageSchema(path: string, title: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    inLanguage: "tr-TR",
    url: `${getSiteOrigin()}${path}`,
  };
}

export function RouteSeo() {
  const location = useLocation();

  const seo = useMemo<SeoPayload | null>(() => {
    const pathname = location.pathname;
    const params = new URLSearchParams(location.search);
    const lowerPath = pathname.toLowerCase();

    if (lowerPath.startsWith("/product/")) {
      return null;
    }

    const baseSchemas = createBaseSchemas();
    const noindexPaths = new Set(["/giris", "/hesabim", "/sepet", "/favoriler", "/odeme", "/akalin1453"]);

    if (lowerPath === "/") {
      const title = `${SEO_BRAND_NAME} | Kadın Çanta ve Aksesuar Modelleri`;
      const description =
        "StilBags&Fashion ile modern, şık ve günlük kullanıma uygun kadın çanta modellerini keşfedin.";
      return {
        title,
        description,
        canonicalPath: "/",
        image: "/banner1.jpg",
        type: "website",
        schema: [...baseSchemas, pageSchema("/", title, description)],
      };
    }

    if (lowerPath === "/shop" || lowerPath === "/urunler") {
      const search = String(params.get("search") ?? "").trim();
      const category = String(params.get("category") ?? "").trim();
      const hasSort = params.has("sort");

      if (search) {
        const title = `"${search}" Arama Sonuçları | ${SEO_BRAND_NAME}`;
        return {
          title,
          description: "Arama sonuçlarını keşfedin. StilBags&Fashion ürünlerini kategori ve modele göre filtreleyin.",
          canonicalPath: "/shop",
          image: "/banner2.jpg",
          noindex: true,
          schema: [...baseSchemas, pageSchema("/shop", title, SEO_DEFAULT_DESCRIPTION)],
        };
      }

      if (category) {
        const categoryLabel = CATEGORY_LABELS[category] ?? "Ürünler";
        const title = `${categoryLabel} | ${SEO_BRAND_NAME}`;
        const description = `${categoryLabel} kategorisindeki seçili ürünleri StilBags&Fashion koleksiyonunda inceleyin.`;
        return {
          title,
          description,
          canonicalPath: `/shop?category=${encodeURIComponent(category)}`,
          image: "/banner2.jpg",
          noindex: hasSort,
          schema: [...baseSchemas, pageSchema(`/shop?category=${encodeURIComponent(category)}`, title, description)],
        };
      }

      const title = `Tüm Ürünler | ${SEO_BRAND_NAME}`;
      const description = "Kadın çanta ve aksesuar koleksiyonunun tamamını StilBags&Fashion ürünler sayfasında keşfedin.";
      return {
        title,
        description,
        canonicalPath: "/shop",
        image: "/banner2.jpg",
        noindex: hasSort,
        schema: [...baseSchemas, pageSchema("/shop", title, description)],
      };
    }

    const staticPages: Record<string, { title: string; description: string; canonical: string; image?: string }> = {
      "/hakkimizda": {
        title: `Hikayemiz | ${SEO_BRAND_NAME}`,
        description: "StilBags&Fashion markasının hikayesini, üretim yaklaşımını ve tasarım anlayışını keşfedin.",
        canonical: "/hakkimizda",
      },
      "/about": {
        title: `Hikayemiz | ${SEO_BRAND_NAME}`,
        description: "StilBags&Fashion markasının hikayesini, üretim yaklaşımını ve tasarım anlayışını keşfedin.",
        canonical: "/hakkimizda",
      },
      "/iletisim": {
        title: `İletişim | ${SEO_BRAND_NAME}`,
        description: "StilBags&Fashion müşteri destek ekibine ulaşın ve tüm soru, öneri ve taleplerinizi iletin.",
        canonical: "/iletisim",
      },
      "/contact": {
        title: `İletişim | ${SEO_BRAND_NAME}`,
        description: "StilBags&Fashion müşteri destek ekibine ulaşın ve tüm soru, öneri ve taleplerinizi iletin.",
        canonical: "/iletisim",
      },
      "/kargo": {
        title: `Kargo Bilgileri | ${SEO_BRAND_NAME}`,
        description: "Sipariş hazırlık, kargolama ve teslimat süreçleri hakkında detaylı bilgilere ulaşın.",
        canonical: "/kargo",
      },
      "/iade": {
        title: `İade Politikası | ${SEO_BRAND_NAME}`,
        description: "İade koşulları, iade süresi ve iade işlemleri hakkında bilmeniz gereken tüm detaylar.",
        canonical: "/iade",
      },
      "/sss": {
        title: `Sık Sorulan Sorular | ${SEO_BRAND_NAME}`,
        description: "Sipariş, ödeme, teslimat ve iade süreçlerine dair en çok sorulan soruların yanıtları.",
        canonical: "/sss",
      },
      "/gizlilik": {
        title: `Gizlilik Politikası | ${SEO_BRAND_NAME}`,
        description: "Kişisel verilerinizin işlenmesi, korunması ve saklanmasına ilişkin gizlilik politikamız.",
        canonical: "/gizlilik",
      },
      "/kullanim-kosullari": {
        title: `Kullanım Koşulları | ${SEO_BRAND_NAME}`,
        description: "Site kullanım koşulları, hak ve yükümlülükler ile hukuki bilgilendirme metinleri.",
        canonical: "/kullanim-kosullari",
      },
      "/surdurulebilirlik": {
        title: `Sürdürülebilirlik | ${SEO_BRAND_NAME}`,
        description: "StilBags&Fashion sürdürülebilirlik yaklaşımı ve sorumlu üretim anlayışını inceleyin.",
        canonical: "/surdurulebilirlik",
      },
      "/kariyer": {
        title: `Kariyer | ${SEO_BRAND_NAME}`,
        description: "StilBags&Fashion kariyer fırsatları ve başvuru süreçleri hakkında bilgi alın.",
        canonical: "/kariyer",
      },
    };

    const staticSeo = staticPages[lowerPath];
    if (staticSeo) {
      return {
        title: staticSeo.title,
        description: staticSeo.description,
        canonicalPath: staticSeo.canonical,
        image: staticSeo.image || "/banner3.jpg",
        noindex: false,
        schema: [...baseSchemas, pageSchema(staticSeo.canonical, staticSeo.title, staticSeo.description)],
      };
    }

    const title = `${SEO_BRAND_NAME} | Kadın Çanta ve Aksesuar`;
    return {
      title,
      description: SEO_DEFAULT_DESCRIPTION,
      canonicalPath: lowerPath || "/",
      image: "/banner1.jpg",
      noindex: noindexPaths.has(lowerPath),
      schema: [...baseSchemas, pageSchema(lowerPath || "/", title, SEO_DEFAULT_DESCRIPTION)],
    };
  }, [location.pathname, location.search]);

  if (!seo) return null;
  return <Seo {...seo} />;
}
