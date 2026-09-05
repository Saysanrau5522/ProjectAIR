"""
Multilingual Standardization Service for Project AIR.
Detects, translates, and normalizes mixed English, Bahasa Melayu (BM),
and Chinese (ZH) construction dockets into standard uniform English JSON payloads.
"""
import re
from typing import Dict, Any, List, Tuple

# Comprehensive Construction Translation Lexicon
BM_TO_EN = [
    # Materials & Engineering
    (r"\bsimen\s+portland\b", "portland cement"),
    (r"\bsimen\b", "cement"),
    (r"\bsemen\b", "cement"),
    (r"\bbesi\s+tetulang\b", "reinforcing steel rebar"),
    (r"\bbesi\s+y\b", "high-tensile deformed rebar"),
    (r"\btetulang\s+keluli\b", "reinforcing steel bar"),
    (r"\brod\s+keluli\b", "steel rebar rod"),
    (r"\bbatu\s+baur\s+kasar\b", "coarse aggregate"),
    (r"\bbatu\s+baur\b", "aggregate"),
    (r"\bbatu\s+kerikil\b", "crushed gravel aggregate"),
    (r"\bbatu\s+pecah\b", "crushed stone"),
    (r"\bpasir\s+sungai\b", "river sand"),
    (r"\bpasir\s+kasar\b", "coarse sand"),
    (r"\bpasir\s+halus\b", "fine plastering sand"),
    (r"\bkonkrit\s+siap\s+bancuh\b", "ready-mix concrete"),
    (r"\bkonkrit\b", "concrete"),
    (r"\bbata\s+merah\b", "red clay bricks"),
    (r"\bbata\s+pasir\b", "cement sand bricks"),
    (r"\bkayu\s+lapis\b", "plywood"),
    (r"\bperancah\s+keluli\b", "steel scaffolding"),
    (r"\bperancah\b", "scaffolding"),
    # Safety & PPE
    (r"\btopi\s+keselamatan\b", "safety hardhat helmet"),
    (r"\btopi\s+keras\b", "hard hat"),
    (r"\bkasut\s+keselamatan\b", "safety boots"),
    (r"\bjaket\s+keselamatan\b", "high-visibility safety vest"),
    (r"\bsarung\s+tangan\s+keselamatan\b", "safety gloves"),
    # Fuel & Consumables
    (r"\bminyak\s+diesel\b", "industrial diesel fuel"),
    (r"\bdiesel\b", "diesel fuel"),
    (r"\bdawai\s+ikat\b", "tie wire"),
    (r"\bpaku\b", "nails"),
    # Document Terms & UOM
    (r"\bsurat\s+hantaran\b", "delivery order"),
    (r"\bnota\s+hantaran\b", "delivery docket"),
    (r"\binvois\b", "invoice"),
    (r"\bguni\b", "bags"),
    (r"\bbeg\b", "bags"),
    (r"\btan\s+metrik\b", "metric tons"),
    (r"\btan\b", "tons"),
    (r"\bela\s+padu\b", "cu yd"),
    (r"\bmeter\s+padu\b", "cu m"),
    (r"\btapak\s+projek\b", "project site"),
]

