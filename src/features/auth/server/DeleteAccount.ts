'use server';

import { APIError } from 'better-auth/api';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import * as z from 'zod';
import { requireUser } from '@/features/auth/server/CurrentUser';
import { deleteUserData } from '@/features/users/server/DeleteUserData';
import { auth } from '@/libs/Auth';
import { db } from '@/libs/DB';
import { userSchema } from '@/models/Schema';

const deleteAccountSchema = z.object({
  password: z.string().min(1),
});

/**
 * Verifies the current password and atomically removes identity and business data.
 *
 * @param input - Current password confirmation.
 * @returns Whether the password was accepted and the account was removed.
 */
export async function deleteAccount(input: { password: string }) {
  const user = await requireUser();
  const deletionInput = deleteAccountSchema.parse(input);

  try {
    await auth.api.verifyPassword({
      body: deletionInput,
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      return { success: false as const };
    }

    throw error;
  }

  await db.transaction(async (transaction) => {
    await deleteUserData(transaction, user.id);
    const [deletedUser] = await transaction
      .delete(userSchema)
      .where(eq(userSchema.id, user.id))
      .returning({ id: userSchema.id });

    if (!deletedUser) {
      throw new Error('账户删除失败');
    }
  });

  return { success: true as const };
}
