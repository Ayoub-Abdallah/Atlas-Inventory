import { syncAllProductStocks } from '../utils/stock';

/**
 * API endpoint to sync all product stock quantities from their variants.
 * This is useful for fixing data inconsistencies.
 * 
 * POST /api/__sync-stock
 */
export default defineEventHandler(async (event) => {
  const db = useDB();

  const result = await syncAllProductStocks(db);

  return {
    success: true,
    message: `Synced ${result.synced} products`,
    details: result.products,
  };
});
