import numpy as np
from tqdm import tqdm
from models import AdAnalysis, AdMetric
from helpers import (
    get_ad_analyses_from_db,
    get_supabase_client,
)


def mock_ad_metric(ad_analysis: AdAnalysis):
    supabase_client = get_supabase_client()

    # Define combined category-location multipliers
    category_location_multipliers = {
        "emotion": {"top-center": 2.0, "middle-center": 1.8, "bottom-center": 1.5},
        "product": {"middle-center": 2.2, "top-center": 1.8, "middle-right": 1.6},
        "brand": {"top-left": 1.8, "top-right": 1.8, "top-center": 2.0},
        "person": {"middle-right": 2.5, "middle-left": 2.2, "middle-center": 2.0},
        "setting": {"top-center": 1.6, "middle-center": 1.8, "bottom-center": 1.4},
        "text": {"top-center": 1.6, "middle-center": 1.4, "bottom-center": 1.2},
        "call-to-action": {"bottom-center": 2.5, "top-left": 2.0, "bottom-right": 1.8},
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
            feature_multiplier = 0.3

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
    supabase_client.table("ad_metrics").upsert(dict_metric).execute()


def main():
    ad_analyses = get_ad_analyses_from_db()

    for ad_analysis in tqdm(ad_analyses, desc="Mocking ad metrics"):
        mock_ad_metric(ad_analysis)


if __name__ == "__main__":
    main()
