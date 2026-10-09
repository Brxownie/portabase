"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { backupButtonAction } from "@/features/database/actions/backup-button.action";
import { Check, DatabaseZap, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { ButtonWithConfirm } from "@/components/common/button-with-confirm";

export type BackupButtonProps = {
  databaseId: string;
  disable: boolean;
  isSync?: boolean;
};

export const BackupButton = (props: BackupButtonProps) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const isMobile = useIsMobile();

  const mutation = useMutation({
    mutationFn: async (databaseId: string) => {
      const backup = await backupButtonAction(databaseId);
      if (backup?.data?.success) {
        toast.success(
          props.isSync
            ? "Sync has been successfully requested."
            : backup.data.actionSuccess?.message || "Backup created successfully!",
        );
        queryClient.invalidateQueries({
          queryKey: ["database-data", props.databaseId],
        });
        queryClient.invalidateQueries({
          queryKey: ["backups", props.databaseId],
        });
        router.refresh();
      } else {
        toast.error(backup?.serverError || (props.isSync ? "Failed to request a sync." : "Failed to create backup."));
      }
    },
  });
  const HandleAction = async () => {
    await mutation.mutateAsync(props.databaseId);
  };

  return (
    <ButtonWithConfirm
      title={props.isSync ? "Run Sync" : "Create Backup"}
      description={
        props.isSync
          ? "Mirror the directory to its storages now? Files removed from the source are deleted from the replica."
          : "Are you sure you want to create a backup?"
      }
      button={{
        main: {
          disabled: props.disable,
          text: isMobile ? "" : props.isSync ? "Sync" : "Backup",
          variant: "default",
          icon: <DatabaseZap />,
        },
        confirm: {
          className: "w-full",
          text: props.isSync ? "Yes, sync now" : "Yes, create backup",
          icon: <Check />,
          variant: "default",
          onClick: async () => {
            await HandleAction();
          },
        },
        cancel: {
          className: "w-full",
          text: "No, cancel",
          icon: <X />,
          variant: "outline",
        },
      }}
      isPending={mutation.isPending}
    />
  );
};
