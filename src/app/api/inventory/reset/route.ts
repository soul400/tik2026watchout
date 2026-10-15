import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SmartInventoryService } from "@/lib/smart-inventory";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { password } = body;

    // Strict validation: password must be 0000
    if (password !== "0000") {
      return NextResponse.json(
        { success: false, message: "كلمة المرور غير صحيحة. يرجى إدخال رمز التأكيد الصحيح (0000)." },
        { status: 401 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug: "mohra-live" },
    });

    if (!tenant) {
      return NextResponse.json(
        { success: false, message: "لم يتم العثور على الحساب المعني." },
        { status: 404 }
      );
    }

    const result = await SmartInventoryService.resetInventory(tenant.id);
    const freshCounters = await SmartInventoryService.getInventoryCounters(tenant.id);

    return NextResponse.json({
      success: true,
      message: `تم تصفير بيانات الخزينة التكتيكية بنجاح (تم حذف ${result.deletedGrantsCount} سجل).`,
      counters: freshCounters,
    });
  } catch (err: any) {
    console.error("[INVENTORY_RESET_ERROR]", err);
    return NextResponse.json(
      { success: false, message: err?.message || "حدث خطأ أثناء تصفير البيانات." },
      { status: 500 }
    );
  }
}
