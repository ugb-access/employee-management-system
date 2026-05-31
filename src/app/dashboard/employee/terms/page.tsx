'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { TermsView } from '@/components/terms-view'
import { PageLoader } from '@/components/ui/loader'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'

export default function EmployeeTermsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      fetchTerms()
    }
  }, [status])

  const fetchTerms = async () => {
    try {
      const res = await fetch('/api/terms')
      // Read as text first so a non-JSON response (e.g. an HTML error page
      // from a server failure) doesn't crash with a cryptic parse error.
      const text = await res.text()
      let data: { content?: string; error?: string } | null = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = null
      }
      if (!res.ok || !data) {
        throw new Error(
          data?.error || 'Could not load Terms & Policies. Please try again later.'
        )
      }
      setLoadError(false)
      setContent(data.content || '')
    } catch (err: unknown) {
      setLoadError(true)
      toast.error(
        err instanceof Error ? err.message : 'Could not load Terms & Policies'
      )
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading terms & policies..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Terms &amp; Policies</h1>
            <p className="text-muted-foreground">
              Company attendance, fines and leave policies
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Company Policy</CardTitle>
            <CardDescription>
              Please review the rules and policies that apply to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadError ? (
              <div className="text-center py-12 text-muted-foreground">
                Could not load Terms &amp; Policies right now. Please refresh the
                page or try again later.
              </div>
            ) : content.trim().length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No terms &amp; policies have been published yet.
              </div>
            ) : (
              <TermsView content={content} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
