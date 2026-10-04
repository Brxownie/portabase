import { createSafeActionClient } from "next-safe-action";
import { currentUser } from "@/lib/auth/current-user";
import { computeSystemPermissions } from "@/lib/acl/system-acl";

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

const handleReturnedServerError = (error: Error) => {
  if (error instanceof ActionError) {
    return error.message;
  } else {
    return "An unexpected error occurred.";
  }
};

export const action = createSafeActionClient({
  handleServerError: handleReturnedServerError,
});

export const userAction = action.use(async ({ next }) => {
  const user = await currentUser();
  if (!user) {
    throw new ActionError("You must be logged in");
  }
  if (user.banned) {
    throw new ActionError("Your account has been banned");
  }
  if (user.role === "pending") {
    throw new ActionError("Your account is pending approval");
  }
  return next({ ctx: { user } });
});

/** Instance admins (superadmin or admin): the same rule as the `(admin)` dashboard layout. */
export const systemAdminAction = userAction.use(async ({ next, ctx }) => {
  const permissions = computeSystemPermissions(ctx.user);
  if (!permissions.isSuperAdmin && !permissions.isAdmin) {
    throw new ActionError("You are not allowed to perform this action");
  }
  return next({ ctx: { permissions } });
});

export const superAdminAction = userAction.use(async ({ next, ctx }) => {
  const permissions = computeSystemPermissions(ctx.user);
  if (!permissions.canAccessSystem) {
    throw new ActionError("You are not allowed to perform this action");
  }
  return next({ ctx: { permissions } });
});
