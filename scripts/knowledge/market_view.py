from typing import Dict, List, Union
from typing_extensions import TypedDict
from llama_index.core import Document, VectorStoreIndex
from llama_index.core.node_parser import SimpleNodeParser
from llama_index.llms.openai import OpenAI
from llama_index.core.storage import StorageContext
from llama_index.vector_stores.supabase import SupabaseVectorStore
from llama_index.core.settings import Settings
from llama_index.embeddings.openai import OpenAIEmbedding
import json
from dataclasses import dataclass
from datetime import datetime
from supabase import create_client, ClientOptions
from pydantic import BaseModel
import logging
import os
from pathlib import Path
from dotenv import load_dotenv
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import asyncio
from concurrent.futures import ThreadPoolExecutor
from company_context import COMPANY_CONTEXT

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


class BrandInsightDetails(TypedDict):
    brand: str
    segments: List[str]
    features: List[str]


class MarketInsightDetails(TypedDict):
    key_segments: List[str]
    price_ranges: List[str]


class BrandInsight(TypedDict):
    insight: str
    source_urls: List[str]
    details: BrandInsightDetails


class MarketInsight(TypedDict):
    insight: str
    source_urls: List[str]
    details: MarketInsightDetails


class MarketInsightResponse(BaseModel):
    """Response model for market insights"""

    executive_summary: Dict
    market_summary: Dict
    market_analysis: Dict
    keyword_insights: Dict
    brand_insights: List[BrandInsight]
    market_insights: List[MarketInsight]
    metadata: Dict


class InsightOutput(TypedDict):
    insight: str
    source_urls: List[str]
    details: List[str]


