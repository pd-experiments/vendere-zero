#!/usr/bin/env python3

from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
import uvicorn
import logging
from pathlib import Path
from dotenv import load_dotenv
from typing import List
import os

from base_queries import KnowledgeBase, QueryRequest
from market_view import (
    MarketResearchAnalyzer,
    MarketInsightRequest,
    MarketInsightResponse,
)
from variants import VariantGenerator, VariantInput, GeneratedVariant

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

env_path = Path(__file__).parents[2] / ".env.local"
load_dotenv(env_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for FastAPI"""
    global kb, market_analyzer, variant_generator

    logger.info("Initializing services...")
    kb = KnowledgeBase()
    market_analyzer = MarketResearchAnalyzer()
    variant_generator = VariantGenerator()
    logger.info("Services initialized successfully")

    yield

    # Clean up on shutdown
    kb = None
    market_analyzer = None
    variant_generator = None
    logger.info("Services shut down")


app = FastAPI(
    title="Knowledge API",
    description="Combined API for knowledge base, market research, and variant generation",
    lifespan=lifespan,
)

# Global instances
kb = None
market_analyzer = None
variant_generator = None


# Knowledge Base Routes
@app.post("/knowledge/query")
async def query_endpoint(request: QueryRequest):
    """Knowledge base query endpoint"""
    if not kb:
        raise HTTPException(status_code=500, detail="Knowledge base not initialized")
    try:
        response = await kb.query(
            query=request.query,
            deep_research=request.deep_research,
            detail_level=request.detail_level,
        )
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


# Health Check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    services_status = {
        "knowledge_base": kb is not None,
        "market_analyzer": market_analyzer is not None,
        "variant_generator": variant_generator is not None,
    }

    if all(services_status.values()):
        return {"status": "healthy", "services": services_status}
    else:
        return {"status": "degraded", "services": services_status}


def main():
    """Run the FastAPI server"""
    port = int(os.getenv("PORT", "8000"))  # Heroku sets PORT environment variable
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
