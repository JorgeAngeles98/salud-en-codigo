import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

const publicRoutes = ["/", "/login", "/registro", "/ficha", "/paciente-login"];
const publicPrefixes = [
  "/ficha/",
  "/api/auth/",
  "/api/public/",
  "/api/trpc/pacienteAuth.",
  "/api/trpc/ficha.accessByToken",
  "/api/trpc/feedback.submit",
];
const dashboardRoutes = ["/profesional", "/admin", "/paciente"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (publicRoutes.includes(pathname)) return NextResponse.next();
  if (publicPrefixes.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) return NextResponse.next();

  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    if (dashboardRoutes.some((r) => pathname.startsWith(r))) {
      loginUrl.searchParams.set("callbackUrl", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const role = req.auth.user?.role;

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/profesional", req.url));
  }
  if (pathname.startsWith("/profesional") && role === "ADMIN") {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  if (pathname.startsWith("/profesional") && role === "PACIENTE") {
    return NextResponse.redirect(new URL("/paciente", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.json|icon-.*\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json|woff|woff2|ttf)$).*)",
  ],
};
