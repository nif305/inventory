import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const DEPARTMENT_EMAIL_MAP = {
  IT_MAINTENANCE: { name: 'سعادة مدير مركز تقنية المعلومات', email: 'it@training.edu.sa' },
  GENERAL_MAINTENANCE: { name: 'سعادة مدير إدارة الخدمات المساندة', email: 'services@training.edu.sa' },
  PROCUREMENT: { name: 'سعادة مدير إدارة المشتريات', email: 'procurement@training.edu.sa' },
  FINANCE: { name: 'سعادة مدير الإدارة المالية', email: 'finance@training.edu.sa' }
};
export const WorkflowService = {
  processMaintenanceApproval: async (requestId: string) => {
    const request = await prisma.maintenanceRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    const targetDept = request.category === 'IT' ? DEPARTMENT_EMAIL_MAP.IT_MAINTENANCE : DEPARTMENT_EMAIL_MAP.GENERAL_MAINTENANCE;
    return prisma.emailDraft.create({ data: { sourceType: 'maintenance', sourceId: requestId, recipient: targetDept.name, subject: `طلب صيانة عاجل - رقم: ${request.code}`, body: `
سعادة ${targetDept.name} المحترم،

السلام عليكم ورحمة الله وبركاته،

الموضوع: طلب صيانة (${request.category})

يرجى التكرم بالنظر في طلب الصيانة الموضح أدناه والذي تم اعتماده من قبل إدارة وكالة التدريب:

رقم الطلب: ${request.code}
الوصف: ${request.description}
الأولوية: ${request.priority}
تاريخ الطلب: ${request.createdAt.toLocaleDateString('ar-SA')}

نأمل سرعة التنفيذ بناءً على الأولوية المحددة.

وتفضلوا بقبول فائق الاحترام،

مدير وكالة التدريب
        `.trim(), status: 'DRAFT' } });
  },
  processPurchaseApproval: async (requestId: string) => {
    const request = await prisma.purchaseRequest.findUnique({ where: { id: requestId } });
    if (!request) throw new Error('Request not found');
    const targetDept = DEPARTMENT_EMAIL_MAP.PROCUREMENT;
    return prisma.emailDraft.create({ data: { sourceType: 'purchase', sourceId: requestId, recipient: targetDept.name, subject: `طلب توريد معتمد - رقم: ${request.code}`, body: `
سعادة ${targetDept.name} المحترم،

يرجى التكرم بتوفير الأصناف التالية بناءً على طلب وكالة التدريب المعتمد:

رقم الطلب: ${request.code}
تفاصيل الأصناف: ${request.items}
السبب: ${request.reason}
القيمة التقديرية: ${request.estimatedValue} ريال

يرجى اتخاذ الإجراء اللازم.

مع التحية،
مدير وكالة التدريب
        `.trim(), status: 'DRAFT' } });
  }
};
