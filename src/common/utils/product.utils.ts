import { ProductStatus } from '@prisma/client';

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function buildProductReferenceBase(name: string): string {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toUpperCase();

  return normalized.slice(0, 16) || 'PRD';
}

export function resolveProductStatusFromStock(stock: number): ProductStatus {
  return stock > 0 ? ProductStatus.AVAILABLE : ProductStatus.UNAVAILABLE;
}

export function serializeProduct<T extends { price: { toNumber(): number }; discountPrice?: { toNumber(): number } | null; weight?: { toNumber(): number } | null }>(
  product: T,
) {
  return {
    ...product,
    price: product.price.toNumber(),
    discountPrice: product.discountPrice?.toNumber() ?? null,
    weight: product.weight?.toNumber() ?? null,
  };
}
