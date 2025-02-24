from typing import Dict, List
from llama_index.core import Document, VectorStoreIndex
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.llms.openai import OpenAI
from llama_index.core.storage import StorageContext
from llama_index.vector_stores.supabase import SupabaseVectorStore
from llama_index.core.settings import Settings
import json
from dataclasses import dataclass
from datetime import datetime
from supabase import create_client, ClientOptions
from pydantic import BaseModel
import logging
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
env_path = Path(__file__).parents[2] / ".env.local"
load_dotenv(env_path)

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MarketInsight:
    target_audiences: List[Dict]
    competitive_landscape: Dict
    key_features: Dict
    pricing_analysis: Dict
    buying_stages: List[str]
    keyword_analysis: List[Dict]
    content_recommendations: List[Dict]
    market_analysis: Dict
    trend_analysis: Dict
    strategic_recommendations: List[str]
    created_at: str


class MarketInsightRequest(BaseModel):
    """Request model for market insight generation"""

    user_id: str
    filters: Dict = {}


class MarketInsightResponse(BaseModel):
    """Response model for market insights"""

    executive_summary: Dict
    market_summary: Dict
    market_analysis: Dict
    keyword_insights: Dict
    metadata: Dict


class MarketResearchAnalyzer:
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

            # Initialize LLM and settings
            self.llm = OpenAI(temperature=0.1, model="gpt-4")
            Settings.llm = self.llm
            Settings.node_parser = SimpleNodeParser()

            # Initialize vector store and index
            self._initialize_index()

            logger.info("MarketResearchAnalyzer initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing MarketResearchAnalyzer: {str(e)}")
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
            for entry in research_data:
                # Log the raw entry for debugging
                logger.debug(f"Processing entry: {json.dumps(entry, indent=2)}")

                content = f"""
                Target Audience: {json.dumps(entry.get("target_audience", []))}
                Competitive Advantages: {json.dumps(entry.get("competitive_advantages", []))}
                Key Features: {json.dumps(entry.get("key_features", []))}
                Keywords: {json.dumps(entry.get("keywords", []))}
                Intent Summary: {entry.get("intent_summary", "")}
                Buying Stage: {entry.get("buying_stage", "")}
                Pain Points: {json.dumps(entry.get("pain_points", []))}
                Perplexity Insights: {entry.get("perplexity_insights", "")}
                """
                doc = Document(text=content)
                documents.append(doc)

                # Log document creation
                logger.debug(f"Created document with content: {content}")

            # Initialize vector store
            db_connection = os.getenv("DB_CONNECTION")
            if not db_connection:
                raise ValueError("Missing DB_CONNECTION environment variable")

            vector_store = SupabaseVectorStore(
                postgres_connection_string=db_connection,
                collection_name="market_research",
            )
            storage_context = StorageContext.from_defaults(vector_store=vector_store)

            # Create index
            self.index = VectorStoreIndex.from_documents(
                documents,
                storage_context=storage_context,
            )

            # Initialize query engine
            self.query_engine = self.index.as_query_engine(
                similarity_top_k=5,
                response_mode="compact",
            )

            # Store raw research data for direct access in analysis methods
            self.research_data = research_data

            logger.info("Vector index initialized successfully")
        except Exception as e:
            logger.error(f"Error in _initialize_index: {str(e)}")
            raise

    async def analyze_market_trends(self) -> Dict:
        """Generate market trend analysis using LlamaIndex"""
        try:
            if not hasattr(self, "query_engine"):
                self.query_engine = self.index.as_query_engine(
                    similarity_top_k=5,
                    response_mode="compact",
                )

            trend_queries = [
                "What are the main market trends visible in the data?",
                "What are the most significant competitive advantages being leveraged?",
                "What patterns emerge in customer pain points across different segments?",
                "How do buying stages correlate with feature preferences?",
            ]

            trend_analysis = {}
            for query in trend_queries:
                response = self.query_engine.query(query)
                trend_analysis[query] = response.response

            return trend_analysis
        except Exception as e:
            logger.error(f"Error in analyze_market_trends: {str(e)}")
            raise

    async def generate_strategic_insights(self) -> List[str]:
        """Generate strategic recommendations"""
        try:
            if not hasattr(self, "query_engine"):
                self.query_engine = self.index.as_query_engine(
                    similarity_top_k=5,
                    response_mode="compact",
                )

            strategy_prompt = """
            Based on the market research data, provide strategic recommendations addressing:
            1. Market positioning opportunities
            2. Feature prioritization
            3. Content strategy adjustments
            4. Competitive differentiation
            5. Customer segment targeting
            
            Format as clear, actionable recommendations.
            """

            response = self.query_engine.query(strategy_prompt)
            return [rec.strip() for rec in response.response.split("\n") if rec.strip()]
        except Exception as e:
            logger.error(f"Error in generate_strategic_insights: {str(e)}")
            raise

    async def generate_market_insight(
        self, user_id: str, filters: Dict = {}
    ) -> MarketInsightResponse:
        """Generate comprehensive market insight"""
        try:
            logger.info(f"Generating market insight for user {user_id}")

            # Generate analyses
            trend_analysis = await self.analyze_market_trends()
            strategic_recommendations = await self.generate_strategic_insights()

            # Use stored research data instead of fetching again
            research_data = self.research_data

            # Log data for debugging
            logger.debug(f"Research data count: {len(research_data)}")
            if research_data:
                logger.debug(f"Sample entry: {json.dumps(research_data[0], indent=2)}")

            # Compile response
            response = MarketInsightResponse(
                executive_summary={
                    "key_findings": strategic_recommendations[:5],
                    "strategic_recommendations": strategic_recommendations[:3],
                },
                market_summary={
                    "target_audiences": self.analyze_target_audiences(research_data),
                    "competitive_landscape": self.analyze_competitive_landscape(
                        research_data
                    ),
                    "key_features": self.analyze_key_features(research_data),
                    "buying_stages": list(
                        set(entry.get("buying_stage", "") for entry in research_data)
                    ),
                },
                market_analysis={
                    "trends": trend_analysis,
                    "strategic_recommendations": strategic_recommendations,
                },
                keyword_insights={
                    "analysis": self.analyze_keywords(research_data),
                },
                metadata={
                    "generated_at": datetime.now().isoformat(),
                    "user_id": user_id,
                    "filters_applied": filters,
                    "data_sources": ["market_research_v2"],
                },
            )

            # Log response for debugging
            logger.debug(f"Generated response: {json.dumps(response.dict(), indent=2)}")
            logger.info(f"Successfully generated market insight for user {user_id}")
            return response

        except Exception as e:
            logger.error(f"Error generating market insight: {str(e)}")
            raise

    def fetch_market_research_data(self, research_data: List[Dict]) -> List[Dict]:
        """Fetch all market research data from the market_research_v2 table"""
        return research_data

    def analyze_target_audiences(self, research_data: List[Dict]) -> List[Dict]:
        """Aggregate and analyze target audience information"""
        audiences = []
        for entry in research_data:
            if isinstance(entry.get("target_audience"), list):
                for audience in entry["target_audience"]:
                    audiences.append(
                        {
                            "segment": audience.get("name", ""),
                            "details": {
                                "characteristics": audience.get("characteristics", []),
                                "preferences": audience.get("preferences", []),
                            },
                            "pain_points": audience.get("pain_points", []),
                            "buying_stage": entry.get("buying_stage", ""),
                        }
                    )
        return audiences

    def analyze_competitive_landscape(self, research_data: List[Dict]) -> Dict:
        """Analyze competitive advantages and market positioning"""
        competitive_analysis = {
            "advantages": {},
            "feature_comparison": {},
            "market_positioning": {},
        }

        for entry in research_data:
            if isinstance(entry.get("competitive_advantages"), list):
                for advantage in entry["competitive_advantages"]:
                    category = self._categorize_advantage(advantage)
                    if category not in competitive_analysis["advantages"]:
                        competitive_analysis["advantages"][category] = []
                    competitive_analysis["advantages"][category].append(advantage)

            # Add feature comparison based on key_features
            if isinstance(entry.get("key_features"), list):
                for feature in entry["key_features"]:
                    feature_name = feature.get("name", "")
                    if feature_name not in competitive_analysis["feature_comparison"]:
                        competitive_analysis["feature_comparison"][feature_name] = {
                            "importance_score": feature.get("importance_score", 0),
                            "benefits": feature.get("mentioned_benefits", []),
                        }

        return competitive_analysis

    def _categorize_advantage(self, advantage: str) -> str:
        """Helper method to categorize competitive advantages"""
        categories = {
            "marketing": ["advertising", "influencer", "social media", "content"],
            "product": ["quality", "design", "style", "comfort"],
            "brand": ["reputation", "heritage", "trust"],
            "distribution": ["platform", "availability", "delivery"],
        }

        advantage_lower = advantage.lower()
        for category, keywords in categories.items():
            if any(keyword in advantage_lower for keyword in keywords):
                return category
        return "other"

    def analyze_key_features(self, research_data: List[Dict]) -> Dict:
        """Analyze key features and their importance"""
        feature_analysis = {}

        for entry in research_data:
            if isinstance(entry.get("key_features"), list):
                for feature in entry["key_features"]:
                    name = feature.get("name", "")
                    if name not in feature_analysis:
                        feature_analysis[name] = {
                            "importance_scores": [],
                            "benefits": set(),
                            "frequency": 0,
                        }
                    feature_analysis[name]["importance_scores"].append(
                        feature.get("importance_score", 0)
                    )
                    feature_analysis[name]["benefits"].update(
                        feature.get("mentioned_benefits", [])
                    )
                    feature_analysis[name]["frequency"] += 1

        # Convert sets to lists for JSON serialization
        for feature in feature_analysis.values():
            feature["benefits"] = list(feature["benefits"])
            feature["average_importance"] = (
                sum(feature["importance_scores"]) / len(feature["importance_scores"])
                if feature["importance_scores"]
                else 0
            )
            del feature["importance_scores"]  # Clean up working data

        return feature_analysis

    def analyze_keywords(self, research_data: List[Dict]) -> List[Dict]:
        """Analyze keyword patterns and intent mapping"""
        keyword_analysis = []

        for entry in research_data:
            if isinstance(entry["keywords"], list):
                for keyword_data in entry["keywords"]:
                    keyword_analysis.append(
                        {
                            "keyword": keyword_data["keyword"],
                            "intent": keyword_data["intent_reflected"],
                            "likelihood": keyword_data["likelihood_score"],
                        }
                    )

        return keyword_analysis

    def analyze_competitive_positioning(self, index: VectorStoreIndex) -> Dict:
        """Analyze competitive positioning and market opportunities"""
        if not hasattr(self, "query_engine"):
            self.query_engine = self.index.as_query_engine(
                similarity_top_k=5,
                response_mode="compact",
            )

        positioning_prompt = """
        Analyze the competitive landscape and provide insights on:
        1. Key differentiators in the market
        2. Gaps in competitor offerings
        3. Emerging market opportunities
        4. Potential threats and challenges
        
        Provide specific examples and evidence from the data.
        """

        response = self.query_engine.query(positioning_prompt)
        return {
            "analysis": response.response,
            "key_findings": self.extract_key_findings(response.response),
        }

    def extract_key_findings(self, analysis: str) -> List[str]:
        """Extract key findings from analysis text"""
        if not hasattr(self, "query_engine"):
            self.query_engine = self.index.as_query_engine(
                similarity_top_k=5,
                response_mode="compact",
            )

        extraction_prompt = "What are the 5 most important findings from this analysis? List them as concise bullet points."
        response = self.query_engine.query(extraction_prompt)
        return [
            finding.strip()
            for finding in response.response.split("\n")
            if finding.strip()
        ]


