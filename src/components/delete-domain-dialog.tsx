"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useDeleteDomain } from "@/hooks/use-domains";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteDomainDialogProps {
  domainId: string;
  domainName: string;
  onDeleted: () => void;
}

export function DeleteDomainDialog({
  domainId,
  domainName,
  onDeleted,
}: DeleteDomainDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteDomainMutation = useDeleteDomain();
  const { toast } = useToast();

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteDomainMutation.mutateAsync(domainId);
      setIsOpen(false);
      onDeleted();
    } catch (error) {
      console.error("Error deleting domain:", error);
      toast({
        title: "Error",
        description: "Failed to delete domain",
        variant: "destructive",
        id: "domains-delete-error",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className="text-gray-500 hover:text-red-500 transition-colors"
          aria-label={`Delete ${domainName}`}
        >
          <Trash2 size={20} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Domain</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the domain <strong>{domainName}</strong>?
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button variant="outline" disabled={isDeleting}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
