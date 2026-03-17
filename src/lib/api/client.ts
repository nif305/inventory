export async function apiClient<T = unknown>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error((data as any).error || 'Request failed');
  }
  return response.json() as Promise<T>;
}
