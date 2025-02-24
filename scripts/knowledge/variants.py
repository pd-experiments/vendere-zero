from typing import List, Dict
from pydantic import BaseModel, Field
from llama_index.core import VectorStoreIndex, Document
from llama_index.core.storage import StorageContext
from llama_index.vector_stores.supabase import SupabaseVectorStore
from llama_index.core import PromptTemplate
from supabase.client import create_client, ClientOptions
import os
from pathlib import Path
from dotenv import load_dotenv
import json
import asyncio
from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
import logging
from llama_index.llms.openai import OpenAI
from llama_index.core.output_parsers import PydanticOutputParser

# Load environment variables
env_path = Path(__file__).parents[2] / ".env.local"
load_dotenv(env_path)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Add at module level, before VariantGenerator class
FORMAT_STR = """The output should be formatted as a JSON object with the following fields:
{
    "variant_id": "string (format: v1_{market}_{keyword_short}_{element})",
    "geo_target": "string (exact match of input geo_target)",
    "keyword": "string (exact match of input keyword)",
    "element_updates": {
        "element_type": "string (optimized text)"
    },
    "audience_segment": "string (target audience description)",
    "predicted_performance": "float (between 0.0 and 1.0)",
    "rationale": "string (explanation of changes)"
}"""


class KeywordData(BaseModel):
    """Represents a keyword with its metrics"""

    # TODO: pick the right fields here, supposedly this is what semrush returns
    term: str = Field(description="The keyword phrase")
    volume: int = Field(description="Monthly search volume")
    intent: str = Field(description="Search intent classification")
    difficulty: float = Field(description="Keyword difficulty score")


class AdElement(BaseModel):
    """Represents an ad element to be varied"""

    type: str = Field(description="Type of element (headline, body, CTA)")
    location: str = Field(description="Location in the ad")
    code: str = Field(description="HTML/CSS template code")
    text: str = Field(description="Current text content")


class VariantInput(BaseModel):
    """Input data for variant generation"""

    keywords: List[KeywordData]
    elements: List[AdElement]
    target_markets: List[str] = Field(description="List of target geographic markets")


class GeneratedVariant(BaseModel):
    """Represents a generated ad variant"""

    variant_id: str = Field(description="Unique identifier for the variant")
    geo_target: str = Field(description="Geographic target market")
    keyword: str = Field(description="Focus keyword")
    element_updates: Dict[str, str] = Field(description="Updates for each element")
    audience_segment: str = Field(description="Target audience segment")
    predicted_performance: float = Field(description="Predicted performance score")
    rationale: str = Field(description="Explanation of variant choices")


