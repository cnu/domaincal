"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "./ui/use-toast";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";

interface Domain {
  id: string;
  name: string;
  domainExpiryDate: string | null;
  createdAt: string;
  updatedAt: string | null;
}

interface DomainListProps {
  refreshTrigger?: number;
}

export function DomainList({ refreshTrigger = 0 }: DomainListProps) {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingDomainId, setDeletingDomainId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDomains = async () => {
      if (!session?.user) {
        setDomains([]);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch("/api/domains");
        if (!response.ok) {
          throw new Error("Failed to fetch domains");
        }

        const data = await response.json();
        setDomains(data.domains || []);
      } catch (error) {
        console.error("Error fetching domains:", error);
        toast({
          title: "Error",
          description: "Failed to load domains",
          variant: "destructive",
          id: "domains-error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDomains();
  }, [session, refreshTrigger, toast]);

  // Sort domains by expiration date (latest first)
  const sortedDomains = [...domains].sort((a, b) => {
    // Handle null expiry dates (put them at the end)
    if (!a.domainExpiryDate && !b.domainExpiryDate) return 0;
    if (!a.domainExpiryDate) return 1;
    if (!b.domainExpiryDate) return -1;

    // Sort by date (latest first)
    return (
      new Date(b.domainExpiryDate).getTime() -
      new Date(a.domainExpiryDate).getTime()
    );
  });

  const handleDeleteDomain = async (domainId: string) => {
    if (window.confirm("Are you sure you want to delete this domain?")) {
      setDeletingDomainId(domainId);
      try {
        const response = await fetch(`/api/domains/${domainId}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          throw new Error("Failed to delete domain");
        }

        // Remove the domain from the local state
        setDomains((prevDomains) =>
          prevDomains.filter((domain) => domain.id !== domainId)
        );

        toast({
          title: "Success",
          description: "Domain deleted successfully",
          id: "domains-deleted",
        });
      } catch (error) {
        console.error("Error deleting domain:", error);
        toast({
          title: "Error",
          description: "Failed to delete domain",
          variant: "destructive",
          id: "domains-delete-error",
        });
      } finally {
        setDeletingDomainId(null);
      }
    }
  };

  if (!session?.user) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-bold mb-4">Your Domains</h2>
      {loading ? (
        <p>Loading domains...</p>
      ) : domains.length === 0 ? (
        <p>No domains added yet.</p>
      ) : (
        <div className="space-y-4">
          {sortedDomains.map((domain) => (
            <div
              key={domain.id}
              className="border rounded-lg p-4 flex items-center justify-between"
            >
              <div className="flex items-center space-x-4">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="text-center">
                    {domain.domainExpiryDate ? (
                      <>
                        <div className="text-sm">
                          {format(new Date(domain.domainExpiryDate), "dd MMMM")}
                        </div>
                        <div className="font-bold">
                          {format(new Date(domain.domainExpiryDate), "yyyy")}
                        </div>
                      </>
                    ) : (
                      <div className="text-2xl font-bold">...</div>
                    )}
                  </div>
                </div>
                <div>
                  <span className="font-bold">{domain.name}</span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteDomain(domain.id)}
                disabled={deletingDomainId === domain.id}
                className="text-gray-500 hover:text-red-500 transition-colors"
                aria-label={`Delete ${domain.name}`}
              >
                <Trash2 size={20} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
