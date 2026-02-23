'use client'

import { cn } from '@/lib/utils'

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  text?: string
}

export function Loader({ size = 'md', className, text }: LoaderProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
  }

  return (
    <div className={cn('flex flex-col items-center justify-center gap-4', className)}>
      <div className="relative">
        {/* Outer ring */}
        <div
          className={cn(
            'rounded-full border-4 border-muted animate-spin',
            sizeClasses[size]
          )}
          style={{
            borderTopColor: 'hsl(var(--primary))',
            animationDuration: '1s',
          }}
        />
        {/* Inner pulse */}
        <div
          className={cn(
            'absolute inset-0 m-auto rounded-full bg-primary/20 animate-pulse',
            size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
          )}
        />
      </div>
      {text && (
        <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
      )}
    </div>
  )
}

export function PageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <Loader size="lg" text={text} />
    </div>
  )
}

export function FullPageLoader({ text = 'Loading...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50">
      <div className="flex flex-col items-center gap-6 p-8 rounded-2xl bg-card/50 backdrop-blur-md border shadow-lg">
        <div className="relative">
          {/* Triple ring loader */}
          <div
            className="w-16 h-16 rounded-full border-4 border-muted animate-spin"
            style={{
              borderTopColor: 'hsl(var(--primary))',
              animationDuration: '1.2s',
            }}
          />
          <div
            className="absolute inset-2 rounded-full border-4 border-muted animate-spin"
            style={{
              borderTopColor: 'hsl(var(--primary) / 0.6)',
              animationDuration: '0.9s',
              animationDirection: 'reverse',
            }}
          />
          <div
            className="absolute inset-4 rounded-full border-2 border-muted animate-spin"
            style={{
              borderTopColor: 'hsl(var(--primary) / 0.4)',
              animationDuration: '0.6s',
            }}
          />
        </div>
        <p className="text-lg font-medium text-foreground">{text}</p>
      </div>
    </div>
  )
}
