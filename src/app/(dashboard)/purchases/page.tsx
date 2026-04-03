import { redirect } from 'next/navigation';

export default function PurchasesRedirectPage() {
  redirect('/suggestions?type=PURCHASE');
}
