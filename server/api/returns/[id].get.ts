import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const params = getRouterParams(event);
  const id = params.id;
  if (!id) throw createError({ statusCode: 400, message: 'Return id required' });

  const ret = await db.query.saleReturns.findFirst({ where: eq(tables.saleReturns.id, id), with: { items: true } });
  if (!ret) throw createError({ statusCode: 404, message: 'Return not found' });

  const refunds = await db.query.refunds.findMany({ where: eq(tables.refunds.saleReturnId, id) });

  return { ...ret, refunds };
});
