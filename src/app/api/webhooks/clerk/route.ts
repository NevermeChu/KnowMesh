import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { NextRequest } from 'next/server';
import { deleteUserData } from '@/features/users/server/DeleteUserData';
import { ensureUserWorkspace } from '@/features/workspaces/server/EnsureUserWorkspace';
import { Env } from '@/libs/Env';

export async function POST(request: NextRequest) {
  if (!Env.CLERK_WEBHOOK_SIGNING_SECRET) {
    return new Response('Clerk webhook is not configured', { status: 503 });
  }

  let event;

  try {
    event = await verifyWebhook(request, {
      signingSecret: Env.CLERK_WEBHOOK_SIGNING_SECRET,
    });
  } catch {
    return new Response('Invalid webhook signature', { status: 400 });
  }

  if (event.type === 'user.created') {
    try {
      await ensureUserWorkspace(event.data.id);
    } catch {
      return new Response('Failed to provision personal workspace', { status: 500 });
    }
  }

  if (event.type === 'user.deleted') {
    if (!event.data.id) {
      return new Response('Deleted user identifier is missing', { status: 400 });
    }

    try {
      await deleteUserData(event.data.id);
    } catch {
      return new Response('Failed to delete user data', { status: 500 });
    }
  }

  return new Response('Webhook received', { status: 200 });
}