# @asynccontextmanager
# async def lifespan(app: FastAPI):
#     """Lifespan context manager for FastAPI"""
#     # Initialize on startup
#     global market_analyzer
#     market_analyzer = MarketResearchAnalyzer()
#     yield
#     # Clean up on shutdown
#     market_analyzer = None


# app = FastAPI(title="Market Research Analysis API", lifespan=lifespan)

# # Global instance
# market_analyzer = None


# @app.post("/generate-market-insight", response_model=MarketInsightResponse)
# async def generate_market_insight_endpoint(request: MarketInsightRequest):
#     """Generate market insight based on request parameters"""
#     try:
#         if not market_analyzer:
#             raise HTTPException(
#                 status_code=500, detail="Market analyzer not initialized"
#             )

#         logger.info(f"Received market insight request for user {request.user_id}")

#         insight = await market_analyzer.generate_market_insight(
#             user_id=request.user_id, filters=request.filters
#         )

#         logger.info(f"Successfully generated market insight for user {request.user_id}")
#         return insight

#     except Exception as e:
#         logger.error(f"Error in generate_market_insight_endpoint: {str(e)}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/health")
# async def health_check():
#     """Simple health check endpoint"""
#     return {"status": "healthy"}


# def main():
#     """Run the FastAPI server"""
#     import uvicorn

#     uvicorn.run(app, host="0.0.0.0", port=8002)


# if __name__ == "__main__":
#     main()
