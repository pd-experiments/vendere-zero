"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Upload, MoreVertical, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { blobToBase64 } from "@/lib/utils";
import { AdStructuredOutputSchema } from "../api/evaluate/schemas";
import { z } from "zod";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
    ResizableHandle,
    ResizablePanel,
    ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

type EvaluationResult = {
    id: string;
    fileName: string;
    file: File;
    base64: string;
    status: "pending" | "processing" | "complete" | "error";
    result?: z.infer<typeof AdStructuredOutputSchema>;
    error?: string;
    uploadedAt: Date;
}

export default function BatchEvaluate() {
    const [evaluations, setEvaluations] = useState<EvaluationResult[]>([]);
    const [selectedEvaluation, setSelectedEvaluation] = useState<EvaluationResult | null>(null);

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        const newEvaluations = await Promise.all(
            Array.from(files).map(async (file) => ({
                id: Math.random().toString(36).slice(2),
                fileName: file.name,
                file,
                base64: await blobToBase64(file),
                status: "pending" as const,
                uploadedAt: new Date(),
            }))
        );

        setEvaluations(prev => [...prev, ...newEvaluations]);
        processImages(newEvaluations);
    };

    const processImages = async (imagesToProcess: EvaluationResult[]) => {
        for (const evaluation of imagesToProcess) {
            setEvaluations(prev =>
                prev.map(e =>
                    e.id === evaluation.id
                        ? { ...e, status: "processing" }
                        : e
                )
            );

            try {
                const response = await fetch("/api/evaluate", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageData: evaluation.base64 }),
                });

                if (!response.ok) throw new Error("Evaluation failed");

                const data = await response.json();

                setEvaluations(prev =>
                    prev.map(e =>
                        e.id === evaluation.id
                            ? { ...e, status: "complete", result: data.ad_description }
                            : e
                    )
                );
            } catch (error) {
                setEvaluations(prev =>
                    prev.map(e =>
                        e.id === evaluation.id
                            ? { ...e, status: "error", error: error instanceof Error ? error.message : "Unknown error" }
                            : e
                    )
                );
            }
        }
    };

    const removeEvaluation = (id: string) => {
        setEvaluations(prev => prev.filter(e => e.id !== id));
    };

    const handleRowClick = (evaluation: EvaluationResult) => {
        setSelectedEvaluation(evaluation);
    };

    // Define all possible columns
    const allColumns: ColumnDef<EvaluationResult>[] = [
        {
            accessorKey: "fileName",
            header: "Name",
            cell: ({ row }) => {
                const evaluation = row.original;
                return (
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 relative rounded overflow-hidden bg-accent">
                            <Image
                                src={evaluation.base64}
                                alt={evaluation.fileName}
                                layout="fill"
                                objectFit="cover"
                            />
                        </div>
                        <span className="font-medium truncate max-w-[200px]">
                            {evaluation.fileName}
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => {
                const evaluation = row.original;
                return (
                    <p className="truncate max-w-[400px] text-sm text-muted-foreground">
                        {evaluation.result?.image_description || "Processing..."}
                    </p>
                );
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const evaluation = row.original;
                return (
                    <span className={`
                        inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
                        ${evaluation.status === "complete" ? "bg-green-100 text-green-800" : ""}
                        ${evaluation.status === "processing" ? "bg-blue-100 text-blue-800" : ""}
                        ${evaluation.status === "error" ? "bg-red-100 text-red-800" : ""}
                        ${evaluation.status === "pending" ? "bg-gray-100 text-gray-800" : ""}
                    `}>
                        {evaluation.status}
                    </span>
                );
            },
        },
        {
            accessorKey: "confidence",
            header: "Confidence",
            cell: ({ row }) => {
                const evaluation = row.original;
                if (!evaluation.result) return null;
                return (
                    <div className="flex items-center gap-2">
                        <Progress
                            value={evaluation.result.sentiment_analysis.confidence * 100}
                            className="h-2 w-20"
                        />
                        <span className="text-sm">
                            {(evaluation.result.sentiment_analysis.confidence * 100).toFixed(0)}%
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: "uploadedAt",
            header: "Uploaded",
            cell: ({ row }) => {
                const evaluation = row.original;
                return (
                    <span className="text-sm text-muted-foreground">
                        {evaluation.uploadedAt.toLocaleString()}
                    </span>
                );
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const evaluation = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => removeEvaluation(evaluation.id)}>
                                Delete
                            </DropdownMenuItem>
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Download</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                );
            },
        },
    ];

    // Get the active columns based on whether details panel is open
    const activeColumns = selectedEvaluation
        ? allColumns.slice(0, 3) // Only Name, Description, and Status columns
        : allColumns;            // All columns

    return (
        <div className="min-h-screen bg-background">
            <div className="border-b">
                <div className="px-6 py-4 max-w-[1400px] mx-auto w-full">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-semibold tracking-tight text-[#B1E116]">Library</h1>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Manage and analyze your visual content
                            </p>
                        </div>
                        <Button
                            onClick={() => document.getElementById('fileInput')?.click()}
                            className="flex items-center gap-2 bg-[#B1E116] text-black hover:bg-[#B1E116]/90"
                        >
                            <Upload className="h-4 w-4" />
                            Upload Files
                        </Button>
                        <input
                            id="fileInput"
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={handleFileUpload}
                        />
                    </div>
                </div>
            </div>

            <div className="px-6 py-6 max-w-[1400px] mx-auto w-full">
                <ResizablePanelGroup 
                    direction="horizontal" 
                    className="relative"
                    onClick={(e) => {
                        // Close panel when clicking the background
                        if (e.target === e.currentTarget) {
                            setSelectedEvaluation(null);
                        }
                    }}
                >
                    <ResizablePanel 
                        defaultSize={selectedEvaluation ? 60 : 100}
                        minSize={40}
                        className="pr-3"
                    >
                        <DataTable 
                            columns={activeColumns} 
                            data={evaluations} 
                            onRowClick={handleRowClick}
                        />
                    </ResizablePanel>

                    {selectedEvaluation && (
                        <>
                            <ResizableHandle className="bg-border/20" />
                            <ResizablePanel defaultSize={40} minSize={25}>
                                <div 
                                    className="h-[calc(100vh-8rem)] relative bg-background pl-3"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="bg-card rounded-xl shadow-sm border h-full flex flex-col p-0.5">
                                        {/* Sticky Header */}
                                        <div className="shrink-0 px-8 py-6 border-b flex flex-col gap-4 bg-background">
                                            <div className="flex items-center justify-between">
                                                <h2 className="text-xl font-semibold">Image Details</h2>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setSelectedEvaluation(null)}
                                                    className="h-8 w-8"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-6 text-sm">
                                                {/* File name and thumbnail */}
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="w-8 h-8 relative shrink-0 rounded-md overflow-hidden bg-accent">
                                                        <Image
                                                            src={selectedEvaluation.base64}
                                                            alt={selectedEvaluation.fileName}
                                                            layout="fill"
                                                            objectFit="cover"
                                                        />
                                                    </div>
                                                    <span className="font-medium truncate">
                                                        {selectedEvaluation.fileName}
                                                    </span>
                                                </div>

                                                {/* Metadata wrapper */}
                                                <div className="flex flex-wrap items-center gap-3 text-sm">
                                                    <div className="text-muted-foreground shrink-0">
                                                        {selectedEvaluation.uploadedAt.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Scrollable Content */}
                                        <div className="flex-1 overflow-y-auto">
                                            <div className="p-8 space-y-8">
                                                <div className="relative h-[300px] w-full rounded-lg overflow-hidden bg-accent/50">
                                                    <Image
                                                        src={selectedEvaluation.base64}
                                                        alt={selectedEvaluation.fileName}
                                                        layout="fill"
                                                        objectFit="contain"
                                                        className="bg-accent/50"
                                                    />
                                                </div>

                                                {/* Features Table */}
                                                {selectedEvaluation.result && (
                                                    <div>
                                                        <h3 className="text-sm font-medium mb-2">Visual Features</h3>
                                                        <div className="rounded-lg border overflow-x-auto">
                                                            <Table>
                                                                <TableHeader>
                                                                    <TableRow>
                                                                        <TableHead className="w-[25%]">Keyword</TableHead>
                                                                        <TableHead className="w-[25%]">Category</TableHead>
                                                                        <TableHead className="w-[15%]">Confidence</TableHead>
                                                                        <TableHead className="w-[35%]">Attributes</TableHead>
                                                                    </TableRow>
                                                                </TableHeader>
                                                                <TableBody>
                                                                    {selectedEvaluation.result.features.map((feature) => (
                                                                        <TableRow key={feature.keyword}>
                                                                            <TableCell className="font-medium">
                                                                                {feature.keyword}
                                                                            </TableCell>
                                                                            <TableCell className="text-muted-foreground">
                                                                                {feature.category}
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <span className="text-sm">
                                                                                    {(feature.confidence_score * 100).toFixed(0)}%
                                                                                </span>
                                                                            </TableCell>
                                                                            <TableCell>
                                                                                <div className="space-y-1">
                                                                                    {feature.visual_attributes?.map((attr) => (
                                                                                        <div key={attr.attribute} className="text-sm text-muted-foreground">
                                                                                            <span className="font-medium text-foreground">{attr.attribute}:</span> {attr.value}
                                                                                        </div>
                                                                                    )) || "N/A"}
                                                                                </div>
                                                                            </TableCell>
                                                                        </TableRow>
                                                                    ))}
                                                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Analysis section */}
                                                {selectedEvaluation.result && (
                                                    <div>
                                                        <h3 className="text-sm font-medium mb-2">Analysis</h3>
                                                        <div className="space-y-4 bg-accent/50 rounded-lg p-4">
                                                            <div>
                                                                <h4 className="text-sm text-muted-foreground mb-1">Description</h4>
                                                                <p className="text-sm">
                                                                    {selectedEvaluation.result.image_description}
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <h4 className="text-sm text-muted-foreground mb-1">Sentiment</h4>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm capitalize">
                                                                        {selectedEvaluation.result.sentiment_analysis.tone}
                                                                    </span>
                                                                    <Progress
                                                                        value={selectedEvaluation.result.sentiment_analysis.confidence * 100}
                                                                        className="h-2 w-20"
                                                                    />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </ResizablePanel>
                        </>
                    )}
                </ResizablePanelGroup>
            </div>
        </div>
    );
} 