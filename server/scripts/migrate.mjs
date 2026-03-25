import { pool } from "../db.mjs";

const createCategoriesSql = `
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  image VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createProductsSql = `
CREATE TABLE IF NOT EXISTS products (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price INT NOT NULL,
  image VARCHAR(255) NOT NULL,
  images_json JSON NULL,
  category_id VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  features_json JSON NOT NULL,
  colors_json JSON NOT NULL,
  tags_json JSON NULL,
  is_new BOOLEAN NOT NULL DEFAULT FALSE,
  is_bestseller BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createUsersSql = `
CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(40) NULL,
  gender VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createUserAddressesSql = `
CREATE TABLE IF NOT EXISTS user_addresses (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL,
  phone VARCHAR(40) NOT NULL DEFAULT '',
  street VARCHAR(255) NOT NULL,
  province VARCHAR(120) NOT NULL,
  district VARCHAR(120) NOT NULL,
  neighborhood VARCHAR(120) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_addresses_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createUserSessionsSql = `
CREATE TABLE IF NOT EXISTS user_sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_sessions_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createPasswordResetTokensSql = `
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_password_reset_tokens_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  UNIQUE KEY uq_password_reset_token_hash (token_hash),
  KEY idx_password_reset_user (user_id),
  KEY idx_password_reset_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createEmailVerificationCodesSql = `
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(120) NOT NULL DEFAULT '',
  last_name VARCHAR(120) NOT NULL DEFAULT '',
  password_hash VARCHAR(255) NOT NULL,
  gender VARCHAR(20) NOT NULL,
  phone VARCHAR(40) NULL,
  code_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_verification_code_hash (code_hash),
  KEY idx_email_verification_email (email),
  KEY idx_email_verification_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createUserCartItemsSql = `
CREATE TABLE IF NOT EXISTS user_cart_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  quantity INT NOT NULL,
  color VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_cart_items_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_user_cart_items_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  UNIQUE KEY uq_user_cart_item (user_id, product_id, color)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createUserWishlistItemsSql = `
CREATE TABLE IF NOT EXISTS user_wishlist_items (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  product_id VARCHAR(50) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_wishlist_items_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_user_wishlist_items_product
    FOREIGN KEY (product_id)
    REFERENCES products(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  UNIQUE KEY uq_user_wishlist_item (user_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createUserOrdersSql = `
CREATE TABLE IF NOT EXISTS user_orders (
  id VARCHAR(20) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  order_date DATE NOT NULL,
  total INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  shipping_company VARCHAR(120) NULL,
  shipping_tracking_no VARCHAR(120) NULL,
  shipping_first_name VARCHAR(120) NULL,
  shipping_last_name VARCHAR(120) NULL,
  shipping_phone VARCHAR(40) NULL,
  shipping_street VARCHAR(255) NULL,
  shipping_province VARCHAR(120) NULL,
  shipping_district VARCHAR(120) NULL,
  shipping_neighborhood VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_orders_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createUserOrderItemsSql = `
CREATE TABLE IF NOT EXISTS user_order_items (
  id CHAR(36) PRIMARY KEY,
  order_id VARCHAR(20) NOT NULL,
  product_json JSON NOT NULL,
  quantity INT NOT NULL,
  color VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_order_items_order
    FOREIGN KEY (order_id)
    REFERENCES user_orders(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createAppSettingsSql = `
CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(120) PRIMARY KEY,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createContactRequestsSql = `
CREATE TABLE IF NOT EXISTS contact_requests (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

const createMarketingAbandonedCartEmailsSql = `
CREATE TABLE IF NOT EXISTS marketing_abandoned_cart_emails (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  email VARCHAR(255) NOT NULL,
  cart_signature CHAR(64) NOT NULL,
  cart_updated_at DATETIME NOT NULL,
  cart_snapshot_json JSON NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'sent',
  error_message TEXT NULL,
  sent_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_marketing_abandoned_cart_emails_user
    FOREIGN KEY (user_id)
    REFERENCES users(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

async function hasIndex(tableName, indexName) {
  const [rows] = await pool.query(`SHOW INDEX FROM \`${tableName}\``);
  return rows.some((row) => String(row.Key_name || "") === indexName);
}

async function ensureIndex(tableName, indexName, createSql) {
  if (await hasIndex(tableName, indexName)) {
    return;
  }
  await pool.query(createSql);
}

async function migrate() {
  await pool.query(createCategoriesSql);
  await pool.query(createProductsSql);
  await pool.query(createUsersSql);
  await pool.query(createUserAddressesSql);
  await pool.query(createUserSessionsSql);
  await pool.query(createPasswordResetTokensSql);
  await pool.query(createEmailVerificationCodesSql);
  await pool.query(createUserCartItemsSql);
  await pool.query(createUserWishlistItemsSql);
  await pool.query(createUserOrdersSql);
  await pool.query(createUserOrderItemsSql);
  await pool.query(createAppSettingsSql);
  await pool.query(createContactRequestsSql);
  await pool.query(createMarketingAbandonedCartEmailsSql);

  // Backward-compatible migration for existing databases.
  try {
    await pool.query(
      `ALTER TABLE user_addresses ADD COLUMN phone VARCHAR(40) NOT NULL DEFAULT '' AFTER last_name`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_addresses ADD COLUMN province VARCHAR(120) NOT NULL DEFAULT '' AFTER street`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_addresses ADD COLUMN district VARCHAR(120) NOT NULL DEFAULT '' AFTER province`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_addresses ADD COLUMN neighborhood VARCHAR(120) NOT NULL DEFAULT '' AFTER district`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  // Keep existing address data usable after schema change.
  try {
    await pool.query(
      `UPDATE user_addresses SET province = city WHERE (province = '' OR province IS NULL) AND city IS NOT NULL`
    );
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }
  }
  try {
    await pool.query(
      `UPDATE user_addresses SET district = postal_code WHERE (district = '' OR district IS NULL) AND postal_code IS NOT NULL`
    );
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }
  }
  try {
    await pool.query(
      `UPDATE user_addresses SET neighborhood = district WHERE (neighborhood = '' OR neighborhood IS NULL) AND district IS NOT NULL`
    );
  } catch (error) {
    if (error?.code !== "ER_BAD_FIELD_ERROR") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_orders ADD COLUMN shipping_company VARCHAR(120) NULL AFTER status`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_orders ADD COLUMN shipping_tracking_no VARCHAR(120) NULL AFTER shipping_company`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE products ADD COLUMN tags_json JSON NULL AFTER colors_json`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE products ADD COLUMN images_json JSON NULL AFTER image`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN gender VARCHAR(20) NULL AFTER phone`);
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_orders ADD COLUMN shipping_first_name VARCHAR(120) NULL AFTER shipping_tracking_no`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_orders ADD COLUMN shipping_last_name VARCHAR(120) NULL AFTER shipping_first_name`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_orders ADD COLUMN shipping_phone VARCHAR(40) NULL AFTER shipping_last_name`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_orders ADD COLUMN shipping_street VARCHAR(255) NULL AFTER shipping_phone`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_orders ADD COLUMN shipping_province VARCHAR(120) NULL AFTER shipping_street`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_orders ADD COLUMN shipping_district VARCHAR(120) NULL AFTER shipping_province`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(
      `ALTER TABLE user_orders ADD COLUMN shipping_neighborhood VARCHAR(120) NULL AFTER shipping_district`
    );
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(`ALTER TABLE email_verification_codes ADD COLUMN phone VARCHAR(40) NULL AFTER gender`);
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(`ALTER TABLE email_verification_codes ADD COLUMN first_name VARCHAR(120) NOT NULL DEFAULT '' AFTER email`);
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(`ALTER TABLE email_verification_codes ADD COLUMN last_name VARCHAR(120) NOT NULL DEFAULT '' AFTER first_name`);
  } catch (error) {
    if (error?.code !== "ER_DUP_FIELDNAME") {
      throw error;
    }
  }
  try {
    await pool.query(`ALTER TABLE email_verification_codes DROP INDEX uq_email_verification_code_hash`);
  } catch (error) {
    if (error?.code !== "ER_CANT_DROP_FIELD_OR_KEY" && error?.code !== "ER_DROP_INDEX_FK") {
      throw error;
    }
  }
  try {
    await pool.query(`CREATE INDEX idx_email_verification_code_hash ON email_verification_codes (code_hash)`);
  } catch (error) {
    if (error?.code !== "ER_DUP_KEYNAME") {
      throw error;
    }
  }

  await ensureIndex(
    "products",
    "idx_products_price_id",
    `CREATE INDEX idx_products_price_id ON products (price, id)`
  );
  await ensureIndex(
    "products",
    "idx_products_is_new_id",
    `CREATE INDEX idx_products_is_new_id ON products (is_new, id)`
  );
  await ensureIndex(
    "products",
    "idx_products_is_bestseller_id",
    `CREATE INDEX idx_products_is_bestseller_id ON products (is_bestseller, id)`
  );
  await ensureIndex(
    "products",
    "idx_products_category_price_id",
    `CREATE INDEX idx_products_category_price_id ON products (category_id, price, id)`
  );
  await ensureIndex(
    "products",
    "idx_products_category_new_id",
    `CREATE INDEX idx_products_category_new_id ON products (category_id, is_new, id)`
  );
  await ensureIndex(
    "user_orders",
    "idx_user_orders_user_created_at",
    `CREATE INDEX idx_user_orders_user_created_at ON user_orders (user_id, created_at)`
  );
  await ensureIndex(
    "user_addresses",
    "idx_user_addresses_user_default",
    `CREATE INDEX idx_user_addresses_user_default ON user_addresses (user_id, is_default)`
  );
  await ensureIndex(
    "user_sessions",
    "idx_user_sessions_expires_at",
    `CREATE INDEX idx_user_sessions_expires_at ON user_sessions (expires_at)`
  );
  await ensureIndex(
    "marketing_abandoned_cart_emails",
    "idx_marketing_abandoned_cart_signature",
    `CREATE INDEX idx_marketing_abandoned_cart_signature ON marketing_abandoned_cart_emails (user_id, cart_signature, status)`
  );
  await ensureIndex(
    "marketing_abandoned_cart_emails",
    "idx_marketing_abandoned_cart_sent_at",
    `CREATE INDEX idx_marketing_abandoned_cart_sent_at ON marketing_abandoned_cart_emails (sent_at)`
  );

  await pool.query(
    `
    INSERT INTO app_settings (setting_key, setting_value)
    VALUES ('site_name', 'StilBags&Fashion')
    ON DUPLICATE KEY UPDATE updated_at = updated_at
    `
  );
  console.log("Migration complete: product + auth tables are ready.");
}

try {
  await migrate();
} catch (error) {
  console.error("Migration failed:", error.message || error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
