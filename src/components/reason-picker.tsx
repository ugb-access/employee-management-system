'use client'

import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  MIN_OTHER_REASON_LENGTH,
  MIN_OTHER_REASON_WORDS,
  OTHER_REASON,
  countWords,
} from '@/lib/reasons'

export interface ReasonValue {
  choice: string
  details: string
}

export const EMPTY_REASON: ReasonValue = { choice: '', details: '' }

interface ReasonPickerProps {
  id: string
  options: readonly string[]
  value: ReasonValue
  onChange: (value: ReasonValue) => void
  label?: string
}

export function ReasonPicker({ id, options, value, onChange, label = 'Reason' }: ReasonPickerProps) {
  const isOther = value.choice === OTHER_REASON
  const detailsLength = value.details.trim().length
  const detailsWords = countWords(value.details)
  const otherIsLongEnough =
    detailsLength >= MIN_OTHER_REASON_LENGTH && detailsWords >= MIN_OTHER_REASON_WORDS

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={id}>
          {label} <span className="text-red-500">*</span>
        </Label>
        <Select
          value={value.choice}
          onValueChange={(choice) => onChange({ ...value, choice })}
        >
          <SelectTrigger id={id} className="w-full">
            <SelectValue placeholder="Select a reason" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.choice && (
        <div className="space-y-2">
          <Label htmlFor={`${id}-details`}>
            {isOther ? (
              <>
                Please explain <span className="text-red-500">*</span>
              </>
            ) : (
              'Details (optional)'
            )}
          </Label>
          <Textarea
            id={`${id}-details`}
            rows={isOther ? 4 : 2}
            placeholder={
              isOther
                ? 'Describe what happened in detail'
                : 'Add any details'
            }
            value={value.details}
            onChange={(e) => onChange({ ...value, details: e.target.value })}
          />
          {isOther && (
            <p className={`text-xs ${otherIsLongEnough ? 'text-green-600' : 'text-muted-foreground'}`}>
              {detailsWords}/{MIN_OTHER_REASON_WORDS} words · {detailsLength}/{MIN_OTHER_REASON_LENGTH} characters minimum
            </p>
          )}
        </div>
      )}
    </div>
  )
}
