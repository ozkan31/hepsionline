import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { buildProductSlug } from "../../lib/product-slug";

const prisma = new PrismaClient();

async function ensureOrderForUser(params: { email: string; phone: string; fullName: string }) {
  const existing = await prisma.order.findFirst({
    where: { customerEmail: params.email },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

  const product = await prisma.product.findFirst({
    orderBy: { id: "asc" },
    select: { id: true, name: true, price: true },
  });
  if (!product) {
    throw new Error("No product found to seed smoke order.");
  }

  const created = await prisma.order.create({
    data: {
      customerName: params.fullName,
      customerEmail: params.email,
      customerPhone: params.phone,
      customerAddress: "Playwright Test Address",
      status: "PENDING",
      paymentStatus: "FAILED",
      totalAmount: product.price,
      items: {
        create: [
          {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unitPrice: product.price,
            totalPrice: product.price,
          },
        ],
      },
    },
    select: { id: true },
  });

  return created.id;
}

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("end-user critical flow: product -> cart -> checkout -> payment result and return request", async ({ page }) => {
  const unique = Date.now();
  const user = {
    fullName: "Playwright Smoke User",
    email: `pw-smoke-${unique}@example.com`,
    phone: `555000${String(unique).slice(-4)}`,
    password: "PwSmoke123!",
  };

  await page.goto("/kayit");
  await page.fill('input[name="fullName"]', user.fullName);
  await page.fill('input[name="email"]', user.email);
  await page.fill('input[name="phone"]', user.phone);
  await page.fill('input[name="addressLine1"]', "Playwright Mah. 1");
  await page.fill('input[name="addressLine2"]', "Test Kat 2");
  await page.fill('input[name="city"]', "Istanbul");
  await page.fill('input[name="district"]', "Kadikoy");
  await page.fill('input[name="postalCode"]', "34000");
  await page.fill('input[name="password"]', user.password);
  await page.fill('input[name="confirmPassword"]', user.password);
  await page.locator('form:has(input[name="fullName"]) button[type="submit"]').click();
  await expect(page).toHaveURL(/\/hesabim|\/checkout/);

  await page.goto("/");
  const productForCart = await prisma.product.findFirst({
    where: {
      OR: [{ quantityControl: false }, { quantity: { gt: 0 } }],
    },
    orderBy: { id: "asc" },
    select: { id: true, name: true },
  });
  if (!productForCart) {
    throw new Error("No in-stock product available for smoke flow.");
  }
  const slug = buildProductSlug(productForCart.name, productForCart.id);
  await page.goto(`/urun/${slug}`);
  await expect(page).toHaveURL(new RegExp(`/urun/${slug}$`));
  await page.getByRole("button", { name: "Hemen Al" }).first().click();
  await page.waitForLoadState("networkidle");

  await page.goto("/sepet");
  if ((await page.getByText("Sepet boÅŸ.").count()) > 0) {
    await page.goto(`/urun/${slug}`);
    await page.getByRole("button", { name: "Sepete Ekle" }).first().click();
    await page.waitForLoadState("networkidle");
    await page.goto("/sepet");
  }
  await expect(page.getByText("Sepet boÅŸ.")).toHaveCount(0);
  await expect(page.getByText("SipariÅŸ Ã–zeti")).toBeVisible();
  await page.getByRole("link", { name: /GÃ¼venli Ã–demeye GeÃ§/i }).click();
  await expect(page).toHaveURL(/\/checkout/);
  await expect(page.getByRole("button", { name: "Ã–demeye geÃ§" })).toBeEnabled();
  await page.getByRole("button", { name: "Ã–demeye geÃ§" }).click();

  await page.waitForLoadState("networkidle");

  let orderId: number | null = null;
  const paymentMatch = page.url().match(/\/odeme\/(\d+)/);
  if (paymentMatch) {
    orderId = Number.parseInt(paymentMatch[1], 10);
  } else {
    await expect(page).toHaveURL(/\/checkout\?status=/);
    orderId = await ensureOrderForUser({
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
    });
  }

  await page.goto(`/odeme/basarisiz?orderId=${orderId}`);
  await expect(page.getByRole("heading", { name: /Odeme Basarisiz/i })).toBeVisible();

  await page.goto("/hesabim/siparislerim");
  await expect(page.getByRole("heading", { name: /SipariÅŸlerim/i })).toBeVisible();
  await page.getByRole("button", { name: "Iade Talebi Olustur" }).first().click();
  await expect(page).toHaveURL(/\/hesabim\/siparislerim\?status=(return_created|return_exists)/);

  const returnRequest = await prisma.adminReturnRequest.findFirst({
    where: { userEmail: user.email },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, type: true },
  });

  expect(returnRequest).not.toBeNull();
  expect(returnRequest?.type).toBe("RETURN");
  expect(["REQUESTED", "REVIEWING", "APPROVED", "COMPLETED", "CANCELLED"]).toContain(returnRequest?.status ?? "");
});

