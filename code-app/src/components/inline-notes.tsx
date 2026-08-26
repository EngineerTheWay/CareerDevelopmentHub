import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

type InlineNotesProps = {
  notes?: string;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
};

export function InlineNotes({ notes, expanded, onToggle, className }: InlineNotesProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [needsExpand, setNeedsExpand] = useState(false);

  useEffect(() => {
    const element = textRef.current;
    if (!element || !notes) {
      setNeedsExpand(false);
      return;
    }

    const updateNeedsExpand = () => {
      setNeedsExpand(element.scrollHeight > element.clientHeight + 1 || element.scrollWidth > element.clientWidth + 1);
    };

    updateNeedsExpand();
    const resizeObserver = new ResizeObserver(updateNeedsExpand);
    resizeObserver.observe(element);

    return () => resizeObserver.disconnect();
  }, [notes]);

  if (!notes) return null;

  if (expanded) {
    return <div className={`whitespace-normal break-words text-xs leading-5 [overflow-wrap:anywhere] ${className ?? ''}`}><span>{notes}</span> <Button type="button" variant="link" className="h-auto shrink-0 p-0 align-baseline text-xs text-primary hover:text-primary" onClick={onToggle}>Collapse notes</Button></div>;
  }

  return <div className={`grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 overflow-hidden ${className ?? ''}`}><span ref={textRef} className="min-w-0 overflow-hidden break-words text-xs leading-5 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [overflow-wrap:anywhere]">{notes}</span>{needsExpand ? <Button type="button" variant="link" className="h-auto shrink-0 self-center p-0 text-xs text-primary hover:text-primary" onClick={onToggle}>Expand notes</Button> : null}</div>;
}
