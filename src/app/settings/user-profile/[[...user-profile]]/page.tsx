import { Show, UserProfile } from '@clerk/nextjs';

export default function UserProfilePage() {
  return (
    <div className="my-6 lg:-ml-12">
      <Show when="signed-in">
        <UserProfile path="/dashboard/user-profile" />
      </Show>
    </div>
  );
}
