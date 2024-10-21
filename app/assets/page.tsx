"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, History } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
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

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsLoading(true)
        try {
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
            const evaluationResponse = await axios.post("/api/evaluate", {
                imageData: base64Image,
                saveToDatabase: true
            })

            setEvaluationResult(evaluationResponse.data.ad_description)
        } catch (error) {
            console.error("Error generating or evaluating image:", error)
            // You can set an error state here to display to the user
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {/* Add history functionality here */}}
                >
                    <History className="w-4 h-4 mr-2" />
                    History
                </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="lg:row-span-2">
                    <CardHeader>
                        <CardTitle>Creative Settings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="userPrompt"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Creative Description</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Describe your brand creative" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                Provide a detailed description of the creative you want to generate.
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
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
                                            <FormDescription>
                                                Adjust how prominent the brand logo should be in the creative.
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                                <div className="space-y-2">
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
                                <Button type="submit" className="w-full" disabled={isLoading}>
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        "Generate Creative"
                                    )}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Generated Creative</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="h-[400px] flex items-center justify-center">
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
                        {evaluationResult && (
                            <div className="space-y-2">
                                <h3 className="text-lg font-semibold">Image Evaluation</h3>
                                <div className="flex flex-wrap gap-2">
                                    {evaluationResult.features.map((feature: z.infer<typeof FeatureSchema>, index: number) => (
                                        <Badge key={index} variant="secondary">
                                            {feature.keyword}: {feature.category}
                                        </Badge>
                                    ))}
                                </div>
                                <p className="text-sm text-gray-600">
                                    Sentiment: {evaluationResult.sentiment_analysis.tone}
                                </p>
                            </div>
                        )}
                    </CardContent>
                    {generatedImage && (
                        <CardFooter className="justify-between">
                            <Button variant="outline">Regenerate</Button>
                            <Button asChild>
                                <a href={generatedImage} download="brand_creative.png">
                                    Download Creative
                                </a>
                            </Button>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </div>
    )
}
