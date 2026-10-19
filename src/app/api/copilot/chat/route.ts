import { NextRequest, NextResponse } from "next/server";
import { CopilotService } from "@/lib/copilot-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query : "";
    const tenantId = typeof body.tenantId === "string" ? body.tenantId : "default-tenant";

    if (!query.trim()) {
      return NextResponse.json(
        { error: "حقل السؤال (query) مطلوب." },
        { status: 400 }
      );
    }

    // Rate limiting or length check
    if (query.length > 500) {
      return NextResponse.json(
        { error: "طول السؤال يتجاوز الحد الأقصى المسموح (500 حرف)." },
        { status: 400 }
      );
    }

    const result = await CopilotService.askCopilot(tenantId, query);

    return NextResponse.json({
      success: true,
      answer: result.answer,
      source: result.source,
      responseTimeMs: result.responseTimeMs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[COPILOT_API_ERROR]", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء معالجة استفسار المساعد الذكي." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId") || "default-tenant";

    const context = await CopilotService.getGroundedContext(tenantId);
    return NextResponse.json({
      success: true,
      context,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
