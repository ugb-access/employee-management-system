'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard-layout'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { RichTextEditor } from '@/components/rich-text-editor'
import { TermsView } from '@/components/terms-view'
import { PageLoader } from '@/components/ui/loader'
import { FileText, Loader2, RotateCcw, Save } from 'lucide-react'
import { generateDefaultTermsHtml, type TermsSettings } from '@/lib/terms'
import { toast } from 'sonner'

export default function AdminTermsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [content, setContent] = useState('')
  const [settings, setSettings] = useState<TermsSettings | null>(null)
  const [isDefault, setIsDefault] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (session && session.user.role !== 'ADMIN') {
      router.push('/dashboard/employee')
    }
  }, [session, status, router])

  useEffect(() => {
    if (session && session.user.role === 'ADMIN') {
      fetchData()
    }
  }, [session])

  const safeParse = (text: string): Record<string, unknown> | null => {
    try {
      return text ? JSON.parse(text) : null
    } catch {
      return null
    }
  }

  const loadSettings = async (): Promise<TermsSettings | null> => {
    try {
      const res = await fetch('/api/settings')
      const data = safeParse(await res.text())
      const s = (data?.settings as TermsSettings | undefined) ?? null
      if (s) setSettings(s)
      return s
    } catch {
      return null
    }
  }

  const fetchData = async () => {
    try {
      // Load settings independently so a Terms failure never blocks Regenerate.
      const loadedSettings = await loadSettings()

      // Load terms; degrade to a client-generated document rather than failing.
      let loadedContent = ''
      let defaultFlag = true
      try {
        const res = await fetch('/api/terms')
        const data = safeParse(await res.text())
        loadedContent = (data?.content as string) || ''
        defaultFlag = (data?.isDefault as boolean) ?? true
      } catch {
        loadedContent = ''
      }

      // If the server gave us nothing but we have settings, generate locally.
      if (loadedContent.trim().length === 0 && loadedSettings) {
        loadedContent = generateDefaultTermsHtml(loadedSettings)
        defaultFlag = true
      }

      setContent(loadedContent)
      setIsDefault(defaultFlag)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load terms')
    } finally {
      setLoading(false)
    }
  }

  const handleRegenerate = async () => {
    // Fetch settings on demand if they didn't load initially.
    const current = settings ?? (await loadSettings())
    if (!current) {
      toast.error('Could not load settings. Please refresh and try again.')
      return
    }
    if (
      !confirm(
        'Replace the current content with a fresh document generated from your current settings? Unsaved edits will be lost.'
      )
    ) {
      return
    }
    setContent(generateDefaultTermsHtml(current))
    toast.success('Regenerated from current settings. Review and save to publish.')
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/terms', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save terms')
      }
      setContent(data.content)
      setIsDefault(false)
      toast.success('Terms & Policies published successfully')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save terms')
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <DashboardLayout>
        <PageLoader text="Loading terms & policies..." />
      </DashboardLayout>
    )
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">Terms &amp; Policies</h1>
                {isDefault && (
                  <Badge variant="outline">Default (not yet published)</Badge>
                )}
              </div>
              <p className="text-muted-foreground">
                Edit the policy document employees see. Content is saved and
                rendered as safe text.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleRegenerate}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Regenerate from current settings
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save &amp; Publish
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Policy Document</CardTitle>
            <CardDescription>
              {isDefault
                ? 'This is a draft generated from your current settings. Edit and publish it to make it official.'
                : 'This is the published document employees currently see.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="edit">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit" className="mt-4">
                <RichTextEditor content={content} onChange={setContent} />
              </TabsContent>
              <TabsContent value="preview" className="mt-4">
                {content.trim().length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Nothing to preview yet.
                  </div>
                ) : (
                  <div className="rounded-md border p-4">
                    <TermsView content={content} />
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
