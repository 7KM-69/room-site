import { useSyncExternalStore } from 'react'

// Interface strings, written by hand for each language (no runtime translation anywhere).

export type Lang = 'ar' | 'tr'

export type UIStrings = {
  dir: 'rtl' | 'ltr'
  locale: string // number formatting
  font: string // page typeface (canvas font-family)
  fontLoad: string // what to ask document.fonts to load before measuring text
  name: string // shown on the language button
  day: string
  night: string
  toDay: string
  toNight: string
  loading: string
  scrollHint: string
  prev: string
  next: string
  prevLabel: string
  nextLabel: string
  pageNav: string
  pagesOf: (a: string, b: string, total: string) => string
  kicker: string // small line above the title on the title page, and on the cover
  epigraph: string[]
  epigraphBy: string
  contents: string // heading of the contents page
  noArticles: string // on the contents page while nothing is published
  essay: (n: string) => string // small line above an article title
  searchPlaceholder: string
  searchLabel: string
  clearSearch: string
  noResults: string
  page: (n: string) => string
  instagram: string
  suggest: string // button label and popup heading
  suggestPlaceholder: string
  suggestSend: string
  suggestNote: string
  close: string
  switchTo: string // the other language, on the switch button
  editor: {
    open: string // trigger button label and modal heading
    title: string
    content: string
    hint: string
    passcode: string
    publish: string
    cancel: string
    missing: string
    wrong: string
    tooMany: string
    network: string
    notConfigured: string
    publishing: string
    publicNote: string
  }
}

export const UI: Record<Lang, UIStrings> = {
  ar: {
    dir: 'rtl',
    locale: 'ar-EG',
    font: 'Amiri, "Noto Naskh Arabic", serif',
    fontLoad: '400 40px Amiri',
    name: 'العربية',
    day: 'نهار',
    night: 'ليل',
    toDay: 'التبديل إلى النهار',
    toNight: 'التبديل إلى الليل',
    loading: 'يُحضَّر المكتب…',
    scrollHint: 'مرّر للأسفل ↓',
    prev: 'السابقة',
    next: 'التالية',
    prevLabel: 'الصفحة السابقة',
    nextLabel: 'الصفحة التالية',
    pageNav: 'تقليب الصفحات',
    pagesOf: (a, b, total) => `${a}–${b} من ${total}`,
    kicker: 'أفكاري',
    epigraph: ['«الحياة التي لا نتأمّلها', 'لا تستحقّ', 'أن تُعاش»'],
    epigraphBy: '— سقراط',
    contents: 'الفهرس',
    noArticles: 'لا مقالات بعد.',
    essay: (n) => `المقالة ${n}`,
    searchPlaceholder: 'ابحث في الدفتر…',
    searchLabel: 'البحث في المقالات',
    clearSearch: 'مسح البحث',
    noResults: 'لا توجد نتائج',
    page: (n) => `ص ${n}`,
    instagram: 'الكاتب على إنستغرام',
    suggest: 'اقترح موضوعًا للكاتب',
    suggestPlaceholder: 'عن أيّ فكرة تودّ أن تقرأ؟',
    suggestSend: 'أرسل عبر إنستغرام',
    suggestNote: 'يُنسخ اقتراحك، فالصقه في الرسالة.',
    close: 'إغلاق',
    switchTo: 'Türkçe',
    editor: {
      open: 'مقالة جديدة',
      title: 'العنوان',
      content: 'النص',
      hint: 'سطر فارغ يبدأ فقرة جديدة، و«## » في أول السطر عنوان فرعي.',
      passcode: 'رمز المرور',
      publish: 'حفظ',
      cancel: 'إلغاء',
      missing: 'املأ العنوان والنص باللغتين.',
      wrong: 'رمز المرور غير صحيح.',
      tooMany: 'محاولات خاطئة كثيرة. حاول بعد ساعة.',
      network: 'تعذّر الاتصال بقاعدة البيانات. حاول مرة أخرى.',
      notConfigured: 'قاعدة البيانات غير مُعدّة بعد (ملف .env.local).',
      publishing: 'يُنشر…',
      publicNote: 'تُنشر المقالة لكل القرّاء.',
    },
  },
  tr: {
    dir: 'ltr',
    locale: 'tr-TR',
    font: '"EB Garamond", Georgia, serif',
    fontLoad: '400 40px "EB Garamond"',
    name: 'Türkçe',
    day: 'Gündüz',
    night: 'Gece',
    toDay: 'Gündüz moduna geç',
    toNight: 'Gece moduna geç',
    loading: 'Masa hazırlanıyor…',
    scrollHint: 'Aşağı kaydırın ↓',
    prev: 'Önceki',
    next: 'Sonraki',
    prevLabel: 'Önceki sayfa',
    nextLabel: 'Sonraki sayfa',
    pageNav: 'Sayfa çevirme',
    pagesOf: (a, b, total) => `${a}–${b} / ${total}`,
    kicker: 'Düşüncelerim',
    epigraph: ['“Sorgulanmamış bir hayat', 'yaşanmaya', 'değmez.”'],
    epigraphBy: '— Sokrates',
    contents: 'İçindekiler',
    noArticles: 'Henüz yazı yok.',
    essay: (n) => `Yazı ${n}`,
    searchPlaceholder: 'Defterde ara…',
    searchLabel: 'Yazılarda ara',
    clearSearch: 'Aramayı temizle',
    noResults: 'Sonuç bulunamadı',
    page: (n) => `s. ${n}`,
    instagram: 'Yazar Instagram’da',
    suggest: 'Bir konu önerin',
    suggestPlaceholder: 'Hangi fikir üzerine okumak istersiniz?',
    suggestSend: 'Instagram’dan gönder',
    suggestNote: 'Öneriniz kopyalanır; mesaja yapıştırın.',
    close: 'Kapat',
    switchTo: 'العربية',
    editor: {
      open: 'Yeni yazı',
      title: 'Başlık',
      content: 'Metin',
      hint: 'Boş satır yeni paragraf başlatır; satır başındaki “## ” ara başlıktır.',
      passcode: 'Parola',
      publish: 'Yayınla',
      cancel: 'Vazgeç',
      missing: 'Her iki dilde de başlığı ve metni doldurun.',
      wrong: 'Parola yanlış.',
      tooMany: 'Çok fazla hatalı deneme. Bir saat sonra tekrar deneyin.',
      network: 'Veritabanına ulaşılamadı. Tekrar deneyin.',
      notConfigured: 'Veritabanı henüz ayarlanmadı (.env.local dosyası).',
      publishing: 'Yayımlanıyor…',
      publicNote: 'Yazı tüm okurlar için yayımlanır.',
    },
  },
}

// ---- Chosen language (null until the reader picks one in the opening dialog) ---------------------------

let lang: Lang | null = null
const listeners = new Set<() => void>()

export const language = {
  get current() { return lang },
  set(l: Lang) {
    lang = l
    document.documentElement.lang = l
    listeners.forEach((fn) => fn())
  },
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => { listeners.delete(fn) }
  },
}

export const useLanguage = () => useSyncExternalStore(language.subscribe, () => language.current)
