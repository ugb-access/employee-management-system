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
      },
      authorize: async (credentials) => {
        const parsedCredentials = z
          .object({ email: z.string().email(), password: z.string().min(6) })
          .safeParse(credentials)

        if (!parsedCredentials.success) return null

        const { email, password } = parsedCredentials.data

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            settings: true,
          },
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
