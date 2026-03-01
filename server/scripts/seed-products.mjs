import { pool } from "../db.mjs";
import { loadSeedData } from "../loadSeedData.mjs";

async function seed() {
  const { products, categories } = await loadSeedData();

  for (const category of categories) {
    await pool.query(
      `
      INSERT INTO categories (id, name, image, description)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        image = VALUES(image),
        description = VALUES(description)
      `,
      [category.id, category.name, category.image, category.description]
    );
  }

  for (const product of products) {
    await pool.query(
      `
      INSERT INTO products (
        id, name, price, image, category_id, description,
        features_json, colors_json, is_new, is_bestseller
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        price = VALUES(price),
        image = VALUES(image),
        category_id = VALUES(category_id),
        description = VALUES(description),
        features_json = VALUES(features_json),
        colors_json = VALUES(colors_json),
        is_new = VALUES(is_new),
        is_bestseller = VALUES(is_bestseller)
      `,
      [
        product.id,
        product.name,
        product.price,
        product.image,
        product.category,
        product.description,
        JSON.stringify(product.features ?? []),
        JSON.stringify(product.colors ?? []),
        Boolean(product.isNew),
        Boolean(product.isBestseller),
      ]
    );
  }

  console.log(
    `Seed complete: ${categories.length} categories, ${products.length} products upserted.`
  );
}

try {
  await seed();
} catch (error) {
  console.error("Seed failed:", error.message || error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
