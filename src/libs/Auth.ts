import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sendAuthenticationEmail } from '@/features/emails/server/SendAuthenticationEmail';
import { ensureUserWorkspace } from '@/features/workspaces/server/EnsureUserWorkspace';
import { syncPendingWorkspaceInvitations } from '@/features/workspaces/server/SyncPendingInvitations';
import { db } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { accountSchema, sessionSchema, userSchema, verificationSchema } from '@/models/Schema';
import { getBaseUrl } from '@/utils/Helpers';

export const auth = betterAuth({
  appName: 'KnowMesh',
  baseURL: getBaseUrl(),
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: {
      account: accountSchema,
      session: sessionSchema,
      user: userSchema,
      verification: verificationSchema,
    },
  }),
  databaseHooks: {
    session: {
      create: {
        after: async (session) => {
          await ensureUserWorkspace(session.userId);
        },
      },
    },
    user: {
      create: {
        after: async (user) => {
          await ensureUserWorkspace(user.id);
        },
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthenticationEmail({ kind: 'password-reset', to: user.email, url });
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
  },
  trustedOrigins: [new URL(getBaseUrl()).origin],
  emailVerification: {
    autoSignInAfterVerification: true,
    afterEmailVerification: async (user) => {
      await syncPendingWorkspaceInvitations(user.id, [user.email]);
    },
    sendOnSignIn: true,
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthenticationEmail({ kind: 'verification', to: user.email, url });
    },
  },
  secret: Env.BETTER_AUTH_SECRET,
});
