"use client"

import {useMutation} from "@tanstack/react-query";
import {Send, ShieldCheck} from "lucide-react";
import {toast} from "sonner";

import {Button} from "@/components/ui/button";
import {NotificationChannel} from "@/db/schema/09_notification-channel";
import {testNotificationChannelAction} from "@/features/channel/components/notifications/channel.action";
import {testStorageChannelAction} from "@/features/channel/components/storages/channel.action";
import {useIsMobile} from "@/hooks/use-mobile";
import {cn} from "@/lib/utils";
import {StorageChannel} from "@/db/schema/12_storage-channel";
import {ChannelKind} from "@/features/channel/components/channels-helpers";
import type {
    NotificationChannelFormType,
    StorageChannelFormType
} from "@/features/channel/schemas/channel-form.schema";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";


type NotifierTestChannelButtonProps = {
    channel: NotificationChannel | StorageChannel;
    organizationId?: string;
    kind: ChannelKind;
}

export const ChannelTestButton = ({channel, organizationId, kind}: NotifierTestChannelButtonProps) => {

    const isMobile = useIsMobile()

    const slugFromDatabaseName =
        kind === "notification" &&
        channel.provider === "healthchecks" &&
        Boolean((channel.config as { useDatabaseNameAsSlug?: boolean } | null)?.useDatabaseNameAsSlug);

    const mutation = useMutation({
        mutationFn: async () => {
            if (kind === "notification") {
                const result = (await testNotificationChannelAction({
                    organizationId,
                    data: channel as unknown as NotificationChannelFormType,
                }))?.data;

                if (result?.success) {
                    toast.success(result.message);
                } else {
                    toast.error("An error occurred while testing the notification channel, check your configuration");
                }
            } else if (kind === "storage") {
                const result = (await testStorageChannelAction({
                    organizationId,
                    data: channel as unknown as StorageChannelFormType,
                }))?.data;

                if (result?.success) {
                    toast.success("Successfully connected to storage channel");
                } else {
                    const responseText = result?.response ? `(${result.response})` : "";
                    toast.error(`An error occurred while testing the storage channel, check your configuration ${responseText}`);
                }
            } else {
                toast.error("Not yet supported");
            }

        },
    });

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div>
                    <Button
                        type="button"
                        variant="default"
                        onClick={() => mutation.mutateAsync()}
                        disabled={mutation.isPending || slugFromDatabaseName}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium shadow-sm transition-all"
                    >
                        {mutation.isPending ? (
                            <>
                                <div
                                    className={cn(" h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white", !isMobile && "mr-2")}/>
                                {!isMobile && `Sending...`}
                            </>
                        ) : (
                            <div className="flex flex-row justify-center items-center">
                                {kind === "notification" ?
                                    <>
                                        <Send className={cn("h-4 w-4", !isMobile && "mr-2")}/>{!isMobile && ` Test Channel`}
                                    </>
                                    :
                                    <>
                                        <ShieldCheck className={cn("h-4 w-4", !isMobile && "mr-2")}/>{!isMobile && ` Test Storage`}
                                    </>
                                }
                            </div>
                        )}
                    </Button>
                </div>
            </TooltipTrigger>

            {slugFromDatabaseName && (
                <TooltipContent>
                    This channel builds its ping URL from the database name of each event, so there is
                    nothing to ping outside a real backup.
                </TooltipContent>
            )}
        </Tooltip>
    )
}