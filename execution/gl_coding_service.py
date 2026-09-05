"""
Smart General Ledger (GL) Coding Service for Project AIR.
Automatically classifies construction procurement line items into standard
Chart of Accounts (COA) codes and financial categories.
"""
import re
from typing import Dict, Any, List

# Construction Standard Chart of Accounts (COA)
GL_CATEGORIES = {
    "5010-MAT": {
        "code": "5010-MAT",
        "name": "COGS - Direct Materials",
        "keywords": [
            "steel", "rebar", "deformed bar", "reinforcing", "cement", "portland",
            "opc", "sand", "gravel", "aggregate", "crushed stone", "brick", "block",
            "timber", "plywood", "lumber", "tile", "mortar", "plaster", "besi",
            "simen", "pasir", "batu", "kayu", "bata", "洋灰", "水泥", "钢筋", "螺纹钢", "碎石", "沙"
        ]
    },
    "5020-CONC": {
        "code": "5020-CONC",
        "name": "COGS - Concrete & Structural Mixes",
        "keywords": [
            "ready-mix", "readymix", "rmc", "concrete", "grade 30", "grade 40",
            "grade 25", "c30", "c40", "c25", "precast", "slump", "konkrit", "预拌混凝土", "混凝土"
        ]
    },
    "5040-EQP": {
        "code": "5040-EQP",
        "name": "Direct Job Cost - Equipment & Machinery",
        "keywords": [
            "excavator", "backhoe", "crane", "forklift", "boom lift", "scaffold",
            "scaffolding", "generator", "compressor", "roller", "compactor",
            "perancah", "jentera", "sewa mesin", "脚手架", "挖掘机", "起重机", "发电机"
        ]
    },
    "5050-FUEL": {
        "code": "5050-FUEL",
        "name": "Job Cost - Fuel & Site Utilities",
        "keywords": [
            "diesel", "petrol", "gasoline", "fuel", "lubricant", "engine oil",
            "generator fuel", "minyak diesel", "柴油", "汽油", "润滑油"
        ]
    },
    "6030-SAFE": {
        "code": "6030-SAFE",
        "name": "Operating Expenses - Safety & PPE",
        "keywords": [
            "hardhat", "hard hat", "helmet", "safety vest", "high-vis", "boots",
            "safety boots", "gloves", "earplugs", "goggles", "safety harness",
            "first aid", "fire extinguisher", "topi keselamatan", "kasut keselamatan",
            "jaket keselamatan", "sarung tangan", "安全帽", "反光衣", "安全鞋", "劳保手套"
        ]
    },
    "6040-SUBCON": {
        "code": "6040-SUBCON",
        "name": "Subcontractor Progress Claims & Labor",
        "keywords": [
            "subcontractor", "sub-con", "labor", "labour", "installation", "formwork",
            "tiling work", "plumbing subcontractor", "electrical subcontract",
            "upah", "buruh", "subkontraktor", "分包工程", "人工费", "劳务"
        ]
    },
    "5090-GEN": {
        "code": "5090-GEN",
        "name": "Direct Job Cost - General Site Consumables",
        "keywords": [
            "nail", "screw", "bolt", "nut", "wire", "tie wire", "tape", "polyfilm",
            "pvc pipe", "canvas", "tarpaulin", "paku", "dawai", "paip", "五金", "铁丝", "塑料薄膜"
        ]
    }
}

def predict_gl_code(description: str) -> Dict[str, Any]:
    """
    Predicts standard GL Code and category name from item description.
    Returns:
        {
            "gl_code": "5010-MAT",
            "gl_category": "COGS - Direct Materials",
            "confidence": 0.95,
            "matched_keyword": "cement"
        }
    """
    if not description:
        return {
            "gl_code": "5010-MAT",
            "gl_category": "COGS - Direct Materials",
            "confidence": 0.50,
            "matched_keyword": "default"
        }

    desc_lower = description.lower()
    
    # Priority check: Safety equipment first (e.g. hardhat, boots shouldn't be tagged as material)
    # Check each category with word boundary or substring match
    best_category = None
    best_score = 0.0
    matched_term = ""

    # Check categories in order of specificity
    category_order = ["6030-SAFE", "5050-FUEL", "5040-EQP", "6040-SUBCON", "5020-CONC", "5010-MAT", "5090-GEN"]
    
    for cat_key in category_order:
        cat_info = GL_CATEGORIES[cat_key]
        for kw in cat_info["keywords"]:
            # Check if keyword exists in text
            if kw in desc_lower:
                score = len(kw) / max(len(desc_lower), 1)
                # Boost specific exact token matches
                pattern = r"\b" + re.escape(kw) + r"\b"
                if re.search(pattern, desc_lower) or any(c in kw for c in "洋灰水泥钢筋螺纹钢碎石沙安全帽柴油混凝土"):
                    score += 1.0
                
                if score > best_score:
                    best_score = score
                    best_category = cat_info
                    matched_term = kw

    if best_category:
        return {
            "gl_code": best_category["code"],
            "gl_category": best_category["name"],
            "confidence": min(0.98, 0.70 + (best_score * 0.2)),
            "matched_keyword": matched_term
        }

    # Default fallback to Direct Materials
    return {
        "gl_code": "5010-MAT",
        "gl_category": "COGS - Direct Materials",
        "confidence": 0.70,
        "matched_keyword": "default_fallback"
    }

def enrich_line_items_with_gl(line_items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Enriches a list of line items with predicted GL codes."""
    for item in line_items:
        desc = item.get("description", "")
        if not item.get("gl_code") or item.get("gl_code") == "5010-MAT":
            gl_pred = predict_gl_code(desc)
            item["gl_code"] = gl_pred["gl_code"]
            item["gl_category"] = gl_pred["gl_category"]
    return line_items
