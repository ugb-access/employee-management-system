import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'

export default async function HomePage() {
  const session = await auth()

  if (session) {
    if (session.user.role === 'ADMIN') {
      redirect('/dashboard/admin')
    } else {
      redirect('/dashboard/employee')
    }
  }

  redirect('/login')
}
