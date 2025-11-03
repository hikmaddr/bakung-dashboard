import { Suspense } from "react";
import UserNotificationsContent from "./UserNotificationsContent";

export default function UserNotificationsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500 dark:text-gray-400">Memuat notifikasi…</div>}>
      <UserNotificationsContent />
    </Suspense>
  );
}
