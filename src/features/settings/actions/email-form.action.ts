"use server";
import { z } from "zod";
import { EmailFormSchema } from "@/features/settings/schemas/email-form.schema";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as drizzleDb from "@/db";
import {ActionError, superAdminAction, systemAdminAction} from "@/lib/safe-actions/actions";
import {withUpdatedAt} from "@/db/utils";
import {sendEmail} from "@/lib/email";
import {render} from "@react-email/components";
import EmailSettingsTest from "@/components/emails/email-settings-test";

export const updateEmailSettingsAction = systemAdminAction
    .inputSchema(
        z.object({
            name: z.string(),
            data: EmailFormSchema,
        })
    )
    .action(async ({ parsedInput }) => {
        const { name, data } = parsedInput;

        const [updatedSettings] = await db
            .update(drizzleDb.schemas.setting)
            .set(withUpdatedAt({
                ...data,
            }))
            .where(eq(drizzleDb.schemas.setting.name, name))
            .returning();

        return {
            data: updatedSettings,
        };
    });

export const sendTestEmailAction = superAdminAction
    .inputSchema(z.object({to: z.string().email()}))
    .action(async ({parsedInput}) => {
        try {
            const info = await sendEmail({
                to: parsedInput.to,
                subject: "Portabase",
                html: await render(EmailSettingsTest(), {}),
            });
            return {sent: !!info?.response};
        } catch (error) {
            throw new ActionError(
                error instanceof Error ? error.message : "Unknown error while sending test email",
            );
        }
    });
