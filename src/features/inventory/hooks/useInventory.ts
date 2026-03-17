'use client';
import { useEffect, useState } from 'react';
export function useInventory() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { fetch('/api/inventory').then((r) => r.json()).then((data) => setItems(data.data || [])); }, []);
  return { items };
}
