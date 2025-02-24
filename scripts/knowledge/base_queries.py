from llama_index.core.storage import StorageContext
from llama_index.core import VectorStoreIndex, Document
from llama_index.vector_stores.supabase import SupabaseVectorStore
from supabase.client import Client, create_client, ClientOptions
from fastapi import FastAPI
from pydantic import BaseModel, Field
import json
import os
import asyncio
from typing import List, Dict
from contextlib import asynccontextmanager

# from llama_index.llms.groq import Groq
from pathlib import Path
from dotenv import load_dotenv
from llama_index.core import PromptTemplate

# from llama_index.core.query_engine import CitationQueryEngine
# from llama_index.core.agent import ReActAgent
# from llama_index.core.tools import QueryEngineTool
# from llama_index.core.response.schema import Response
from llama_index.program.openai import OpenAIPydanticProgram
import sys

sys.path.append(str(Path(__file__).parents[2]))
from company_context import COMPANY_CONTEXT


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

        # Initialize the index
        self._initialize_index()

        # Create company-specific prompt template with safe gets
        company_name = COMPANY_CONTEXT.get("name", "Company")
        company_context = f"""You are an AI assistant for {company_name}, 
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

        # Update research query engine with company context
        self.research_query_engine = self.index.as_query_engine(
            similarity_top_k=50,
            response_mode="refine",
            text_qa_template=PromptTemplate(
                f"""{company_context}
                
                You are a specialized AI assistant focused on generating detailed, comprehensive analysis.
                Your responses should be thorough and well-supported by the database information,
                while considering {company_name}'s specific context and strategic priorities.
                
                Context information is below:
                ---------------------
                {{context_str}}
                ---------------------

                Using this context and {company_name}'s company perspective, provide a detailed analysis addressing: {{query_str}}
                
                Requirements:
                - Generate at least 4-5 detailed paragraphs
                - Support each point with specific examples from the data
                - Include relevant statistics and trends
                - Cite specific sources when possible
                - Analyze patterns and relationships in the data
                - Consider implications for our strategic priorities
                - Align insights with our market position
                
                If certain information isn't available in the context, acknowledge that limitation but explore related available data."""
            ),
            temperature=0.1,
        )

        # Update structured program with company context
        self.structured_program = OpenAIPydanticProgram.from_defaults(
            output_cls=StructuredReport,
            prompt_template_str=f"""{company_context}
            
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
            - Maintains our market perspective""",
            verbose=True,
        )

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
        """Initialize the vector store and index"""
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

        qa_template = PromptTemplate(
            f"""{company_context}
            
            You are a specialized AI assistant focused on providing comprehensive analysis of marketing and competitive data.
            Your responses should be thorough and well-supported by the database information about ads, market research, and competitor citations.
            
            Context information is below:
            ---------------------
            {{context_str}}
            ---------------------

            Using this context and {company_name}'s perspective, provide a detailed analysis addressing: {{query_str}}
            
            Requirements:
            - Generate at least 2-3 detailed paragraphs
            - Support each point with specific examples from the data
            - Include relevant statistics and trends when available
            - Cite specific sources and evidence
            - Consider implications for our strategic priorities
            - Align insights with our market position
            
            If certain information isn't available in the context, acknowledge that limitation but explore related available data."""
        )

        self.index = VectorStoreIndex.from_documents(
            documents, storage_context=storage_context
        )

        self.query_engine = self.index.as_query_engine(
            similarity_top_k=50,
            response_mode="refine",
            text_qa_template=qa_template,
            temperature=0.1,
        )

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

    async def query(self, query: str, deep_research: bool = False) -> dict:
        """Enhanced query method that supports both simple queries and structured reports"""
        if not deep_research:
            # Use existing simple query logic
            response = self.query_engine.query(query)

            sources = []
            for source_node in response.source_nodes:
                source = {
                    "text": source_node.node.text,
                    "score": float(source_node.score),
                    "extra_info": source_node.node.extra_info,
                }
                sources.append(source)

            return {"response": str(response), "sources": sources}
        else:
            # Generate structured report
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
