/**
 * Auth Property-Based Tests
 *
 * Tests the `withAuth` middleware and `authorizeCredentials` logic directly
 * without HTTP overhead. Prisma is mocked via in-memory stubs.
 *
 * Properties covered:
 *  1. JWT contains correct identity claims          (Req 1.1)
 *  2. Invalid credentials always rejected           (Req 1.2)
 *  3. Unauthenticated requests always rejected      (Req 1.4)
 *  4. Insufficient-role requests always rejected    (Req 1.5, 2.2, 2.3)
 *  5. ADMIN role passes all permission checks       (Req 2.4)
 */

import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { authorizeCredentials, checkAuth, type AuthToken } from '@/lib/auth'

// ─────────────────────────────────────────────
// Helpers / Arbitraries
// ─────────────────────────────────────────────

const ALL_ROLES = Object.values(Role) as Role[]

/** Arbitrary that picks any valid Role */
const arbRole = fc.constantFrom(...ALL_ROLES)

/** Arbitrary that picks any non-ADMIN Role */
const arbNonAdminRole = fc.constantFrom(
  ...ALL_ROLES.filter((r) => r !== Role.ADMIN),
)

/** Arbitrary for a non-empty subset of roles (used as requiredRoles) */
const arbRequiredRoles = fc.array(arbRole, { minLength: 1, maxLength: ALL_ROLES.length }).map(
  (arr) => [...new Set(arr)] as Role[],
)

/** Arbitrary for a non-empty subset of non-ADMIN roles */
const arbNonAdminRequiredRoles = fc
  .array(arbNonAdminRole, { minLength: 1, maxLength: ALL_ROLES.length - 1 })
  .map((arr) => [...new Set(arr)] as Role[])

/** Build a mock AuthToken */
function makeToken(overrides: Partial<AuthToken> = {}): AuthToken {
  return {
    id: 'user-123',
    email: 'test@example.com',
    role: Role.SALES_ANALYST,
    ...overrides,
  }
}

/** Build an expired token (exp in the past) */
function makeExpiredToken(role: Role = Role.ADMIN): AuthToken {
  return makeToken({ role, exp: Math.floor(Date.now() / 1000) - 3600 })
}

// ─────────────────────────────────────────────
// Property 1: JWT contains correct identity claims
// Validates: Requirements 1.1
// ─────────────────────────────────────────────

describe('Property 1: JWT contains correct identity claims', () => {
  it('authorizeCredentials returns token with correct id and role for valid user', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbRole,
        fc.string({ minLength: 1, maxLength: 30 }),
        async (role, password) => {
          const userId = `user-${Math.random().toString(36).slice(2)}`
          const email = `user-${userId}@example.com`
          const hash = await bcrypt.hash(password, 1) // cost=1 for speed

          const findUser = async () => ({
            id: userId,
            email,
            role,
            passwordHash: hash,
          })

          const token = await authorizeCredentials(email, password, findUser, bcrypt.compare)

          // Token must be non-null
          expect(token).not.toBeNull()
          // Token must carry the correct user ID
          expect(token!.id).toBe(userId)
          // Token must carry the correct role
          expect(token!.role).toBe(role)
          // Token must carry the correct email
          expect(token!.email).toBe(email)
        },
      ),
      { numRuns: 20 },
    )
  })
})

// ─────────────────────────────────────────────
// Property 2: Invalid credentials always rejected
// Validates: Requirements 1.2
// ─────────────────────────────────────────────

describe('Property 2: Invalid credentials always rejected', () => {
  it('returns null when user does not exist', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.emailAddress(),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (email, password) => {
          const findUser = async () => null

          const token = await authorizeCredentials(email, password, findUser, bcrypt.compare)
          expect(token).toBeNull()
        },
      ),
      { numRuns: 20 },
    )
  })

  it('returns null when password does not match', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbRole,
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 1, maxLength: 30 }),
        async (role, correctPassword, wrongPassword) => {
          fc.pre(correctPassword !== wrongPassword)

          const hash = await bcrypt.hash(correctPassword, 1)
          const findUser = async () => ({
            id: 'user-abc',
            email: 'user@example.com',
            role,
            passwordHash: hash,
          })

          const token = await authorizeCredentials(
            'user@example.com',
            wrongPassword,
            findUser,
            bcrypt.compare,
          )
          expect(token).toBeNull()
        },
      ),
      { numRuns: 20 },
    )
  })

  it('returns null when user has no passwordHash', async () => {
    await fc.assert(
      fc.asyncProperty(
        arbRole,
        fc.string({ minLength: 1, maxLength: 30 }),
        async (role, password) => {
          const findUser = async () => ({
            id: 'user-abc',
            email: 'user@example.com',
            role,
            passwordHash: null,
          })

          const token = await authorizeCredentials(
            'user@example.com',
            password,
            findUser,
            bcrypt.compare,
          )
          expect(token).toBeNull()
        },
      ),
      { numRuns: 10 },
    )
  })
})

