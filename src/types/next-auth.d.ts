import { DefaultSession, DefaultUser } from "next-auth";
import { JWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    isAdmin: boolean;
    mustChangePassword: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    isAdmin: boolean;
    mustChangePassword: boolean;
  }
}
