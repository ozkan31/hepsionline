import type { PrismaClient as PrismaClientType } from "@prisma/client";

declare global {
  var prisma: PrismaClientType | undefined;
}

const currentEngineType = (process.env.PRISMA_CLIENT_ENGINE_TYPE ?? "").toLowerCase();
if (!currentEngineType || currentEngineType === "client" || currentEngineType === "dataproxy") {
  process.env.PRISMA_CLIENT_ENGINE_TYPE = "library";
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaClient } = require("@prisma/client") as {
  PrismaClient: new () => PrismaClientType;
};

export const prisma: PrismaClientType = global.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
