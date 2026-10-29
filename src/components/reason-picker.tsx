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
import { MIN_OTHER_REASON_LENGTH, OTHER_REASON } from '@/lib/reasons'

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
}

export function ReasonPicker({ id, options, value, onChange }: ReasonPickerProps) {
  const isOther = value.choice === OTHER_REASON
  const detailsLength = value.details.trim().length

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={id}>
          Reason <span className="text-red-500">*</span>
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
                : 'Add any details for your manager'
            }
            value={value.details}
            onChange={(e) => onChange({ ...value, details: e.target.value })}
          />
          {isOther && (
            <p
              className={`text-xs ${
                detailsLength >= MIN_OTHER_REASON_LENGTH ? 'text-green-600' : 'text-muted-foreground'
              }`}
            >
              {detailsLength}/{MIN_OTHER_REASON_LENGTH} characters minimum
            </p>
          )}
        </div>
      )}
    </div>
  )
}