ZH_TO_EN = [
    # Materials
    ("波特兰水泥", "portland cement"),
    ("普通硅酸盐水泥", "ordinary portland cement"),
    ("洋灰", "portland cement"),
    ("水泥", "cement"),
    ("高强度螺纹钢", "high-tensile deformed rebar"),
    ("螺纹钢", "reinforcing steel rebar"),
    ("变形钢筋", "deformed steel rebar"),
    ("钢筋", "reinforcing steel rebar"),
    ("圆钢", "round steel bar"),
    ("粗骨料", "coarse aggregate"),
    ("碎石", "crushed stone aggregate"),
    ("石子", "crushed gravel"),
    ("河沙", "river sand"),
    ("水洗砂", "washed sand"),
    ("中砂", "medium sand"),
    ("细砂", "fine sand"),
    ("沙", "sand"),
    ("预拌混凝土", "ready-mix concrete"),
    ("商品混凝土", "commercial concrete"),
    ("混凝土", "concrete"),
    ("红砖", "red clay bricks"),
    ("水泥砖", "cement bricks"),
    ("夹板", "plywood"),
    ("胶合板", "plywood"),
    ("钢管脚手架", "steel tube scaffolding"),
    ("脚手架", "scaffolding"),
    # Safety
    ("施工安全帽", "construction safety hardhat"),
    ("安全帽", "safety hardhat helmet"),
    ("反光背心", "high-visibility safety vest"),
    ("劳保鞋", "safety boots"),
    ("安全鞋", "safety boots"),
    ("防滑手套", "anti-slip safety gloves"),
    ("劳保手套", "safety gloves"),
    # Fuel & Misc
    ("工业柴油", "industrial diesel fuel"),
    ("柴油", "diesel fuel"),
    ("扎丝", "tie wire"),
    ("铁丝", "tie wire"),
    ("圆钉", "nails"),
    # Document Terms & UOM
    ("送货单", "delivery order"),
    ("发货单", "delivery docket"),
    ("签收单", "signed receipt"),
    ("发票", "invoice"),
    ("吨", "tons"),
    ("包", "bags"),
    ("袋", "bags"),
    ("立方米", "cu m"),
    ("立方", "cu m"),
    ("方", "cu m"),
    ("工程项目", "project site"),
]

def detect_languages(text: str) -> List[str]:
    """Detects languages present in text: 'ZH', 'MS', 'EN'."""
    langs = []
    # Check for Chinese Hanzi characters (\u4e00 - \u9fff)
    if re.search(r"[\u4e00-\u9fff]", text):
        langs.append("ZH")
        
    # Check for characteristic Malay terms
    ms_tokens = ["simen", "besi", "tetulang", "pasir", "batu", "konkrit", "topi", "kasut", "surat", "hantaran", "guni", "tan", "tapak"]
    lower = text.lower()
    if any(re.search(r"\b" + t + r"\b", lower) for t in ms_tokens):
        langs.append("MS")
        
    if not langs or re.search(r"[a-zA-Z]", text):
        langs.append("EN")
        
    return langs

def standardize_text(raw_text: str) -> Dict[str, Any]:
    """
    Translates and normalizes multilingual construction terms into uniform English.
    Returns:
        {
            "original": str,
            "standardized": str,
            "detected_languages": list of str,
            "replacements": list of (source, target)
        }
    """
    if not raw_text:
        return {
            "original": "",
            "standardized": "",
            "detected_languages": ["EN"],
            "replacements": []
        }

    langs = detect_languages(raw_text)
    standardized = raw_text
    replacements = []

    # 1. Apply Chinese phrase replacements
    for zh_phrase, en_trans in ZH_TO_EN:
        if zh_phrase in standardized:
            standardized = standardized.replace(zh_phrase, f" {en_trans} ")
            replacements.append((zh_phrase, en_trans))

    # 2. Apply Bahasa Melayu regex replacements
    for pattern, en_trans in BM_TO_EN:
        matches = re.findall(pattern, standardized, flags=re.IGNORECASE)
        if matches:
            standardized = re.sub(pattern, f" {en_trans} ", standardized, flags=re.IGNORECASE)
            replacements.append((pattern, en_trans))

    # Clean whitespace
    clean_standardized = re.sub(r"\s+", " ", standardized).strip()

    return {
        "original": raw_text,
        "standardized": clean_standardized,
        "detected_languages": langs,
        "replacements": replacements
    }

def standardize_line_item(item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Standardizes line item description and unit into uniform English.
    Preserves original text for audit compliance.
    """
    desc = item.get("description", "")
    unit = item.get("unit", "")
    
    desc_std = standardize_text(desc)
    unit_std = standardize_text(unit)
    
    updated = dict(item)
    updated["original_description"] = desc
    updated["description"] = desc_std["standardized"]
    updated["detected_languages"] = desc_std["detected_languages"]
    if unit:
        updated["original_unit"] = unit
        updated["unit"] = unit_std["standardized"].title() if unit_std["standardized"] else unit
        
    return updated
