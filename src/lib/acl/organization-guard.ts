import "server-only";
import {User} from "@/db/schema/02_user";
import {getActiveMember, getOrganization} from "@/lib/auth/auth";
import {computeOrganizationPermissions} from "@/lib/acl/organization-acl";
import {computeSystemPermissions} from "@/lib/acl/system-acl";
import {ActionError} from "@/lib/safe-actions/actions";

/**
 * Organization settings (agents, projects, channels): instance admins, or owners/admins
 * of `organizationId` while it is their active organization. No organization (an
 * instance-level object) leaves instance admins only.
 */
export async function assertCanManageOrganization(user: User, organizationId: string | null | undefined) {
    const {isSuperAdmin, isAdmin} = computeSystemPermissions(user);
    if (isSuperAdmin || isAdmin) return;
    const organization = organizationId ? await getOrganization({}) : null;
    const activeMember = organization ? await getActiveMember() : null;
    if (
        !organization ||
        organization.id !== organizationId ||
        !activeMember ||
        !computeOrganizationPermissions(activeMember).canManageSettings
    ) {
        throw new ActionError("You are not allowed to perform this action");
    }
}
