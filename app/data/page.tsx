"use client";

import {
  Table,
  TableHead,
  TableHeader,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useCallback, useEffect, useState } from "react";
import { AdVisualWithMetric } from "../api/metrics/schemas";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import Image from "next/image";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
export default function Home() {
  const [data, setData] = useState<AdVisualWithMetric[]>([]);

  const [offset, setOffset] = useState(0);
  const [count, setCount] = useState(10);

  const [selectedAd, setSelectedAd] = useState<AdVisualWithMetric | null>(null);
  const fetchData = useCallback(
    async (offset: number) => {
      const res = await fetch(`/api/metrics?offset=${offset}&count=${count}`);
      const data = await res.json();
      setData(data);
    },
    [count]
  );

  useEffect(() => {
    fetchData(offset);
  }, [offset, fetchData]);

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel>
        <div className="p-4 h-screen overflow-scroll">
          <h1 className="text-2xl font-bold">
            AI-Generated Visual Analytics on Nike Ads
          </h1>
          <p className="mb-4">
            The following are visual features and sample analytics taken from
            Nike ads. The visual features have been extracted using our AI
            model.
          </p>

          <div className="flex justify-between items-center pb-4">
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setOffset(offset - count)}
                disabled={offset === 0}
                variant="outline"
                size="icon"
              >
                <ChevronLeft />
              </Button>
              Page {offset / count + 1}
              <Button
                onClick={() => setOffset(offset + count)}
                disabled={data.length < count}
                variant="outline"
                size="icon"
              >
                <ChevronRight />
              </Button>
            </div>
            <Button variant="outline" size="icon">
              <ChevronUp />
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Image</TableHead>
                <TableHead>Keywords</TableHead>
                <TableHead>Impressions</TableHead>
                <TableHead>CTR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={row.id}
                  onClick={() => setSelectedAd(row)}
                  className="cursor-pointer"
                >
                  <TableCell>
                    <Image
                      src={row.image_url}
                      alt={row.image_description}
                      width={100}
                      height={100}
                    />
                  </TableCell>
                  <TableCell>
                    {row.features.map((f) => (
                      <div key={f.keyword}>
                        {f.keyword} ({f.category}, {f.location})
                      </div>
                    ))}
                  </TableCell>
                  <TableCell>{row.ad_metrics[0].impressions}</TableCell>
                  <TableCell>{row.ad_metrics[0].ctr}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel>
        {selectedAd ? (
          <div className="p-4 flex flex-col gap-4">
            <div className="relative h-96">
              <Image
                src={selectedAd.image_url}
                alt={selectedAd.image_description}
                objectFit="contain"
                layout="fill"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-sm">{selectedAd.image_description}</div>
            </div>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Visual Attributes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedAd.features.map((f) => (
                    <TableRow key={f.keyword}>
                      <TableCell>{f.keyword}</TableCell>
                      <TableCell>{f.category}</TableCell>
                      <TableCell>{f.location}</TableCell>
                      <TableCell>
                        {f.visual_attributes.map((a) => (
                          <div key={a.attribute}>
                            {a.attribute}: {a.value}
                          </div>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="flex justify-center items-center h-full text-muted-foreground">
            No ad selected
          </div>
        )}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
