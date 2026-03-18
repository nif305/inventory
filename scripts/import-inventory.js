require('dotenv').config();

const path = require('path');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const FILE_NAME = 'الملف الاسياسي المرسل لبناء النظام.xlsx';
const FILE_PATH = path.join(process.cwd(), FILE_NAME);

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(value) {
  const cleaned = String(value ?? '')
    .replace(/,/g, '')
    .trim();

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : 0;
}

function detectStatus(quantity, minStock = 5) {
  if (quantity <= 0) return 'OUT_OF_STOCK';
  if (quantity <= minStock) return 'LOW_STOCK';
  return 'AVAILABLE';
}

function inferItemType(name) {
  const normalized = normalizeText(name);

  const consumableKeywords = [
    'قلم',
    'أقلام',
    'قلم رصاص',
    'قلم تحديد',
    'ورق',
    'ورق طباعة',
    'ورق أصفر',
    'نوته',
    'ملفات',
    'ملف',
    'دوكس فايل',
    'أغلفة',
    'أغلفة بطاقات',
    'أغلفة شهادات',
    'تعليقة بطاقة',
    'دبابيس',
    'صمغ',
    'ظرف',
    'مشابك',
    'براية',
    'مساحة',
    'مسطرة',
    'مغناطيس ألوان',
  ];

  const isConsumable = consumableKeywords.some((keyword) => normalized.includes(keyword));
  return isConsumable ? 'CONSUMABLE' : 'RETURNABLE';
}

function inferCategory(name) {
  const normalized = normalizeText(name);

  if (
    normalized.includes('لابتوب') ||
    normalized.includes('كمبيوتر') ||
    normalized.includes('كاميرا') ||
    normalized.includes('VR') ||
    normalized.includes('فلاش ميموري') ||
    normalized.includes('كرت حفظ') ||
    normalized.includes('بطارية') ||
    normalized.includes('ريموت') ||
    normalized.includes('كيبل') ||
    normalized.includes('شاحن')
  ) {
    return 'أجهزة وتقنيات تدريبية';
  }

  if (
    normalized.includes('مسدس') ||
    normalized.includes('كلبشات') ||
    normalized.includes('حزام تكتيكي') ||
    normalized.includes('جراب مسدس') ||
    normalized.includes('خوذة') ||
    normalized.includes('سترة حماية') ||
    normalized.includes('سكين') ||
    normalized.includes('عصا') ||
    normalized.includes('مراية فحص') ||
    normalized.includes('مفاتيح كلبشات')
  ) {
    return 'معدات تدريب أمني وميداني';
  }

  if (
    normalized.includes('دمية') ||
    normalized.includes('إسعافات') ||
    normalized.includes('شنطة إسعافات')
  ) {
    return 'معدات إسعافات وتدريب تخصصي';
  }

  if (
    normalized.includes('فليب شارت') ||
    normalized.includes('سبورة') ||
    normalized.includes('استاند') ||
    normalized.includes('ستاند') ||
    normalized.includes('حامل') ||
    normalized.includes('مسند ثلاثي')
  ) {
    return 'وسائل وتجهيزات تدريبية';
  }

  if (
    normalized.includes('أطباق') ||
    normalized.includes('كيتل بل') ||
    normalized.includes('حبل قفز') ||
    normalized.includes('قفازة') ||
    normalized.includes('فرش اسفنج') ||
    normalized.includes('مصدات')
  ) {
    return 'معدات رياضية وتدريب بدني';
  }

  return 'مواد تشغيلية ومكتبية';
}

function inferUnit(name) {
  const normalized = normalizeText(name);

  if (
    normalized.includes('ورق طباعة') ||
    normalized.includes('دبابيس') ||
    normalized.includes('صمغ') ||
    normalized.includes('أغلفة') ||
    normalized.includes('تعليقة بطاقة') ||
    normalized.includes('مشابك')
  ) {
    return 'حبة';
  }

  return 'قطعة';
}

function inferLocation(type) {
  return type === 'CONSUMABLE' ? 'المخزن التشغيلي' : 'المخزن الرئيسي';
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('ملف .env غير مقروء أو أن DATABASE_URL غير موجود داخله.');
  }

  console.log(`📥 جاري قراءة الملف: ${FILE_NAME}`);

  const workbook = XLSX.readFile(FILE_PATH);
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const rawRows = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  });

  if (!rawRows.length) {
    throw new Error('ملف الإكسل فارغ أو لم يتم العثور على بيانات صالحة.');
  }

  const rows = rawRows
    .map((row) => ({
      code: normalizeText(row['الكود']),
      name: normalizeText(row['المادة ']),
      quantity: toNumber(row['الكمية المتوفرة']),
    }))
    .filter((row) => row.code && row.name);

  if (!rows.length) {
    throw new Error('لم يتم العثور على صفوف صالحة تحتوي على الكود واسم المادة.');
  }

  let created = 0;
  let updated = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const quantity = row.quantity;
    const minStock = 5;
    const itemType = inferItemType(row.name);
    const status = detectStatus(quantity, minStock);
    const category = inferCategory(row.name);
    const unit = inferUnit(row.name);
    const location = inferLocation(itemType);

    const existing = await prisma.inventoryItem.findUnique({
      where: { code: row.code },
      select: { id: true },
    });

    await prisma.inventoryItem.upsert({
      where: { code: row.code },
      update: {
        name: row.name,
        category,
        type: itemType,
        quantity,
        availableQty: quantity,
        reservedQty: 0,
        minStock,
        unit,
        location,
        status,
        financialTracking: false,
        notes: 'تم الاستيراد من ملف المواد الأساسي',
        sortOrder: index + 1,
      },
      create: {
        code: row.code,
        name: row.name,
        description: null,
        category,
        subcategory: null,
        type: itemType,
        quantity,
        availableQty: quantity,
        reservedQty: 0,
        minStock,
        unit,
        location,
        status,
        unitPrice: null,
        totalPrice: null,
        financialTracking: false,
        notes: 'تم الاستيراد من ملف المواد الأساسي',
        imageUrl: null,
        sortOrder: index + 1,
      },
    });

    if (existing) {
      updated += 1;
    } else {
      created += 1;
    }
  }

  console.log('✅ اكتمل الاستيراد بنجاح');
  console.log(`➕ مواد جديدة: ${created}`);
  console.log(`🔄 مواد محدثة: ${updated}`);
  console.log(`📦 إجمالي الصفوف المعالجة: ${rows.length}`);
}

main()
  .catch((error) => {
    console.error('❌ فشل الاستيراد:');
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });