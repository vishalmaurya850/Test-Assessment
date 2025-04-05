from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import numpy as np
import faiss
import json
import google.generativeai as genai
import re
import logging
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/recommend": {"origins": "https://shlassessment.vercel.app"}})
logging.basicConfig(level=logging.INFO)

# Load minimal data at startup
try:
    with open("shl_assessments_enriched.json", "r") as f:
        assessments = json.load(f)
    logging.info("Loaded assessments data")
except Exception as e:
    logging.error(f"Failed to load assessments: {e}")
    raise

# Configure Gemini API
api_key=os.getenv('GEMINI_API_KEY')  # Replace with your key
genai.configure(api_key=api_key)  # Adjust if needed
model = genai.GenerativeModel("models/gemini-2.0-flash-thinking-exp-1219") # Adjust if needed

def retrieve_assessments(query, k=5):
    # Simple keyword-based fallback
    query_words = set(query.lower().split())
    scored_assessments = []
    for assessment in assessments:
        desc_words = set(assessment["description"].lower().split())
        score = len(query_words.intersection(desc_words))
        if score > 0:
            scored_assessments.append((score, assessment))
    # Sort by score (first element of tuple) in descending order
    scored_assessments.sort(key=lambda x: x[0], reverse=True)
    return [a[1] for a in scored_assessments[:k]]
    
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

@app.route("/recommend", methods=["POST", "OPTIONS"])
def recommend():
    if request.method == "OPTIONS":
        return "", 200
    data = request.get_json()
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"error": "Query is required"}), 400

    try:
        initial_assessments = retrieve_assessments(query)
        ranked_assessments, explanations = rank_with_gemini(query, initial_assessments)
    except Exception as e:
        logging.error(f"Processing failed: {e}")
        return jsonify({"error": "Internal server error"}), 500

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
                "explanation": explanations[i]
            }
            for i, a in enumerate(ranked_assessments)
        ]
    }
    return jsonify(response)

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy"}), 200

if __name__ == "__main__":
    port = int(os.getenv("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
