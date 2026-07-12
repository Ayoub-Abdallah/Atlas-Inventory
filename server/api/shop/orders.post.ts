import { and, eq, inArray } from 'drizzle-orm';
import { normalizePhone } from '../../../shared/utils/phone';
import { productPrice, productStock } from '../../utils/shop';

interface CheckoutItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

/**
 * Public checkout: creates a Web Order (status "new"). No online payment.
 * Prices are always computed server-side; stock is decremented later,
 * when an admin confirms the order.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  // Honeypot: bots fill every field; real form never sends "website"
  if (body?.website) {
    throw createError({ statusCode: 400, message: 'Invalid order' });
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (name.length < 2 || name.length > 80) {
    throw createError({ statusCode: 400, message: 'A valid name is required' });
  }

  const db = useDB();
  const settings = await db.query.settings.findFirst({
    where: eq(tables.settings.id, 1),
  });
  const countryCode = settings?.phoneCountryCode || '+213';

  const phone = normalizePhone(body?.phone, countryCode);
  if (!phone) {
    throw createError({ statusCode: 400, message: 'A valid phone number is required' });
  }

  const note =
    typeof body?.note === 'string' ? body.note.trim().slice(0, 500) : null;

  const rawItems: CheckoutItem[] = Array.isArray(body?.items) ? body.items : [];
  if (rawItems.length === 0 || rawItems.length > 20) {
    throw createError({ statusCode: 400, message: 'Cart must contain 1 to 20 items' });
  }
  for (const item of rawItems) {
    if (
      !item?.productId ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 99
    ) {
      throw createError({ statusCode: 400, message: 'Invalid cart item' });
    }
  }

  const productIds = [...new Set(rawItems.map((i) => i.productId))];
  const products = await db.query.products.findMany({
    where: and(
      inArray(tables.products.id, productIds),
      eq(tables.products.published, true),
      eq(tables.products.isActive, true)
    ),
    with: { variants: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Validate availability and compute totals server-side
  const orderItems = [];
  const unavailable: Array<{ productId: string; reason: string }> = [];
  for (const item of rawItems) {
    const product = productMap.get(item.productId);
    if (!product) {
      unavailable.push({ productId: item.productId, reason: 'not_available' });
      continue;
    }

    let unitPrice: number;
    let variantName: string | null = null;
    let available: number;

    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (!variant) {
        unavailable.push({ productId: item.productId, reason: 'not_available' });
        continue;
      }
      unitPrice = variant.price;
      variantName = variant.name;
      available = variant.stockQuantity || 0;
    } else {
      unitPrice = productPrice(product).price;
      available = productStock(product);
    }

    if (available < item.quantity) {
      unavailable.push({ productId: item.productId, reason: 'insufficient_stock' });
      continue;
    }

    orderItems.push({
      productId: product.id,
      variantId: item.variantId || null,
      productName: product.name,
      variantName,
      unitPrice,
      quantity: item.quantity,
      lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
    });
  }

  if (unavailable.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Some items are no longer available',
      data: { unavailable },
    });
  }

  const totalAmount =
    Math.round(orderItems.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;

  // Order number: WEB-YYMMDD-XXXX, retried on the (unlikely) collision
  const now = new Date();
  const datePart = `${String(now.getFullYear()).slice(2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  let orderNumber = '';
  for (let attempt = 0; attempt < 5; attempt++) {
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const candidate = `WEB-${datePart}-${rand}`;
    const clash = await db.query.webOrders.findFirst({
      where: eq(tables.webOrders.orderNumber, candidate),
      columns: { id: true },
    });
    if (!clash) {
      orderNumber = candidate;
      break;
    }
  }
  if (!orderNumber) {
    throw createError({ statusCode: 500, message: 'Could not allocate an order number' });
  }

  const orderId = generateId('worder');
  await db.insert(tables.webOrders).values({
    id: orderId,
    orderNumber,
    customerName: name,
    phone,
    note,
    status: 'new',
    totalAmount,
  });
  await db.insert(tables.webOrderItems).values(
    orderItems.map((item) => ({
      id: generateId('woitem'),
      orderId,
      ...item,
    }))
  );

  return {
    orderNumber,
    totalAmount,
    items: orderItems.map((i) => ({
      productName: i.productName,
      variantName: i.variantName,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
    })),
  };
});
