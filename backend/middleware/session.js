import session from 'express-session';
import { SESSION_SECRET } from '../config/index.js';

// Anonymous, cookie-only session — no accounts, no login. express-session
// here is used purely to issue/sign a session id cookie; actual file and
// extraction state lives in pipeline/sessionStore.js, keyed by req.sessionID.
export const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24h
  },
});
