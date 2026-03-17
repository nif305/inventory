'use client';
import React from 'react';
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">حدث خطأ غير متوقع في عرض هذا الجزء.</div>;
    return this.props.children;
  }
}
