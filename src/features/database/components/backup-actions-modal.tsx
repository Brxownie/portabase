"use client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {Separator} from "@/components/ui/separator";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert";
import {EDbmsSchema} from "@/db/schema/types";
import {BackupActionsForm} from "@/features/database/components/backup-actions-form";
import {BackupPresenceDetails} from "@/features/database/components/backup-presence-details";
import {
    getBackupActionTextBasedOnActionKind,
    useBackupModal
} from "@/features/database/components/backup-modal-context";


type DatabaseActionsModalProps = { dbms?: EDbmsSchema }


export const DatabaseBackupActionsModal = ({dbms}: DatabaseActionsModalProps) => {
    const {open, action, backup, closeModal} = useBackupModal();
    if (!backup || !action) return null;
    const text = getBackupActionTextBasedOnActionKind(action);
    const isPresence = action === "presence";


    return (
        <Dialog open={open} onOpenChange={closeModal}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isPresence ? text : `${text} backup ?`}</DialogTitle>
                    <DialogDescription>
                        {isPresence ? "Backup file presence per storage" : "Select the backup storage"}
                    </DialogDescription>
                    <Separator className="mt-3 mb-3"/>
                </DialogHeader>
                {action === "restore" && dbms === "files" && (
                    <Alert>
                        <AlertTitle>Mirror restore</AlertTitle>
                        <AlertDescription>
                            The directory will be returned to this backup&apos;s state. Files created since will be
                            deleted, except excluded paths.
                        </AlertDescription>
                    </Alert>
                )}
                {isPresence
                    ? <BackupPresenceDetails backup={backup}/>
                    : <BackupActionsForm backup={backup} action={action}/>}
            </DialogContent>
        </Dialog>
    )
}