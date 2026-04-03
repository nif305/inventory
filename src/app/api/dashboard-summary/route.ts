import { NextRequest, NextResponse } from 'next/server';
import { CustodyStatus, ItemStatus, ItemType, RequestStatus, Role, Status, SuggestionStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();
  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieEmployeeId = decodeURIComponent(request.cookies.get('user_employee_id')?.value || '').trim();

  const effectiveRole = mapRole(
    decodeURIComponent(
      request.headers.get('x-active-role') ||
        request.cookies.get('server_active_role')?.value ||
        request.cookies.get('active_role')?.value ||
        request.cookies.get('user_role')?.value ||
        'user'
    ).trim()
  );

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({ where: { id: cookieId }, select: { id: true, status: true } });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: { email: { equals: cookieEmail, mode: 'insensitive' } },
      select: { id: true, status: true },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({ where: { employeeId: cookieEmployeeId }, select: { id: true, status: true } });
  }

  if (!user) throw new Error('تعذر التحقق من المستخدم الحالي. أعد تسجيل الدخول ثم حاول مرة أخرى.');
  if (user.status !== Status.ACTIVE) throw new Error('الحساب غير نشط.');

  return { id: user.id, role: effectiveRole };
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);
    const isPrivileged = session.role === Role.MANAGER || session.role === Role.WAREHOUSE;

    const requestWhere = isPrivileged ? {} : { requesterId: session.id };
    const returnWhere = isPrivileged ? {} : { requesterId: session.id };
    const suggestionWhere = isPrivileged ? {} : { requesterId: session.id };
    const custodyWhere = isPrivileged
      ? { status: { in: [CustodyStatus.ACTIVE, CustodyStatus.OVERDUE, CustodyStatus.RETURN_REQUESTED] } }
      : { userId: session.id, status: { in: [CustodyStatus.ACTIVE, CustodyStatus.OVERDUE, CustodyStatus.RETURN_REQUESTED] } };

    const [totalInventory, lowStock, outOfStock, returnableItems, consumableItems, pendingRequests, issuedRequests, rejectedRequests, requestItemsCount, pendingReturns, activeCustody, delayedCustody, maintenancePending, cleaningPending, purchasePending, otherPending, unreadNotifications, latestUpdates] = await Promise.all([
      prisma.inventoryItem.count(),
      prisma.inventoryItem.count({ where: { status: ItemStatus.LOW_STOCK } }),
      prisma.inventoryItem.count({ where: { status: ItemStatus.OUT_OF_STOCK } }),
      prisma.inventoryItem.count({ where: { type: ItemType.RETURNABLE } }),
      prisma.inventoryItem.count({ where: { type: ItemType.CONSUMABLE } }),
      prisma.request.count({ where: { ...requestWhere, status: { in: [RequestStatus.PENDING, RequestStatus.APPROVED] } } }),
      prisma.request.count({ where: { ...requestWhere, status: RequestStatus.ISSUED } }),
      prisma.request.count({ where: { ...requestWhere, status: RequestStatus.REJECTED } }),
      prisma.requestItem.count({ where: isPrivileged ? {} : { request: { requesterId: session.id } } }),
      prisma.returnRequest.count({ where: { ...returnWhere, status: 'PENDING' } }),
      prisma.custodyRecord.count({ where: custodyWhere }),
      prisma.custodyRecord.count({ where: { ...custodyWhere, status: CustodyStatus.OVERDUE } }),
      prisma.suggestion.count({ where: { ...suggestionWhere, category: 'MAINTENANCE', status: SuggestionStatus.PENDING } }),
      prisma.suggestion.count({ where: { ...suggestionWhere, category: 'CLEANING', status: SuggestionStatus.PENDING } }),
      prisma.suggestion.count({ where: { ...suggestionWhere, category: 'PURCHASE', status: SuggestionStatus.PENDING } }),
      prisma.suggestion.count({ where: { ...suggestionWhere, category: 'OTHER', status: SuggestionStatus.PENDING } }),
      prisma.notification.count({ where: { userId: session.id, isRead: false } }),
      prisma.notification.findMany({ where: { userId: session.id }, orderBy: { createdAt: 'desc' }, take: 4 }),
    ]);

    return NextResponse.json({
      metrics: {
        totalInventory,
        lowStock,
        outOfStock,
        availableInventory: Math.max(totalInventory - outOfStock, 0),
        returnableItems,
        consumableItems,
        pendingRequests,
        issuedRequests,
        rejectedRequests,
        pendingReturns,
        activeCustody,
        delayedCustody,
        maintenancePending,
        cleaningPending,
        purchasePending,
        otherPending,
        unreadNotifications,
        requestItemsCount,
      },
      latestUpdates,
    });
  } catch (error: any) {
    const message = error?.message || 'تعذر جلب ملخص لوحة التحكم';
    const statusCode = message.includes('الحساب غير نشط') || message.includes('تعذر التحقق من المستخدم الحالي') ? 401 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
