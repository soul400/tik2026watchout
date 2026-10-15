import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EnigmaEngine } from "@/lib/enigma-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;

    const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    let reviews = await EnigmaEngine.getEnigmaReviews(tenant.id, status);

    // Auto-sync if empty
    if (reviews.length === 0) {
      await EnigmaEngine.analyzeAndSyncEnigmaReviews(tenant.id);
      reviews = await EnigmaEngine.getEnigmaReviews(tenant.id, status);
    }

    return NextResponse.json({
      success: true,
      count: reviews.length,
      reviews,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch enigma reviews" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: "mohra-live" } });
    if (!tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    const syncedCount = await EnigmaEngine.analyzeAndSyncEnigmaReviews(tenant.id);
    const reviews = await EnigmaEngine.getEnigmaReviews(tenant.id);

    return NextResponse.json({
      success: true,
      syncedCount,
      reviewsCount: reviews.length,
      message: `تم فحص ومزامنة ${syncedCount} حساباً غامضاً بنجاح.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to analyze enigmas" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { reviewId, status } = body;

    if (!reviewId || !["PENDING", "CONFIRMED", "DISMISSED"].includes(status)) {
      return NextResponse.json({ error: "Invalid reviewId or status" }, { status: 400 });
    }

    const updated = await prisma.enigmaReview.update({
      where: { id: reviewId },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: "STREAMER_ANALYST",
      },
    });

    return NextResponse.json({
      success: true,
      updated,
      message: `تم تغيير حالة الفحص إلى ${status} بنجاح.`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to update review" },
      { status: 500 }
    );
  }
}
