import streamlit as st
import json
import os
import requests
import urllib.parse
from datetime import datetime
from dateutil import parser
import uuid

# --- Constants & Config ---
STORE_FILE = "phd_dossier_data.json"
STATUSES = [
    {"id": "researching", "label": "Researching"},
    {"id": "preparing", "label": "Preparing"},
    {"id": "submitted", "label": "Submitted"},
    {"id": "interview", "label": "Interview"},
    {"id": "admitted", "label": "Admitted"},
    {"id": "rejected", "label": "Rejected"},
]

st.set_page_config(page_title="PhD Dossier", page_icon="🎓", layout="wide")

# --- Helper Functions ---
def load_data():
    if os.path.exists(STORE_FILE):
        with open(STORE_FILE, "r") as f:
            return json.load(f)
    return []

def save_data():
    with open(STORE_FILE, "w") as f:
        json.dump(st.session_state.programs, f, indent=2)

def empty_program(uni, prog):
    return {
        "id": str(uuid.uuid4())[:8],
        "university": uni.strip(),
        "program": prog.strip(),
        "status": "researching",
        "deadline": "",
        "fee": "",
        "feeWaiver": "",
        "selection": "",
        "placements": "",
        "notes": "",
        "professors": [],
        "students": [],
        "sources": [],
        "lastResearched": None,
    }

def days_until(date_str):
    if not date_str or date_str == "—":
        return None
    try:
        dt = parser.parse(date_str, fuzzy=True)
        delta = (dt.date() - datetime.now().date()).days
        return delta
    except:
        return None

def host_of(url):
    try:
        return urllib.parse.urlparse(url).netloc.replace('www.', '')
    except:
        return url

# --- AI Research Function ---
def research_with_ai(university, program):
    api_key = os.environ.get("ANTHROPIC_API_KEY") or st.secrets.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("Anthropic API key not found in environment or secrets.")

    prompt = f"""Research the PhD program "{program}" at "{university}" using web search. Search the department site, faculty pages, graduate admissions pages, and public profiles.
Find:
1. 5-8 professors: name, research area, URL.
2. 3-6 current PhD students: name, URL.
3. Next application deadline (Month Day, Year).
4. Application fee and fee-waiver info.
5. Typical admitted-student profile/requirements.
6. Recent PhD placements.

Respond ONLY with minified JSON:
{{"professors":[{{"name":"","area":"","url":""}}],"students":[{{"name":"","url":""}}],"deadline":"","fee":"","feeWaiver":"","selection":"","placements":"","sources":["url1"]}}"""

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    payload = {
        "model": "claude-3-7-sonnet-20250219",
        "max_tokens": 1000,
        "messages": [{"role": "user", "content": prompt}],
        "tools": [{"type": "web_search_20250305", "name": "web_search"}] # Claude web search tool
    }

    response = requests.post("https://api.anthropic.com/v1/messages", headers=headers, json=payload)
    response.raise_for_status()
    
    data = response.json()
    text = "".join(block.get("text", "") for block in data.get("content", []) if block.get("type") == "text")
    
    clean_text = text.replace("```json", "").replace("```", "").strip()
    start, end = clean_text.find("{"), clean_text.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON found in AI response")
        
    return json.loads(clean_text[start:end+1])

# --- State Initialization ---
if "programs" not in st.session_state:
    st.session_state.programs = load_data()
if "active_id" not in st.session_state:
    st.session_state.active_id = st.session_state.programs[0]["id"] if st.session_state.programs else None

# --- UI Sidebar ---
with st.sidebar:
    st.markdown("### 🗂️ Add a Program")
    with st.form("add_form", clear_on_submit=True):
        new_uni = st.text_input("University", placeholder="e.g., Stanford")
        new_prog = st.text_input("Program", placeholder="e.g., CS PhD")
        if st.form_submit_button("Add to dossier") and new_uni and new_prog:
            new_p = empty_program(new_uni, new_prog)
            st.session_state.programs.insert(0, new_p)
            st.session_state.active_id = new_p["id"]
            save_data()
            st.rerun()

    st.divider()
    st.markdown("### 📂 Dossier Files")
    for p in st.session_state.programs:
        # Highlight active program
        btn_type = "primary" if p["id"] == st.session_state.active_id else "secondary"
        if st.button(f"{p['university']}\n\n*{p['program']}*", key=p["id"], type=btn_type, use_container_width=True):
            st.session_state.active_id = p["id"]
            st.rerun()

# --- Main App Body ---
active = next((p for p in st.session_state.programs if p["id"] == st.session_state.active_id), None)

