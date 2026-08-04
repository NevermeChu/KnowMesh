import { UserProfile } from '@clerk/nextjs';

export default function UserProfilePage() {
  return (
    <div className="py-8">
      <UserProfile path="/settings/user-profile" />
    </div>
  );
}
