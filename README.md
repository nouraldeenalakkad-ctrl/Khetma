# خَتْمَة

تطبيق جلسة ختم قرآن عربية RTL مبني بـ React وVite. الواجهة ومسار الجلسة وقارئ PDF جاهزون، لكن الوصول المشترك بين الأجهزة يحتاج إعداد Supabase قبل النشر.

## التشغيل

```bash
npm install
npm run dev
```

## ملفات القرآن

ملفات الأجزاء الأصلية موجودة حاليًا في جذر المشروع باسم `juz1.pdf` إلى `juz30.pdf`. يجب نسخها إلى `public/quran/juz-01.pdf` إلى `public/quran/juz-30.pdf` قبل التشغيل، ويقرأها التطبيق عبر PDF.js. يجب مراجعة مصدر الملفات وترخيصها قبل النشر العام.

## Supabase

1. أنشئ مشروعًا في Supabase.
2. افتح SQL Editor والصق ملف `supabase/schema.sql` كاملًا.
3. انسخ `.env.example` إلى `.env` وضع `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY` من إعدادات المشروع.
4. قبل النشر العام، انقل التحقق من كلمة المرور وعمليات claim/complete/delete إلى Edge Function أو RPC آمن. لا تضع Service Role Key داخل Vite.

## Cloudflare Pages

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

النسخة الحالية تعمل محليًا بدون Supabase كواجهة قابلة للتجربة، ولا تدّعي أن الجلسات المحلية مشتركة بين الأجهزة حتى تُضاف مفاتيح Supabase ويُربط مسار الواجهة بدوال قاعدة البيانات.

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
