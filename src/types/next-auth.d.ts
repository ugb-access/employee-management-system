import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: 'ADMIN' | 'EMPLOYEE'
      designation: string | null
      employeeId: string | null
    } & DefaultSession['user']
  }

  interface User {
    role: 'ADMIN' | 'EMPLOYEE'
    designation: string | null
    employeeId: string | null
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'ADMIN' | 'EMPLOYEE'
    designation: string | null
    employeeId: string | null
  }
}
