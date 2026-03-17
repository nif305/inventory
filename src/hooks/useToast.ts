'use client';
import { useCallback, useState } from 'react';
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const showToast = useCallback((value: string) => setMessage(value), []);
  const clearToast = useCallback(() => setMessage(null), []);
  return { message, showToast, clearToast };
}
