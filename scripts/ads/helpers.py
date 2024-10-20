import os
from typing import Any, Generator
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager

import supabase
from tqdm import tqdm

from models import (
    AdAnalysis,
    AdStructuredOutput,
    Feature,
    GoogleAd,
    SentimentAnalysis,
    VisualAttribute,
)


load_dotenv(".env.local")


def create_driver(headless: bool = True) -> WebDriver:
    chrome_options = Options()
    if headless:
        chrome_options.add_argument("--headless")
    driver = webdriver.Chrome(
        service=Service(ChromeDriverManager().install()), options=chrome_options
    )
    return driver


def get_supabase_client():
    return supabase.create_client(
        os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    )


def get_ad_data_from_db() -> list[GoogleAd]:
    supabase_client = get_supabase_client()
    offset, batch_size = 0, 1000
    ads: list[GoogleAd] = []
    while True:
        new_ads: list[GoogleAd] = [
            GoogleAd.model_validate(ad)
            for ad in supabase_client.table("google_image_ads")
            .select("*")
            .range(offset, offset + batch_size)
            .execute()
            .data
        ]
        ads.extend(new_ads)
        if len(new_ads) < batch_size:
            break
        offset += batch_size
    return ads


def get_ad_structured_outputs_from_db() -> list[AdStructuredOutput]:
    supabase_client = get_supabase_client()
    offset, batch_size = 0, 1000
    analyses: list[AdStructuredOutput] = []
    while True:
        new_analyses: list[AdStructuredOutput] = [
            AdStructuredOutput.model_validate(analysis)
            for analysis in supabase_client.table("ad_structured_output")
            .select("*")
            .range(offset, offset + batch_size)
            .execute()
            .data
        ]
        analyses.extend(new_analyses)
        if len(new_analyses) < batch_size:
            break
        offset += batch_size
    return analyses


def get_ad_analyses_from_db() -> list[AdAnalysis]:
    supabase_client = get_supabase_client()
    offset, batch_size = 0, 1000
    analyses: list[AdAnalysis] = []
    while True:
        raw_analyses: list[dict[str, Any]] = (
            supabase_client.table("ad_structured_output")
            .select(
                "id, image_description, image_url, features(id, ad_output_id, keyword, confidence_score, category, location, visual_attributes(id, feature_id, attribute, value)), sentiment_analysis(id, ad_output_id, tone, confidence)"
            )
            .range(offset, offset + batch_size)
            .execute()
            .data
        )
        new_analyses: list[AdAnalysis] = [
            AdAnalysis.model_validate(analysis) for analysis in raw_analyses
        ]
        analyses.extend(new_analyses)
        if len(new_analyses) < batch_size:
            break
        offset += batch_size
    return analyses
