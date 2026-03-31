import { google } from "googleapis";
import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetCurrentAuthUserResponse,
} from "@workspace/api-zod";
import { db, usersTable } from "@workspace/db";
import { and, eq, ne } from "drizzle-orm";
import {
  clearSession,
  createGoogleOAuth2Client,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  type SessionData,
} from "../lib/auth.js";

const router: IRouter = Router();

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/";
  }
  return value;
}

async function upsertUser(userInfo: {
  id?: string | null;
  email?: string | null;
  given_name?: string | null;
  family_name?: string | null;
  name?: string | null;
  picture?: string | null;
}, refreshToken?: string | null) {
  const userData = {
    id: userInfo.id as string,
    email: userInfo.email ?? null,
    firstName: userInfo.given_name ?? userInfo.name?.split(" ")[0] ?? null,
    lastName: userInfo.family_name ?? userInfo.name?.split(" ").slice(1).join(" ") ?? null,
    profileImageUrl: userInfo.picture ?? null,
    ...(refreshToken ? { googleRefreshToken: refreshToken } : {}),
  };

  // Remove any stale rows that share the same email but a different id
  // (can happen when switching auth providers or re-creating OAuth clients)
  if (userData.email) {
    await db
      .delete(usersTable)
      .where(and(eq(usersTable.email, userData.email), ne(usersTable.id, userData.id)));
  }

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/login", (req: Request, res: Response) => {
  const redirectUri = `${getOrigin(req)}/api/callback`;
  const returnTo = getSafeReturnTo(req.query.returnTo);

  const oauth2Client = createGoogleOAuth2Client(redirectUri);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account",
    scope: [
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/drive.appdata",
    ],
    state: returnTo,
  });

  res.redirect(authUrl);
});

router.get("/callback", async (req: Request, res: Response) => {
  const redirectUri = `${getOrigin(req)}/api/callback`;
  const { code, state, error } = req.query;

  if (error) {
    res.redirect("/api/login");
    return;
  }

  if (!code || typeof code !== "string") {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(state);

  try {
    const oauth2Client = createGoogleOAuth2Client(redirectUri);
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      res.redirect("/api/login");
      return;
    }

    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    if (!userInfo.id) {
      res.redirect("/api/login");
      return;
    }

    // Save refresh token to DB if Google returned one; otherwise reuse stored one
    const dbUser = await upsertUser(userInfo, tokens.refresh_token ?? null);

    // If Google didn't return a refresh token (re-login without consent prompt),
    // use the one we stored from the first login so token refresh keeps working.
    const effectiveRefreshToken =
      tokens.refresh_token ?? dbUser.googleRefreshToken ?? undefined;

    const now = Math.floor(Date.now() / 1000);
    const sessionData: SessionData = {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        profileImageUrl: dbUser.profileImageUrl,
      },
      access_token: tokens.access_token,
      refresh_token: effectiveRefreshToken,
      expires_at: tokens.expiry_date
        ? Math.floor(tokens.expiry_date / 1000)
        : now + 3600,
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.redirect(returnTo);
  } catch (err) {
    console.error("Google OAuth callback error:", err);
    res.redirect("/api/login");
  }
});

router.get("/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  await clearSession(res, sid);
  res.redirect("/");
});

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json({ success: true });
});

export default router;
