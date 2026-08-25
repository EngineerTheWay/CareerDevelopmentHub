import { useRef, useState } from 'react';
import { Check, Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type RefinedSearchOption = {
  id: string;
  label: string;
  description?: string;
};

type RefinedSearchBoxProps = {
  id: string;
  value: string;
  options: RefinedSearchOption[];
  placeholder: string;
  emptyLabel: string;
  createLabel: string;
  disabled?: boolean;
  onChange: (value: string, selectedId?: string) => void;
  onCreate?: (value: string) => void;
  onClear?: () => void;
};

export function RefinedSearchBox({ id, value, options, placeholder, emptyLabel, createLabel, disabled = false, onChange, onCreate, onClear }: RefinedSearchBoxProps) {
  const [open, setOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const normalizedValue = value.trim().toLowerCase();
  const filteredOptions = options
    .filter((option: RefinedSearchOption) => option.id && option.label.trim())
    .filter((option: RefinedSearchOption) => option.label.toLowerCase().includes(normalizedValue) || (option.description ?? '').toLowerCase().includes(normalizedValue))
    .slice(0, 6);
  const exactMatch = options.find((option: RefinedSearchOption) => option.label.trim().toLowerCase() === normalizedValue);
  const showClear = Boolean(value.trim()) && !disabled;
  const handleClear = () => {
    onClear?.();
    onChange('', undefined);
    setOpen(false);
  };



  return (
    <div ref={wrapperRef} className="relative">
      <div className={cn('relative', disabled && 'text-muted-foreground')}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          className="h-11 bg-white pl-9 pr-10 text-foreground shadow-sm hover:border-primary focus-visible:border-primary dark:bg-card dark:text-card-foreground"
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => { onChange(event.target.value); setOpen(true); }}
        />
        {showClear ? (
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            className="absolute right-1.5 top-1/2 h-8 w-8 -translate-y-1/2 bg-secondary text-secondary-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
            aria-label={`Clear ${id}`}
            onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault()}
            onClick={handleClear}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>
      {!disabled && open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-white p-1 text-foreground shadow-lg dark:bg-card dark:text-card-foreground">
          {filteredOptions.length > 0 ? filteredOptions.map((option: RefinedSearchOption) => (
            <Button key={option.id} type="button" variant="ghost" className="h-auto w-full justify-start gap-2 px-2 py-2 text-left" onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={() => { onChange(option.label, option.id); setOpen(false); }}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                {exactMatch?.id === option.id ? <Check className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground dark:text-card-foreground">{option.label}</span>
                {option.description ? <span className="block truncate text-xs text-muted-foreground">{option.description}</span> : null}
              </span>
            </Button>
          )) : <div className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</div>}
          {value.trim() && !exactMatch && onCreate ? (
            <div className="mt-1 border-t pt-1">
              <Button type="button" variant="ghost" className="h-auto w-full justify-start gap-2 px-2 py-2 text-left" onMouseDown={(event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault()} onClick={() => { onCreate(value.trim()); setOpen(false); }}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"><Plus className="h-3.5 w-3.5" /></span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground dark:text-card-foreground">{createLabel} “{value.trim()}”</span>
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
