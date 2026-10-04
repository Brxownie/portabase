import {z} from "zod";
import {validateRcloneConfig} from "@/features/channel/components/storages/rclone/rclone.parse";

export const RcloneChannelConfigSchema = z
    .object({
        configText: z.string().trim().min(1, "rclone config is required"),
        remoteName: z.string().trim().min(1, "Remote name is required"),
        remotePath: z.string().trim().optional().default(""),
    })
    .superRefine((value, ctx) => {
        const message = validateRcloneConfig(value.configText, value.remoteName);
        if (message) {
            ctx.addIssue({code: "custom", path: ["configText"], message});
        }
    });
