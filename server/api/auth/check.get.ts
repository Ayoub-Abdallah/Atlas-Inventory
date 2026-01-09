import { users } from '../../database/schema';
import { count } from 'drizzle-orm';

export default defineEventHandler(async () => {
  try {
    const db = useDB();

    // Check if any users exist in the database
    const [result] = await db.select({ count: count() }).from(users);
    const hasUsers = result.count > 0;

    return {
      hasUsers,
      needsSetup: !hasUsers,
    };
  } catch (error) {
    console.error('[auth/check] Error:', error);
    throw createError({
      statusCode: 500,
      message: error instanceof Error ? error.message : 'Database error',
    });
  }
});
