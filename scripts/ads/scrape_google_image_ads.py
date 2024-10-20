from tqdm import tqdm
from datetime import datetime
import json
import os
import time
from typing import Any
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from webdriver_manager.chrome import ChromeDriverManager
import re
from urllib.parse import urlparse
import traceback
import multiprocessing as mp

import supabase

from models import GoogleAd
from helpers import get_supabase_client, create_driver, get_ad_data_from_db

# Load environment variables
load_dotenv(".env.local")


def scrape_ad_links(url: str, limit: int = 1000, headless: bool = True):
    # Open the website

    driver = create_driver(headless=headless)
    supabase_client = get_supabase_client()

    driver.get(url)
    all_links: list[str] = []

    driver.get(url)
    WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.TAG_NAME, "creative-preview"))
    )

    while len(all_links) < limit:
        try:
            all_links = list(
                map(
                    lambda card: {
                        "advertisement_url": card.find_element(
                            By.TAG_NAME, "a"
                        ).get_attribute("href")
                    },
                    driver.find_elements(By.TAG_NAME, "creative-preview"),
                )
            )

            batch_size = 500
            for i in range(0, len(all_links), batch_size):
                batch = all_links[i : i + batch_size]
                supabase_client.table("google_image_ads").upsert(batch).execute()

            print("Upserted", len(all_links), "links")

            driver.execute_script(
                "window.scrollBy(0, document.body.scrollHeight);"
                "window.scrollBy(0, -100);"
            )
        except Exception as e:
            print("Error getting ad links:", e)
            break


def wait_for_image_ad_to_render(driver: WebDriver) -> str | None:
    try:
        for i in range(2):
            driver.switch_to.frame(driver.find_element(By.TAG_NAME, "iframe"))

        image_element = driver.find_element(By.ID, "marketing-image")
        image_url = image_element.get_attribute("src")
        driver.switch_to.default_content()
        return image_url
    except:
        # print("Error waiting for image ad to render:", e)
        driver.switch_to.default_content()
        return None


def parse_ad_data(ad: GoogleAd, driver: WebDriver) -> GoogleAd | None:
    ad_data: GoogleAd = ad
    for _ in range(3):
        try:
            driver.get(ad.advertisement_url)
            WebDriverWait(driver, 10).until(
                EC.presence_of_element_located(
                    (By.CLASS_NAME, "advertiser-header-link")
                )
            )

            ad_data: GoogleAd = ad

            advertiser_name_element = driver.find_element(
                By.CLASS_NAME, "advertiser-header-link"
            )

            ad_data.advertiser_name = advertiser_name_element.text.strip()
            ad_data.advertiser_url = advertiser_name_element.get_attribute("href")

            last_shown_element = driver.find_element(
                By.XPATH, "//*[contains(@class, 'region-last-shown')]"
            )
            ad_data.last_shown = datetime.strptime(
                last_shown_element.text.split(":")[1].strip(), "%b %d, %Y"
            ).date()

            # for _ in range(2):

            #     WebDriverWait(driver, 10).until(
            #         EC.presence_of_element_located((By.TAG_NAME, "iframe"))
            #     )
            #     driver.switch_to.frame(driver.find_element(By.TAG_NAME, "iframe"))

            # WebDriverWait(driver, 10).until(
            #     EC.presence_of_element_located((By.ID, "marketing-image"))
            # )

            WebDriverWait(driver, 3).until(wait_for_image_ad_to_render)

            ad_data.image_url = wait_for_image_ad_to_render(driver)

            if ad_data.image_url:
                return ad_data
        except:
            # print("Error parsing ad data:", e)
            continue

    return ad_data


SCRAPE_LINKS = False

if __name__ == "__main__":
    if SCRAPE_LINKS:
        scrape_ad_links(
            url="https://adstransparency.google.com/advertiser/AR16735076323512287233?region=US&authuser=1&format=IMAGE",
            limit=1000,
            headless=False,
        )
    else:

        driver = create_driver(headless=False)
        supabase_client = get_supabase_client()
        ads = get_ad_data_from_db()

        total_ads = len(ads)
        success_pbar = tqdm(total=total_ads, desc="Successful", position=0)
        fail_pbar = tqdm(total=total_ads, desc="Failed", position=1)

        for ad in tqdm(ads, desc="Parsing ads", position=2):
            parsed_ad = parse_ad_data(ad, driver)
            if parsed_ad and parsed_ad.image_url:
                supabase_client.table("google_image_ads").upsert(
                    parsed_ad.model_dump(mode="json")
                ).execute()
                success_pbar.update(1)
            else:
                fail_pbar.update(1)

        success_pbar.close()
        fail_pbar.close()
