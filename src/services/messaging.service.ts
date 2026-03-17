import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const MessagingService = {
  send: async (data: {
    senderId: string;
    receiverId: string;
    subject: string;
    body: string;
    relatedType?: string;
    relatedId?: string;
  }) => {
    const message = await prisma.internalMessage.create({
      data: {
        senderId: data.senderId,
        receiverId: data.receiverId,
        subject: data.subject,
        body: data.body,
        relatedType: data.relatedType || null,
        relatedId: data.relatedId || null,
      },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true },
        },
        receiver: {
          select: { id: true, fullName: true, role: true },
        },
      },
    });

    await prisma.notification.create({
      data: {
        userId: data.receiverId,
        type: 'NEW_MESSAGE',
        title: 'رسالة داخلية جديدة',
        message: `لديك رسالة داخلية بعنوان: ${data.subject}`,
      },
    });

    return message;
  },

  getInbox: async (userId: string) =>
    prisma.internalMessage.findMany({
      where: { receiverId: userId },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true },
        },
        receiver: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

  getSent: async (userId: string) =>
    prisma.internalMessage.findMany({
      where: { senderId: userId },
      include: {
        sender: {
          select: { id: true, fullName: true, role: true },
        },
        receiver: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),

  markAsRead: async (messageId: string, userId: string) =>
    prisma.internalMessage.updateMany({
      where: {
        id: messageId,
        receiverId: userId,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    }),
};