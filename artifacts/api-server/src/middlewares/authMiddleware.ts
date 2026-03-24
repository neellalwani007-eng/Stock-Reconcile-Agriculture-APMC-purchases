import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";
import {
  clearSession,
  getSessionId,
  getSession,
  updateSession,
  refreshGoogleTokens,
  type SessionData,
} from "../lib/auth.js";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;
      user?: User | undefined;
      sessionId?: string;
      sessionData?: SessionData;
    }

    export interface AuthedRequest {
      user: User;
      sessionId: string;
      sessionData: SessionData;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  const sid = getSessionId(req);
  if (!sid) {
    next();
    return;
  }

  let session = await getSession(sid);
  if (!session?.user?.id) {
    await clearSession(res, sid);
    next();
    return;
  }

  // Refresh token if expired
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && now > session.expires_at) {
    const refreshed = await refreshGoogleTokens(session);
    if (!refreshed) {
      await clearSession(res, sid);
      next();
      return;
    }
    session = refreshed;
    await updateSession(sid, session);
  }

  req.user = session.user;
  req.sessionId = sid;
  req.sessionData = session;
  next();
}
