import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from './prisma'
import { z } from 'zod'

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        loginType: { label: 'Login Type', type: 'text' },
        employeeId: { label: 'Employee ID', type: 'text' },
        accessKey: { label: 'Access Key', type: 'text' },
      },
      authorize: async (credentials) => {
        const loginType = (credentials as Record<string, string>).loginType

        if (loginType === 'employee') {
          // Employee login: employeeId + accessKey
          const parsed = z
            .object({
              employeeId: z.string().min(1),
              accessKey: z.string().min(1),
            })
            .safeParse(credentials)

          if (!parsed.success) return null

          const { employeeId, accessKey } = parsed.data

          const user = await prisma.user.findFirst({
            where: {
              employeeId,
              role: 'EMPLOYEE',
            },
          })

          if (!user || !user.isActive || !user.accessKey) return null

          if (user.accessKey !== accessKey) return null

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            designation: user.designation,
            employeeId: user.employeeId,
          }
        } else {
          // Admin login: email + password
          const parsed = z
            .object({
              email: z.string().email(),
              password: z.string().min(6),
            })
            .safeParse(credentials)

          if (!parsed.success) return null

          const { email, password } = parsed.data

          const user = await prisma.user.findUnique({
            where: { email },
          })

          if (!user || !user.isActive) return null

          const passwordsMatch = await compare(password, user.password)

          if (!passwordsMatch) return null

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            designation: user.designation,
            employeeId: user.employeeId,
          }
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = (user.id ?? token.sub) as string
        token.role = user.role
        token.designation = user.designation
        token.employeeId = user.employeeId
      }
      return token
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as 'ADMIN' | 'EMPLOYEE'
        session.user.designation = token.designation as string | null
        session.user.employeeId = token.employeeId as string | null
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
})
