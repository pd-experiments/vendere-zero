from pydantic import UUID4, BaseModel, Field
from typing import List, Optional
from datetime import date, datetime


class Profile(BaseModel):
    name: str
    img: str


class WebResult(BaseModel):
    title: str
    url: str
    description: str
    profile: Profile


class WebResults(BaseModel):
    results: List[WebResult]


class BraveWebSearchResponse(BaseModel):
    web: WebResults


class Thumbnail(BaseModel):
    src: str


class Properties(BaseModel):
    url: str


class ImageResult(BaseModel):
    title: str
    url: str
    thumbnail: Thumbnail
    properties: Properties


class BraveImageSearchResponse(BaseModel):
    results: List[ImageResult]


class MarketSegment(BaseModel):
    name: str
    characteristics: List[str]
    pain_points: List[str]
    preferences: List[str]


class ProductFeature(BaseModel):
    name: str
    importance_score: float = Field(
        description="A score between 0 and 1 indicating the importance of the feature to the product"
    )
    mentioned_benefits: List[str]


class PricePoint(BaseModel):
    range_min: float
    range_max: float
    target_segment: str
    value_proposition: str


class MarketResearch(BaseModel):
    intent_summary: str = Field(
        description="This is a summary of the intent of the ad. It is a single sentence that captures the main idea of the ad. It should be extremely detailed and specific."
    )
    primary_intent: str
    secondary_intents: List[str]
    market_segments: List[MarketSegment]
    key_features: List[ProductFeature]
    price_points: List[PricePoint]
    buying_stage: str = Field(description="awareness, consideration, or purchase")
    seasonal_factors: Optional[List[str]]
    competitor_brands: List[str]
    keywords: List[str] = Field(description="Extracted relevant keywords for PPC")


class GPTStructuredMarketResearch(BaseModel):
    intent_summary: str
    target_audience: List[MarketSegment]
    pain_points: List[str]
    buying_stage: str
    key_features: List[ProductFeature]
    competitive_advantages: List[str]


class CombinedMarketResearch(MarketResearch):
    query: str
    url: str
    timestamp: datetime


class GoogleAd(BaseModel):
    advertisement_url: str
    advertiser_name: str | None
    advertiser_url: str | None
    image_url: str | None
    last_shown: date | None = None
    ad_description: str | None = None


class SearchQueries(BaseModel):
    queries: List[str]


class AdStructuredOutput(BaseModel):
    id: UUID4 = Field(default_factory=UUID4)
    image_url: str
    image_description: str
