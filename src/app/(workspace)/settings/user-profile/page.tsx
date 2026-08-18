import { AccountSettings } from '@/features/auth/components/AccountSettings';
import { requireUser } from '@/features/auth/server/CurrentUser';

export default async function UserProfilePage() {
  const user = await requireUser();

  return <AccountSettings user={user} />;
}
