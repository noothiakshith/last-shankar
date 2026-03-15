import { NextRequest, NextResponse } from 'next/server';
import { getToken, JWT } from 'next-auth/jwt';
import { Role } from '@prisma/client';

export type AuthToken = JWT & {
  id: string;
  email: string;
  role: Role;
};

export function checkAuth(token: any, allowedRoles?: Role[]): { ok: true } | { ok: false; status: number; error: string } {
  if (!token) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  // Check expiration if available
  if (token.exp && token.exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = token.role as Role;
    if (!allowedRoles.includes(userRole) && userRole !== Role.ADMIN) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
  }

  return { ok: true };
}

export function withAuth(
  handler: (req: NextRequest, token: JWT) => Promise<NextResponse>,
  allowedRoles?: Role[]
) {
  return async (req: NextRequest) => {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    
    const auth = checkAuth(token, allowedRoles);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    return handler(req, token!);
  };
}
