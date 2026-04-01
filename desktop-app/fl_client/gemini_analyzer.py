"""
Gemini AI Analysis for Skin Cancer Predictions
Provides detailed explanations using Google's Generative AI API.

Environment Variable:
  GEMINI_API_KEY - Your Google Generative AI API key
"""

import json
import sys
import os
from typing import Dict, Any, Optional

try:
    import google.generativeai as genai
except ImportError:
    genai = None


# ── Constants ────────────────────────────────────────────────────────────────

CLASS_DESCRIPTIONS = {
    "akiec": {
        "name": "Actinic Keratosis",
        "description": "A precancerous lesion caused by sun damage. Appears as scaly, crusty patches on sun-exposed skin.",
        "risk": "Medium - Can develop into squamous cell carcinoma if untreated"
    },
    "bcc": {
        "name": "Basal Cell Carcinoma",
        "description": "The most common type of skin cancer. Usually appears as a pearly nodule or non-healing sore.",
        "risk": "High - Most common skin cancer but rarely metastasizes if treated early"
    },
    "bkl": {
        "name": "Benign Keratosis",
        "description": "Common, harmless skin growth. Brown, black, or tan wart-like spots that appear raised.",
        "risk": "Low - Non-cancerous but may be removed for cosmetic or comfort reasons"
    },
    "df": {
        "name": "Dermatofibroma",
        "description": "A benign firm bump, usually brown or reddish. Often found on legs and arms.",
        "risk": "Low - Non-cancerous - No treatment needed unless it becomes bothersome"
    },
    "mel": {
        "name": "Melanoma",
        "description": "The deadliest form of skin cancer. Originates in pigment-producing cells.",
        "risk": "High - Most dangerous skin cancer, requires immediate attention"
    },
    "nv": {
        "name": "Nevus (Mole)",
        "description": "Common skin growth made up of melanocytes (pigment cells). Usually brown, tan, or flesh-colored.",
        "risk": "Low - Most moles are harmless, but monitor for changes"
    },
    "vasc": {
        "name": "Vascular Lesion",
        "description": "A lesion composed primarily of blood vessels. Includes hemangiomas, telangiectasia, and cherry angiomas.",
        "risk": "Low - Usually benign, removal is typically for cosmetic reasons"
    }
}


# ── Gemini Analyzer ──────────────────────────────────────────────────────────

def get_gemini_analysis(
    predicted_class: str,
    confidence: float,
    all_probabilities: Dict[str, float],
    image_features: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Get detailed analysis from Gemini for a skin cancer prediction.
    
    Args:
        predicted_class: Short label (e.g., 'mel', 'bkl')
        confidence: Confidence score (0.0 to 1.0)
        all_probabilities: Dict of {short_label: probability}
        image_features: Optional dict with image characteristics
    
    Returns:
        Dict with analysis, recommendations, and warnings
    """
    
    api_key = os.getenv('GEMINI_API_KEY')
    
    # Fallback: Return structured response without API if key not available
    if not api_key or genai is None:
        return get_fallback_analysis(predicted_class, confidence, all_probabilities)
    
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-pro')
        
        # Build prompt
        class_info = CLASS_DESCRIPTIONS.get(predicted_class, {})
        confidence_pct = confidence * 100
        
        prompt = f"""
You are a dermatology AI assistant. Analyze this skin cancer prediction result:

PREDICTION RESULT:
- Predicted Condition: {class_info.get('name', predicted_class)} ({confidence_pct:.1f}% confidence)
- Model Classification: {predicted_class}
- All Model Probabilities:
  {json.dumps(all_probabilities, indent=2)}

YOUR TASK:
Provide a clear, structured analysis suitable for patient and doctor consultation.

RESPOND WITH THIS EXACT JSON FORMAT (no markdown, just raw JSON):
{{
  "diagnosis": "Clear one-sentence diagnosis statement",
  "explanation": "2-3 sentences explaining what this condition is and why it appears",
  "characteristics": ["visible characteristic 1", "visible characteristic 2", "characteristic 3"],
  "risk_level": "Low|Medium|High",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "next_steps": "Specific action to take (consult dermatologist, monitor, etc.)",
  "confidence_note": "Statement about the confidence level and model limitations",
  "disclaimer": "Important: This is an AI analysis, not a medical diagnosis. Always consult a qualified dermatologist."
}}

Be medically accurate, empathetic, and clear. Focus on actionable information.
"""
        
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        # Try to parse JSON from response
        try:
            analysis = json.loads(text)
        except json.JSONDecodeError:
            # If Gemini didn't return pure JSON, extract it
            import re
            json_match = re.search(r'\{.*\}', text, re.DOTALL)
            if json_match:
                analysis = json.loads(json_match.group())
            else:
                analysis = get_fallback_analysis(predicted_class, confidence, all_probabilities)
        
        return {
            "success": True,
            "source": "gemini",
            **analysis
        }
    
    except Exception as e:
        # Fallback on any error
        print(f"Gemini API error: {e}", file=sys.stderr)
        return get_fallback_analysis(predicted_class, confidence, all_probabilities)


def get_fallback_analysis(
    predicted_class: str,
    confidence: float,
    all_probabilities: Dict[str, float]
) -> Dict[str, Any]:
    """Fallback analysis without Gemini API."""
    
    class_info = CLASS_DESCRIPTIONS.get(predicted_class, {})
    confidence_pct = confidence * 100
    risk_level = class_info.get('risk', 'Unknown').split(' - ')[0].strip()
    
    # Determine if prediction is confident
    is_confident = confidence > 0.7
    confidence_note = (
        f"The model is {confidence_pct:.0f}% confident in this prediction, which is "
        f"{'quite reliable' if is_confident else 'relatively uncertain'}. "
        f"Please consult a dermatologist for confirmation."
    )
    
    return {
        "success": True,
        "source": "fallback",
        "diagnosis": f"{class_info.get('name', predicted_class)} detected ({confidence_pct:.1f}% confidence)",
        "explanation": class_info.get('description', 'Skin condition detected'),
        "characteristics": infer_characteristics(predicted_class),
        "risk_level": risk_level,
        "recommendations": get_recommendations(predicted_class),
        "next_steps": get_next_steps(predicted_class),
        "confidence_note": confidence_note,
        "disclaimer": "Important: This is an AI analysis, not a medical diagnosis. Always consult a qualified dermatologist."
    }


def infer_characteristics(predicted_class: str) -> list:
    """Infer visible characteristics based on condition."""
    
    characteristics_map = {
        "akiec": ["Scaly or crusty patches", "Red or brown discoloration", "Sun-exposed areas"],
        "bcc": ["Pearl-like appearance", "Waxy nodule", "May have central ulceration"],
        "bkl": ["Brown or black coloring", "Waxy or scaly surface", "Raised appearance"],
        "df": ["Firm, dome-shaped bump", "Brown to reddish color", "Fixed to skin"],
        "mel": ["Asymmetrical shape", "Color variation", "Irregular borders"],
        "nv": ["Uniform color", "Round or oval shape", "Flat or slightly raised"],
        "vasc": ["Red or purple color", "Blanches with pressure", "Vascular origin"]
    }
    
    return characteristics_map.get(predicted_class, ["Skin lesion detected"])


def get_recommendations(predicted_class: str) -> list:
    """Get recommendations based on condition."""
    
    recommendations_map = {
        "akiec": [
            "Apply high SPF sunscreen (50+) daily",
            "Avoid prolonged sun exposure",
            "Monitor for changes or new lesions"
        ],
        "bcc": [
            "Schedule appointment with dermatologist soon",
            "Avoid sun exposure to affected area",
            "Early treatment significantly improves outcomes"
        ],
        "bkl": [
            "No urgent medical intervention required",
            "Monitor for changes in appearance",
            "Removal available for cosmetic concerns"
        ],
        "df": [
            "No treatment needed unless bothersome",
            "Can be removed surgically or by other methods",
            "Monitor for enlargement or irritation"
        ],
        "mel": [
            "URGENT: Consult dermatologist immediately",
            "Avoid any manipulation or scratching",
            "Early detection and treatment are critical"
        ],
        "nv": [
            "Monitor for ABCDE changes (asymmetry, borders, color, diameter, evolution)",
            "Note baseline appearance with photos",
            "Annual skin check recommended"
        ],
        "vasc": [
            "Generally no treatment needed",
            "Can be treated for cosmetic reasons",
            "Monitor for growth or symptoms"
        ]
    }
    
    return recommendations_map.get(predicted_class, ["Consult a dermatologist for professional evaluation"])


def get_next_steps(predicted_class: str) -> str:
    """Get next steps based on condition."""
    
    steps_map = {
        "akiec": "Schedule a dermatology appointment within 1-2 weeks to discuss treatment options.",
        "bcc": "Schedule a dermatology appointment this week for biopsy and treatment planning.",
        "bkl": "No urgent action needed; can monitor or consult dermatologist if desired.",
        "df": "No action required unless concerned about appearance or symptoms.",
        "mel": "This requires immediate dermatology evaluation. Schedule an urgent appointment.",
        "nv": "Monitor regularly; schedule annual skin checks with a dermatologist.",
        "vasc": "Optional consultation with dermatologist if you want to explore treatment options."
    }
    
    return steps_map.get(predicted_class, "Consult with a qualified dermatologist.")


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Get Gemini AI analysis for skin predictions')
    parser.add_argument('--class', dest='predicted_class', required=True, help='Predicted class (e.g., mel, bkl)')
    parser.add_argument('--confidence', type=float, required=True, help='Confidence score (0.0-1.0)')
    parser.add_argument('--probs', type=json.loads, default='{}', help='All probabilities as JSON')
    
    args = parser.parse_args()
    
    result = get_gemini_analysis(
        predicted_class=args.predicted_class,
        confidence=args.confidence,
        all_probabilities=args.probs
    )
    
    print(json.dumps(result))
