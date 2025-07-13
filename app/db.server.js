import { PrismaClient } from '@prisma/client';

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;

// Create a new return request
export async function createReturnRequest(data) {
  return prisma.returnRequest.create({
    data: {
      customerId: data.customerId,
      orderId: data.orderId,
      reason: data.reason,
      status: data.status || 'pending',
      refunded: data.refunded || false,
      refundAmount: data.refundAmount,
      // receipts: {
      //   create: data.receipts || [], // Array of { fileUrl: ..., refunded, refundAmount }
      // },
    },
    include: { receipts: true },
  });
}

// Create a refund record
export async function createRefund(data) {
  return prisma.refund.create({
    data: {
      returnRequestId: data.returnRequestId,
      shopifyRefundId: data.shopifyRefundId,
      amount: data.amount,
      currency: data.currency || 'USD',
      status: data.status || 'pending',
      processedAt: data.processedAt,
    },
  });
}

// Update return request status to refunded
export async function updateReturnRequestStatus(returnRequestId, status, refunded = true) {
  return prisma.returnRequest.update({
    where: { id: returnRequestId },
    data: {
      status,
      refunded,
      updatedAt: new Date(),
    },
  });
}

// Get return requests with refunds
export async function getReturnRequests() {
  return prisma.returnRequest.findMany({
    include: { 
      receipts: true,
      refunds: true,
    },
  });
}

export async function createOrUpdateProduct(product) {
  return prisma.product.upsert({
    where: { shopifyId: product.shopifyId },
    update: product,
    create: product,
  });
}
