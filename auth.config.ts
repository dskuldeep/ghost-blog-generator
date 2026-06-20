import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no DB / Node-only deps). Used by middleware and extended in auth.ts.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  // trustHost lets NextAuth infer the URL from request headers, so AUTH_URL is
  // optional on Railway. AUTH_SECRET falls back to SECRETS_KEY so a single
  // stable secret is enough to deploy.
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.SECRETS_KEY,
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname.startsWith("/login");
      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/topics", nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
