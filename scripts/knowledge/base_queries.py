from llama_index.core.storage import StorageContext
from llama_index.core import VectorStoreIndex, Document, Settings
from llama_index.vector_stores.supabase import SupabaseVectorStore
from supabase.client import Client, create_client, ClientOptions
from fastapi import FastAPI
from pydantic import BaseModel, Field
import json
import os
import asyncio
from typing import List, Dict, Any
from contextlib import asynccontextmanager
import requests
from llama_index.core.llms import (
    CustomLLM,
    CompletionResponse,
    CompletionResponseGen,
    LLMMetadata,
)
from llama_index.core.llms.callbacks import llm_completion_callback
from pathlib import Path
from dotenv import load_dotenv
from llama_index.core import PromptTemplate
from company_context import COMPANY_CONTEXT
from llama_index.program.openai import OpenAIPydanticProgram
from llama_index.llms.openai import OpenAI
from qa_templates import create_qa_templates


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI"""
    # Initialize on startup
    global kb
    kb = KnowledgeBase()
    yield
    # Clean up on shutdown
    kb = None


app = FastAPI(title="Knowledge Base API", lifespan=lifespan)

env_path = Path(__file__).parents[2] / ".env.local"
load_dotenv(env_path)


class QueryRequest(BaseModel):
    query: str
    deep_research: bool = False
    detail_level: int = Field(default=50, ge=0, le=100)


class ReportSection(BaseModel):
    title: str
    content: str
    sources: List[Dict]


class Report(BaseModel):
    title: str
    sections: List[ReportSection]
    summary: str


class DataPoint(BaseModel):
    """A single piece of evidence from the knowledge base with its metadata."""

    content: str = Field(description="The actual content/text of the data point")
    source_type: str = Field(
        description="Type of source: 'ad', 'market_research', or 'citation'"
    )
    url: str = Field(default="", description="URL to the source if available")
    image_url: str = Field(
        default="", description="URL to associated image if available"
    )
    relevance_score: float = Field(
        description="Relevance score of this data point to the query"
    )


class ResearchArea(BaseModel):
    """A specific area of research in the report with its findings and evidence."""

    title: str = Field(description="Title of this research area")
    format_guide: str = Field(
        description="Specific format and structure for this section"
    )
    query_prompt: str = Field(
        description="Customized prompt to generate this section's content"
    )
    supporting_data: List[DataPoint] = Field(
        description="Evidence supporting the content"
    )


class StructuredReport(BaseModel):
    """A structured report containing analysis of the knowledge base data."""

    query: str = Field(description="The original query that prompted this report")
    areas: List[ResearchArea] = Field(
        description="Analysis areas with their format guides"
    )
    executive_summary: str = Field(
        description="High-level summary of the entire report"
    )


class PerplexityLLM(CustomLLM):
    context_window: int = 4096
    num_output: int = 1024
    model: str = "sonar-pro"
    temperature: float = 0.1
    api_key: str = None
    api_url: str = "https://api.perplexity.ai/chat/completions"
    last_citations: List[str] = []

    def __init__(
        self, model: str = "sonar-pro", temperature: float = 0.1, api_key: str = None
    ):
        super().__init__()
        self.model = model
        self.temperature = temperature
        self.api_key = api_key or os.getenv("PERPLEXITY_API_KEY")
        self.last_citations = []  # Reset citations on init
        if not self.api_key:
            raise ValueError("Perplexity API key not found")

    @property
    def metadata(self) -> LLMMetadata:
        """Get LLM metadata."""
        return LLMMetadata(
            context_window=self.context_window,
            num_output=self.num_output,
            model_name=self.model,
        )

    @llm_completion_callback()
    def complete(self, prompt: str, **kwargs: Any) -> CompletionResponse:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": "You are a specialized AI assistant focused on providing comprehensive analysis of marketing and competitive data.",
                },
                {"role": "user", "content": prompt},
            ],
            "max_tokens": self.num_output,
            "temperature": self.temperature,
        }

        try:
            response = requests.post(self.api_url, json=payload, headers=headers)
            response.raise_for_status()
            response_json = response.json()

            # Extract and store citations if available
            self.last_citations = response_json.get("citations", [])

            return CompletionResponse(
                text=response_json["choices"][0]["message"]["content"]
            )
        except Exception as e:
            self.last_citations = []  # Reset citations on error
            raise Exception(f"Error calling Perplexity API: {str(e)}")

    @llm_completion_callback()
    def stream_complete(self, prompt: str, **kwargs: Any) -> CompletionResponseGen:
        response_text = self.complete(prompt, **kwargs).text
        response = ""
        # Simulate streaming by yielding one character at a time
        for char in response_text:
            response += char
            yield CompletionResponse(text=response, delta=char)

    def get_last_citations(self) -> List[str]:
        """Return citations from the last API call"""
        return self.last_citations


class KnowledgeBase:
    def __init__(self):
        # Initialize connections using environment variables
        self.supabase = create_client(
            os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
            os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
            options=ClientOptions(
                postgrest_client_timeout=60,
                schema="public",
            ),
        )

        # Initialize the index and query engines
        self._initialize_index()

    def _fetch_all_data(self, supabase: Client) -> List[Document]:
        """Fetch all relevant data from Supabase and convert to Documents"""
        documents = []

        # Fetch ad library data
        ad_data = supabase.table("ad_structured_output").select("*").execute().data
        for ad in ad_data:
            doc = Document(
                text=f"Ad Description: {ad['image_description']}\nImage URL: {ad['image_url']}",
                extra_info={"type": "ad", "id": ad["id"], "url": ad["image_url"]},
            )
            documents.append(doc)

        # Fetch market research data
        research_data = supabase.table("market_research_v2").select("*").execute().data
        for research in research_data:
            research_text = f"""
            Intent Summary: {research["intent_summary"]}
            Target Audience: {json.dumps(research["target_audience"], indent=2)}
            Pain Points: {json.dumps(research["pain_points"], indent=2)}
            Key Features: {json.dumps(research["key_features"], indent=2)}
            Competitive Advantages: {json.dumps(research["competitive_advantages"], indent=2)}
            Perplexity Insights: {research["perplexity_insights"]}
            """
            doc = Document(
                text=research_text,
                extra_info={
                    "type": "market_research",
                    "id": research["id"],
                    "image_url": research["image_url"],
                },
            )
            documents.append(doc)

        # Fetch citation research
        citation_data = supabase.table("citation_research").select("*").execute().data
        for citation in citation_data:
            citation_text = f"""
            Intent Summary: {citation["intent_summary"]}
            Primary Intent: {citation["primary_intent"]}
            Secondary Intents: {json.dumps(citation["secondary_intents"], indent=2)}
            Market Segments: {json.dumps(citation["market_segments"], indent=2)}
            Key Features: {json.dumps(citation["key_features"], indent=2)}
            Price Points: {json.dumps(citation["price_points"], indent=2)}
            Source URL: {citation["site_url"]}
            """
            doc = Document(
                text=citation_text,
                extra_info={
                    "type": "citation",
                    "id": citation["id"],
                    "image_url": citation["image_url"],
                    "url": citation["site_url"],
                },
            )
            documents.append(doc)

        return documents

    def _initialize_index(self):
        """Initialize the vector store and index, LLMs, and query engines"""
        documents = self._fetch_all_data(self.supabase)
        vector_store = SupabaseVectorStore(
            postgres_connection_string=os.getenv("DB_CONNECTION"),
            collection_name="library_items",
        )
        storage_context = StorageContext.from_defaults(vector_store=vector_store)

        # Create detailed company-specific prompt template
        company_name = COMPANY_CONTEXT.get("name", "Company")
        company_context = f"""You are an AI assistant for {company_name}, providing detailed analysis based on our company context.
        
        Key Company Context:
        - Industry: {COMPANY_CONTEXT.get("industry", "Not specified")}
        - Core Products: {", ".join(COMPANY_CONTEXT.get("core_business", {}).get("primary_products", ["Not specified"]))}
        - Key Markets: {", ".join(COMPANY_CONTEXT.get("core_business", {}).get("key_markets", ["Not specified"]))}
        - Target Segments: {", ".join(COMPANY_CONTEXT.get("core_business", {}).get("target_segments", ["Not specified"]))}
        
        Strategic Focus Areas:
        {self._format_strategic_priorities()}
        
        Market Position:
        - Competitive Advantages: {", ".join(COMPANY_CONTEXT.get("market_position", {}).get("competitive_advantages", ["Not specified"]))}
        - Key Competitors: {self._format_competitors()}
        - Current Market Trends: {", ".join(COMPANY_CONTEXT.get("market_position", {}).get("market_trends", {}).get("consumer_preferences", ["Not specified"]))}"""

        # Initialize QA templates for different detail levels
        self.qa_templates = create_qa_templates(company_context, company_name)

        self.index = VectorStoreIndex.from_documents(
            documents, storage_context=storage_context
        )

        # Initialize both LLMs
        self.perplexity_llm = PerplexityLLM(model="sonar-pro", temperature=0.1)
        openai_llm = OpenAI(model="gpt-4o-mini", temperature=0.1)

        # First set up OpenAI for structured program
        Settings.llm = openai_llm
        Settings.context_window = 8000
        Settings.num_output = 4000

        # Create structured program with OpenAI explicitly
        structured_prompt = f"""{company_context}
            
            Analyze the provided data and generate a structured report from {company_name}'s perspective.
            Focus on detailed analysis with comprehensive evidence and patterns.
            
            Available Data Types:
            - Market research with intent summaries and target audiences
            - Competitor citations with features and pricing
            - Ad analysis with visual descriptions
            
            Query: {{query}}
            Retrieved Context: {{context}}
            
            Return a structured report with these exact components:
            1. query: The original query text
            2. areas: A list of 3-4 research areas relevant to our priorities, each containing:
               - title: Clear section title aligned with our context
               - format_guide: Detailed format/structure (4-5 paragraphs per section)
               - query_prompt: Detailed prompt for company-specific analysis
               - supporting_data: List of relevant data points
            3. executive_summary: A thorough summary for leadership (2-3 paragraphs)
            
            Ensure each area:
            - Aligns with our strategic priorities
            - Considers our competitive positioning
            - Addresses our current challenges
            - Provides actionable insights
            - Maintains our market perspective"""

        self.structured_program = OpenAIPydanticProgram.from_defaults(
            output_cls=StructuredReport,
            llm=openai_llm,
            prompt_template_str=structured_prompt,
            verbose=True,
        )

        # Set up research query engine with OpenAI
        self.research_query_engine = self.index.as_query_engine(
            similarity_top_k=50,
            response_mode="refine",
            text_qa_template=self.qa_templates["standard"],
            llm=openai_llm,  # Explicitly pass OpenAI LLM
        )

        # Now switch to Perplexity for regular queries
        Settings.llm = self.perplexity_llm

        # # Initialize regular query engine with Perplexity
        # self.query_engine = self.index.as_query_engine(
        #     similarity_top_k=120,
        #     response_mode="compact",
        #     text_qa_template=self.qa_templates["compact"],
        #     llm=self.perplexity_llm,  # Explicitly pass Perplexity LLM
        # )

        # Create extended context for other methods
        self.company_context = f"""You are an AI assistant for {company_name}, 
        focusing on our company's specific context and strategic priorities.
        
        Key Company Context:
        - Industry: {COMPANY_CONTEXT.get("industry", "Not specified")}
        - Core Products: {", ".join(COMPANY_CONTEXT.get("core_business", {}).get("primary_products", ["Not specified"]))}
        - Key Markets: {", ".join(COMPANY_CONTEXT.get("core_business", {}).get("key_markets", ["Not specified"]))}
        - Target Segments: {", ".join(COMPANY_CONTEXT.get("core_business", {}).get("target_segments", ["Not specified"]))}
        
        Strategic Focus Areas:
        {self._format_strategic_priorities()}
        
        Market Position:
        - Competitive Advantages: {", ".join(COMPANY_CONTEXT.get("market_position", {}).get("competitive_advantages", ["Not specified"]))}
        - Key Competitors: {self._format_competitors()}
        - Current Market Trends: {", ".join(COMPANY_CONTEXT.get("market_position", {}).get("market_trends", {}).get("consumer_preferences", ["Not specified"]))}
        
        Current Challenges:
        {self._format_challenges()}
        """

    async def generate_section(self, area: ResearchArea) -> ReportSection:
        """Generate a single section of the report with retries and error handling"""
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # Query with the custom prompt for this section using research query engine
                section_response = self.research_query_engine.query(
                    f"""Generate a detailed analysis section about {area.title}.
                    
                    Specific Instructions:
                    {area.query_prompt}

                    Format your response using this structure: {area.format_guide}
                    
                    IMPORTANT: You must generate a NEW, DETAILED response. Never repeat or reference a previous answer.
                    
                    Requirements:
                    - Minimum 4-5 detailed paragraphs
                    - Specific examples and evidence
                    - Clear data citations
                    - In-depth analysis of patterns
                    - Comprehensive coverage of available data
                    
                    If you cannot generate a proper response, raise an error instead of returning a placeholder."""
                )

                content = str(section_response)

                # Check for invalid responses
                invalid_responses = [
                    "Repeat the original answer",
                    "I cannot generate",
                    "I apologize",
                    "As an AI",
                ]

                if any(phrase in content for phrase in invalid_responses):
                    raise ValueError("Invalid response detected")

                if len(content.split()) < 100:  # Minimum word count check
                    raise ValueError("Response too short")

                # Collect sources
                sources = [
                    {
                        "type": source_node.node.extra_info.get("type", "unknown"),
                        "content": source_node.node.text,
                        "url": source_node.node.extra_info.get("url", ""),
                        "image_url": source_node.node.extra_info.get("image_url", ""),
                        "relevance_score": float(source_node.score),
                    }
                    for source_node in section_response.source_nodes
                ]

                if not sources:
                    raise ValueError("No sources found in response")

                return ReportSection(title=area.title, content=content, sources=sources)

            except Exception:
                if attempt == max_retries - 1:  # Last attempt
                    # If all retries failed, generate a simplified but valid response
                    basic_response = self.query_engine.query(
                        f"""Provide a basic but valid analysis of {area.title}.
                        Focus on the most important facts and evidence available.
                        Must include at least 2-3 paragraphs with specific data points."""
                    )

                    return ReportSection(
                        title=area.title,
                        content=str(basic_response),
                        sources=[
                            {
                                "type": node.node.extra_info.get("type", "unknown"),
                                "content": node.node.text,
                                "relevance_score": float(node.score),
                            }
                            for node in basic_response.source_nodes
                        ],
                    )
                else:
                    # Wait briefly before retrying
                    await asyncio.sleep(1)
                    continue
        return None

    async def generate_report(self, query: str) -> Report:
        """Generates a structured report using OpenAI"""
        # Get initial context and plan the report structure
        initial_response = self.research_query_engine.query(  # Use research engine for initial query too
            f"""Analyze this query and determine the most effective way to structure a detailed report: {query}
            
            For each major area to cover, specify:
            1. The title of the section
            2. The ideal format/structure for presenting that specific type of information (minimum 4-5 paragraphs)
            3. A detailed prompt that will generate comprehensive analysis
            
            Consider the types of data available:
            - Market research with intent summaries and target audiences
            - Competitor citations with features and pricing
            - Ad analysis with visual descriptions
            
            Focus on creating sections that will provide unique, valuable insights rather than basic summaries.
            Each section should require detailed analysis with multiple examples and data points."""
        )

        # Generate structured report plan
        plan = self.structured_program(query=query, context=str(initial_response))

        # Generate all sections in parallel with error handling
        section_tasks = [self.generate_section(area) for area in plan.areas]
        sections = await asyncio.gather(*section_tasks, return_exceptions=True)

        # Filter out any failed sections and log them
        valid_sections = [
            section for section in sections if isinstance(section, ReportSection)
        ]

        return Report(
            title=query, sections=valid_sections, summary=plan.executive_summary
        )

    async def query(
        self, query: str, deep_research: bool = False, detail_level: int = 50
    ) -> dict:
        """Enhanced query method that supports both simple queries and structured reports"""
        if not deep_research:
            # Scale similarity_top_k based on detail level
            similarity_top_k = min(50 + (detail_level / 250) * 950, 800)

            # Scale context and output limits based on detail level
            # Map detail_level to context window (2048-8192 tokens)
            context_window = int(2048 + (detail_level / 100) * 6144)
            # Map detail_level to output tokens (256-4096 tokens)
            num_output = int(256 + (detail_level / 315) * 3840)

            # Select appropriate template and response mode based on detail level
            if detail_level < 35:
                template = self.qa_templates["compact"]
                response_mode = "simple_summarize"
                self.perplexity_llm.model = "sonar"
            elif detail_level < 50:
                template = self.qa_templates["compact"]
                response_mode = "tree_summarize"
                self.perplexity_llm.model = "sonar"
            elif detail_level < 65:
                template = self.qa_templates["standard"]
                response_mode = "tree_summarize"
                self.perplexity_llm.model = "sonar"
            elif detail_level < 85:
                template = self.qa_templates["comprehensive"]
                response_mode = "compact"
                self.perplexity_llm.model = "sonar-pro"
            else:
                template = self.qa_templates["comprehensive"]
                response_mode = "refine"
                self.perplexity_llm.model = "sonar-pro"

            # Update LLM settings
            self.perplexity_llm.context_window = context_window
            self.perplexity_llm.num_output = num_output

            # Create query engine with detail-specific settings
            detail_query_engine = self.index.as_query_engine(
                similarity_top_k=similarity_top_k,
                response_mode=response_mode,
                text_qa_template=template,
                llm=self.perplexity_llm,
            )

            response = detail_query_engine.query(query)

            sources = []
            for source_node in response.source_nodes:
                source = {
                    "text": source_node.node.text,
                    "score": float(source_node.score),
                    "extra_info": source_node.node.extra_info,
                }
                sources.append(source)

            citations = self.perplexity_llm.get_last_citations()

            return {
                "response": str(response),
                "sources": sources,
                "citations": citations,
                "metadata": {
                    "detail_level": detail_level,
                    "similarity_top_k": similarity_top_k,
                    "response_mode": response_mode,
                    "llm_model": self.perplexity_llm.model,
                    "context_window": context_window,
                    "num_output": num_output,
                },
            }
        else:
            # Deep research mode remains unchanged
            report = await self.generate_report(query)
            return {
                "report": {
                    "title": report.title,
                    "sections": [
                        {
                            "title": section.title,
                            "content": section.content,
                            "sources": section.sources,
                        }
                        for section in report.sections
                    ],
                    "summary": report.summary,
                },
                "type": "detailed_report",
            }

    def _format_strategic_priorities(self) -> str:
        """Format strategic priorities from company context, handling optional fields"""
        priorities = COMPANY_CONTEXT.get("strategic_priorities", {})
        formatted = []

        for area, details in priorities.items():
            formatted.append(f"- {area.replace('_', ' ').title()}:")
            if isinstance(details, dict):  # Check if details is a dictionary
                if "focus_areas" in details:
                    formatted.append(
                        f"  - Focus Areas: {', '.join(details['focus_areas'])}"
                    )
                if "objectives" in details:
                    formatted.append(
                        f"  - Objectives: {', '.join(details['objectives'])}"
                    )
                if "initiatives" in details:
                    formatted.append(
                        f"  - Key Initiatives: {', '.join(details['initiatives'])}"
                    )

        return "\n".join(formatted) if formatted else "No strategic priorities defined"

    def _format_competitors(self) -> str:
        """Format competitor information from company context, handling optional fields"""
        try:
            competitors = COMPANY_CONTEXT.get("market_position", {}).get(
                "key_competitors", []
            )
            return ", ".join(
                f"{comp.get('name', 'Unknown')} ({', '.join(comp.get('primary_competition_areas', ['General']))})"
                for comp in competitors
            )
        except Exception:
            return "No competitor information available"

    def _format_challenges(self) -> str:
        """Format current challenges from company context, handling optional fields"""
        try:
            challenges = COMPANY_CONTEXT.get("internal_context", {}).get(
                "current_challenges", {}
            )
            formatted = []

            for area, items in challenges.items():
                if (
                    isinstance(items, list) and items
                ):  # Check if items is a non-empty list
                    formatted.append(
                        f"- {area.replace('_', ' ').title()}: {', '.join(items)}"
                    )

            return (
                "\n".join(formatted) if formatted else "No current challenges defined"
            )
        except Exception:
            return "No challenge information available"


# Create a global instance of KnowledgeBase
# kb = None

# @app.post("/query")
# async def query_endpoint(request: QueryRequest):
#     """Enhanced endpoint that supports both simple queries and detailed reports"""
#     if not kb:
#         raise HTTPException(status_code=500, detail="Knowledge base not initialized")

#     try:
#         response = await kb.query(request.query, request.deep_research)
#         return response
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/health")
# async def health_check():
#     """
#     Simple health check endpoint
#     """
#     return {"status": "healthy"}

# def main():
#     """Run the FastAPI server"""
#     uvicorn.run(app, host="0.0.0.0", port=8000)

# if __name__ == "__main__":
#     main()