st.title("🎓 PhD Dossier")
st.caption(f"APPLICATION SEASON 2026–27 • {len(st.session_state.programs)} PROGRAMS TRACKED")
st.divider()

if not active:
    st.info("### Your dossier is empty\nAdd a university and program on the left, then run AI research to pull faculty, students, deadlines, and placements from the web.")
else:
    # Header Area
    col1, col2, col3 = st.columns([2, 1, 1])
    
    with col1:
        st.header(active["university"])
        st.subheader(active["program"])
        
    with col2:
        # Status Dropdown
        current_idx = next((i for i, s in enumerate(STATUSES) if s["id"] == active["status"]), 0)
        new_status = st.selectbox("Status", options=[s["id"] for s in STATUSES], 
                                  format_func=lambda x: next(s["label"] for s in STATUSES if s["id"] == x), 
                                  index=current_idx, label_visibility="collapsed")
        if new_status != active["status"]:
            active["status"] = new_status
            save_data()

    with col3:
        btn_label = "Refresh AI Research" if active.get("lastResearched") else "Run AI Research"
        if st.button(btn_label, type="primary", use_container_width=True):
            try:
                with st.spinner("Researching the web... this takes about 15-20 seconds."):
                    res = research_with_ai(active["university"], active["program"])
                    active.update({
                        "professors": res.get("professors", active["professors"]),
                        "students": res.get("students", active["students"]),
                        "deadline": res.get("deadline", active["deadline"]),
                        "fee": res.get("fee", active["fee"]),
                        "feeWaiver": res.get("feeWaiver", active["feeWaiver"]),
                        "selection": res.get("selection", active["selection"]),
                        "placements": res.get("placements", active["placements"]),
                        "sources": res.get("sources", active["sources"]),
                        "lastResearched": datetime.now().strftime("%Y-%m-%d"),
                    })
                    save_data()
                    st.success("Research completed!")
                    st.rerun()
            except Exception as e:
                st.error(f"AI Research Failed: {str(e)}")
        
        if st.button("🗑️ Remove Program", use_container_width=True):
            st.session_state.programs = [p for p in st.session_state.programs if p["id"] != active["id"]]
            st.session_state.active_id = st.session_state.programs[0]["id"] if st.session_state.programs else None
            save_data()
            st.rerun()

    if active.get("lastResearched"):
        st.caption(f"Last AI research: {active['lastResearched']}")

    st.markdown("---")

    # Application Details
    c1, c2, c3 = st.columns(3)
    d_left = days_until(active.get("deadline"))
    d_label = f" ({d_left} days left)" if d_left is not None and d_left >= 0 else " (Passed)" if d_left is not None else ""
    
    active["deadline"] = c1.text_input(f"Deadline {d_label}", active.get("deadline", ""))
    active["fee"] = c2.text_input("Application Fee", active.get("fee", ""))
    active["feeWaiver"] = c3.text_input("Fee Waiver Criteria", active.get("feeWaiver", ""))

    # Editable Text Blocks
    active["selection"] = st.text_area("Past selection highlights / requirements", active.get("selection", ""), height=100)
    active["placements"] = st.text_area("Where graduates land (Placements)", active.get("placements", ""), height=100)
    active["notes"] = st.text_area("My Notes", active.get("notes", ""), height=150)

    # Faculty (Using Streamlit's awesome interactive data_editor grid)
    st.markdown("### Faculty")
    edited_professors = st.data_editor(
        active.get("professors", []),
        column_config={
            "name": st.column_config.TextColumn("Name", required=True),
            "area": st.column_config.TextColumn("Research Area"),
            "url": st.column_config.LinkColumn("Website URL")
        },
        num_rows="dynamic",
        use_container_width=True,
        key=f"prof_{active['id']}"
    )
    active["professors"] = edited_professors

    # Current Students
    st.markdown("### Current PhD Students")
    edited_students = st.data_editor(
        active.get("students", []),
        column_config={
            "name": st.column_config.TextColumn("Name", required=True),
            "url": st.column_config.LinkColumn("Website / LinkedIn URL")
        },
        num_rows="dynamic",
        use_container_width=True,
        key=f"stu_{active['id']}"
    )
    active["students"] = edited_students

    # Sources
    if active.get("sources"):
        st.markdown("### Sources")
        cols = st.columns(min(len(active["sources"]), 4))
        for i, src in enumerate(active["sources"]):
            cols[i % 4].markdown(f"🔗 [{host_of(src)}]({src})")

    # Save changes automatically at the bottom
    save_data()

st.markdown("---")
st.caption("AI research pulls from public web sources — department pages, Google Scholar, LinkedIn, X, and personal sites. Always confirm deadlines and fees on the official admissions page.")