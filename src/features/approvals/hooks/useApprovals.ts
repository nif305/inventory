'use client';
import { useEffect, useState } from 'react';
export function useApprovals() {
  const [requests, setRequests] = useState<any[]>([]);
  useEffect(() => { fetch('/api/requests?status=PENDING').then((r) => r.json()).then((data) => setRequests(data.data || [])); }, []);
  return { requests };
}
