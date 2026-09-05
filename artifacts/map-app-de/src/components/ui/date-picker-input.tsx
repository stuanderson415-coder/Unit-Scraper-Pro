import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function parseDate(value: string) {
  if (!value) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day, 12);
}

function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd');
}

export function DatePickerInput({
  value,
  onChange,
  disabled,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel: string;
}) {
  const selected = parseDate(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            'flex h-10 w-full items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-left text-sm outline-none transition hover:border-teal-500 focus:border-teal-700 focus:ring-2 focus:ring-teal-100 disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-zinc-400" />
          <span className={selected ? 'text-zinc-900' : 'text-zinc-400'}>
            {selected ? format(selected, 'dd/MM/yyyy') : 'DD/MM/YYYY'}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          onSelect={date => date && onChange(toIsoDate(date))}
          captionLayout="dropdown"
        />
      </PopoverContent>
    </Popover>
  );
}