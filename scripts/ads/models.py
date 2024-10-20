from pydantic import BaseModel, UUID4, Field
from datetime import date
from typing import List, Literal


class GoogleAd(BaseModel):
    advertisement_url: str
    advertiser_name: str | None
    advertiser_url: str | None
    image_url: str | None
    last_shown: date | None = None


class AdStructuredOutput(BaseModel):
    id: UUID4 = Field(default_factory=UUID4)
    image_url: str
    image_description: str


class SentimentAnalysis(BaseModel):
    id: UUID4 = Field(default_factory=UUID4)
    ad_output_id: UUID4
    tone: str
    confidence: float = Field(ge=0.0, le=1.0)


class VisualAttribute(BaseModel):
    id: UUID4 = Field(default_factory=UUID4)
    feature_id: UUID4
    attribute: str
    value: str


class Feature(BaseModel):
    id: UUID4 = Field(default_factory=UUID4)
    ad_output_id: UUID4
    keyword: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    category: str
    # Category (e.g., "emotion", "product", "brand", "person", "setting", "text", "call-to-action")
    location: Literal[
        "top-left",
        "top-center",
        "top-right",
        "middle-left",
        "middle-center",
        "middle-right",
        "bottom-left",
        "bottom-center",
        "bottom-right",
        "unknown",
    ]
    visual_attributes: List[VisualAttribute] | None = None


class AdAnalysis(BaseModel):
    id: UUID4 = Field(default_factory=UUID4)
    image_description: str
    features: List[Feature] | None = None
    sentiment: SentimentAnalysis | None = None


class AdMetric(BaseModel):
    ad_id: UUID4
    impressions: int = Field(0, ge=0)  # Non-negative integer
    clicks: int = Field(0, ge=0)  # Non-negative integer
    ctr: float | None = None
