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


class Keyword(BaseModel):
    keyword: str = Field(
        description="The keyword that is being targeted. This is a single word or phrase that captures the main idea of the keyword."
    )
    intent_reflected: str = Field(
        description="The intent of the keyword. This is a single word or phrase that captures the main idea of the keyword."
    )
    likelihood_score: float = Field(
        description="A score between 0 and 1 indicating the likelihood of the keyword being used in a search query"
    )


class Keywords(BaseModel):
    keywords: List[Keyword]


class OriginalImageHeadline(BaseModel):
    headline_text: str = Field(description="The original headline.")
    headline_type: str = Field(description="The type of headline.")
    visual_context: str = Field(description="The visual context of the headline.")


class OriginalImageHeadlines(BaseModel):
    headlines: list[OriginalImageHeadline] = Field(
        description="A list of text (e.g. headlines)."
    )


class ImprovedHeadline(BaseModel):
    original: str = Field(description="The original headline.")
    improved: str = Field(description="The improved headline.")
    improvements: list[str] = Field(description="A list of text (e.g. improvements).")
    target_audience: list[str] = Field(
        description="A list of text (e.g. target audience)."
    )
    pain_point_addressed: list[str] = Field(
        description="A list of text (e.g. pain point addressed)."
    )
    expected_impact: list[str] = Field(
        description="A list of text (e.g. expected impact)."
    )


class ImprovedHeadlines(BaseModel):
    headlines: list[ImprovedHeadline] = Field(
        description="A list of text (e.g. improved headlines)."
    )
