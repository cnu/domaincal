import { NextRequest } from "next/server";
import { DomainController } from "@/controllers/domain.controller";

export async function GET() {
  return DomainController.getUserDomains();
}

export async function POST(request: NextRequest) {
  return DomainController.addDomain(request);
}
