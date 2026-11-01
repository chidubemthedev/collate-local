import "server-only";
import { cookies } from "next/headers";
import { getDataSource } from "@/lib/db";
import { AuthSession } from "@/lib/db/entities/auth-session.entity";
import { getSessionCookieName } from "./config";
import { hashSessionToken, isSessionValid } from "./session";
import { UnauthorizedError } from "./errors";

export interface CurrentUser {
  personId: string;
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(getSessionCookieName())?.value;
  if (!token) {
    return null;
  }

  const dataSource = await getDataSource();
  const session = await dataSource.getRepository(AuthSession).findOne({
    where: { sessionTokenHash: hashSessionToken(token) },
  });

  if (!session || !isSessionValid(session)) {
    return null;
  }

  return { personId: session.personId };
}

export async function requireUser(): Promise<CurrentUser> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    throw new UnauthorizedError();
  }
  return currentUser;
}
