import requests
from bs4 import BeautifulSoup
import json
import time

def scrape_shl_catalog():
    base_url = "https://www.shl.com/solutions/products/product-catalog/"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    assessments = []
    type_param = "1"  # For Individual Test Solutions
    items_per_page = 12
    max_start = 1200  # Last page from pagination (32 pages total, 0-based)

    for page_start in range(0, max_start + 1, items_per_page):
        # Construct URL for the current page
        url = f"{base_url}?start={page_start}&type={type_param}" if page_start > 0 else base_url
        print(f"Scraping page: {url}")
        response = requests.get(url, headers=headers)
        
        if response.status_code != 200:
            print(f"Failed to fetch page {url}: {response.status_code}")
            break

        # Parse HTML
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Find all tables and select the one for Individual Test Solutions
        tables = soup.find_all("table")
        target_table = None
        for table in tables:
            if "Individual Test Solutions" in table.find("th", class_="custom__table-heading__title").text:
                target_table = table
                break
        
        if not target_table:
            print("No Individual Test Solutions table found on this page.")
            break
        
        # Extract rows (skip header row)
        rows = target_table.find_all("tr")[1:]  # Skip <th> row
        if not rows:
            print("No more assessments found. Ending scrape.")
            break

        for row in rows:
            try:
                cols = row.find_all("td")
                if len(cols) != 4:  # Expect 4 columns
                    continue

                # Assessment Name and URL
                name_tag = cols[0].find("a")
                name = name_tag.text.strip() if name_tag else "Unknown"
                relative_url = name_tag["href"] if name_tag and "href" in name_tag.attrs else ""
                full_url = f"https://www.shl.com{relative_url}" if relative_url else ""

                # Remote Testing Support
                remote = "Yes" if cols[1].find("span", class_="catalogue__circle -yes") else "No"

                # Adaptive/IRT Support
                adaptive = "Yes" if cols[2].find("span", class_="catalogue__circle -yes") else "No"

                # Test Type (join all keys)
                test_type_tags = cols[3].find_all("span", class_="product-catalogue__key")
                test_type = ", ".join(tag.text.strip() for tag in test_type_tags) if test_type_tags else "Unknown"

                # Description (placeholder; fetch from linked page if needed)
                description = name

                # Duration (placeholder; fetch from linked page if needed)
                duration = "Unknown"

                assessment = {
                    "name": name,
                    "url": full_url,
                    "description": description,
                    "duration": duration,
                    "test_type": test_type,
                    "remote": remote,
                    "adaptive": adaptive
                }
                assessments.append(assessment)
            except Exception as e:
                print(f"Error parsing row: {e}")

        time.sleep(1)  # Be polite to the server

    # Save to JSON
    with open("shl_assessments.json", "w") as f:
        json.dump(assessments, f, indent=4)
    
    print(f"Scraped {len(assessments)} Individual Test Solutions.")
    return assessments

# Run the scraper
if __name__ == "__main__":
    assessments = scrape_shl_catalog()