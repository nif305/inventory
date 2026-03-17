import { NextResponse } from 'next/server';
import { ReportService } from '@/services/report.service';

export async function GET() {
  try {
    const data = await ReportService.getExecutiveSummary();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: error?.message || 'تعذر تحميل ملخص التقارير',
      },
      { status: 500 }
    );
  }
}