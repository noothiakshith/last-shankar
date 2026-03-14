import { getToken } from 'next-auth/jwt'
import { NextRequest, NextResponse } from 'next/server'
import { Role } from '@prisma/client'

export type { Role }

/**
 * Decoded JWT payload shape returned by NextAuth.
 */
export interface AuthToken {
  id: string
  email: string
  role: Role
  exp?: number
  iat?: number
}

/**
 * Higher-order function that wraps a Next.js App Router handler with
 * JWT authentication and role-based access control.
 *
 * - Returns 401 if no valid JWT is present or the token is expired.
 * - Returns 403 if the token's role is not in `requiredRoles`
 *   (ADMIN always passes).
 * - Injects the decoded token into the request as `req.auth` for
 *   downstream handlers.
 */
export function withAuth(
  handler: (req: NextRequest, token: AuthToken) => Promise<NextResponse>,
  requiredRoles: Role[],
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    })

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check expiry explicitly (getToken already handles this, but be explicit)
    if (token.exp && Date.now() / 1000 > (token.exp as number)) {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 })
    }

    const userRole = token.role as Role

    // ADMIN bypasses all role checks
    if (userRole !== Role.ADMIN && !requiredRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const authToken: AuthToken = {
      id: token.id as string,
      email: token.email as string,
      role: userRole,
      exp: token.exp as number | undefined,
      iat: token.iat as number | undefined,
    }

    return handler(req, authToken)
  }
}

/**
 * Standalone helper to validate a JWT token object (already decoded)
 * against a set of required roles. Used in property tests and
 * non-HTTP contexts.
 *
 * Returns:
 *  - { ok: true, token } if authorized
 *  - { ok: false, status: 401 } if token is null/expired
 *  - { ok: false, status: 403 } if role is insufficient
 */
export function checkAuth(
  token: AuthToken | null,
  requiredRoles: Role[],
): { ok: true; token: AuthToken } | { ok: false; status: 401 | 403 } {
  if (!token) {
    return { ok: false, status: 401 }
  }

  if (token.exp !== undefined && Date.now() / 1000 > token.exp) {
    return { ok: false, status: 401 }
  }

  if (token.role !== Role.ADMIN && !requiredRoles.includes(token.role)) {
    return { ok: false, status: 403 }
  }

  return { ok: true, token }
}

/**
 * Standalone helper to validate credentials and return an auth token
 * payload. Used in property tests without HTTP overhead.
 *
 * Returns null if credentials are invalid.
 */
export async function authorizeCredentials(
  email: string,
  password: string,
  findUser: (email: string) => Promise<{ id: string; email: string; role: Role; passwordHash: string | null } | null>,
  comparePassword: (plain: string, hash: string) => Promise<boolean>,
): Promise<AuthToken | null> {
  const user = await findUser(email)
  if (!user || !user.passwordHash) return null

  const valid = await comparePassword(password, user.passwordHash)
  if (!valid) return null

  return { id: user.id, email: user.email, role: user.role }
}
