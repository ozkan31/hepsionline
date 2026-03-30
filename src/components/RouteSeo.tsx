import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Seo } from '@/components/Seo';
import {
  SEO_BRAND_NAME,
  getSiteOrigin,
  normalizeSeoText,
  type SeoPayload,
} from '@/lib/seo';
import { getCategoryPageById, getCategoryPageBySlug } from '@/lib/categoryPages';

function withTrailingSlash(path: string) {
  if (!path || path === '/') return '/';
  return path.endsWith('/') ? path : `${path}/`;
}

function createBaseSchemas() {
  const baseUrl = getSiteOrigin();
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: SEO_BRAND_NAME,
      url: baseUrl,
      logo: `${baseUrl}/banner1.jpg`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SEO_BRAND_NAME,
      url: baseUrl,
      inLanguage: 'tr-TR',
      potentialAction: {
        '@type': 'SearchAction',
        target: `${baseUrl}/shop?search={search_term_string}`,
        'query-input': 'required name=search_term_string',
      },
    },
  ];
}

function pageSchema(path: string, title: string, description: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: normalizeSeoText(title),
    description: normalizeSeoText(description),
    inLanguage: 'tr-TR',
    url: `${getSiteOrigin()}${path}`,
  };
}

export function RouteSeo() {
  const location = useLocation();

  const seo = useMemo<SeoPayload | null>(() => {
    const pathname = location.pathname;
    const params = new URLSearchParams(location.search);
    const lowerPath = pathname.toLowerCase();
    const baseSchemas = createBaseSchemas();
    const normalizedPath = withTrailingSlash(lowerPath || '/');

    if (lowerPath.startsWith('/product/')) {
      return null;
    }

    if (lowerPath.startsWith('/kategori/')) {
      const slug = lowerPath.replace(/^\/kategori\//, '').replace(/\/+$/, '');
      const categoryPage = getCategoryPageBySlug(slug);
      if (!categoryPage) {
        return {
          title: `Kategori Bulunamadı | ${SEO_BRAND_NAME}`,
          description: 'Aradığınız kategori bulunamadı.',
          canonicalPath: '/shop/',
          image: '/banner2.jpg',
          noindex: true,
          schema: [...baseSchemas, pageSchema('/shop/', `Kategori Bulunamadı | ${SEO_BRAND_NAME}`, 'Aradığınız kategori bulunamadı.')],
        };
      }

      return {
        title: categoryPage.title,
        description: categoryPage.description,
        canonicalPath: categoryPage.path,
        image: categoryPage.image,
        type: 'website',
        schema: [...baseSchemas, pageSchema(categoryPage.path, categoryPage.title, categoryPage.description)],
      };
    }

    if (lowerPath === '/') {
      const title = `${SEO_BRAND_NAME} | Kadın Çanta ve Aksesuar Modelleri`;
      const description =
        'StilBags&Fashion ile modern, şık ve günlük kullanıma uygun kadın çanta modellerini keşfedin.';
      return {
        title,
        description,
        canonicalPath: '/',
        image: '/banner1.jpg',
        type: 'website',
        schema: [...baseSchemas, pageSchema('/', title, description)],
      };
    }

    if (lowerPath === '/shop' || lowerPath === '/shop/' || lowerPath === '/urunler' || lowerPath === '/urunler/') {
      const search = String(params.get('search') ?? '').trim();
      const category = String(params.get('category') ?? '').trim();
      const hasSort = params.has('sort') && params.get('sort') !== 'featured';
      const categoryPage = getCategoryPageById(category);

      if (search) {
        const title = `"${search}" Arama Sonuçları | ${SEO_BRAND_NAME}`;
        const description = 'Arama sonuçlarını keşfedin. StilBags&Fashion ürünlerini kategori ve modele göre filtreleyin.';
        return {
          title,
          description,
          canonicalPath: '/shop/',
          image: '/banner2.jpg',
          noindex: true,
          schema: [...baseSchemas, pageSchema('/shop/', title, description)],
        };
      }

      if (categoryPage) {
        return {
          title: categoryPage.title,
          description: categoryPage.description,
          canonicalPath: categoryPage.path,
          image: categoryPage.image,
          noindex: true,
          schema: [...baseSchemas, pageSchema(categoryPage.path, categoryPage.title, categoryPage.description)],
        };
      }

      const title = `Tüm Ürünler | ${SEO_BRAND_NAME}`;
      const description = 'Kadın çanta ve aksesuar koleksiyonunun tamamını StilBags&Fashion ürünler sayfasında keşfedin.';
      return {
        title,
        description,
        canonicalPath: '/shop/',
        image: '/banner2.jpg',
        noindex: hasSort || lowerPath.startsWith('/urunler'),
        schema: [...baseSchemas, pageSchema('/shop/', title, description)],
      };
    }

    const staticPages: Record<string, { title: string; description: string; canonical: string; image?: string }> = {
      '/hakkimizda': {
        title: `Hikayemiz | ${SEO_BRAND_NAME}`,
        description: 'StilBags&Fashion markasının hikayesini, üretim yaklaşımını ve tasarım anlayışını keşfedin.',
        canonical: '/hakkimizda/',
      },
      '/about': {
        title: `Hikayemiz | ${SEO_BRAND_NAME}`,
        description: 'StilBags&Fashion markasının hikayesini, üretim yaklaşımını ve tasarım anlayışını keşfedin.',
        canonical: '/hakkimizda/',
      },
      '/iletisim': {
        title: `İletişim | ${SEO_BRAND_NAME}`,
        description: 'StilBags&Fashion müşteri destek ekibine ulaşın ve tüm soru, öneri ve taleplerinizi iletin.',
        canonical: '/iletisim/',
      },
      '/contact': {
        title: `İletişim | ${SEO_BRAND_NAME}`,
        description: 'StilBags&Fashion müşteri destek ekibine ulaşın ve tüm soru, öneri ve taleplerinizi iletin.',
        canonical: '/iletisim/',
      },
      '/kargo': {
        title: `Kargo Bilgileri | ${SEO_BRAND_NAME}`,
        description: 'Sipariş hazırlık, kargolama ve teslimat süreçleri hakkında detaylı bilgilere ulaşın.',
        canonical: '/kargo/',
      },
      '/iade': {
        title: `İade Politikası | ${SEO_BRAND_NAME}`,
        description: 'İade koşulları, iade süresi ve iade işlemleri hakkında bilmeniz gereken tüm detaylar.',
        canonical: '/iade/',
      },
      '/sss': {
        title: `Sık Sorulan Sorular | ${SEO_BRAND_NAME}`,
        description: 'Sipariş, ödeme, teslimat ve iade süreçlerine dair en çok sorulan soruların yanıtları.',
        canonical: '/sss/',
      },
      '/gizlilik': {
        title: `Gizlilik Politikası | ${SEO_BRAND_NAME}`,
        description: 'Kişisel verilerinizin işlenmesi, korunması ve saklanmasına ilişkin gizlilik politikamız.',
        canonical: '/gizlilik/',
      },
      '/kullanim-kosullari': {
        title: `Kullanım Koşulları | ${SEO_BRAND_NAME}`,
        description: 'Site kullanım koşulları, hak ve yükümlülükler ile hukuki bilgilendirme metinleri.',
        canonical: '/kullanim-kosullari/',
      },
      '/surdurulebilirlik': {
        title: `Sürdürülebilirlik | ${SEO_BRAND_NAME}`,
        description: 'StilBags&Fashion sürdürülebilirlik yaklaşımı ve sorumlu üretim anlayışını inceleyin.',
        canonical: '/surdurulebilirlik/',
      },
      '/kariyer': {
        title: `Kariyer | ${SEO_BRAND_NAME}`,
        description: 'StilBags&Fashion kariyer fırsatları ve başvuru süreçleri hakkında bilgi alın.',
        canonical: '/kariyer/',
      },
      '/yardim-merkezi': {
        title: `Yardım Merkezi | ${SEO_BRAND_NAME}`,
        description: 'Sipariş, kargo, iade ve hesap işlemleri için ihtiyaç duyduğunuz tüm yardım bağlantılarına tek yerden ulaşın.',
        canonical: '/yardim-merkezi/',
      },
      '/404': {
        title: `Sayfa Bulunamadı | ${SEO_BRAND_NAME}`,
        description: 'Aradığınız sayfa bulunamadı. Yardım Merkezi veya mağaza bağlantılarıyla doğru bölüme geçin.',
        canonical: '/404/',
      },
    };

    const staticSeo = staticPages[lowerPath.replace(/\/+$/, '')];
    if (staticSeo) {
      return {
        title: staticSeo.title,
        description: staticSeo.description,
        canonicalPath: staticSeo.canonical,
        image: staticSeo.image || '/banner3.jpg',
        noindex: withTrailingSlash(lowerPath) !== staticSeo.canonical,
        schema: [...baseSchemas, pageSchema(staticSeo.canonical, staticSeo.title, staticSeo.description)],
      };
    }
    return {
      title: `Sayfa Bulunamadı | ${SEO_BRAND_NAME}`,
      description: 'Aradığınız sayfa bulunamadı. Yardım Merkezi, ürünler ve iletişim bağlantılarıyla doğru sayfaya geçebilirsiniz.',
      canonicalPath: normalizedPath,
      image: '/banner1.jpg',
      noindex: true,
      schema: [
        ...baseSchemas,
        pageSchema(
          normalizedPath,
          `Sayfa Bulunamadı | ${SEO_BRAND_NAME}`,
          'Aradığınız sayfa bulunamadı. Yardım Merkezi, ürünler ve iletişim bağlantılarıyla doğru sayfaya geçebilirsiniz.'
        ),
      ],
    };
  }, [location.pathname, location.search]);

  if (!seo) return null;
  return <Seo {...seo} />;
}