// ─────────────────────────────────────────────
// Property 3: Unauthenticated requests always rejected
// Validates: Requirements 1.4
// ─────────────────────────────────────────────

describe('Property 3: Unauthenticated requests always rejected', () => {
  it('checkAuth returns 401 when token is null regardless of required roles', () => {
    fc.assert(
      fc.property(arbRequiredRoles, (requiredRoles) => {
        const result = checkAuth(null, requiredRoles)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.status).toBe(401)
        }
      }),
      { numRuns: 100 },
    )
  })

  it('checkAuth returns 401 for expired tokens regardless of role or required roles', () => {
    fc.assert(
      fc.property(arbRole, arbRequiredRoles, (role, requiredRoles) => {
        const expiredToken = makeExpiredToken(role)
        const result = checkAuth(expiredToken, requiredRoles)
        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.status).toBe(401)
        }
      }),
      { numRuns: 100 },
    )
  })
})

// ─────────────────────────────────────────────
// Property 4: Insufficient-role requests always rejected
// Validates: Requirements 1.5, 2.2, 2.3
// ─────────────────────────────────────────────

describe('Property 4: Insufficient-role requests always rejected', () => {
  it('checkAuth returns 403 when role is not in requiredRoles (non-ADMIN)', () => {
    fc.assert(
      fc.property(
        arbNonAdminRole,
        arbNonAdminRequiredRoles,
        (userRole, requiredRoles) => {
          // Ensure the user's role is NOT in the required roles
          fc.pre(!requiredRoles.includes(userRole))

          const token = makeToken({ role: userRole })
          const result = checkAuth(token, requiredRoles)

          expect(result.ok).toBe(false)
          if (!result.ok) {
            expect(result.status).toBe(403)
          }
        },
      ),
      { numRuns: 200 },
    )
  })

  it('checkAuth returns ok when role IS in requiredRoles', () => {
    fc.assert(
      fc.property(arbNonAdminRole, (userRole) => {
        const token = makeToken({ role: userRole })
        const result = checkAuth(token, [userRole])

        expect(result.ok).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
})

// ─────────────────────────────────────────────
// Property 5: ADMIN role passes all permission checks
// Validates: Requirements 2.4
// ─────────────────────────────────────────────

describe('Property 5: ADMIN role passes all permission checks', () => {
  it('checkAuth never returns 403 for ADMIN regardless of requiredRoles', () => {
    fc.assert(
      fc.property(arbRequiredRoles, (requiredRoles) => {
        const adminToken = makeToken({ role: Role.ADMIN })
        const result = checkAuth(adminToken, requiredRoles)

        // ADMIN must never be forbidden
        if (!result.ok) {
          expect(result.status).not.toBe(403)
        } else {
          expect(result.ok).toBe(true)
        }
      }),
      { numRuns: 200 },
    )
  })

  it('checkAuth returns ok for ADMIN even with empty requiredRoles list', () => {
    const adminToken = makeToken({ role: Role.ADMIN })
    // Even with no roles required (empty array), ADMIN should pass
    // because ADMIN bypasses the role check entirely
    const result = checkAuth(adminToken, [])
    expect(result.ok).toBe(true)
  })

  it('checkAuth returns ok for ADMIN with any single role requirement', () => {
    fc.assert(
      fc.property(arbRole, (requiredRole) => {
        const adminToken = makeToken({ role: Role.ADMIN })
        const result = checkAuth(adminToken, [requiredRole])
        expect(result.ok).toBe(true)
      }),
      { numRuns: 100 },
    )
  })
})
