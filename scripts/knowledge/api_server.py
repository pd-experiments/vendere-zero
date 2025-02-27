#!/usr/bin/env python3

from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
import uvicorn
import logging
from pathlib import Path
from dotenv import load_dotenv
from typing import List, Optional, Dict
import os

# Change relative imports to absolute imports
from scripts.knowledge.base_queries import KnowledgeBase, QueryRequest
from scripts.knowledge.market_view import (
    MarketResearchAnalyzer,
    MarketInsightRequest,
    MarketInsightResponse,
)
from scripts.knowledge.variants import VariantGenerator, VariantInput, GeneratedVariant

# Import KeywordVariantGenerator and related models
from scripts.knowledge.keyword_variants import (
    KeywordVariantGenerator,
    AdFeatures,
    KeywordVariant,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

env_path = Path(__file__).parents[2] / ".env.local"
load_dotenv(env_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI"""
    global kb, market_analyzer, variant_generator, keyword_generator

    logger.info("Initializing services...")
    kb = KnowledgeBase()
    market_analyzer = MarketResearchAnalyzer()
    variant_generator = VariantGenerator()
    keyword_generator = KeywordVariantGenerator()
    logger.info("Services initialized successfully")

    yield

    # Clean up on shutdown
    kb = None  # type: ignore
    market_analyzer = None  # type: ignore
    variant_generator = None  # type: ignore
    keyword_generator = None  # type: ignore
    logger.info("Services shut down")


app = FastAPI(
    title="Knowledge API",
    description="Combined API for knowledge base, market research, and variant generation",
    lifespan=lifespan,
)

# Global instances
kb: Optional[KnowledgeBase] = None
market_analyzer: Optional[MarketResearchAnalyzer] = None
variant_generator: Optional[VariantGenerator] = None
keyword_generator: Optional[KeywordVariantGenerator] = None


# Knowledge Base Routes
@app.post("/knowledge/query")
async def query_endpoint(request: QueryRequest):
    """Knowledge base query endpoint"""
    if not kb:
        raise HTTPException(status_code=500, detail="Knowledge base not initialized")
    try:
        response = await kb.query(request.query, request.deep_research)
        return response
    except Exception as e:
        logger.error(f"Error in query endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Market Research Routes
@app.post("/market/insight", response_model=MarketInsightResponse)
async def generate_market_insight_endpoint(request: MarketInsightRequest):
    """Generate market insight endpoint"""
    try:
        if not market_analyzer:
            raise HTTPException(
                status_code=500, detail="Market analyzer not initialized"
            )

        logger.info(f"Received market insight request for user {request.user_id}")
        insight = await market_analyzer.generate_market_insight(
            user_id=request.user_id, filters=request.filters
        )
        logger.info(f"Successfully generated market insight for user {request.user_id}")
        return insight
    except Exception as e:
        logger.error(f"Error in generate_market_insight_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Variant Generation Routes
@app.post("/variants/generate", response_model=List[GeneratedVariant])
async def generate_variants_endpoint(input_data: VariantInput):
    """Generate variants endpoint"""
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


# Keyword Variant Generation Routes
@app.post("/keywords/generate", response_model=List[KeywordVariant])
async def generate_keyword_variants_endpoint(
    ad_features: AdFeatures, user_id: Optional[str] = None
):
    """Generate keyword variants for ad features endpoint"""
    try:
        if not keyword_generator:
            raise HTTPException(
                status_code=500, detail="Keyword generator not initialized"
            )

        logger.info(
            f"Received keyword variant generation request for {ad_features.product_category}"
        )
        variants = await keyword_generator.generate_keyword_variants(ad_features)

        # Filter to only include generated keywords if needed
        generated_variants = [kw for kw in variants if kw.source == "generated"]

        # Save variants to database if user_id is provided
        if user_id:
            await keyword_generator.save_to_database(variants, user_id)
            logger.info(
                f"Saved {len(variants)} variants to database for user {user_id}"
            )

        logger.info(f"Returning {len(generated_variants)} generated keyword variants")
        return generated_variants
    except Exception as e:
        logger.error(f"Error in generate_keyword_variants_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Export Keyword Variants Routes
@app.post("/keywords/export", response_model=dict)
async def export_keyword_variants_endpoint(
    ad_features: AdFeatures, user_id: Optional[str] = None
):
    """Export keyword variants to CSV and JSON"""
    try:
        if not keyword_generator:
            raise HTTPException(
                status_code=500, detail="Keyword generator not initialized"
            )

        logger.info(
            f"Received keyword export request for {ad_features.product_category}"
        )

        # Generate variants
        variants = await keyword_generator.generate_keyword_variants(ad_features)

        # Save variants to database if user_id is provided
        if user_id:
            await keyword_generator.save_to_database(variants, user_id)
            logger.info(
                f"Saved {len(variants)} variants to database for user {user_id}"
            )

        # Export to both formats
        csv_path = await keyword_generator.export_to_csv(variants, ad_features)
        json_path = await keyword_generator.export_to_json(variants, ad_features)

        # Create a response with file paths
        response = {
            "total_variants": len(variants),
            "generated_variants": len(
                [kw for kw in variants if kw.source == "generated"]
            ),
            "csv_export_path": csv_path,
            "json_export_path": json_path,
            "message": "Keyword variants successfully exported",
        }

        logger.info(f"Exported {len(variants)} keyword variants to CSV and JSON")
        return response
    except Exception as e:
        logger.error(f"Error in export_keyword_variants_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# New keyword management routes
@app.get("/keywords", response_model=List[Dict])
async def get_all_keywords_endpoint(user_id: Optional[str] = None):
    """Get all keywords with variant counts for a user"""
    try:
        if not keyword_generator:
            raise HTTPException(
                status_code=500, detail="Keyword generator not initialized"
            )

        if not user_id:
            raise HTTPException(status_code=400, detail="User ID is required")

        logger.info(f"Received request for all keywords for user {user_id}")
        keywords = await keyword_generator.get_all_keywords(user_id)
        logger.info(f"Returning {len(keywords)} keywords")
        return keywords
    except Exception as e:
        logger.error(f"Error in get_all_keywords_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/keywords/{keyword}/variants", response_model=List[Dict])
async def get_keyword_variants_endpoint(keyword: str, user_id: str):
    """Get all variants for a specific keyword"""
    try:
        if not keyword_generator:
            raise HTTPException(
                status_code=500, detail="Keyword generator not initialized"
            )

        logger.info(
            f"Received request for variants of keyword '{keyword}' for user {user_id}"
        )
        variants = await keyword_generator.get_variants_for_keyword(keyword, user_id)
        logger.info(f"Returning {len(variants)} variants for keyword '{keyword}'")
        return variants
    except Exception as e:
        logger.error(f"Error in get_keyword_variants_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/keywords/batch-generate", response_model=Dict)
async def batch_generate_variants_endpoint(request: dict):
    """Generate variants for multiple keywords"""
    try:
        if not keyword_generator:
            raise HTTPException(
                status_code=500, detail="Keyword generator not initialized"
            )

        # Extract data from request
        ad_features_dict = request.get("ad_features", {})
        keywords = request.get("keywords", [])
        user_id = request.get("user_id")

        if not keywords or not user_id:
            raise HTTPException(
                status_code=400, detail="Keywords and user_id are required"
            )

        logger.info(f"Received batch generation request for {len(keywords)} keywords")

        results = {
            "total_processed": len(keywords),
            "successful": 0,
            "failed": 0,
            "variants_generated": 0,
            "keywords": [],
        }

        for keyword in keywords:
            try:
                # Create ad features with the keyword
                ad_features = AdFeatures(**ad_features_dict)

                # Generate variants
                variants = await keyword_generator.generate_keyword_variants(
                    ad_features, keyword
                )

                # Save to database
                await keyword_generator.save_to_database(variants, user_id)

                results["successful"] += 1
                results["variants_generated"] += len(variants)
                results["keywords"].append(
                    {
                        "keyword": keyword,
                        "status": "success",
                        "variants_count": len(variants),
                    }
                )

            except Exception as e:
                logger.error(
                    f"Error generating variants for keyword '{keyword}': {str(e)}"
                )
                results["failed"] += 1
                results["keywords"].append(
                    {"keyword": keyword, "status": "failed", "error": str(e)}
                )

        logger.info(
            f"Batch generation completed: {results['successful']} successful, {results['failed']} failed"
        )
        return results
    except Exception as e:
        logger.error(f"Error in batch_generate_variants_endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# Health Check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    services_status = {
        "knowledge_base": kb is not None,
        "market_analyzer": market_analyzer is not None,
        "variant_generator": variant_generator is not None,
        "keyword_generator": keyword_generator is not None,
    }

    if all(services_status.values()):
        return {"status": "healthy", "services": services_status}
    else:
        return {"status": "degraded", "services": services_status}


# Test endpoint for debugging
@app.get("/test")
async def test_endpoint():
    """Simple test endpoint for debugging"""
    return {"message": "API server is running"}


def main():
    """Run the FastAPI server"""
    port = int(os.getenv("PORT", "8000"))  # Default to port 8000 if not specified
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
