import requests
from bs4 import BeautifulSoup
import json
import numpy as np
from sentence_transformers import SentenceTransformer
import faiss
import time
import re

# Step 1: Merge the two JSON files
def merge_assessments(file1="shl_assessments.json", file2="shl_prepackaged_assessments.json"):
    with open(file1, "r") as f1:
        individual_assessments = json.load(f1)
    with open(file2, "r") as f2:
        prepackaged_assessments = json.load(f2)
    
    # Merge both lists
    merged_assessments = individual_assessments + prepackaged_assessments
    print(f"Merged {len(individual_assessments)} individual and {len(prepackaged_assessments)} prepackaged assessments. Total: {len(merged_assessments)}")
    return merged_assessments

# Step 2: Enrich dataset by scraping linked pages
def enrich_assessments(assessments):
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    for i, assessment in enumerate(assessments):
        url = assessment["url"]
        print(f"Scraping {i+1}/{len(assessments)}: {url}")
        try:
            response = requests.get(url, headers=headers)
            if response.status_code != 200:
                print(f"Failed to fetch {url}: {response.status_code}")
                continue

            soup = BeautifulSoup(response.content, "html.parser")
            content = soup.find("div", class_="product-catalogue") or soup

            # Description
            desc_header = content.find("h4", text="Description")
            description = desc_header.find_next("p").text.strip() if desc_header and desc_header.find_next("p") else assessment["name"]

            # Job Levels
            job_levels_header = content.find("h4", text="Job levels")
            job_levels = job_levels_header.find_next("p").text.strip() if job_levels_header and job_levels_header.find_next("p") else "Unknown"

            # Languages
            languages_header = content.find("h4", text="Languages")
            languages = languages_header.find_next("p").text.strip() if languages_header and languages_header.find_next("p") else "Unknown"
            if languages == "Unknown":  # Fallback to Downloads section
                downloads_header = content.find("h4", text="Downloads")
                if downloads_header:
                    language_tags = downloads_header.find_next("ul", class_="product-catalogue__downloads").find_all("p", class_="product-catalogue__download-language")
                    languages = ", ".join(set(tag.text.strip() for tag in language_tags)) if language_tags else "Unknown"

            # Assessment Length (Duration)
            length_header = content.find("h4", text="Assessment length")
            if length_header:
                length_text = length_header.find_next("p").text.strip()
                duration_match = re.search(r"Approximate Completion Time in minutes\s*=\s*(\d+)", length_text, re.IGNORECASE)
                duration = f"{duration_match.group(1)} mins" if duration_match else "Unknown"
            else:
                duration = "Unknown"

            # Update assessment
            assessment["description"] = description
            assessment["job_levels"] = job_levels
            assessment["languages"] = languages
            assessment["duration"] = duration

            time.sleep(1)  # Be polite to the server
        except Exception as e:
            print(f"Error scraping {url}: {e}")
            assessment["description"] = assessment["name"]
            assessment["job_levels"] = "Unknown"
            assessment["languages"] = "Unknown"
            assessment["duration"] = "Unknown"
    
    # Save enriched dataset
    with open("shl_assessments_enriched.json", "w") as f:
        json.dump(assessments, f, indent=4)
    print("Enriched dataset saved to shl_assessments_enriched.json")
    return assessments

# Step 3: Generate embeddings
def generate_embeddings(assessments):
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    texts = [
        f"{a['name']} - Description: {a['description']} - Job Levels: {a['job_levels']} - "
        f"Languages: {a['languages']} - Duration: {a['duration']} - Test Type: {a['test_type']}"
        for a in assessments
    ]
    embeddings = embedder.encode(texts, show_progress_bar=True)
    print(f"Generated embeddings with shape: {embeddings.shape}")
    return embeddings

# Step 4: Build FAISS index
def build_faiss_index(embeddings):
    dimension = embeddings.shape[1]
    index = faiss.IndexFlatL2(dimension)
    index.add(embeddings)
    print(f"FAISS index built with {index.ntotal} vectors.")
    return index

# Step 5: Retrieval function
def retrieve_assessments(query, assessments, index, embedder, k=10):
    query_embedding = embedder.encode([query])
    distances, indices = index.search(query_embedding, k)
    return [assessments[i] for i in indices[0]]

# Main execution
if __name__ == "__main__":
    # Merge the datasets
    assessments = merge_assessments("shl_assessments.json", "shl_prepackaged_assessments.json")

    # Enrich with data from links
    enriched_assessments = enrich_assessments(assessments)

    # Generate embeddings
    embeddings = generate_embeddings(enriched_assessments)

    # Build FAISS index
    index = build_faiss_index(embeddings)

    # Save for reuse
    np.save("shl_embeddings_enriched.npy", embeddings)
    faiss.write_index(index, "shl_faiss_index_enriched.index")

    # Test retrieval
    embedder = SentenceTransformer("all-MiniLM-L6-v2")
    query = "I am hiring for Java developers who can also collaborate effectively with my business teams."
    top_assessments = retrieve_assessments(query, enriched_assessments, index, embedder, k=10)

    # Print results
    print("\nTop 10 Recommended Assessments:")
    for i, assessment in enumerate(top_assessments, 1):
        print(f"{i}. {assessment['name']} (Test Type: {assessment['test_type']}, Duration: {assessment['duration']}) - {assessment['url']}")