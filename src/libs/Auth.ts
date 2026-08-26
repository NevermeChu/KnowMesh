import 'server-only';
import { betterAuth } from 'better-auth';
import { sendAuthenticationEmail } from '@/features/emails/server/SendAuthenticationEmail';
import { ensureUserWorkspace } from '@/features/workspaces/server/EnsureUserWorkspace';
import { syncPendingWorkspaceInvitations } from '@/features/workspaces/server/SyncPendingInvitations';
import { getAuthenticationCoreOptions } from '@/libs/AuthCore';
import { getBaseUrl } from '@/utils/Helpers';

export const auth = betterAuth({
  appName: 'KnowMesh',
  ...getAuthenticationCoreOptions(),
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
});
