import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/libs/Auth';

export const { GET, POST } = toNextJsHandler(auth);
