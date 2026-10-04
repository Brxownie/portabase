import {eq} from "drizzle-orm";
import {db} from "@/db";
import * as drizzleDb from "@/db";
import {currentUser} from "@/lib/auth/current-user";
import {getActiveMember, getOrganization} from "@/lib/auth/auth";
import {computeOrganizationPermissions} from "@/lib/acl/organization-acl";
import {isAgentOnline} from "@/features/agents/utils/status/agent-status";
import {PolicyScope} from "@/features/database/schemas/policy-scope.schema";

export class DatabaseNotFoundError extends Error {
    constructor(databaseId: string) {
        super(`Database not found or update failed: ${databaseId}`);
        this.name = "DatabaseNotFoundError";
    }
}

export class UnauthorizedError extends Error {
    constructor(databaseId: string, message = `Not authorized to delete this database: ${databaseId}`) {
        super(message);
        this.name = "UnauthorizedError";
    }
}

export class AgentOnlineError extends Error {
    constructor(databaseId: string) {
        super(`Agent must be offline to delete this database: ${databaseId}`);
        this.name = "AgentOnlineError";
    }
}

export async function assertCanDeleteDatabase(databaseId: string): Promise<void> {
    const database = await db.query.database.findFirst({
        where: eq(drizzleDb.schemas.database.id, databaseId),
        with: {
            agent: true,
        },
    });

    if (!database || !database.agent) {
        throw new DatabaseNotFoundError(databaseId);
    }

    const user = await currentUser();
    if (!user) {
        throw new UnauthorizedError(databaseId);
    }

    const agent = database.agent;
    const isAdmin = user.role === "superadmin" || user.role === "admin";

    let authorized: boolean;
    if (agent.organizationId === null) {
        authorized = isAdmin;
    } else {
        const organization = await getOrganization({});
        const activeMember = await getActiveMember();
        const canManage = activeMember
            ? computeOrganizationPermissions(activeMember).canManageAgents
            : false;

        const hasAccess =
            !!organization && agent.organizationId === organization.id;
        authorized = canManage && hasAccess;
    }

    if (!authorized) {
        throw new UnauthorizedError(databaseId);
    }

    if (isAgentOnline(agent.lastContact)) {
        throw new AgentOnlineError(databaseId);
    }
}

export async function assertCanManageAgentDatabases(agentId: string): Promise<void> {
    const agent = await db.query.agent.findFirst({
        where: eq(drizzleDb.schemas.agent.id, agentId),
    });
    if (!agent) {
        throw new DatabaseNotFoundError(agentId);
    }

    const user = await currentUser();
    if (!user) {
        throw new UnauthorizedError(agentId);
    }

    const isAdmin = user.role === "superadmin" || user.role === "admin";

    let authorized: boolean;
    if (agent.organizationId === null) {
        authorized = isAdmin;
    } else {
        const organization = await getOrganization({});
        const activeMember = await getActiveMember();
        const canManage = activeMember
            ? computeOrganizationPermissions(activeMember).canManageAgents
            : false;
        const hasAccess = !!organization && agent.organizationId === organization.id;
        authorized = canManage && hasAccess;
    }

    if (!authorized) {
        throw new UnauthorizedError(agentId);
    }
}

/** Same rule as the database page: active org + member, and the database's project belongs to that org. */
export async function assertCanReadDatabase(databaseId: string): Promise<void> {
    const database = await db.query.database.findFirst({
        columns: {id: true},
        where: eq(drizzleDb.schemas.database.id, databaseId),
        with: {project: {columns: {organizationId: true}}},
    });
    const organization = await getOrganization({});
    const activeMember = await getActiveMember();

    if (!database?.project || !organization || !activeMember || database.project.organizationId !== organization.id) {
        throw new UnauthorizedError(databaseId, `Not authorized to read this database: ${databaseId}`);
    }
}

/**
 * Backup operations (download, restore, delete, migration): read access plus an
 * owner or admin role in that organization — members do not see these actions.
 */
export async function assertCanOperateDatabase(databaseId: string): Promise<void> {
    await assertCanReadDatabase(databaseId);
    const activeMember = await getActiveMember();
    if (!activeMember || activeMember.role === "member") {
        throw new UnauthorizedError(databaseId, `Not authorized to operate on this database: ${databaseId}`);
    }
}

/** Project settings (edit, delete, policies): the project is in the active organization and the member is an owner or admin. */
export async function assertCanManageProject(projectId: string): Promise<void> {
    const project = await db.query.project.findFirst({
        columns: {organizationId: true},
        where: eq(drizzleDb.schemas.project.id, projectId),
    });
    const organization = await getOrganization({});
    const activeMember = await getActiveMember();

    if (
        !project ||
        !organization ||
        project.organizationId !== organization.id ||
        !activeMember ||
        !computeOrganizationPermissions(activeMember).canManageSettings
    ) {
        throw new UnauthorizedError(projectId, `Not authorized to manage this project: ${projectId}`);
    }
}

/** Retention, alert and storage policies: operate rights on a database scope, manage rights on a project scope. */
export async function assertCanManagePolicyScope(scope: PolicyScope): Promise<void> {
    if (scope.type === "database") {
        await assertCanOperateDatabase(scope.id);
    } else {
        await assertCanManageProject(scope.id);
    }
}