class VariantGenerator:
    def __init__(self):
        try:
            # Initialize Supabase client
            supabase_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            supabase_key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

            if not supabase_url or not supabase_key:
                raise ValueError("Missing Supabase environment variables")

            self.supabase = create_client(
                supabase_url,
                supabase_key,
                options=ClientOptions(
                    postgrest_client_timeout=60,
                    schema="public",
                ),
            )

            # Initialize vector store and index
            self._initialize_index()

            # Initialize LLM and output parser
            self.llm = OpenAI(model="gpt-4o-mini", temperature=0.1)
            self.parser = PydanticOutputParser(GeneratedVariant)

            # Create prompt template with format instructions
            self.prompt_template = PromptTemplate(
                """Generate an optimized ad variant based on the following inputs:
                
                Market Research Context:
                ---------------------
                {context_str}
                ---------------------
                
                Input Parameters:
                - Geographic Target: {geo_target}
                - Keyword: {keyword}
                - Element Type: {element_type}
                - Current Text: {current_text}
                
                Output Format Instructions:
                {format_str}
                
                Generate a variant that:
                1. Maintains keyword relevance
                2. Adapts messaging for the geographic market
                3. Optimizes for the element type and placement
                4. Considers audience segments from market research
                5. Includes performance predictions
                
                Generate the variant now:
                """
            )

            logger.info("VariantGenerator initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing VariantGenerator: {str(e)}")
            raise

    def _initialize_index(self):
        """Initialize vector store and index with market research data"""
        try:
            # Fetch market research data
            research_data = (
                self.supabase.table("market_research_v2").select("*").execute().data
            )

            if not research_data:
                logger.warning("No market research data found in database")
                research_data = []

            logger.info(f"Found {len(research_data)} market research entries")

            documents = []
            for research in research_data:
                try:
                    research_text = f"""
                    Intent Summary: {research.get("intent_summary", "")}
                    Target Audience: {json.dumps(research.get("target_audience", {}), indent=2)}
                    Pain Points: {json.dumps(research.get("pain_points", {}), indent=2)}
                    Key Features: {json.dumps(research.get("key_features", {}), indent=2)}
                    Competitive Advantages: {json.dumps(research.get("competitive_advantages", {}), indent=2)}
                    """
                    doc = Document(
                        text=research_text,
                        extra_info={
                            "type": "market_research",
                            "id": research.get("id"),
                        },
                    )
                    documents.append(doc)
                except Exception as e:
                    logger.error(f"Error processing research entry: {str(e)}")
                    continue

            # Initialize vector store
            db_connection = os.getenv("DB_CONNECTION")
            if not db_connection:
                raise ValueError("Missing DB_CONNECTION environment variable")

            vector_store = SupabaseVectorStore(
                postgres_connection_string=db_connection,
                collection_name="variant_research",
            )
            storage_context = StorageContext.from_defaults(vector_store=vector_store)

            # Create index with custom prompt template
            self.index = VectorStoreIndex.from_documents(
                documents,
                storage_context=storage_context,
            )

            # Initialize query engine
            self.query_engine = self.index.as_query_engine(
                similarity_top_k=5,
                response_mode="compact",
            )

            logger.info("Vector index initialized successfully")
        except Exception as e:
            logger.error(f"Error in _initialize_index: {str(e)}")
            raise

    async def generate_variant(
        self, keyword: KeywordData, element: AdElement, geo_target: str
    ) -> GeneratedVariant:
        """Generate a single variant for given parameters"""
        try:
            logger.info(
                f"Generating variant for keyword: {keyword.term}, market: {geo_target}"
            )

            # Query relevant market research
            context = self.query_engine.query(
                f"""Find relevant market research for:
                - Keyword: {keyword.term}
                - Geographic market: {geo_target}
                - Ad element type: {element.type}
                
                Focus on audience preferences, pain points, and successful messaging patterns.
                """
            )

            if not context:
                logger.warning("No relevant market research found")

            # Create example format
            dict_example = {
                "variant_id": f"v1_{geo_target}_{keyword.term.replace(' ', '_')}_{element.type}",
                "geo_target": geo_target,
                "keyword": keyword.term,
                "element_updates": {element.type: "optimized text here"},
                "audience_segment": "target audience description",
                "predicted_performance": 0.85,
                "rationale": "explanation of changes",
            }

            # Get response with JSON mode
            response = self.llm.complete(
                f"""You are an expert at generating optimized ad variants. Generate a valid JSON matching the example format.

                Generate an optimized ad variant based on:
                Market Research: {str(context)}
                Geographic Target: {geo_target}
                Keyword: {keyword.term}
                Element Type: {element.type}
                Current Text: {element.text}

                Use this exact JSON format:
                {json.dumps(dict_example, indent=2)}
                """,
                response_format={"type": "json_object"},
            )

            # Parse JSON response into GeneratedVariant
            variant_dict = json.loads(response.text)
            variant = GeneratedVariant(**variant_dict)

            logger.info(f"Successfully generated variant: {variant.variant_id}")
            return variant

        except Exception as e:
            logger.error(f"Error generating variant: {str(e)}")
            raise

    async def generate_variants(
        self, input_data: VariantInput
    ) -> List[GeneratedVariant]:
        """Generate variants for all combinations of inputs"""
        try:
            logger.info(
                f"Starting variant generation for {len(input_data.keywords)} keywords"
            )

            # Create tasks for all combinations
            tasks = []
            for keyword in input_data.keywords:
                for element in input_data.elements:
                    for market in input_data.target_markets:
                        tasks.append(
                            self.generate_variant(
                                keyword=keyword, element=element, geo_target=market
                            )
                        )

            logger.info(f"Created {len(tasks)} variant generation tasks")

            # Execute tasks concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)

            # Filter and log successful results
            variants = []
            for result in results:
                if isinstance(result, GeneratedVariant):
                    variants.append(result)
                elif isinstance(result, Exception):
                    logger.error(f"Task failed with error: {str(result)}")

            logger.info(f"Successfully generated {len(variants)} variants")
            return variants

        except Exception as e:
            logger.error(f"Error in generate_variants: {str(e)}")
            raise


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI"""
    # Initialize on startup
    global variant_generator
    variant_generator = VariantGenerator()
    yield
    # Clean up on shutdown
    variant_generator = None


app = FastAPI(title="Variant Generation API", lifespan=lifespan)

# Global instance
variant_generator = None


@app.post("/generate-variants", response_model=List[GeneratedVariant])
async def generate_variants_endpoint(input_data: VariantInput):
    """Generate variants based on input keywords, elements, and markets"""
    try:
        if not variant_generator:
            raise HTTPException(
                status_code=500, detail="Variant generator not initialized"
            )

        logger.info(
            f"Received variant generation request with {len(input_data.keywords)} keywords"
        )

        variants = await variant_generator.generate_variants(input_data)

        logger.info(f"Returning {len(variants)} generated variants")
        return variants

    except Exception as e:
        logger.error(f"Error in generate_variants_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Simple health check endpoint"""
    return {"status": "healthy"}


def main():
    """Run the FastAPI server"""
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)


if __name__ == "__main__":
    main()
