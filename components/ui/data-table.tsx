"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
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
import { ChevronDown, Search, SlidersHorizontal, UploadCloud, Video, ImageIcon, Loader2, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import Image from "next/image";

interface DataTableFilter<TData> {
  id: string;
  label: string;
  type: 'range' | 'multiselect';
  value: unknown;
  options?: string[];
  filterFn: FilterFn<TData>;
  onValueChange: (value: unknown) => void;
}

interface ServerSidePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
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
  serverSidePagination?: ServerSidePagination;
  isLoading?: boolean;
  onLoadPage?: (page: number) => Promise<void>;
  loadedPages?: Set<number>;
  uploadButton?: {
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onCancelUpload: (fileId: string) => void;
    uploadingFiles: Array<{
      id: string;
      fileName: string;
      file: File;
      fileType: "image" | "video";
      status: "uploading" | "processing" | "complete" | "error";
      error?: string;
      progress?: number;
    }>;
  };
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
  serverSidePagination,
  isLoading = false,
  onLoadPage,
  loadedPages = new Set<number>(),
  uploadButton,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [globalFilterValue, setGlobalFilterValue] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
      globalFilter: globalFilterValue,
      pagination: serverSidePagination
        ? {
          pageIndex: serverSidePagination.page - 1,
          pageSize: serverSidePagination.pageSize,
        }
        : undefined,
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

  // Add background page loading
  const loadNextPages = useCallback(async () => {
    if (!serverSidePagination || !onLoadPage) return;

    const totalPages = Math.ceil(serverSidePagination.total / serverSidePagination.pageSize);
    const currentPage = serverSidePagination.page;

    // Load next 2 pages and previous page if they haven't been loaded
    const pagesToLoad = [currentPage - 1, currentPage + 1, currentPage + 2]
      .filter(page => page > 0 && page <= totalPages && !loadedPages.has(page));

    for (const page of pagesToLoad) {
      await onLoadPage(page);
    }
  }, [serverSidePagination, onLoadPage, loadedPages]);

  // Load next pages when current page changes
  React.useEffect(() => {
    loadNextPages();
  }, [loadNextPages, serverSidePagination?.page]);

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
                                  className={`w-4 h-4 border rounded-sm ${(filter.value as string[]).includes(option)
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
          {uploadButton && (
            <>
              {uploadButton.uploadingFiles.length > 0 && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2"
                    >
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Uploading {uploadButton.uploadingFiles.length} file{uploadButton.uploadingFiles.length > 1 ? 's' : ''}</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-80 p-2"
                  >
                    <div className="space-y-2">
                      {uploadButton.uploadingFiles.map(file => (
                        <div
                          key={file.id}
                          className="flex items-start gap-2 p-2 rounded-lg bg-muted/30"
                        >
                          <div className="relative w-8 h-8 rounded overflow-hidden bg-muted flex-shrink-0">
                            {file.fileType === 'image' && file.file && (
                              <Image
                                src={URL.createObjectURL(file.file)}
                                alt={file.fileName}
                                fill
                                className="object-cover"
                              />
                            )}
                            {file.fileType === 'video' && (
                              <Video className="h-4 w-4 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-muted-foreground" />
                            )}
                            {file.status === "uploading" && (
                              <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                              </div>
                            )}
                            {file.status === "complete" && (
                              <div className="absolute inset-0 bg-emerald-500/10 flex items-center justify-center">
                                <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                                  <svg
                                    className="h-2 w-2 text-white"
                                    fill="none"
                                    strokeWidth="2"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </div>
                              </div>
                            )}
                            {file.status === "error" && (
                              <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center">
                                <div className="h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                                  <X className="h-2 w-2 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium truncate">
                                {file.fileName}
                              </p>
                              {file.status === "uploading" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => uploadButton.onCancelUpload(file.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {file.status === "uploading" && "Uploading..."}
                              {file.status === "processing" && "Processing..."}
                              {file.status === "complete" && "Complete"}
                              {file.status === "error" && (
                                <span className="text-red-500">{file.error || "Upload failed"}</span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="h-8 flex items-center gap-2" variant="secondary">
                    <UploadCloud className="h-4 w-4" />
                    Upload
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px]">
                  <DropdownMenuItem
                    onClick={() => document.getElementById('imageInput')?.click()}
                    className="flex items-center gap-2"
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span>Upload Images</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => document.getElementById('videoInput')?.click()}
                    className="flex items-center gap-2"
                  >
                    <Video className="h-4 w-4" />
                    <span>Upload Video</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <input
                id="imageInput"
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={uploadButton.onFileUpload}
              />
              <input
                id="videoInput"
                type="file"
                accept="video/*"
                className="hidden"
                onChange={uploadButton.onFileUpload}
              />
            </>
          )}
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

      {/* Table section with inline loading states */}
      <div>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="border-b hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="h-9 px-4 text-xs font-medium text-muted-foreground">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              // Loading rows
              Array(10).fill(0).map((_, i) => (
                <TableRow key={`loading-${i}`} className="border-b last:border-0">
                  {table.getAllColumns().map((column) => (
                    <TableCell key={column.id} className="px-4 py-3">
                      <div className="flex items-center h-full">
                        <Skeleton className="h-4 w-[80%] bg-muted-foreground/10" />
                      </div>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              // Normal data rows
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
          {serverSidePagination
            ? `${serverSidePagination.total} items`
            : `${table.getFilteredRowModel().rows.length} items`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => serverSidePagination
              ? serverSidePagination.onPageChange(serverSidePagination.page - 1)
              : table.previousPage()
            }
            disabled={serverSidePagination
              ? serverSidePagination.page <= 1
              : !table.getCanPreviousPage()
            }
            className="h-8"
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => serverSidePagination
              ? serverSidePagination.onPageChange(serverSidePagination.page + 1)
              : table.nextPage()
            }
            disabled={serverSidePagination
              ? serverSidePagination.page >= Math.ceil(serverSidePagination.total / serverSidePagination.pageSize)
              : !table.getCanNextPage()
            }
            className="h-8"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
} 