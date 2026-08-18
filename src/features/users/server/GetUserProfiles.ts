import 'server-only';
import { inArray } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { userSchema } from '@/models/Schema';

export type UserProfile = {
  displayName: string;
  email: string;
  imageUrl: string | null;
};

/**
 * Loads local Better Auth profiles in one query.
 *
 * @param userIds - User identifiers referenced by business membership rows.
 * @returns Profiles keyed by user identifier.
 */
export async function getUserProfiles(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)];

  if (uniqueUserIds.length === 0) {
    return new Map<string, UserProfile>();
  }

  const users = await db
    .select({
      email: userSchema.email,
      id: userSchema.id,
      image: userSchema.image,
      name: userSchema.name,
    })
    .from(userSchema)
    .where(inArray(userSchema.id, uniqueUserIds));

  return new Map(
    users.map((user) => [
      user.id,
      {
        displayName: user.name.trim() || user.email,
        email: user.email,
        imageUrl: user.image,
      },
    ]),
  );
}
