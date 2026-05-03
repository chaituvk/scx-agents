import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { dob, ssn_last4, address } = await req.json();

    // Simulate KYC verification
    // In production, this would call:
    // - Identity verification APIs (Onfido, Jumio, Persona)
    // - Government databases
    // - Credit bureaus
    // - Sanctions lists (OFAC, UN, EU)
    // - PEP (Politically Exposed Persons) databases

    const mockResults = [
      { status: "verified", riskScore: 15, checks: { identity: true, sanctions: false, pep: false } },
      { status: "verified", riskScore: 35, checks: { identity: true, sanctions: false, pep: false } },
      { status: "rejected", riskScore: 75, checks: { identity: false, sanctions: true, pep: false }, reason: "Sanctions list match" },
      { status: "pending", riskScore: 50, checks: { identity: true, sanctions: false, pep: true }, reason: "PEP match - manual review required" },
    ];

    const result = mockResults[Math.floor(Math.random() * mockResults.length)];

    return NextResponse.json({
      status: result.status,
      riskScore: result.riskScore,
      checks: result.checks,
      reason: result.reason || null,
      timestamp: new Date().toISOString(),
      referenceId: `KYC-${Date.now()}`,
    });
  } catch {
    return NextResponse.json({ error: "KYC verification failed" }, { status: 400 });
  }
}
