import { ChevronDown, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type MultiSelectOption<TValue extends string = string> = {
  value: TValue;
  label: string;
};

export type FilterTypeOption<TValue extends string> = {
  value: TValue;
  label: string;
};

type MultiSelectFilterProps<TValue extends string> = {
  label: string;
  typeLabel?: string;
  typeValue?: TValue;
  typeOptions?: Array<FilterTypeOption<TValue>>;
  options: Array<MultiSelectOption<TValue>>;
  selected: TValue[];
  onSelectedChange?: (selected: TValue[]) => void;
  allValue?: TValue;
  onChange?: (selected: TValue[]) => void;
  onTypeChange?: (value: TValue) => void;
  className?: string;
};

export function MultiSelectFilter<TValue extends string>({ label, typeLabel = 'Filter type', typeValue, typeOptions, options, selected, onSelectedChange, allValue, onChange, onTypeChange, className }: MultiSelectFilterProps<TValue>) {
  const [query, setQuery] = useState('');
  const safeSelected = Array.isArray(selected) ? selected : [];
  const cleanOptions = useMemo(() => options.filter((option: MultiSelectOption<TValue>) => Boolean(option.value && option.label.trim())), [options]);
  const visibleOptions = cleanOptions.filter((option: MultiSelectOption<TValue>) => option.label.toLowerCase().includes(query.trim().toLowerCase()));
  const selectedLabels = cleanOptions.filter((option: MultiSelectOption<TValue>) => safeSelected.includes(option.value)).map((option: MultiSelectOption<TValue>) => option.label);
  const triggerLabel = selectedLabels.length === 0 ? label : selectedLabels.length === 1 ? selectedLabels[0] : `${selectedLabels.length} selected`;

  const emitSelected = (nextSelected: TValue[]) => {
    const normalizedSelected = allValue && nextSelected.length === 0 ? [allValue] : nextSelected;
    onSelectedChange?.(normalizedSelected);
    onChange?.(normalizedSelected);
  };
  const toggleValue = (value: TValue) => {
    if (allValue && value === allValue) { emitSelected([allValue]); return; }
    const withoutAll = allValue ? safeSelected.filter((item: TValue) => item !== allValue) : safeSelected;
    const nextSelected = withoutAll.includes(value) ? withoutAll.filter((item: TValue) => item !== value) : [...withoutAll, value];
    emitSelected(nextSelected);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className={`h-9 justify-between bg-popover text-popover-foreground hover:bg-popover ${className ?? ''}`}>
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="space-y-3">
          {typeOptions && typeValue && onTypeChange ? (
            <div className="space-y-1.5">
              <div className="text-sm font-medium text-popover-foreground">{typeLabel}</div>
              <Select value={typeValue} onValueChange={(value: string) => { onTypeChange(value as TValue); setQuery(''); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[220px]">
                  {typeOptions.filter((option: FilterTypeOption<TValue>) => Boolean(option.value)).map((option: FilterTypeOption<TValue>) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)} placeholder="Type to filter options" className="h-9 pl-9" />
          </div>
          <div className="max-h-[180px] space-y-1 overflow-y-auto pr-1">
            {visibleOptions.length === 0 ? <div className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">No matches</div> : visibleOptions.map((option: MultiSelectOption<TValue>) => {
              const isSelected = safeSelected.includes(option.value);
              return (
                <button key={option.value} type="button" className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground" onClick={() => toggleValue(option.value)}>
                  <Checkbox checked={isSelected} aria-hidden="true" tabIndex={-1} />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>

                </button>
              );
            })}
          </div>
          {safeSelected.filter((item: string) => item !== allValue).length > 0 ? <Button type="button" variant="ghost" size="sm" className="w-full" onClick={() => emitSelected([])}>Clear selection</Button> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}
