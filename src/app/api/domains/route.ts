import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { JsonValue } from "@prisma/client/runtime/library";

interface DomainResponse {
  id: string;
  name: string;
  domainExpiryDate: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

interface ErrorResponse {
  error: string;
}

interface Domain {
  id: bigint;
  name: string;
  domainExpiryDate: Date | null;
  domainCreatedDate: Date | null;
  domainUpdatedDate: Date | null;
  registrar: string | null;
  emails: string | null;
  response: JsonValue;
  createdAt: Date;
  updatedAt: Date;
}

const serializeDomain = (domain: Domain): DomainResponse => ({
  id: domain.id.toString(),
  name: domain.name,
  domainExpiryDate: domain.domainExpiryDate,
  createdAt: domain.createdAt,
  updatedAt: domain.updatedAt,
});

const validateDomain = (domain: string): boolean => {
  if (!domain || domain.includes(" ") || !domain.includes(".")) return false;

  try {
    // Basic URL validation
    new URL(`http://${domain}`);
    return true;
  } catch {
    return false;
  }
};

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const domains = await prisma.domain.findMany({
    where: {
      users: {
        some: {
          userId: BigInt(session.user.id),
        },
      },
    },
  });

  return NextResponse.json({ domains: domains.map(serializeDomain) });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { domain } = await request.json();

    if (!domain) {
      return NextResponse.json(
        { error: "Domain is required" },
        { status: 400 }
      );
    }

    // Validate domain
    const validDomain = validateDomain(domain.trim());

    if (!validDomain) {
      return NextResponse.json<ErrorResponse>(
        { error: "Invalid domain format" },
        { status: 400 }
      );
    }

    if (!session?.user?.id) {
      // For anonymous users, just validate the domain and return
      return NextResponse.json({
        message: "Please sign in to track this domain",
        requiresAuth: true,
        domain: { name: domain },
      });
    }

    // Check if domain already exists
    const existingDomain = await prisma.domain.findUnique({
      where: { name: domain },
    });

    let domainId: bigint;
    if (!existingDomain) {
      // Create new domain
      const newDomain = await prisma.domain.create({
        data: { name: domain },
      });
      domainId = newDomain.id;
    } else {
      domainId = existingDomain.id;
    }

    // Link domain to user
    await prisma.userDomains.upsert({
      where: {
        userId_domainId: {
          userId: BigInt(session.user.id),
          domainId,
        },
      },
      create: {
        userId: BigInt(session.user.id),
        domainId,
      },
      update: {}, // No updates needed if association exists
    });

    return NextResponse.json({
      message: "Domain added successfully",
      domain: serializeDomain({
        id: domainId,
        name: domain,
        domainExpiryDate: null,
        domainCreatedDate: null,
        domainUpdatedDate: null,
        registrar: null,
        emails: null,
        response: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    });
  } catch (error) {
    console.error("Error adding domain:", error);
    return NextResponse.json(
      { error: "Failed to add domain" },
      { status: 500 }
    );
  }
}
