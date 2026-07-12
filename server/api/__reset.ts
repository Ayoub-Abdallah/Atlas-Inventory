import { users } from '../database/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const db = useDB();
  const passwordHash = await hashPassword('12345678');
  await db.update(users).set({ passwordHash }).where(eq(users.email, 'ayoubabdallah.dev@gmail.com'));
  return { success: true };
});
