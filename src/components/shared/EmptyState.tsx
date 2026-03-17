import { Card } from '@/components/ui/Card';
export function EmptyState({ title, description }: { title: string; description?: string }) {
  return <Card className="p-8 text-center"><h3 className="mb-2 font-bold text-primary">{title}</h3>{description ? <p className="text-sm text-gray-500">{description}</p> : null}</Card>;
}
