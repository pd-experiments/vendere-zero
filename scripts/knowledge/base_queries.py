from llama_index.core.storage import StorageContext
from llama_index.core import VectorStoreIndex, Document
from llama_index.vector_stores.supabase import SupabaseVectorStore
from supabase.client import Client, create_client, ClientOptions
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import json
import os
from typing import List

# from llama_index.llms.groq import Groq
from pathlib import Path
from dotenv import load_dotenv
from llama_index.core import PromptTemplate
# from llama_index.core.query_engine import CitationQueryEngine

app = FastAPI(title="Knowledge Base API")

env_path = Path(__file__).parents[2] / ".env.local"
load_dotenv(env_path)


class QueryRequest(BaseModel):
    query: str


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

        qa_template = PromptTemplate(
            """You are a specialized AI assistant focused on analyzing marketing and competitive data. 
            Your responses should be based solely on the provided database information about ads, market research, and competitor citations.
            
            Context information is below:
            ---------------------
            {context_str}
            ---------------------

            Using only this context, please answer the question: {query_str}
            
            Provide specific examples and references from the data when possible. If information isn't available in the context, acknowledge that limitation."""
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

    def query(self, query: str) -> dict:
        """
        Query the knowledge base and return the response with citations

        Args:
            query: The question to ask the knowledge base

        Returns:
            dict: Dictionary containing response text and source information
        """
        response = self.query_engine.query(query)

        sources = []
        for source_node in response.source_nodes:
            source = {
                "text": source_node.node.text,
                "score": float(
                    source_node.score
                ),
                "extra_info": source_node.node.extra_info,
            }
            sources.append(source)

        return {"response": str(response), "sources": sources}


# Create a global instance of KnowledgeBase
kb = None


@app.on_event("startup")
async def startup_event():
    """Initialize KnowledgeBase when the server starts"""
    global kb
    kb = KnowledgeBase()


@app.post("/query")
async def query_endpoint(request: QueryRequest):
    """
    Endpoint to query the knowledge base
    """
    if not kb:
        raise HTTPException(status_code=500, detail="Knowledge base not initialized")

    try:
        response = kb.query(request.query)
        return response 
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """
    Simple health check endpoint
    """
    return {"status": "healthy"}


def main():
    """Run the FastAPI server"""
    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
