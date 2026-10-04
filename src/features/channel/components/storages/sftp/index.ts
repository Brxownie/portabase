import {Readable} from "node:stream";

import {SftpConfig} from "@/features/channel/components/storages/sftp/types";
import {toRcloneTarget} from "@/features/channel/components/storages/rclone/target";
import {
    checkRclone,
    copyRclone,
    deleteRclone,
    getRclone,
    pingRclone,
    uploadRclone,
} from "@/features/channel/components/storages/rclone";
import {
    StorageCopyInput,
    StorageDeleteInput,
    StorageGetInput,
    StorageMetaData,
    StorageResult,
    StorageUploadInput,
} from "@/features/storages/types";

const PROVIDER = "sftp" as const;

export async function uploadSftp(
    config: SftpConfig,
    input: {data: StorageUploadInput; metadata?: StorageMetaData},
): Promise<StorageResult> {
    const {rclone, cleanup} = await toRcloneTarget("sftp", config);
    try {
        const result = await uploadRclone(rclone, input);
        return {...result, provider: PROVIDER} as unknown as StorageResult;
    } finally {
        cleanup();
    }
}

export async function getSftp(
    config: SftpConfig,
    input: {data: StorageGetInput; metadata: StorageMetaData},
): Promise<StorageResult> {
    const {rclone, cleanup} = await toRcloneTarget("sftp", config);
    try {
        const result = await getRclone(rclone, input);
        const file = result.file instanceof Readable ? result.file : undefined;
        if (result.success && file) {
            file.on("close", cleanup);
        } else {
            cleanup();
        }
        return {...result, provider: PROVIDER};
    } catch (e) {
        cleanup();
        throw e;
    }
}

export async function deleteSftp(
    config: SftpConfig,
    input: {data: StorageDeleteInput; metadata?: StorageMetaData},
): Promise<StorageResult> {
    const {rclone, cleanup} = await toRcloneTarget("sftp", config);
    try {
        const result = await deleteRclone(rclone, input);
        return {...result, provider: PROVIDER} as unknown as StorageResult;
    } finally {
        cleanup();
    }
}

export async function checkSftp(
    config: SftpConfig,
    input: {data: {path: string}; metadata?: StorageMetaData},
): Promise<StorageResult> {
    const {rclone, cleanup} = await toRcloneTarget("sftp", config);
    try {
        const result = await checkRclone(rclone, input);
        return {...result, provider: PROVIDER} as unknown as StorageResult;
    } finally {
        cleanup();
    }
}

export async function copySftp(
    config: SftpConfig,
    input: {data: StorageCopyInput},
): Promise<StorageResult> {
    const {rclone, cleanup} = await toRcloneTarget("sftp", config);
    try {
        const result = await copyRclone(rclone, input);
        return {...result, provider: PROVIDER} as unknown as StorageResult;
    } finally {
        cleanup();
    }
}

export async function pingSftp(config: SftpConfig): Promise<StorageResult> {
    const {rclone, cleanup} = await toRcloneTarget("sftp", config);
    try {
        const result = await pingRclone(rclone);
        return {...result, provider: PROVIDER} as unknown as StorageResult;
    } finally {
        cleanup();
    }
}
