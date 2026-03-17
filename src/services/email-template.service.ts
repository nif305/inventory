import { PrismaClient } from '@prisma/client';
import { DEPARTMENTS } from '@/lib/constants/departments';
const prisma = new PrismaClient();
export { DEPARTMENTS };
export const EmailTemplateService = {
  generateDraft: async (sourceType: 'purchase' | 'maintenance' | 'inventory', sourceId: string, targetDept: keyof typeof DEPARTMENTS) => {
    let data: any; let details = '';
    if (sourceType === 'purchase') {
      data = await prisma.purchaseRequest.findUnique({ where: { id: sourceId } });
      details = `
نوضح لكم بأن وكالة التدريب بحاجة ماسة لتوفير الأصناف التالية:
- تفاصيل الطلب: ${data?.items}
- مبررات الطلب: ${data?.reason}
- القيمة التقديرية: ${data?.estimatedValue} ريال
      `;
    } else if (sourceType === 'maintenance') {
      data = await prisma.maintenanceRequest.findUnique({ where: { id: sourceId } });
      details = `
نود إبلاغكم بوجود عطل/حاجة صيانة لـ: ${data?.description}
- الأولوية: ${data?.priority}
- التصنيف: ${data?.category}
      `;
    } else {
      data = { code: sourceId };
      details = 'هذا إشعار متعلق بالمخزون ويحتاج إلى اتخاذ الإجراء المناسب.';
    }
    const recipientName = DEPARTMENTS[targetDept].name;
    const date = new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const subject = sourceType === 'purchase' ? `موضوع: طلب توريد مواد/أجهزة لوكالة التدريب - رقم: ${data?.code}` : `موضوع: طلب صيانة/دعم فني لوكالة التدريب - رقم: ${data?.code}`;
    const body = `
${recipientName} المحترم،

السلام عليكم ورحمة الله وبركاته،

التاريخ: ${date}

إشارة إلى المهام التشغيلية لوكالة التدريب والرامية إلى توفير البيئة المناسبة للعملية التدريبية، نرجو التكرم بالاطلاع والموافقة على ما يلي:

${details}

نأمل من سعادتكم النظر في هذا الطلب واتخاذ ما ترونه مناسباً في أقرب وقت ممكن، علماً بأن هذه المواد/الخدمات ذات أهمية عاجلة لمسار العمل.

وشكراً لتعاونكم الدائم.

وتفضلوا بقبول فائق الاحترام والتقدير،

محمد الأحمد
مدير وكالة التدريب
    `.trim();
    return prisma.emailDraft.create({ data: { sourceType, sourceId, recipient: recipientName, subject, body, status: 'DRAFT' } });
  }
};
