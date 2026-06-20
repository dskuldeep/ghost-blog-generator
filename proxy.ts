import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Next.js 16 "proxy" convention (formerly middleware). NextAuth's `auth`
// higher-order handler enforces the `authorized` callback in auth.config.ts.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Protect everything except Next internals, the login page, auth API, and static assets.
  matcher: ["/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)"],
};
