import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";

const ORDER_NO_MIN = 10_000_000_000;
const ORDER_NO_MAX_EXCLUSIVE = 100_000_000_000;

export function generateOrderNo() {
  return String(randomInt(ORDER_NO_MIN, ORDER_NO_MAX_EXCLUSIVE));
}

export async function generateUniqueOrderNo(tx: Prisma.TransactionClient, maxAttempts = 12) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const orderNo = generateOrderNo();
    const exists = await tx.order.findUnique({
      where: { orderNo },
      select: { id: true },
    });
    if (!exists) {
      return orderNo;
    }
  }

  throw new Error("ORDER_NO_GENERATION_ERROR");
}
