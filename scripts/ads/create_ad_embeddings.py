from models import AdStructuredOutput
from helpers import get_supabase_client
from openai import OpenAI
import os
from dotenv import load_dotenv
from tqdm import tqdm
import multiprocessing as mp

load_dotenv("../../.env.local")

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))


def create_embedding(ad_structured_output: AdStructuredOutput | None):
    if ad_structured_output is None:
        return

    try:
        embedding: list[float] = (
            client.embeddings.create(
                input=ad_structured_output.image_description,
                model="text-embedding-3-small",
            )
            .data[0]
            .embedding
        )
        ad_structured_output.description_embeddings = embedding
    finally:
        return ad_structured_output


def push_to_supabase(ad_structured_output: AdStructuredOutput | None):
    if ad_structured_output is None:
        return

    if ad_structured_output.description_embeddings is None:
        print("No embedding found for ad", ad_structured_output.id)

    supabase_client = get_supabase_client()

    supabase_client.table("ad_structured_output").upsert(
        ad_structured_output.model_dump(mode="json")
    ).execute()


if __name__ == "__main__":
    supabase_client = get_supabase_client()
    raw_ad_data = (
        supabase_client.table("ad_structured_output").select("*").execute().data
    )
    ads: list[AdStructuredOutput] = list(
        map(lambda ad: AdStructuredOutput.model_validate(ad), raw_ad_data)
    )

    with tqdm(total=len(ads), desc="Creating embeddings") as pbar:

        def update_pbar(ad: AdStructuredOutput | None):
            push_to_supabase(ad)
            pbar.update(1)

        with mp.Pool(4) as pool:
            for ad in ads:
                pool.apply_async(create_embedding, args=(ad,), callback=update_pbar)
            pool.close()
            pool.join()