@dataclass
class CompetitorData:
    brand: str
    urls: List[str]
    features: List[Dict]
    price_points: Dict
    market_segments: Dict


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
            self.llm = OpenAI(temperature=0.1, model="gpt-4o-mini")
            Settings.llm = self.llm
            Settings.node_parser = SimpleNodeParser()

            # Initialize embedding model for semantic deduplication
            self.embed_model = OpenAIEmbedding()

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
                prompt = f"""
                Provide a detailed analysis of the following trend for {COMPANY_CONTEXT["name"]}:
                {query}

                Format as a clear, actionable trend with no "1.", "2.", or "3." prefixes, just provide the trend.
                
                Here's a compilation of key company context for {COMPANY_CONTEXT["name"]}. 
                {COMPANY_CONTEXT}
                """

                response = self.query_engine.query(prompt)
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

            # Generate brand and market insights
            brand_market_insights = await self.generate_brand_market_insights(user_id)

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
                brand_insights=brand_market_insights["brand_insights"],
                market_insights=brand_market_insights["market_insights"],
                metadata={
                    "generated_at": datetime.now().isoformat(),
                    "user_id": user_id,
                    "filters_applied": filters,
                    "data_sources": ["market_research_v2", "citation_research"],
                },
            )

            # Store the response in markets_overview table
            try:
                response_dict = response.dict()
                result = (
                    self.supabase.table("markets_overview")
                    .insert(
                        {
                            "user_id": user_id,
                            "insights": response_dict,
                            "created_at": datetime.now().isoformat(),
                        }
                    )
                    .execute()
                )

                # Check if the operation was successful
                if hasattr(result, "data") and result.data:
                    logger.info(
                        f"Successfully stored market insight in markets_overview table for user {user_id}"
                    )
                else:
                    logger.warning(
                        f"Market insight storage completed but may not have been successful for user {user_id}"
                    )
            except Exception as e:
                logger.error(f"Error storing market insight in database: {str(e)}")
                # Continue execution even if storage fails

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

    def _semantic_deduplication(
        self, items: List[Dict], key_field: str, similarity_threshold: float = 0.85
    ) -> List[Dict]:
        """
        Perform semantic deduplication on a list of items based on a specific field.

        Args:
            items: List of dictionaries containing the items to deduplicate
            key_field: The field name to use for semantic comparison
            similarity_threshold: Threshold above which items are considered duplicates (0.0 to 1.0)

        Returns:
            List of deduplicated items
        """
        if not items:
            return []

        try:
            # Extract the text values to compare
            texts = [item.get(key_field, "") for item in items]

            # Generate embeddings for all texts
            embeddings = self.embed_model.get_text_embedding_batch(texts)
            embeddings_array = np.array(embeddings)

            # Calculate similarity matrix
            similarity_matrix = cosine_similarity(embeddings_array)

            # Track which items to keep
            to_keep = [True] * len(items)

            # For each pair of items, mark duplicates
            for i in range(len(items)):
                if not to_keep[i]:
                    continue  # Skip if already marked as duplicate

                for j in range(i + 1, len(items)):
                    if similarity_matrix[i, j] >= similarity_threshold:
                        # Mark the item with lower "frequency" or "likelihood" as duplicate
                        # If these fields don't exist, keep the first occurrence
                        item_i_score = items[i].get(
                            "frequency", items[i].get("likelihood", 1)
                        )
                        item_j_score = items[j].get(
                            "frequency", items[j].get("likelihood", 0)
                        )

                        if item_i_score >= item_j_score:
                            to_keep[j] = False
                        else:
                            to_keep[i] = False
                            break  # No need to compare i with other items

            # Filter the items based on the to_keep mask
            deduplicated_items = [
                item for idx, item in enumerate(items) if to_keep[idx]
            ]

            logger.info(
                f"Semantic deduplication reduced {len(items)} items to {len(deduplicated_items)} items"
            )
            return deduplicated_items

        except Exception as e:
            logger.error(f"Error in semantic deduplication: {str(e)}")
            # Fall back to returning original items if deduplication fails
            return items

    def _deduplicate_target_audiences(self, audiences: List[Dict]) -> List[Dict]:
        """
        Deduplicate target audiences based on segment name similarity.
        Preserves and merges citations from similar audiences.
        """
        try:
            if not audiences:
                return []

            # Create a list of dictionaries with the segment name as the key field for deduplication
            audience_for_dedup = []
            for idx, audience in enumerate(audiences):
                audience_for_dedup.append(
                    {
                        "name": audience["segment"],
                        "original": audience,
                        "original_index": idx,
                    }
                )

            # Perform semantic deduplication
            deduplicated_indices = set()
            similarity_threshold = 0.85  # Same threshold as in _semantic_deduplication

            # Extract the text values to compare
            texts = [item["name"] for item in audience_for_dedup]

            # Generate embeddings for all texts
            embeddings = self.embed_model.get_text_embedding_batch(texts)
            embeddings_array = np.array(embeddings)

            # Calculate similarity matrix
            similarity_matrix = cosine_similarity(embeddings_array)

            # Track which items to keep and which to merge
            to_keep = [True] * len(audience_for_dedup)
            merge_map = {}  # Maps indices to be merged with

            # For each pair of items, mark duplicates and track merges
            for i in range(len(audience_for_dedup)):
                if not to_keep[i]:
                    continue  # Skip if already marked as duplicate

                for j in range(i + 1, len(audience_for_dedup)):
                    if similarity_matrix[i, j] >= similarity_threshold:
                        # Mark the second item as duplicate
                        to_keep[j] = False
                        # Track that j should be merged with i
                        merge_map[j] = i

            # Merge citations for similar audiences
            for j, i in merge_map.items():
                # Get citations from both audiences
                original_citations = audience_for_dedup[i]["original"].get(
                    "citations", []
                )
                duplicate_citations = audience_for_dedup[j]["original"].get(
                    "citations", []
                )

                # Merge citations (avoid duplicates)
                merged_citations = list(set(original_citations + duplicate_citations))

                # Update the original audience with merged citations
                audience_for_dedup[i]["original"]["citations"] = merged_citations

            # Filter the items based on the to_keep mask
            deduplicated_items = [
                item["original"]
                for idx, item in enumerate(audience_for_dedup)
                if to_keep[idx]
            ]

            logger.info(
                f"Target audience deduplication reduced {len(audiences)} audiences to {len(deduplicated_items)} audiences"
            )
            return deduplicated_items

        except Exception as e:
            logger.error(f"Error in target audience deduplication: {str(e)}")
            # Return original data if deduplication fails
            return audiences

    def _deduplicate_keywords(self, keywords: List[Dict]) -> List[Dict]:
        """
        Deduplicate keywords based on keyword text similarity.
        Preserves and merges citations from similar keywords.
        """
        try:
            if not keywords:
                return []

            # Extract the text values to compare
            texts = [item.get("keyword", "") for item in keywords]

            # Generate embeddings for all texts
            embeddings = self.embed_model.get_text_embedding_batch(texts)
            embeddings_array = np.array(embeddings)

            # Calculate similarity matrix
            similarity_matrix = cosine_similarity(embeddings_array)
            similarity_threshold = 0.85

            # Track which items to keep and which to merge
            to_keep = [True] * len(keywords)
            merge_map = {}  # Maps indices to be merged with

            # For each pair of items, mark duplicates and track merges
            for i in range(len(keywords)):
                if not to_keep[i]:
                    continue  # Skip if already marked as duplicate

                for j in range(i + 1, len(keywords)):
                    if similarity_matrix[i, j] >= similarity_threshold:
                        # Compare likelihood scores to decide which to keep
                        item_i_score = keywords[i].get("likelihood", 0)
                        item_j_score = keywords[j].get("likelihood", 0)

                        if item_i_score >= item_j_score:
                            # Keep i, merge j into i
                            to_keep[j] = False
                            merge_map[j] = i
                        else:
                            # Keep j, merge i into j
                            to_keep[i] = False
                            merge_map[i] = j
                            break  # No need to compare i with other items

            # Merge citations for similar keywords
            for source_idx, target_idx in merge_map.items():
                # Get citations from both keywords
                target_citations = keywords[target_idx].get("citations", [])
                source_citations = keywords[source_idx].get("citations", [])

                # Merge citations (avoid duplicates)
                merged_citations = list(set(target_citations + source_citations))

                # Update the target keyword with merged citations
                keywords[target_idx]["citations"] = merged_citations

            # Filter the items based on the to_keep mask
            deduplicated_items = [
                item for idx, item in enumerate(keywords) if to_keep[idx]
            ]

            logger.info(
                f"Keyword deduplication reduced {len(keywords)} keywords to {len(deduplicated_items)} keywords"
            )
            return deduplicated_items

        except Exception as e:
            logger.error(f"Error in keyword deduplication: {str(e)}")
            # Return original data if deduplication fails
            return keywords

    def analyze_target_audiences(self, research_data: List[Dict]) -> List[Dict]:
        """Aggregate and analyze target audience information with semantic deduplication"""
        audiences = []
        for entry in research_data:
            if isinstance(entry.get("target_audience"), list):
                for audience in entry["target_audience"]:
                    # Get citations if available
                    citations = entry.get("citations", [])

                    audiences.append(
                        {
                            "segment": audience.get("name", ""),
                            "details": {
                                "characteristics": audience.get("characteristics", []),
                                "preferences": audience.get("preferences", []),
                            },
                            "pain_points": audience.get("pain_points", []),
                            "buying_stage": entry.get("buying_stage", ""),
                            "citations": citations,  # Include citations for this audience
                        }
                    )

        # Apply semantic deduplication to target audiences
        deduplicated_audiences = self._deduplicate_target_audiences(audiences)

        return deduplicated_audiences

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
        """Analyze keyword patterns and intent mapping with semantic deduplication"""
        keyword_analysis = []

        for entry in research_data:
            if isinstance(entry.get("keywords"), list):
                # Get citations if available
                citations = entry.get("citations", [])

                for keyword_data in entry["keywords"]:
                    if (
                        isinstance(keyword_data, dict)
                        and "keyword" in keyword_data
                        and "intent_reflected" in keyword_data
                    ):
                        keyword_analysis.append(
                            {
                                "keyword": keyword_data["keyword"],
                                "intent": keyword_data["intent_reflected"],
                                "likelihood": keyword_data.get("likelihood_score", 0),
                                "citations": citations,  # Include citations for this keyword
                            }
                        )

        # Apply semantic deduplication to keywords
        deduplicated_keywords = self._deduplicate_keywords(keyword_analysis)

        return deduplicated_keywords

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

    async def generate_brand_market_insights(
        self, user_id: str
    ) -> Dict[str, List[InsightOutput]]:
        """Generate brand and market insights from citation research data"""
        try:
            # Fetch citation research data
            citation_data = (
                self.supabase.table("citation_research")
                .select("*")
                .order("created_at", desc=True)  # Get most recent data
                .limit(15)  # Limit to 15 most recent entries
                .execute()
                .data
            )

            if not citation_data:
                logger.warning("No citation research data found")
                return {"brand_insights": [], "market_insights": []}

            # Get key competitors from company context
            key_competitors = [
                comp["name"]
                for comp in COMPANY_CONTEXT["market_position"]["key_competitors"]
            ]

            # Extract unique brands from recent data, prioritizing key competitors
            unique_brands = set()
            key_competitor_entries = []
            other_entries = []

            for entry in citation_data:
                brands = entry.get("competitor_brands", [])
                for brand in brands:
                    if brand in key_competitors:
                        key_competitor_entries.append(entry)
                        unique_brands.add(brand)
                    else:
                        other_entries.append(entry)
                        unique_brands.add(brand)

            # Prioritize key competitors first, then add other brands up to limit
            top_brands = (
                [brand for brand in key_competitors if brand in unique_brands]
                + list(unique_brands - set(key_competitors))
            )[
                :10
            ]  # Limit to 10 brands total

            # Simplified competitor data collection with company context awareness
            competitor_data: Dict[str, CompetitorData] = {}
            for brand in top_brands:
                # For each brand, fetch entries that contain this brand
                # We'll use a filter to find entries where the brand is in the competitor_brands array
                brand_entries = []

                # Since we can't do complex SQL queries directly, we'll filter the data we already have
                for entry in citation_data:
                    competitor_brands = entry.get("competitor_brands", [])
                    if not competitor_brands:
                        continue

                    # Check if brand is in competitor_brands (exact match or partial match)
                    if brand in competitor_brands or any(
                        brand.lower() in cb.lower() for cb in competitor_brands
                    ):
                        brand_entries.append(entry)

                # Randomly sample up to 15 entries if we have more
                import random

                if len(brand_entries) > 15:
                    brand_entries = random.sample(brand_entries, 15)

                if not brand_entries:
                    continue

                # Get competitor context if available
                competitor_context = next(
                    (
                        comp
                        for comp in COMPANY_CONTEXT["market_position"][
                            "key_competitors"
                        ]
                        if comp["name"] == brand
                    ),
                    None,
                )

                # Collect all URLs for this brand
                brand_urls = []
                for entry in brand_entries:
                    if entry.get("site_url") and entry["site_url"] not in brand_urls:
                        brand_urls.append(entry["site_url"])

                # Use the first entry for other data
                latest_entry = brand_entries[0]

                # Extract market segments names and features
                market_segments = [
                    segment.get("name", "")
                    for segment in latest_entry.get("market_segments", [])
                    if isinstance(segment, dict)
                ]

                # If this is a key competitor, add their primary competition areas
                if competitor_context:
                    market_segments.extend(
                        competitor_context["primary_competition_areas"]
                    )
                    market_segments = list(set(market_segments))  # Remove duplicates

                # Extract price points
                price_points = [
                    {
                        "range": f"${point.get('range_min', 0)}-${point.get('range_max', 0)}",
                        "segment": point.get("target_segment", ""),
                    }
                    for point in latest_entry.get("price_points", [])
                    if isinstance(point, dict)
                ]

                competitor_data[brand] = CompetitorData(
                    brand=brand,
                    urls=brand_urls[:3],  # Limit to 3 URLs per brand
                    features=latest_entry.get("key_features", []),
                    price_points=price_points,
                    market_segments=market_segments,
                )

            # Generate insights in parallel with company context
            brand_insights = await self._generate_brand_insights(competitor_data)
            market_insights = await self._generate_market_insights(
                citation_data, company_context=COMPANY_CONTEXT
            )

            return {
                "brand_insights": brand_insights,
                "market_insights": market_insights,
            }

        except Exception as e:
            logger.error(f"Error generating brand and market insights: {str(e)}")
            raise

    async def _generate_brand_insights(
        self, competitor_data: Dict[str, CompetitorData]
    ) -> List[InsightOutput]:
        """Generate brand-specific insights using parallel processing"""

        async def process_brand(
            brand: str, data: CompetitorData
        ) -> List[InsightOutput]:
            try:
                # Extract feature names and importance scores
                features = [
                    f"{f.get('name', '')} ({f.get('importance_score', 0):.1f})"
                    for f in data.features[:3]
                    if isinstance(f, dict) and "name" in f and "importance_score" in f
                ]

                segments = data.market_segments[:3] if data.market_segments else []

                # Create a focused prompt for actionable insights
                prompt = f"""
                Generate 2 concise insights about {brand}'s market actions or strategy.
                Format example: "{brand} [action/strategy] [specific detail] in [market/segment], responding to [trend/need]"
                Keep it tweet-length but specific and actionable.
                Example: "Nike launches eco-friendly running line 'GreenStride' in European market, responding to sustainability demand"

                Use these details:
                Features: {", ".join(features) if features else "N/A"}
                Segments: {", ".join(segments) if segments else "N/A"}
                """

                response = self.query_engine.query(prompt)

                # Clean and format insights
                insights = [
                    text.strip()
                    for text in response.response.split("\n")
                    if text.strip()
                    and not text.strip().startswith(("1.", "2.", "3.", "-", "•"))
                ]

                return [
                    {
                        "insight": insight,
                        "source_urls": data.urls,
                        "details": {
                            "brand": brand,
                            "segments": segments,
                            "features": features,
                        },
                    }
                    for insight in insights
                    if len(insight) > 20 and len(insight) < 150  # Ensure concise length
                ][:2]

            except Exception as e:
                logger.error(f"Error processing brand {brand}: {str(e)}")
                return []

        tasks = [process_brand(brand, data) for brand, data in competitor_data.items()]
        results = await asyncio.gather(*tasks)
        return [insight for brand_insights in results for insight in brand_insights]

    async def _generate_market_insights(
        self, citation_data: List[Dict], company_context: Dict
    ) -> List[InsightOutput]:
        """Generate market-wide insights using parallel processing"""
        try:
            # Aggregate key market data with company context awareness
            market_data = {
                "segments": set(
                    company_context["core_business"]["target_segments"]
                ),  # Start with company's target segments
                "price_ranges": set(),
                "trends": set(
                    company_context["market_position"]["market_trends"][
                        "consumer_preferences"
                    ]
                ),  # Include known trends
            }

            for entry in citation_data:
                # Add segments and their pain points
                segments = entry.get("market_segments", [])
                if isinstance(segments, list):
                    for segment in segments:
                        if isinstance(segment, dict):
                            segment_name = segment.get("name")
                            if segment_name:
                                market_data["segments"].add(segment_name)
                                # Add pain points if available
                                pain_points = segment.get("pain_points", [])
                                if isinstance(pain_points, list):
                                    market_data["trends"].update(pain_points)

                # Add price ranges
                price_points = entry.get("price_points", [])
                if isinstance(price_points, list):
                    for point in price_points:
                        if isinstance(point, dict):
                            min_price = point.get("range_min")
                            max_price = point.get("range_max")
                            if min_price is not None and max_price is not None:
                                price_range = f"${min_price}-${max_price}"
                                market_data["price_ranges"].add(price_range)

            # Convert sets to sorted lists and ensure we have data
            market_data = {
                "segments": sorted(list(market_data["segments"]))[:3],
                "price_ranges": (
                    sorted(list(market_data["price_ranges"]))[:3]
                    if market_data["price_ranges"]
                    else ["$0-$100"]
                ),
                "trends": sorted(list(market_data["trends"]))[:3],
            }

            # Generate focused market insights with company context
            market_prompt = f"""
            Generate 3 concise market insights about trends and opportunities for {company_context["name"]}.
            Format: "[Market segment/trend] drives [specific change/action] in [product/service area], leading to [impact/opportunity]"
            Example: "Rising athleisure demand drives 40% growth in premium sports apparel, leading to new DTC brand launches"

            Company Context:
            Industry: {company_context["industry"]}
            Core Products: {", ".join(company_context["core_business"]["primary_products"])}
            Strategic Priorities: {", ".join(company_context["strategic_priorities"]["innovation"]["focus_areas"])}

            Market Details:
            Key Segments: {", ".join(market_data["segments"])}
            Price Ranges: {", ".join(market_data["price_ranges"])}
            Market Trends: {", ".join(market_data["trends"])}

            Each insight should be specific, actionable, and aligned with the company's strategic priorities.
            """

            response = self.query_engine.query(market_prompt)
            logger.debug(f"LLM Response for market insights: {response.response}")

            # Clean and format insights
            insights = [
                text.strip()
                for text in response.response.split("\n")
                if text.strip()
                and not text.strip().startswith(("1.", "2.", "3.", "-", "•"))
            ]

            # Ensure we have at least one insight
            if not insights:
                insights = [
                    f"{market_data['segments'][0]} segment shows growing demand for {company_context['core_business']['primary_products'][0]}, aligning with {company_context['strategic_priorities']['innovation']['focus_areas'][0]}"
                ]

            source_urls = list(
                set(
                    entry.get("site_url", "")
                    for entry in citation_data
                    if entry.get("site_url")
                )
            )[:2]
            if not source_urls:
                source_urls = ["market analysis"]

            return [
                {
                    "insight": insight,
                    "source_urls": source_urls,
                    "details": {
                        "key_segments": market_data["segments"],
                        "price_ranges": market_data["price_ranges"],
                    },
                }
                for insight in insights
                if len(insight) > 20 and len(insight) < 150  # Ensure concise length
            ][:3]

        except Exception as e:
            logger.error(f"Error generating market insights: {str(e)}")
            return [
                {
                    "insight": f"Market analysis indicates opportunities for {company_context['name']} in core segments",
                    "source_urls": ["market analysis"],
                    "details": {
                        "key_segments": company_context["core_business"][
                            "target_segments"
                        ][:2],
                        "price_ranges": ["$0-$100"],
                    },
                }
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
