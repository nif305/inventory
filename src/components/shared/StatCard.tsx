import React from 'react';
import { Card } from '@/components/ui/Card';
export function StatCard({ title, value, icon, trend, variant }: { title: string; value: string | number; icon?: string; trend?: string; variant?: 'warning' | 'danger'; }) {
  return (
    <Card className={`p-5 ${variant === 'warning' ? 'border-amber-200' : variant === 'danger' ? 'border-red-200' : ''}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-surface-subtle">{title}</p>
          <p className="mt-2 text-3xl font-bold text-primary">{value}</p>
          {trend ? <p className="mt-2 text-xs text-green-600">{trend}</p> : null}
        </div>
        <div className="rounded-2xl bg-surface px-3 py-2 text-xs text-surface-subtle">{icon || '—'}</div>
      </div>
    </Card>
  );
}
