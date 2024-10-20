import asyncio
from models import AdStructuredOutput, AdMetric
from helpers import (
    get_ad_analyses_from_db,
    get_ad_structured_outputs_from_db,
    get_supabase_client,
)
import numpy as np
from tqdm.asyncio import tqdm


async def mock_ad_metric(ad_analysis: AdStructuredOutput):
    supabase_client = get_supabase_client()

    # Generate impressions using Poisson distribution
    # Adjust the lambda parameter based on expected average impressions
    impressions = np.random.poisson(lam=1000)

    # Generate clicks using Binomial distribution
    # Adjust the p parameter based on expected click-through rate
    clicks = np.random.binomial(n=impressions, p=0.03)

    # Ensure clicks don't exceed impressions (just in case)
    clicks = min(clicks, impressions)

    metric = AdMetric(ad_id=ad_analysis.id, impressions=impressions, clicks=clicks)
    dict_metric = {
        k: v for k, v in metric.model_dump(mode="json").items() if v is not None
    }
    supabase_client.table("ad_metrics").upsert(dict_metric).execute()


async def main():
    ad_analyses = list(get_ad_analyses_from_db())
    print(len(ad_analyses), ad_analyses[0])
    # ad_analyses = get_ad_structured_outputs_from_db()
    # tasks = [mock_ad_metric(ad_analysis) for ad_analysis in ad_analyses]

    # with tqdm(total=len(tasks), desc="Mocking ad metrics") as pbar:
    #     for task in asyncio.as_completed(tasks):
    #         await task
    #         pbar.update(1)


if __name__ == "__main__":
    asyncio.run(main())
