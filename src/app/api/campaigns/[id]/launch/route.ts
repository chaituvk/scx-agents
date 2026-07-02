import { NextRequest, NextResponse } from "next/server";
import { campaignRepo } from "@/lib/repositories/campaign";
import { getTenantFromRequest } from "@/lib/tenant";
import { launchCampaign } from "@/lib/campaigns/delivery";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const tenantId = await getTenantFromRequest(req);
    const { id } = await params;

    const campaign = await campaignRepo.findById(id, tenantId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!["draft", "scheduled", "paused"].includes(campaign.status)) {
      return NextResponse.json(
        { error: `Campaign cannot be launched from status '${campaign.status}'` },
        { status: 400 }
      );
    }

    // Update status to running synchronously so the response reflects it
    await campaignRepo.update(id, tenantId, {
      status: "running",
      started_at: new Date().toISOString(),
    });

    // Fire-and-forget: run delivery in the background without awaiting
    launchCampaign(id, tenantId).catch((err) => {
      console.error(`[campaign] Background delivery error for ${id}:`, err);
    });

    return NextResponse.json({ status: "running" });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
