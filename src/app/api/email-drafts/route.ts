import { NextRequest, NextResponse } from 'next/server';
import { EmailTemplateService } from '@/services/email-template.service';
export async function POST(request: NextRequest) {
  try {
    const { sourceType, sourceId, targetDept } = await request.json();
    if (!sourceType || !sourceId || !targetDept) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    return NextResponse.json(await EmailTemplateService.generateDraft(sourceType, sourceId, targetDept), { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
