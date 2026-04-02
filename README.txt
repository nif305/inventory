الملفات المرفقة في هذه الدفعة:
1) src/app/api/requests/route.ts
2) src/app/api/requests/[id]/route.ts
3) src/app/api/returns/route.ts
4) src/app/api/auth/me/route.ts
5) src/app/api/auth/logout/route.ts

الترتيب المقترح:
- استبدل الملفات الخمسة
- نفذ git add .
- نفذ git commit
- نفذ git push
- اختبر على الموقع المنشور:
  1. تسجيل الدخول
  2. التحول بين الأدوار
  3. صرف الطلب من دور مسؤول المخزن فقط
  4. رفض الطلب من دور مسؤول المخزن فقط
  5. طلب الإرجاع ومعالجته من دور مسؤول المخزن فقط
  6. تسجيل الخروج ثم التأكد من مسح الجلسة
