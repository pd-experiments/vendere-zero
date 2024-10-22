import asyncio
import numpy as np
from tqdm import tqdm
from models import AdAnalysis, AdMetric
from helpers import (
    get_ad_analyses_from_db,
    get_supabase_client,
)


async def mock_ad_metric(ad_analysis: AdAnalysis):
    supabase_client = get_supabase_client()

    # Define combined category-location multipliers
    category_location_multipliers = {
        "emotion": {"top-center": 3.5, "middle-center": 3.0, "bottom-center": 2.5},
        "product": {"middle-center": 4.0, "top-center": 3.2, "middle-right": 2.8},
        "brand": {"top-left": 3.2, "top-right": 3.2, "top-center": 3.5},
        "person": {"middle-right": 4.5, "middle-left": 4.0, "middle-center": 3.5},
        "setting": {"top-center": 2.8, "middle-center": 3.2, "bottom-center": 2.5},
        "text": {"top-center": 2.8, "middle-center": 2.5, "bottom-center": 2.2},
        "call-to-action": {"bottom-center": 4.5, "top-left": 3.5, "bottom-right": 3.2},
    }

    # Calculate combined multiplier based on all features
    combined_multiplier = 1.0
    feature_count = 0

    for feature in ad_analysis.features:
        category = (
            feature.category
            if feature.category in category_location_multipliers
            else "text"
        )
        location = feature.location

        # Get the multiplier for the category-location combination
        if location in category_location_multipliers[category]:
            feature_multiplier = category_location_multipliers[category][location]
        else:
            # Default multiplier if the specific location is not defined for the category
            feature_multiplier = 0.2

        combined_multiplier *= feature_multiplier
        feature_count += 1

    # Apply root to normalize the combined multiplier
    if feature_count > 0:
        combined_multiplier = combined_multiplier ** (1 / feature_count)

    # Generate impressions using Poisson distribution
    base_impressions = 1000
    adjusted_impressions = base_impressions * combined_multiplier
    impressions = np.random.poisson(lam=adjusted_impressions)

    # Generate clicks using Binomial distribution with adjusted CTR
    base_ctr = 0.03
    adjusted_ctr = base_ctr * combined_multiplier
    clicks = np.random.binomial(n=impressions, p=adjusted_ctr)

    # Ensure clicks don't exceed impressions (just in case)
    clicks = min(clicks, impressions)

    metric = AdMetric(ad_id=ad_analysis.id, impressions=impressions, clicks=clicks)
    dict_metric = {
        k: v for k, v in metric.model_dump(mode="json").items() if v is not None
    }

    # Use asyncio.to_thread for the database operation
    await asyncio.to_thread(
        lambda: supabase_client.table("ad_metrics").upsert(dict_metric).execute()
    )


async def main():
    ad_analyses = await asyncio.to_thread(get_ad_analyses_from_db)

    tasks = [mock_ad_metric(ad_analysis) for ad_analysis in ad_analyses]

    for task in tqdm(
        asyncio.as_completed(tasks), total=len(tasks), desc="Mocking ad metrics"
    ):
        await task


if __name__ == "__main__":
    asyncio.run(main())
