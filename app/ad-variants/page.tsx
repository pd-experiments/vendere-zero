"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function AdVariants() {
  return (
    <div className="container mx-auto p-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Ad Variants</h1>
        <p className="text-muted-foreground">
          Create and manage different variants of your advertisements.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ad Variants Dashboard</CardTitle>
          <CardDescription>
            This page is under construction. More features coming soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Content will be added in future updates */}
        </CardContent>
      </Card>
    </div>
  );
}
