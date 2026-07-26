import streamlit as st
import pandas as pd
import json
import os
from google import genai
from google.genai import types


def get_gemini_client(api_key=None):
    key = api_key or os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key:
        raise ValueError(
            "No Gemini API key was provided. Enter your API key in the sidebar or set GEMINI_API_KEY."
        )
    return genai.Client(api_key=key)


def search_and_extract_with_gemini(university, program, api_key=None):
    """
    Uses Gemini 1.5 Flash to search the web for the program details
    and strictly return the data in a JSON schema.
    """
    prompt = f"""
    Use Google Search to find information about the {program} PhD program at {university}.
    Extract the following details from the official department and admissions pages:
    1. The upcoming Application Deadline.
    2. The Application Fee amount.
    3. GRE and English language testing requirements.
    4. A brief list of key faculty members and their research areas.
    5. A brief list of current PhD students (and their website links if found).
    
    Format the output STRICTLY as a JSON object with exactly these keys: 
    "deadline", "fee", "requirements", "faculty", "students".
    """
    
    client = get_gemini_client(api_key=api_key)

    # Configure the API request to use Google Search as a tool and enforce JSON output
    response = client.models.generate_content(
        model='gemini-1.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            tools=[types.Tool(google_search=types.GoogleSearch())],
            response_mime_type="application/json",
            temperature=0.2
        )
    )
    
    # Parse the JSON string returned by Gemini
    try:
        return json.loads(response.text)
    except json.JSONDecodeError:
        return {
            "deadline": "Error parsing", 
            "fee": "Error parsing", 
            "requirements": "Error parsing", 
            "faculty": "Error parsing", 
            "students": "Error parsing"
        }

# --- Streamlit Frontend UI ---

st.set_page_config(page_title="PhD Tracker", page_icon="🎓", layout="wide")
st.title("🎓 Gemini-Powered PhD Application Tracker")
st.write("Enter your target programs. Gemini will search the web in real-time to gather deadlines, faculty, and requirements.")

# User Inputs
st.sidebar.header("Configuration")
api_key_input = st.sidebar.text_input(
    "Gemini API Key",
    type="password",
    help="Create one at https://ai.google.dev/gemini-api/docs/api-key",
)
if api_key_input:
    os.environ["GEMINI_API_KEY"] = api_key_input

col1, col2 = st.columns(2)
with col1:
    university_input = st.text_input("University (e.g., MIT)")
with col2:
    program_input = st.text_input("PhD Program (e.g., Electrical Engineering)")

# Initialize session state to store accumulated data
if "tracker_data" not in st.session_state:
    st.session_state.tracker_data = []

if st.button("Search & Extract Intelligence"):
    if not api_key_input:
        st.warning("Please enter a Gemini API key in the sidebar first.")
    elif university_input and program_input:
        with st.spinner(f"Gemini is searching the web for {university_input} - {program_input}..."):
            try:
                # Execute the grounded search and extraction
                extracted_json = search_and_extract_with_gemini(
                    university_input,
                    program_input,
                    api_key=api_key_input,
                )
            except Exception as exc:
                st.error(f"Gemini request failed: {exc}")
            else:
                # Add the new data to our session state list
                st.session_state.tracker_data.append({
                    "University": university_input,
                    "Program": program_input,
                    "Deadline": extracted_json.get('deadline', 'N/A'),
                    "Fee": extracted_json.get('fee', 'N/A'),
                    "Requirements": extracted_json.get('requirements', 'N/A'),
                    "Faculty": str(extracted_json.get('faculty', 'N/A')),
                    "Students": str(extracted_json.get('students', 'N/A'))
                })

                st.success(f"Data successfully extracted for {university_input}!")

    else:
        st.warning("Please provide both a University and a Program.")

# Display the accumulated data and provide the download option
if st.session_state.tracker_data:
    st.subheader("Your Compiled Application Tracker")
    
    # Convert session state list to a Pandas DataFrame
    df = pd.DataFrame(st.session_state.tracker_data)
    
    # Display the interactive table in the UI
    st.dataframe(df, use_container_width=True)
    
    # Generate CSV for download
    csv_data = df.to_csv(index=False).encode('utf-8')
    st.download_button(
        label="📥 Download Tracker as CSV",
        data=csv_data,
        file_name="phd_application_tracker.csv",
        mime="text/csv",
    )
