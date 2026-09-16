export const userProfile = {
  name: 'أمينة الحسن',
  role: 'مؤمنة في طريق القرآن',
  email: 'amina@khatmah.app',
  streak: 18,
  dailyGoal: 20,
  completedPages: 216,
  readingMinutes: 32,
}

export const khatmahs = [
  {
    id: 'al-fajr',
    title: 'ختمة الفجر',
    description: 'ختمة جماعية مع القراءة اليومية قبل الفجر',
    progress: 68,
    totalPages: 604,
    completedPages: 410,
    pagesToday: 18,
    owner: 'أمينة الحسن',
    nextReading: 'غدًا · 15 صفحة',
    lastRead: 'اليوم · 9:30 مساءً',
    color: '#0F6A63',
    badge: 'نشطة',
    members: 14,
    target: 'إكمال خلال 22 يومًا',
  },
  {
    id: 'riyad',
    title: 'ختمة رياح',
    description: 'ختمة فردية للقراءة الهادئة في الليل',
    progress: 42,
    totalPages: 604,
    completedPages: 254,
    pagesToday: 12,
    owner: 'أمينة الحسن',
    nextReading: 'الإثنين · 12 صفحة',
    lastRead: 'أمس · 8:15 مساءً',
    color: '#F4A62A',
    badge: 'جارية',
    members: 1,
    target: 'إكمال خلال 38 يومًا',
  },
  {
    id: 'al-noor',
    title: 'ختمة النور',
    description: 'ختمة منزلية مع متابعة الأجزاء المتبقية',
    progress: 86,
    totalPages: 604,
    completedPages: 520,
    pagesToday: 8,
    owner: 'أمينة الحسن',
    nextReading: 'اليوم · 8 صفحات',
    lastRead: 'اليوم · 6:30 صباحًا',
    color: '#0B4F49',
    badge: 'تقريبًا',
    members: 8,
    target: 'يومين فقط',
  },
]

export const overviewStats = [
  { label: 'إجمالي الختمات', value: '03', icon: 'book', change: '+1 هذا الشهر' },
  { label: 'الصفحات المقروءة', value: '1,284', icon: 'sparkle', change: '+182 هذا الأسبوع' },
  { label: 'معدل الالتزام', value: '92%', icon: 'target', change: '+5% عن الشهر الماضي' },
  { label: 'الأيام المتتالية', value: '18 يوم', icon: 'flame', change: 'استمراريّة ممتازة' },
]

export const juzProgress = [
  { number: 1, title: 'سبحان الذي', status: 'مكتمل', pages: 20 },
  { number: 2, title: 'الليل', status: 'مكتمل', pages: 20 },
  { number: 3, title: 'قريش', status: 'مكتمل', pages: 20 },
  { number: 4, title: 'المرسلات', status: 'مكتمل', pages: 20 },
  { number: 5, title: 'النبأ', status: 'مكتمل', pages: 20 },
  { number: 6, title: 'المعارج', status: 'مكتمل', pages: 20 },
  { number: 7, title: 'تبارك', status: 'مكتمل', pages: 20 },
  { number: 8, title: 'غافر', status: 'مكتمل', pages: 20 },
  { number: 9, title: 'الرحمن', status: 'قيد القراءة', pages: 12 },
  { number: 10, title: 'الحاقة', status: 'قيد القراءة', pages: 9 },
  { number: 11, title: 'ق', status: 'غير مُكتمل', pages: 0 },
  { number: 12, title: 'الذاريات', status: 'غير مُكتمل', pages: 0 },
  { number: 13, title: 'الطور', status: 'غير مُكتمل', pages: 0 },
  { number: 14, title: 'النجم', status: 'غير مُكتمل', pages: 0 },
  { number: 15, title: 'الشعراء', status: 'غير مُكتمل', pages: 0 },
  { number: 16, title: 'المؤمنون', status: 'غير مُكتمل', pages: 0 },
  { number: 17, title: 'الكهف', status: 'غير مُكتمل', pages: 0 },
  { number: 18, title: 'السجدة', status: 'غير مُكتمل', pages: 0 },
  { number: 19, title: 'الأحقاف', status: 'غير مُكتمل', pages: 0 },
  { number: 20, title: 'محمد', status: 'غير مُكتمل', pages: 0 },
  { number: 21, title: 'الفتح', status: 'غير مُكتمل', pages: 0 },
  { number: 22, title: 'الحجرات', status: 'غير مُكتمل', pages: 0 },
  { number: 23, title: 'ق', status: 'غير مُكتمل', pages: 0 },
  { number: 24, title: 'الشرح', status: 'غير مُكتمل', pages: 0 },
  { number: 25, title: 'التين', status: 'غير مُكتمل', pages: 0 },
  { number: 26, title: 'المطففين', status: 'غير مُكتمل', pages: 0 },
  { number: 27, title: 'الإنشقاق', status: 'غير مُكتمل', pages: 0 },
  { number: 28, title: 'البروج', status: 'غير مُكتمل', pages: 0 },
  { number: 29, title: 'الطارق', status: 'غير مُكتمل', pages: 0 },
  { number: 30, title: 'النصر', status: 'غير مُكتمل', pages: 0 },
]

export const activityFeed = [
  { id: 1, text: 'أكملت 12 صفحة من الجزء التاسع', time: 'قبل 23 دقيقة', tone: 'green' },
  { id: 2, text: 'حفظت خمس آيات من سورة البقرة', time: 'قبل ساعة', tone: 'gold' },
  { id: 3, text: 'تم تحديث هدف اليوم بنجاح', time: 'قبل يومين', tone: 'blue' },
]

export const monthlyReading = [
  { month: 'يناير', value: 42 },
  { month: 'فبراير', value: 64 },
  { month: 'مارس', value: 58 },
  { month: 'أبريل', value: 71 },
  { month: 'مايو', value: 86 },
  { month: 'يونيو', value: 93 },
]

export const verse = `اعوذ بالله من الشيطان الرجيم
بسم الله الرحمن الرحيم
﴿وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ﴾`

export const settingsSections = [
  {
    title: 'الملف الشخصي',
    items: [
      { label: 'اسم المستخدم', value: 'أمينة الحسن' },
      { label: 'البريد الإلكتروني', value: 'amina@khatmah.app' },
      { label: 'المنطقة الزمنية', value: 'مكة المكرمة' },
    ],
  },
  {
    title: 'التنبيهات',
    items: [
      { label: 'تذكير يومي', value: 'مفعل' },
      { label: 'تذكير القراءة الليليّة', value: 'مفعل' },
      { label: 'مذكّرات الختمة', value: 'كل 3 أيام' },
    ],
  },
]
