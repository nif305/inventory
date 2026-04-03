import { redirect } from 'next/navigation';

export default function CleaningRedirectPage() {
  redirect('/suggestions?type=CLEANING');
}
