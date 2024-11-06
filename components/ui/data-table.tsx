"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  FilterFn,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Search, SlidersHorizontal } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface DataTableFilter<TData> {
  id: string;
  label: string;
  type: 'range' | 'multiselect';
  value: unknown;
  options?: string[];
  filterFn: FilterFn<TData>;
  onValueChange: (value: unknown) => void;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  filters?: DataTableFilter<TData>[];
  onRowClick?: (data: TData) => void;
  searchPlaceholder?: string;
  maxRowsPerPage?: number;
  globalFilter?: {
    placeholder: string;
    searchFn: FilterFn<TData>;
  };
  disableSearch?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  filters = [],
  globalFilter,
  onRowClick,
  searchPlaceholder = "Search...",
  maxRowsPerPage = 10,
  disableSearch = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilterValue, setGlobalFilterValue] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
      globalFilter: globalFilterValue,
    },
    enableFilters: true,
    initialState: {
      pagination: {
        pageSize: maxRowsPerPage,
      },
    },
  });

  // Apply filters when they change
  React.useEffect(() => {
    // Clear existing filters first
    table.getAllColumns().forEach(column => {
      column.setFilterValue(undefined);
    });

    // Apply new filters
    filters.forEach(filter => {
      if (filter.type === 'range') {
        const [min, max] = filter.value as [number, number];
        if (min > 0 || max < 100) {
          table.getColumn(filter.id)?.setFilterValue([min / 100, max / 100]);
        }
      } else if (filter.type === 'multiselect') {
        const selected = filter.value as string[];
        if (selected.length > 0) {
          table.getColumn(filter.id)?.setFilterValue(selected);
        }
      }
    });
  }, [filters, table]);

  // Apply global filter
  React.useEffect(() => {
    if (globalFilterValue) {
      table.setGlobalFilter(globalFilterValue);
    }
  }, [globalFilterValue, table]);

  const activeFiltersCount = filters.reduce(
    (count, filter) => {
      if (filter.type === 'range') {
        const [min, max] = filter.value as [number, number];
        return count + (min > 0 || max < 100 ? 1 : 0);
      }
      return count + ((filter.value as unknown[])?.length > 0 ? 1 : 0);
    },
    0
  );

  return (
    <div className="w-full" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center justify-between py-3 border-b">
        <div className="flex items-center gap-4">
          {globalFilter && !disableSearch && (
            <div className="relative w-[380px]">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilterValue}
                onChange={(event) => setGlobalFilterValue(event.target.value)}
                className="pl-8 h-8"
              />
            </div>
          )}
          {filters.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[280px]">
                <div className="p-4 space-y-4">
                  {filters.map((filter) => (
                    <div key={filter.id} className="space-y-2">
                      <Label>{filter.label}</Label>
                      {filter.type === 'range' && (
                        <>
                          <Slider
                            min={0}
                            max={100}
                            step={1}
                            value={filter.value as [number, number]}
                            onValueChange={filter.onValueChange}
                            className="mt-2"
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{(filter.value as [number, number])[0]}%</span>
                            <span>{(filter.value as [number, number])[1]}%</span>
                          </div>
                        </>
                      )}
                      {filter.type === 'multiselect' && filter.options && (
                        <div className="space-y-1">
                          {filter.options.map((option) => (
                            <DropdownMenuItem
                              key={option}
                              onSelect={() => {
                                const currentValue = filter.value as string[];
                                filter.onValueChange(
                                  currentValue.includes(option)
                                    ? currentValue.filter((v) => v !== option)
                                    : [...currentValue, option]
                                );
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <div
                                  className={`w-4 h-4 border rounded-sm ${
                                    (filter.value as string[]).includes(option)
                                      ? "bg-primary border-primary"
                                      : "border-input"
                                  }`}
                                />
                                <span className="capitalize">{option}</span>
                              </div>
                            </DropdownMenuItem>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {activeFiltersCount > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          filters.forEach((filter) => {
                            if (filter.type === 'range') {
                              filter.onValueChange([0, 100]);
                            } else {
                              filter.onValueChange([]);
                            }
                          });
                        }}
                      >
                        Reset Filters
                      </Button>
                    </>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-8">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[150px]">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  const displayName = column.id
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');

                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {displayName}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Rest of the component remains the same */}
      <div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="h-9 px-4 text-xs font-medium text-muted-foreground">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={`${onRowClick ? "cursor-pointer" : ""} border-b last:border-0 hover:bg-accent/50`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-sm text-muted-foreground"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between px-4 py-3 border-t">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredRowModel().rows.length} items
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
} 