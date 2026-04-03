import { redirect } from 'next/navigation';

export default function MaintenanceRedirectPage() {
  redirect('/suggestions?type=MAINTENANCE');
}
