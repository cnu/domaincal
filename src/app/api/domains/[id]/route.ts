import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

// Define the context type for dynamic route parameters
type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await the params Promise to get the id
    const resolvedParams = await params;
    const domainId = resolvedParams.id;

    // Check if domain exists and belongs to the user
    const userDomain = await prisma.userDomains.findUnique({
      where: {
        userId_domainId: {
          userId: BigInt(session.user.id),
          domainId: BigInt(domainId),
        },
      },
    });

    if (!userDomain) {
      return NextResponse.json(
        { error: "Domain not found or not owned by user" },
        { status: 404 }
      );
    }

    // Delete the user-domain association
    await prisma.userDomains.delete({
      where: {
        userId_domainId: {
          userId: BigInt(session.user.id),
          domainId: BigInt(domainId),
        },
      },
    });

    // Check if any other users are tracking this domain
    const otherUserDomains = await prisma.userDomains.findFirst({
      where: {
        domainId: BigInt(domainId),
      },
    });

    // If no other users are tracking this domain, delete it
    if (!otherUserDomains) {
      await prisma.domain.delete({
        where: {
          id: BigInt(domainId),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting domain:", error);
    return NextResponse.json(
      { error: "Failed to delete domain" },
      { status: 500 }
    );
  }
}
