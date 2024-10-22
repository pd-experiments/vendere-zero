"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Loader2, History, Settings } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AdStructuredOutputSchema, FeatureSchema } from "@/app/api/evaluate/schemas"
import { blobToBase64 } from "@/lib/utils"

const formSchema = z.object({
    userPrompt: z.string().min(1, "Prompt is required"),
    includeFaces: z.boolean().default(false),
    includeBrandLogo: z.boolean().default(true),
    includeHandsFingers: z.boolean().default(false),
    brandStyle: z.string().default("modern"),
    colorScheme: z.string().default("vibrant"),
    brandLogoProminence: z.number().min(0).max(100).default(50),
})

export default function BrandCreativeGeneratorPage() {
    const [generatedImage, setGeneratedImage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [evaluationResult, setEvaluationResult] = useState<z.infer<typeof AdStructuredOutputSchema> | null>(null)
    const [mode, setMode] = useState<"create" | "upload">("create")

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            userPrompt: "",
            includeFaces: false,
            includeBrandLogo: true,
            includeHandsFingers: false,
            brandStyle: "modern",
            colorScheme: "vibrant",
            brandLogoProminence: 50,
        },
    })

    const toggleMode = () => {
        setMode(mode === "create" ? "upload" : "create")
    }

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
            if (mode === "create") {
                const response = await axios.post("/api/image", values, {
                    responseType: 'arraybuffer'
                })

                console.log(response)

                // Check if the response is JSON (error message) instead of an image
                const contentType = response.headers['content-type'];
                if (contentType && contentType.includes('application/json')) {
                    const errorMessage = JSON.parse(new TextDecoder().decode(response.data));
                    throw new Error(errorMessage.error || 'Unknown error occurred');
                }

                const blob = new Blob([response.data], { type: 'image/png' })
                const imageUrl = URL.createObjectURL(blob)
                setGeneratedImage(imageUrl)

                // Convert blob to base64
                const base64Image = await blobToBase64(blob);

                // Call the evaluate route with base64 image data
                await evaluateImage(base64Image)
            }
        } catch (error) {
            console.error("Error generating or evaluating image:", error)
            // You can set an error state here to display to the user
        } finally {
            setIsLoading(false)
        }
    }

    async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0]
        if (file) {
            setIsLoading(true)
            try {
                const base64Image = await new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(file)
                })

                setGeneratedImage(base64Image)
                await evaluateImage(base64Image)
            } catch (error) {
                console.error("Error uploading or evaluating image:", error)
            } finally {
                setIsLoading(false)
            }
        }
    }

    async function evaluateImage(base64Image: string) {
        const evaluationResponse = await axios.post("/api/evaluate", {
            imageData: base64Image,
            saveToDatabase: true
        })
        setEvaluationResult(evaluationResponse.data.ad_description)
    }

    return (
        <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
            <div className="mb-4">
                <Button
                    onClick={toggleMode}
                    variant={mode === "create" ? "default" : "outline"}
                    className="w-32" // Fixed width for consistent button size
                >
                    {mode === "create" ? "Switch to Upload" : "Switch to Create"}
                </Button>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="mb-8 w-full">
                    <div className="flex items-center space-x-2 w-[100%]">
                        {mode === "create" ? (
                            <FormField
                                control={form.control}
                                name="userPrompt"
                                render={({ field }) => (
                                    <FormItem className="flex-grow">
                                        <FormControl>
                                            <Input placeholder="Describe your brand creative" {...field} className="w-full" />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />
                        ) : (
                            <div className="flex-grow">
                                <Input type="file" onChange={handleFileUpload} accept="image/*" />
                            </div>
                        )}
                        
                        {mode === "create" && (
                            <>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" size="icon" className="shrink-0">
                                            <Settings className="h-4 w-4" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80">
                                        <div className="space-y-4">
                                            <FormField
                                                control={form.control}
                                                name="brandStyle"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Brand Style</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select a brand style" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="modern">Modern</SelectItem>
                                                                <SelectItem value="classic">Classic</SelectItem>
                                                                <SelectItem value="minimalist">Minimalist</SelectItem>
                                                                <SelectItem value="bold">Bold</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="colorScheme"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Color Scheme</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Select a color scheme" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                <SelectItem value="vibrant">Vibrant</SelectItem>
                                                                <SelectItem value="pastel">Pastel</SelectItem>
                                                                <SelectItem value="monochrome">Monochrome</SelectItem>
                                                                <SelectItem value="earthy">Earthy</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="brandLogoProminence"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Brand Logo Prominence</FormLabel>
                                                        <FormControl>
                                                            <Slider
                                                                min={0}
                                                                max={100}
                                                                step={1}
                                                                value={[field.value]}
                                                                onValueChange={(value) => field.onChange(value[0])}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="includeFaces"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                        </FormControl>
                                                        <FormLabel>Include Faces</FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="includeHandsFingers"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                        </FormControl>
                                                        <FormLabel>Include Hands/Fingers</FormLabel>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </PopoverContent>
                                </Popover>
                                <Button type="submit" disabled={isLoading} className="shrink-0">
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        "Generate"
                                    )}
                                </Button>
                            </>
                        )}
                        
                        {mode === "upload" && (
                            <Button type="button" onClick={() => evaluateImage(generatedImage!)} disabled={isLoading || !generatedImage} className="shrink-0">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Evaluating...
                                    </>
                                ) : (
                                    "Evaluate"
                                )}
                            </Button>
                        )}
                        
                        <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => {/* Add history functionality here */}}
                            className="shrink-0"
                        >
                            <History className="h-4 w-4" />
                        </Button>
                    </div>
                </form>
            </Form>

            <div className="flex flex-col lg:flex-row gap-8">
                <div className="w-full lg:w-1/2">
                    <div className="bg-gray-100 rounded-lg overflow-hidden w-full aspect-square">
                        <div className="w-full h-full flex items-center justify-center">
                            {generatedImage ? (
                                <img
                                    src={generatedImage}
                                    alt="Generated Creative"
                                    className="max-w-full max-h-full object-contain"
                                />
                            ) : (
                                <div className="text-center text-gray-500">
                                    Your generated creative will appear here.
                                </div>
                            )}
                        </div>
                    </div>
                    {generatedImage && (
                        <div className="mt-4 flex justify-between w-full">
                            <Button variant="outline">Regenerate</Button>
                            <Button asChild>
                                <a href={generatedImage} download="brand_creative.png">
                                    Download Creative
                                </a>
                            </Button>
                        </div>
                    )}
                </div>

                <div className="w-full lg:w-1/2">
                    {evaluationResult ? (
                        <div className="space-y-6">
                            <h3 className="text-xl font-semibold">Image Evaluation</h3>
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500 mb-2">Features</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {evaluationResult.features.map((feature: z.infer<typeof FeatureSchema>, index: number) => (
                                            <Badge key={index} variant="secondary">
                                                {feature.keyword}: {feature.category}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500 mb-2">Sentiment</h4>
                                    <p className="text-sm">
                                        {evaluationResult.sentiment_analysis.tone}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-medium text-gray-500 mb-2">Description</h4>
                                    <p className="text-sm">{evaluationResult.image_description}</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-500">
                            Evaluation results will appear here after generating an image.
                        </div>
                    )}
                </div>
            </div>
        </main>
    )
}
