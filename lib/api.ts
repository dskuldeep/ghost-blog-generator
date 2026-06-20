import { NextResponse } from "next/server";
import { auth } from "@/auth";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Throws ApiError(401) when there is no session. Returns the user otherwise. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new ApiError(401, "Unauthorized");
  return session.user;
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Wrap a route handler with auth + uniform error handling. */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      await requireUser();
      return await handler(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      console.error("[api] unhandled error:", err);
      const message = err instanceof Error ? err.message : "Internal error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  };
}
