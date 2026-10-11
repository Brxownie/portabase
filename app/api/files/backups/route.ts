import {NextResponse} from "next/server";
import path from "path";
import type {StorageInput} from "@/features/storages/types";
import {dispatchStorage} from "@/features/storages/utils/storages.dispatch";
import {verifyBackupToken} from "@/features/storages/utils/backup-url";
import {Readable} from "node:stream";
import {logger} from "@/lib/logger";
import {env} from "@/env.mjs";

const log = logger.child({module: "api/files/backups"});

export async function GET(
    request: Request,
) {

    const {searchParams} = new URL(request.url);
    const token = searchParams.get('token');
    const expires = searchParams.get('expires');
    const pathFromUrl = searchParams.get('path');
    const storageId = searchParams.get('storageId');

    if (!pathFromUrl || !storageId) {
        return NextResponse.json({error: "Missing search params"}, {status: 404})
    }

    const fileName = path.basename(pathFromUrl);

    const check = verifyBackupToken(fileName, expires, token, env.PROJECT_SECRET);
    if (!check.ok) {
        return NextResponse.json(
            {error: `Invalid signed token: ${check.reason}`},
            {status: check.reason === "missing" ? 400 : 403}
        );
    }

    const input: StorageInput = {
        action: "get",
        data: {
            path: pathFromUrl,
            signedUrl: true,
        },
        metadata: {
            storageId: storageId,
            fileKind: "backups",
        }
    };

    log.info({input: input}, "Dispatch Storage");

    const result = await dispatchStorage(input, undefined, storageId);

    if (!result.success) {
        return NextResponse.json({error: "Enable to get file from provided storage channel, an error occurred !"})
    }

    if (!result.file || !(result.file instanceof Readable)) {
        return NextResponse.json(
            {error: "Invalid file payload"},
            {status: 500}
        );
    }

    const fileStream = Readable.from(result.file as Readable);

    const stream = new ReadableStream({
        start(controller) {
            fileStream.on('data', (chunk) => controller.enqueue(chunk));
            fileStream.on('end', () => controller.close());
            fileStream.on('error', (err) => controller.error(err));
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Type': 'application/octet-stream',
        },
    });
}


