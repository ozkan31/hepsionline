import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function printRows(title, rows) {
  console.log(`\n=== ${title} ===`);
  for (const row of rows) {
    console.log(JSON.stringify(row, null, 2));
  }
}

async function explain(title, sql, params = []) {
  const rows = await prisma.$queryRawUnsafe(`EXPLAIN FORMAT=JSON ${sql}`, ...params);
  printRows(title, rows);
}

async function main() {
  const [firstProduct, firstCart] = await Promise.all([
    prisma.product.findFirst({
      orderBy: { id: "asc" },
      select: { id: true },
    }),
    prisma.cart.findFirst({
      orderBy: { id: "desc" },
      select: { id: true, token: true },
    }),
  ]);

  if (!firstProduct) {
    throw new Error("No product found.");
  }
  if (!firstCart) {
    throw new Error("No cart found.");
  }

  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000);

  await explain(
    "AuditLog COUNT product_view 24h",
    `
SELECT COUNT(*) AS cnt
FROM AdminAuditLog
WHERE action = ?
  AND entity = ?
  AND entityId = ?
  AND createdAt >= ?
    `,
    ["event:product_view", "product", String(firstProduct.id), since24h],
  );

  await explain(
    "AuditLog COUNT add_to_cart 24h",
    `
SELECT COUNT(*) AS cnt
FROM AdminAuditLog
WHERE action = ?
  AND entity = ?
  AND entityId = ?
  AND createdAt >= ?
    `,
    ["event:add_to_cart", "product", String(firstProduct.id), since24h],
  );

  await explain(
    "Cart details (cart + items + product)",
    `
SELECT
  c.id AS cart_id,
  c.token AS cart_token,
  ci.id AS item_id,
  ci.quantity,
  ci.unitPrice,
  ci.productId,
  p.id AS product_id,
  p.name,
  p.imageUrl,
  p.imageAlt,
  p.imageBroken,
  p.oldPrice
FROM Cart c
LEFT JOIN CartItem ci ON ci.cartId = c.id
LEFT JOIN Product p ON p.id = ci.productId
WHERE c.token = ?
ORDER BY ci.id DESC
    `,
    [firstCart.token],
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
