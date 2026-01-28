import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const mustChangePassword = req.auth?.user?.mustChangePassword;
  
  // Public paths
  const isPublicPath = pathname === "/login";
  
  // Allow access to login page if not authenticated
  if (isPublicPath && !isLoggedIn) {
    return NextResponse.next();
  }
  
  // Redirect to dashboard if already logged in and trying to access login
  if (isPublicPath && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  
  // Redirect to login if not authenticated
  if (!isLoggedIn && !isPublicPath) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  
  // Force password change if required (except on change-password page)
  if (mustChangePassword && pathname !== "/change-password" && !isPublicPath) {
    return NextResponse.redirect(new URL("/change-password", req.url));
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
