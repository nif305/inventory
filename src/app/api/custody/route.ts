import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Status, Role, CustodyStatus, ItemType } from '@prisma/client';

function mapRole(role: string): Role {
  const normalized = String(role || '').trim().toLowerCase();

  if (normalized === 'manager') return Role.MANAGER;
  if (normalized === 'warehouse') return Role.WAREHOUSE;
  return Role.USER;
}

async function resolveSessionUser(request: NextRequest) {
  const cookieId = decodeURIComponent(request.cookies.get('user_id')?.value || '').trim();
  const cookieEmail = decodeURIComponent(request.cookies.get('user_email')?.value || '').trim();
  const cookieEmployeeId = decodeURIComponent(
    request.cookies.get('user_employee_id')?.value || ''
  ).trim();
  const cookieRole = decodeURIComponent(request.cookies.get('user_role')?.value || 'user').trim();

  const role = mapRole(cookieRole);

  let user = null;

  if (cookieId) {
    user = await prisma.user.findUnique({
      where: { id: cookieId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
  }

  if (!user && cookieEmail) {
    user = await prisma.user.findFirst({
      where: {
        email: {
          equals: cookieEmail,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
  }

  if (!user && cookieEmployeeId) {
    user = await prisma.user.findUnique({
      where: { employeeId: cookieEmployeeId },
      select: {
        id: true,
        role: true,
        status: true,
      },
    });
  }

  if (!user) {
    throw new Error('غير مصرح');
  }

  if (user.status !== Status.ACTIVE) {
    throw new Error('الحساب غير نشط');
  }

  return {
    id: user.id,
    role: user.role || role,
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await resolveSessionUser(request);

    const custodyRecords = await prisma.custodyRecord.findMany({
      where: {
        userId: session.id,
        status: {
          in: [CustodyStatus.ACTIVE, CustodyStatus.RETURN_REQUESTED],
        },
        item: {
          type: ItemType.RETURNABLE,
        },
      },
      include: {
        item: {
          select: {
            id: true,
            code: true,
            name: true,
            category: true,
            type: true,
          },
        },
        user: {
          select: {
            fullName: true,
            department: true,
          },
        },
        returnRequests: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            code: true,
            status: true,
            conditionNote: true,
            rejectionReason: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ expectedReturn: 'asc' }, { issueDate: 'desc' }],
    });

    return NextResponse.json({
      data: custodyRecords.map((record) => ({
        id: record.id,
        quantity: record.quantity,
        issueDate: record.issueDate?.toISOString(),
        expectedReturn: record.expectedReturn?.toISOString() || null,
        actualReturn: record.actualReturn?.toISOString() || null,
        notes: record.notes,
        status: record.status,
        userId: record.userId,
        user: record.user,
        item: record.item,
        returnRequests: record.returnRequests.map((ret) => ({
          ...ret,
          createdAt: ret.createdAt.toISOString(),
        })),
      })),
    });
  } catch (error: any) {
    const statusCode =
      error?.message === 'غير مصرح' || error?.message === 'الحساب غير نشط' ? 401 : 500;

    return NextResponse.json(
      { error: error?.message || 'تعذر جلب العهد' },
      { status: statusCode }
    );
  }
}
