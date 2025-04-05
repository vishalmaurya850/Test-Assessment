from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import numpy as np
import faiss
import json
import google.generativeai as genai
import re
import logging
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/recommend": {"origins": "https://shlassessment.vercel.app"}})
logging.basicConfig(level=logging.INFO)

# Load minimal data at startup
with open("shl_assessments_enriched.json", "r") as f:
    assessments = json.load(f)
embeddings = np.load("shl_embeddings_enriched.npy")
index = faiss.read_index("shl_faiss_index_enriched.index")

# Defer heavy model loading to first request
embedder = None
def get_embedder():
    global embedder
    if embedder is None:
        from sentence_transformers import SentenceTransformer
        embedder = SentenceTransformer("all-MiniLM-L6-v2", device="cpu")
    return embedder

# Configure Gemini API
api_key=os.getenv('GEMINI_API_KEY')  # Replace with your key
genai.configure(api_key=api_key)  # Adjust if needed
model = genai.GenerativeModel("models/gemini-2.0-flash-thinking-exp-1219") # Adjust if needed


def retrieve_assessments(query, k=20):
    query_embedding = embedder.encode([query])
    distances, indices = index.search(query_embedding, k)
    return [assessments[i] for i in indices[0]]

def rank_with_gemini(query, retrieved_assessments):
    try:
        prompt = f"""
        You are an expert in talent assessment. Given the query: "{query}",
        rank these assessments from most to least relevant based on their attributes (description, test type, job levels, duration, languages).
        Provide a numbered list of assessment names followed by a concise explanation of why each is relevant to the query. Avoid Markdown formatting (e.g., no ** or *); use plain text only.

        Assessments:
        {json.dumps(retrieved_assessments, indent=2)}
        """
        logging.debug(f"Sending prompt to Gemini (first 500 chars): {prompt[:500]}...")
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        logging.debug(f"Full Gemini Response: {response_text}")

        ranked_names = []
        explanations = []
        lines = response_text.split("\n")

        # Parse numbered list and clean names
        current_explanation = []
        for line in lines:
            line = line.strip()
            if not line:
                continue
            if line[0].isdigit():
                if current_explanation:  # Save previous explanation
                    explanations.append(" ".join(current_explanation))
                    current_explanation = []
                name = re.sub(r"^\d+\.\s*", "", line).strip()
                name = re.sub(r"\*\*|\*", "", name).strip()  # Remove Markdown markers
                ranked_names.append(name)
            else:
                # Clean explanation by removing Markdown prefixes
                cleaned_line = re.sub(r"^\s*[-*]\s*|\s*\*\*\s*Explanation:\s*", "", line).strip()
                if cleaned_line:
                    current_explanation.append(cleaned_line)

        # Add the last explanation
        if current_explanation:
            explanations.append(" ".join(current_explanation))

        logging.debug(f"Parsed Ranked Names (cleaned): {ranked_names}")
        logging.debug(f"Parsed Explanations (cleaned): {explanations}")

        ranked_assessments = []
        for name in ranked_names:
            for assessment in retrieved_assessments:
                if assessment["name"].lower() == name.lower():
                    ranked_assessments.append(assessment)
                    logging.debug(f"Matched '{name}' to '{assessment['name']}'")
                    break

        if not ranked_assessments:
            logging.warning("No ranked assessments matched, using initial assessments")
            ranked_assessments = retrieved_assessments[:10]
            explanations = [f"Ranked by similarity to '{query}' (Gemini ranking unavailable)"] * len(ranked_assessments)
        elif len(explanations) < len(ranked_assessments):
            explanations.extend([f"Ranked by Gemini for '{query}'"] * (len(ranked_assessments) - len(explanations)))

        return ranked_assessments[:10], explanations[:10]
    except Exception as e:
        logging.error(f"Gemini API error: {e}")
        return retrieved_assessments[:10], ["Fallback: No ranking due to API error"] * min(10, len(retrieved_assessments))

@app.route("/recommend", methods=["POST"])
def recommend():
    if request.method == "OPTIONS":
        return "", 200  # Handle CORS preflight
    data = request.get_json()
    query = data.get("query", "")
    if not query:
        return jsonify({"error": "Query is required"}), 400

    initial_assessments = retrieve_assessments(query)
    logging.debug(f"Initial Assessments: {[a['name'] for a in initial_assessments]}")
    ranked_assessments, explanations = rank_with_gemini(query, initial_assessments)

    response = {
        "query": query,
        "recommendations": [
            {
                "name": a["name"],
                "test_type": a["test_type"],
                "duration": a["duration"],
                "url": a["url"],
                "description": a["description"],
                "job_levels": a["job_levels"],
                "languages": a["languages"],
                "explanation": explanations[i] if i < len(explanations) else "No explanation provided."
            }
            for i, a in enumerate(ranked_assessments)
        ]
    }
    logging.debug(f"Response JSON: {json.dumps(response, indent=2)}")
    return jsonify(response)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))  # Default to 5000 locally, use Render's PORT in production
    app.run(host="0.0.0.0", port=port, debug=True)
