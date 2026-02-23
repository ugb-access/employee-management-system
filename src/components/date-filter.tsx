'use client'

import { useState, useRef, useEffect, useMemo, memo } from 'react'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { CalendarIcon, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { DateRange } from 'react-day-picker'

export interface DateFilterValue {
  startDate: string
  endDate: string
}

export type DateFilterMode = 'month' | 'range'

export interface DateFilterProps {
  modes?: DateFilterMode[]
  monthCount?: number
  onChange: (value: DateFilterValue) => void
  className?: string
}

export function getCurrentMonthRange(): DateFilterValue {
  const now = new Date()
  return {
    startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
  }
}

function DateFilterComponent({
  modes = ['month'],
  monthCount = 12,
  onChange,
  className,
}: DateFilterProps) {
  // State
  const [mode, setMode] = useState<DateFilterMode>(modes[0])
  const [selectedMonth, setSelectedMonth] = useState(new Date())
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const [rangePickerOpen, setRangePickerOpen] = useState(false)

  // Use ref for date range to avoid re-renders during selection
  const dateRangeRef = useRef<DateRange | undefined>(undefined)
  const [, forceUpdate] = useState({})

  // Refs
  const onChangeRef = useRef(onChange)
  const lastEmittedRef = useRef<string>('')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Month options
  const monthOptions = useMemo(() => {
    const options: { date: Date; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < monthCount; i++) {
      const d = subMonths(now, i)
      options.push({
        date: d,
        label: format(d, 'MMMM yyyy'),
      })
    }
    return options
  }, [monthCount])

  // Emit only if changed
  const emit = (start: Date, end: Date) => {
    const key = `${format(start, 'yyyy-MM-dd')}_${format(end, 'yyyy-MM-dd')}`
    if (lastEmittedRef.current !== key) {
      lastEmittedRef.current = key
      onChangeRef.current({
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      })
    }
  }

  // Handle month selection
  const handleMonthSelect = (date: Date) => {
    setSelectedMonth(date)
    setMonthPickerOpen(false)
    emit(startOfMonth(date), endOfMonth(date))
  }

  // Handle range selection
  const handleRangeSelect = (range: DateRange | undefined) => {
    // Update ref (doesn't trigger re-render)
    dateRangeRef.current = range

    // Force a re-render to update the display
    forceUpdate({})

    // Only close and emit when BOTH dates are selected
    if (range?.from && range?.to) {
      setRangePickerOpen(false)
      emit(range.from, range.to)
    }
  }

  // Handle mode change
  const handleModeChange = (newMode: DateFilterMode) => {
    if (newMode === mode) return
    setMode(newMode)
  }

  // Labels
  const monthLabel = format(selectedMonth, 'MMMM yyyy')

  // Get range from ref for display
  const rangeLabel = useMemo(() => {
    const range = dateRangeRef.current
    if (!range?.from) return 'Select dates'
    if (!range?.to) return `${format(range.from, 'MMM d')} - ?`
    return `${format(range.from, 'MMM d')} - ${format(range.to, 'MMM d, yyyy')}`
  }, [dateRangeRef.current])

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Mode Toggle */}
      {modes.length > 1 && (
        <div className="flex h-9 rounded-lg border bg-muted p-0.5">
          <button
            type="button"
            onClick={() => handleModeChange('month')}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-colors',
              mode === 'month'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('range')}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md transition-colors',
              mode === 'range'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            Range
          </button>
        </div>
      )}

      {/* Month Picker */}
      {mode === 'month' && (
        <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex h-9 w-44 items-center justify-between rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
            >
              <span>{monthLabel}</span>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-1" align="start">
            <div className="max-h-64 overflow-y-auto">
              {monthOptions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleMonthSelect(opt.date)}
                  className={cn(
                    'w-full rounded px-2 py-1.5 text-sm text-left hover:bg-accent',
                    format(selectedMonth, 'yyyy-MM') === format(opt.date, 'yyyy-MM') &&
                      'bg-accent font-medium'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Range Picker */}
      {mode === 'range' && (
        <Popover open={rangePickerOpen} onOpenChange={setRangePickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[260px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {rangeLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-0"
            align="start"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <Calendar
              mode="range"
              defaultMonth={dateRangeRef.current?.from}
              selected={dateRangeRef.current}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

export const DateFilter = memo(DateFilterComponent)
