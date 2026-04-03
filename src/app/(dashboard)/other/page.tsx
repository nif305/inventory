import { redirect } from 'next/navigation';

export default function OtherRedirectPage() {
  redirect('/suggestions?type=OTHER');
}
