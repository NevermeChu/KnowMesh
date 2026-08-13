import { verifyWebhook } from '@clerk/nextjs/webhooks';
import type { NextRequest } from 'next/server';
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

  return new Response('Webhook received', { status: 200 });
}
