import { createPaytrCallbackHash, getPaytrConfig, isSafeEqual } from "@/lib/paytr";
import { prisma } from "@/lib/prisma";
import { resolveAbVariantForToken } from "@/lib/ab-test";
import { grantLoyaltyPointsForOrder } from "@/lib/loyalty";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

function getField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveInteger(value: string) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export async function POST(request: Request) {
  const paytrConfig = getPaytrConfig();
  if (!paytrConfig) {
    return new Response("PAYTR notification failed: missing config", { status: 500 });
  }

  const formData = await request.formData();
  const merchantOid = getField(formData, "merchant_oid");
  const status = getField(formData, "status");
  const totalAmountRaw = getField(formData, "total_amount");
  const incomingHash = getField(formData, "hash");

  await prisma.adminAuditLog.create({
    data: {
      action: "paytr:callback_received",
      entity: "paytr",
      entityId: merchantOid || null,
      afterJson: {
        merchantOid: merchantOid || null,
        status: status || null,
        totalAmount: totalAmountRaw || null,
      },
    },
  });

  if (!merchantOid || !status || !totalAmountRaw || !incomingHash) {
    return new Response("PAYTR notification failed: missing required fields", { status: 400 });
  }

  const calculatedHash = createPaytrCallbackHash(merchantOid, status, totalAmountRaw);
  if (!calculatedHash || !isSafeEqual(calculatedHash, incomingHash)) {
    await prisma.adminAuditLog.create({
      data: {
        action: "paytr:callback_bad_hash",
        entity: "paytr",
        entityId: merchantOid,
      },
    });
    return new Response("PAYTR notification failed: bad hash", { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { paytrMerchantOid: merchantOid },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      cartToken: true,
      customerEmail: true,
      items: {
        select: {
          productId: true,
          quantity: true,
        },
      },
    },
  });

  if (!order) {
    await prisma.adminAuditLog.create({
      data: {
        action: "paytr:callback_order_not_found",
        entity: "paytr",
        entityId: merchantOid,
      },
    });
    return new Response("PAYTR notification failed: order not found", { status: 404 });
  }

  if (order.paymentStatus !== "PENDING") {
    return new Response("OK");
  }

  const parsedTotalAmount = parsePositiveInteger(totalAmountRaw);
  const paymentTypeRaw = getField(formData, "payment_type");
  const paymentType = paymentTypeRaw.length > 0 ? paymentTypeRaw : null;
  const failedReasonCodeRaw = getField(formData, "failed_reason_code");
  const failedReasonCode = failedReasonCodeRaw.length > 0 ? failedReasonCodeRaw : null;
  const failedReasonMsgRaw = getField(formData, "failed_reason_msg");
  const failedReasonMsg = failedReasonMsgRaw.length > 0 ? failedReasonMsgRaw : null;

  if (status === "success") {
    const homeAbVariant = await resolveAbVariantForToken("home_hero_copy", order.cartToken);
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "PAID",
          status: order.status === "PENDING" ? "CONFIRMED" : order.status,
          paytrTotalAmount: parsedTotalAmount,
          paytrPaymentType: paymentType,
          paytrFailedReasonCode: null,
          paytrFailedReasonMsg: null,
          paymentCompletedAt: new Date(),
        },
      });
      await grantLoyaltyPointsForOrder(tx, order.id);

      if (order.cartToken) {
        const cart = await tx.cart.findUnique({
          where: { token: order.cartToken },
          select: { id: true },
        });

        if (cart) {
          for (const orderItem of order.items) {
            if (!orderItem.productId || orderItem.quantity <= 0) {
              continue;
            }

            let remainingToRemove = orderItem.quantity;
            const cartItems = await tx.cartItem.findMany({
              where: {
                cartId: cart.id,
                productId: orderItem.productId,
              },
              orderBy: { id: "asc" },
              select: {
                id: true,
                quantity: true,
              },
            });

            for (const cartItem of cartItems) {
              if (remainingToRemove <= 0) {
                break;
              }

              if (cartItem.quantity <= remainingToRemove) {
                remainingToRemove -= cartItem.quantity;
                await tx.cartItem.delete({
                  where: { id: cartItem.id },
                });
              } else {
                await tx.cartItem.update({
                  where: { id: cartItem.id },
                  data: {
                    quantity: {
                      decrement: remainingToRemove,
                    },
                  },
                });
                remainingToRemove = 0;
              }
            }
          }
        }
      }

      const orderItems = await tx.orderItem.findMany({
        where: { orderId: order.id, productId: { not: null } },
        select: {
          productId: true,
          quantity: true,
          totalPrice: true,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: "event:purchase_order",
          actorId: order.customerEmail ?? undefined,
          entity: "order",
          entityId: String(order.id),
          afterJson: {
            totalAmount: parsedTotalAmount,
          },
        },
      });

      if (homeAbVariant) {
        await tx.adminAuditLog.create({
          data: {
            action: `ab:home_hero_copy:${homeAbVariant}:purchase`,
            actorId: order.customerEmail ?? undefined,
            entity: "order",
            entityId: String(order.id),
          },
        });
      }

      for (const item of orderItems) {
        if (!item.productId) {
          continue;
        }

        await tx.adminAuditLog.create({
          data: {
            action: "event:purchase_item",
            actorId: order.customerEmail ?? undefined,
            entity: "product",
            entityId: String(item.productId),
            afterJson: {
              quantity: item.quantity,
              totalPrice: item.totalPrice,
              orderId: order.id,
            },
          },
        });
      }
    });
  } else {
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (!item.productId) {
          continue;
        }

        await tx.product.updateMany({
          where: {
            id: item.productId,
            quantityControl: true,
          },
          data: {
            quantity: {
              increment: item.quantity,
            },
          },
        });
      }

      await tx.couponUsage.deleteMany({
        where: {
          orderId: order.id,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          action: "paytr:failed_order_deleted",
          entity: "order",
          entityId: String(order.id),
          afterJson: {
            paytrTotalAmount: parsedTotalAmount,
            paytrPaymentType: paymentType,
            failedReasonCode,
            failedReasonMsg,
          },
        },
      });

      await tx.order.delete({
        where: { id: order.id },
      });
    });
  }

  revalidatePath("/");
  revalidatePath("/sepet");
  revalidatePath("/checkout");
  revalidatePath(`/odeme/${order.id}`);
  revalidatePath("/odeme/basarili");
  revalidatePath("/odeme/basarisiz");
  revalidatePath("/hesabim/puanlar");
  revalidatePath("/akalin1453/loyalty");
  revalidatePath("/akalin1453");

  return new Response("OK");
}
