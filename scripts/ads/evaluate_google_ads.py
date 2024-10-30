import requests
from models import GoogleAd
from tqdm import tqdm
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
)

from helpers import get_ad_data_from_db, get_supabase_client


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=4, max=10),
    retry=retry_if_exception_type(requests.RequestException),
    retry_error_callback=lambda retry_state: False,
)
def evaluate_ad(ad: GoogleAd):
    try:
        response = requests.post(
            "http://localhost:3000/api/evaluate",
            json={"imageUrl": ad.image_url, "saveToDatabase": True},
        )
        response.raise_for_status()
        return True
    except requests.RequestException as e:
        print(f"Error evaluating ad: {e}")
        raise  # Re-raise the exception to trigger a retry

def evaluate_ads(ads: list[GoogleAd]):
    total = len(ads)
    success_bar = tqdm(total=total, desc="Successful", position=0)
    fail_bar = tqdm(total=total, desc="Failed", position=1)
    skip_bar = tqdm(total=total, desc="Skipped", position=2)
    supabase_client = get_supabase_client()
    for ad in ads:
        if (
            ad.image_url is None
            or len(
                supabase_client.table("ad_structured_output")
                .select("*")
                .eq("image_url", ad.image_url)
                .execute()
                .data
            )
            > 0
        ):
            skip_bar.update(1)
        elif evaluate_ad(ad):
            success_bar.update(1)
        else:
            fail_bar.update(1)

    successful = success_bar.n
    failed = fail_bar.n
    skipped = skip_bar.n
    success_bar.close()
    fail_bar.close()
    skip_bar.close()
    print(
        f"Evaluation complete. Successful: {successful}, Failed: {failed}, Skipped: {skipped}"
    )
    return successful, failed


if __name__ == "__main__":
    ads = get_ad_data_from_db()
    evaluate_ads(ads)
