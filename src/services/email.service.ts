import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
export const EmailService = {
  generateDraft: async (sourceType: 'maintenance' | 'purchase', sourceId: string) => {
    let subject = ''; let body = ''; let recipient = '';
    if (sourceType === 'maintenance') {
      const req = await prisma.maintenanceRequest.findUnique({ where: { id: sourceId } });
      if (!req) throw new Error('Request not found');
      recipient = req.category === 'IT' ? 'سعادة مدير مركز تقنية المعلومات' : 'سعادة مدير إدارة الخدمات المساندة';
      subject = `طلب صيانة (${req.category}) - رقم: ${req.code}`;
      body = `
سعادة المدير،

السلام عليكم ورحمة الله وبركاته،

الموضوع: ${subject}

يرجى التكرم بالنظر في طلب الصيانة المقدم من قسم ${req.category}، وذلك للأسباب التالية:
${req.description}

ملاحظات إضافية: ${req.notes || 'لا يوجد'}

نشكركم على تعاونكم الدائم.

وتفضلوا بقبول فائق الاحترام والتقدير،
مدير وكالة التدريب
      `.trim();
    } else {
      const req = await prisma.purchaseRequest.findUnique({ where: { id: sourceId } });
      if (!req) throw new Error('Request not found');
      recipient = 'سعادة مدير إدارة المشتريات';
      subject = `طلب توريد - رقم: ${req.code}`;
      body = `
سعادة مدير إدارة المشتريات المحترم،

السلام عليكم ورحمة الله وبركاته،

الموضوع: طلب توريد مستلزمات

بناءً على الاحتياج التشغيلي، يرجى التكرم بتوفير الأصناف التالية:
${req.items}

السبب: ${req.reason}
القيمة التقديرية: ${req.estimatedValue || 'غير محدد'} ريال

نأمل العمل على توفيرها في أقرب وقت ممكن.

وتفضلوا بقبول فائق الاحترام،
      `.trim();
    }
    return prisma.emailDraft.create({ data: { sourceType, sourceId, recipient, subject, body, status: 'DRAFT' } });
  },
  markAsCopied: async (id: string) => prisma.emailDraft.update({ where: { id }, data: { status: 'COPIED', copiedAt: new Date() } })
};
