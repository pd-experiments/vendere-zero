export async function getOrganicResults(
    keyword: string,
    database: string = "us",
): Promise<string[]> {
    const apiKey = process.env.SEMRUSH_API_KEY;
    if (!apiKey) {
        throw new Error("SEMRUSH_API_KEY is not set");
    }
    const url = new URL("https://api.semrush.com/");
    url.search = new URLSearchParams({
        type: "phrase_organic",
        key: apiKey,
        phrase: keyword,
        database: database,
        export_columns: "Ur", // Just get URLs
        display_limit: "10", // Limit to top 10 results
    }).toString();

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Semrush API error: ${response.statusText}`);
        }

        const data = await response.text();
        console.log(data);
        // Skip header row and split into lines
        const lines = data.split("\n").slice(1);
        // Filter out empty lines and return URLs
        return lines.filter((line) => line.trim()).map((line) => line.trim());
    } catch (error) {
        console.error("Error fetching organic results:", error);
        return [];
    }
}

export async function getPaidResults(
    keyword: string,
    database: string = "us",
): Promise<string[]> {
    const apiKey = process.env.SEMRUSH_API_KEY;
    if (!apiKey) {
        throw new Error("SEMRUSH_API_KEY is not set");
    }
    const url = new URL("https://api.semrush.com/");
    url.search = new URLSearchParams({
        type: "phrase_adwords",
        key: apiKey,
        phrase: keyword,
        database: database,
        export_columns: "Ur", // Just get URLs
        display_limit: "10", // Limit to top 10 results
    }).toString();

    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Semrush API error: ${response.statusText}`);
        }

        const data = await response.text();
        console.log(data);
        // Skip header row and split into lines
        const lines = data.split("\n").slice(1);
        // Filter out empty lines and return URLs
        return lines.filter((line) => line.trim()).map((line) => line.trim());
    } catch (error) {
        console.error("Error fetching paid results:", error);
        return [];
    }
}
