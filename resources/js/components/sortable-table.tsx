import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc';

type SortState = {
  key: string;
  direction: SortDirection;
};

type ResolverMap<T> = Record<string, (item: T) => unknown>;

const normalizeValue = (value: unknown): number | string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;

  const asString = String(value).trim();
  const asNumber = Number(asString);
  if (!Number.isNaN(asNumber) && asString !== '') return asNumber;

  const asDate = Date.parse(asString);
  if (!Number.isNaN(asDate)) return asDate;

  return asString.toLowerCase();
};

export function useSortableData<T>(
  items: T[],
  resolvers: ResolverMap<T>,
  initialSort: SortState | null = null,
) {
  const [sortState, setSortState] = useState<SortState | null>(initialSort);

  const sortedItems = useMemo(() => {
    if (!sortState) return items;

    const resolver = resolvers[sortState.key];
    if (!resolver) return items;

    const direction = sortState.direction === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      const aValue = normalizeValue(resolver(a));
      const bValue = normalizeValue(resolver(b));

      if (aValue < bValue) return -1 * direction;
      if (aValue > bValue) return 1 * direction;
      return 0;
    });
  }, [items, resolvers, sortState]);

  const requestSort = (key: string) => {
    setSortState((current) => {
      if (!current || current.key !== key) {
        return { key, direction: 'asc' };
      }

      return {
        key,
        direction: current.direction === 'asc' ? 'desc' : 'asc',
      };
    });
  };

  return {
    sortedItems,
    sortState,
    requestSort,
  };
}

export function SortableTh({
  label,
  sortKey,
  sortState,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  sortState: SortState | null;
  onSort: (key: string) => void;
  className?: string;
}) {
  const isActive = sortState?.key === sortKey;
  const direction = isActive ? sortState?.direction : null;

  return (
    <th className={className}>
      <button
        type="button"
        className="inline-flex items-center gap-1 text-left hover:text-primary transition-colors"
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <span className={cn('text-xs text-muted-foreground', isActive && 'text-primary')}>
          {direction === 'asc' ? '^' : direction === 'desc' ? 'v' : '<>'}
        </span>
      </button>
    </th>
  );
}
