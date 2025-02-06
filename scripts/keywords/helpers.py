import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(".env.local")


def get_supabase_client():
    return create_client(
        os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    )
