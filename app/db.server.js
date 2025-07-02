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
      // receipts: {
      //   create: data.receipts || [], // Array of { fileUrl: ... }
      // },
    },
    include: { receipts: true },
  });
}

// Example usage:
// await createReturnRequest({
//   customerId: '123',
//   orderId: '456',
//   reason: 'Damaged item',
//   receipts: [{ fileUrl: 'https://example.com/receipt1.png' }],
// });

export async function getReturnRequests() {
  return prisma.returnRequest.findMany({
    include: { receipts: true },
  });
}

export async function createOrUpdateProduct(product) {
  return prisma.product.upsert({
    where: { shopifyId: product.shopifyId },
    update: product,
    create: product,
  });
}
