"use server";

import { addProductToCurrentFavoriteList } from "@/lib/favorites";
import { prisma } from "@/lib/prisma";
import { clearUserSessionCookie, getUserSessionFromCookie, setUserSessionCookie } from "@/lib/user-auth";
import bcrypt from "bcrypt";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function getStringField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeInternalPath(rawPath: string, fallback: string) {
  if (!rawPath || !rawPath.startsWith("/") || rawPath.startsWith("//")) {
    return fallback;
  }

  return rawPath;
}

function withStatus(path: string, status: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}status=${encodeURIComponent(status)}`;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function withNext(basePath: string, nextPath: string) {
  if (!nextPath || nextPath === "/" || nextPath === "/hesabim") {
    return basePath;
  }

  const encodedNext = encodeURIComponent(nextPath);
  const separator = basePath.includes("?") ? "&" : "?";
  return `${basePath}${separator}next=${encodedNext}`;
}

function parseOptionalPositiveInteger(rawValue: string) {
  if (!rawValue) {
    return null;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function withAuthContext(basePath: string, nextPath: string, favoriteProductId: number | null) {
  let target = withNext(basePath, nextPath);

  if (favoriteProductId && favoriteProductId > 0) {
    const separator = target.includes("?") ? "&" : "?";
    target = `${target}${separator}favoriteProductId=${favoriteProductId}`;
  }

  return target;
}

function getNextPath(formData: FormData) {
  const nextPath = getStringField(formData, "next");
  if (!nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return "/hesabim";
  }
  return nextPath;
}

async function applyPendingFavoriteProduct(productId: number | null) {
  if (!productId) {
    return false;
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    return false;
  }

  await addProductToCurrentFavoriteList(product.id);
  return true;
}

function revalidateUserPaths() {
  revalidatePath("/");
  revalidatePath("/arama");
  revalidatePath("/favoriler");
  revalidatePath("/giris");
  revalidatePath("/kayit");
  revalidatePath("/hesabim");
  revalidatePath("/checkout");
}

export async function registerUserAction(formData: FormData) {
  const nextPath = getNextPath(formData);
  const favoriteProductId = parseOptionalPositiveInteger(getStringField(formData, "favoriteProductId"));
  const fullName = getStringField(formData, "fullName");
  const email = normalizeEmail(getStringField(formData, "email"));
  const phone = getStringField(formData, "phone");
  const addressLine1 = getStringField(formData, "addressLine1");
  const addressLine2 = getStringField(formData, "addressLine2");
  const city = getStringField(formData, "city");
  const district = getStringField(formData, "district");
  const postalCode = getStringField(formData, "postalCode");
  const password = getStringField(formData, "password");
  const confirmPassword = getStringField(formData, "confirmPassword");

  if (!fullName || !email || !phone || !addressLine1 || !city || !district || !postalCode || !password || !confirmPassword) {
    redirect(withAuthContext("/kayit?status=invalid", nextPath, favoriteProductId));
  }

  if (!isValidEmail(email)) {
    redirect(withAuthContext("/kayit?status=invalid_email", nextPath, favoriteProductId));
  }

  if (password.length < 6) {
    redirect(withAuthContext("/kayit?status=short_password", nextPath, favoriteProductId));
  }

  if (password !== confirmPassword) {
    redirect(withAuthContext("/kayit?status=password_mismatch", nextPath, favoriteProductId));
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    redirect(withAuthContext("/kayit?status=email_exists", nextPath, favoriteProductId));
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const createdUser = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash,
      phone,
      addressLine1,
      addressLine2: addressLine2.length > 0 ? addressLine2 : null,
      city,
      district,
      postalCode,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  const sessionSet = await setUserSessionCookie({
    id: createdUser.id,
    fullName: createdUser.fullName,
    email: createdUser.email,
  });

  if (!sessionSet) {
    redirect(withAuthContext("/giris?status=session_error", nextPath, favoriteProductId));
  }

  const pendingFavoriteApplied = await applyPendingFavoriteProduct(favoriteProductId);
  revalidateUserPaths();

  if (pendingFavoriteApplied || nextPath !== "/hesabim") {
    redirect(nextPath);
  }

  redirect("/hesabim?status=registered");
}

export async function loginUserAction(formData: FormData) {
  const nextPath = getNextPath(formData);
  const favoriteProductId = parseOptionalPositiveInteger(getStringField(formData, "favoriteProductId"));
  const email = normalizeEmail(getStringField(formData, "email"));
  const password = getStringField(formData, "password");

  if (!email || !password || !isValidEmail(email)) {
    redirect(withAuthContext("/giris?status=invalid", nextPath, favoriteProductId));
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      fullName: true,
      email: true,
      passwordHash: true,
    },
  });

  if (!user) {
    redirect(withAuthContext("/giris?status=invalid", nextPath, favoriteProductId));
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    redirect(withAuthContext("/giris?status=invalid", nextPath, favoriteProductId));
  }

  const sessionSet = await setUserSessionCookie({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
  });

  if (!sessionSet) {
    redirect(withAuthContext("/giris?status=session_error", nextPath, favoriteProductId));
  }

  await applyPendingFavoriteProduct(favoriteProductId);
  revalidateUserPaths();
  redirect(nextPath);
}

export async function logoutUserAction() {
  await clearUserSessionCookie();
  revalidateUserPaths();
  redirect("/giris?status=logged_out");
}

export async function updateUserProfileAction(formData: FormData) {
  const session = await getUserSessionFromCookie();
  if (!session.ok) {
    redirect("/giris?status=required&next=%2Fhesabim");
  }

  const fullName = getStringField(formData, "fullName");
  const email = normalizeEmail(getStringField(formData, "email"));
  const phone = getStringField(formData, "phone");
  const addressLine1 = getStringField(formData, "addressLine1");
  const addressLine2 = getStringField(formData, "addressLine2");
  const city = getStringField(formData, "city");
  const district = getStringField(formData, "district");
  const postalCode = getStringField(formData, "postalCode");
  const newPassword = getStringField(formData, "newPassword");
  const confirmNewPassword = getStringField(formData, "confirmNewPassword");

  if (!fullName || !email || !phone || !addressLine1 || !city || !district || !postalCode) {
    redirect("/hesabim?status=invalid");
  }

  if (!isValidEmail(email)) {
    redirect("/hesabim?status=invalid_email");
  }

  if (newPassword.length > 0 && newPassword.length < 6) {
    redirect("/hesabim?status=short_password");
  }

  if (newPassword.length > 0 && newPassword !== confirmNewPassword) {
    redirect("/hesabim?status=password_mismatch");
  }

  const duplicatedEmail = await prisma.user.findFirst({
    where: {
      email,
      id: {
        not: session.session.userId,
      },
    },
    select: { id: true },
  });

  if (duplicatedEmail) {
    redirect("/hesabim?status=email_exists");
  }

  const updateData: {
    fullName: string;
    email: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    district: string;
    postalCode: string;
    passwordHash?: string;
  } = {
    fullName,
    email,
    phone,
    addressLine1,
    addressLine2: addressLine2.length > 0 ? addressLine2 : null,
    city,
    district,
    postalCode,
  };

  if (newPassword.length > 0) {
    updateData.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  const updatedUser = await prisma.user.update({
    where: { id: session.session.userId },
    data: updateData,
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  const sessionSet = await setUserSessionCookie({
    id: updatedUser.id,
    fullName: updatedUser.fullName,
    email: updatedUser.email,
  });

  if (!sessionSet) {
    redirect("/giris?status=session_error");
  }

  revalidateUserPaths();
  redirect("/hesabim?status=updated");
}

export async function upsertPrimaryAddressAction(formData: FormData) {
  const session = await getUserSessionFromCookie();
  if (!session.ok) {
    redirect("/giris?status=required&next=%2Fhesabim%2Fadresler");
  }

  const redirectTo = sanitizeInternalPath(getStringField(formData, "redirectTo"), "/hesabim/adresler");

  const fullName = getStringField(formData, "fullName");
  const phone = getStringField(formData, "phone");
  const addressLine1 = getStringField(formData, "addressLine1");
  const addressLine2 = getStringField(formData, "addressLine2");
  const city = getStringField(formData, "city");
  const district = getStringField(formData, "district");
  const postalCode = getStringField(formData, "postalCode");

  if (!fullName || !phone || !addressLine1 || !city || !district || !postalCode) {
    redirect(withStatus(redirectTo, "invalid"));
  }

  const updatedUser = await prisma.user.update({
    where: { id: session.session.userId },
    data: {
      fullName,
      phone,
      addressLine1,
      addressLine2: addressLine2.length > 0 ? addressLine2 : null,
      city,
      district,
      postalCode,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  });

  const sessionSet = await setUserSessionCookie({
    id: updatedUser.id,
    fullName: updatedUser.fullName,
    email: updatedUser.email,
  });

  if (!sessionSet) {
    redirect("/giris?status=session_error");
  }

  revalidatePath("/hesabim");
  revalidatePath("/hesabim/adresler");
  revalidatePath("/checkout");
  revalidatePath(redirectTo.split("?")[0] ?? redirectTo);
  redirect(withStatus(redirectTo, "updated"));
}

export async function deletePrimaryAddressAction() {
  const session = await getUserSessionFromCookie();
  if (!session.ok) {
    redirect("/giris?status=required&next=%2Fhesabim%2Fadresler");
  }

  await prisma.user.update({
    where: { id: session.session.userId },
    data: {
      addressLine1: "",
      addressLine2: null,
      city: "",
      district: "",
      postalCode: "",
    },
    select: { id: true },
  });

  revalidatePath("/hesabim");
  revalidatePath("/hesabim/adresler");
  redirect("/hesabim/adresler?status=deleted");
}

export async function createReturnRequestAction(formData: FormData) {
  const session = await getUserSessionFromCookie();
  if (!session.ok) {
    redirect("/giris?status=required&next=%2Fhesabim%2Fsiparislerim");
  }

  const redirectTo = sanitizeInternalPath(getStringField(formData, "redirectTo"), "/hesabim/siparislerim");
  const orderId = parseOptionalPositiveInteger(getStringField(formData, "orderId"));
  const orderItemId = parseOptionalPositiveInteger(getStringField(formData, "orderItemId"));
  const rawType = getStringField(formData, "type").toUpperCase();
  const type = rawType === "EXCHANGE" ? "EXCHANGE" : "RETURN";
  const reason = getStringField(formData, "reason").slice(0, 250);
  const note = getStringField(formData, "note").slice(0, 1000);

  if (!orderId) {
    redirect(withStatus(redirectTo, "return_invalid"));
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: session.session.userId },
    select: { email: true, phone: true },
  });

  if (!currentUser) {
    redirect("/giris?status=session_error");
  }

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      OR: [{ customerEmail: currentUser.email }, { customerPhone: currentUser.phone }],
    },
    select: {
      id: true,
      customerEmail: true,
    },
  });

  if (!order) {
    redirect(withStatus(redirectTo, "return_invalid"));
  }

  let safeOrderItemId: number | null = null;
  if (orderItemId) {
    const item = await prisma.orderItem.findFirst({
      where: {
        id: orderItemId,
        orderId: order.id,
      },
      select: { id: true },
    });
    safeOrderItemId = item?.id ?? null;
  }

  const existingOpenRequest = await prisma.adminReturnRequest.findFirst({
    where: {
      orderId: order.id,
      userEmail: currentUser.email,
      status: {
        in: ["REQUESTED", "REVIEWING", "APPROVED"],
      },
    },
    select: { id: true },
  });

  if (existingOpenRequest) {
    redirect(withStatus(redirectTo, "return_exists"));
  }

  await prisma.adminReturnRequest.create({
    data: {
      orderId: order.id,
      orderItemId: safeOrderItemId,
      userEmail: currentUser.email,
      type,
      reason: reason.length > 0 ? reason : "Musteri iade talebi",
      note: note.length > 0 ? note : null,
      status: "REQUESTED",
    },
  });

  revalidatePath("/hesabim/siparislerim");
  revalidatePath("/akalin1453/returns");
  redirect(withStatus(redirectTo, "return_created"));
}
