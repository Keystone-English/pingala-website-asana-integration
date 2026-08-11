import os
import requests
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

ASANA_PAT = os.getenv("ASANA_ACCESS_TOKEN")
TARGET_PROJECT_ID = os.getenv("ASANA_TARGET_PROJECT_ID")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "asana-to-website-intergr-1f753")

ASANA_HEADERS = {
    "Authorization": f"Bearer {ASANA_PAT}",
    "Accept": "application/json",
}

def init_firebase():
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})
    return firestore.client()

def fetch_asana_tasks():
    url = f"https://app.asana.com/api/1.0/projects/{TARGET_PROJECT_ID}/tasks"
    params = {
        "opt_fields": "name,notes,completed,permalink_url,assignee.name,memberships.section.name",
        "completed_since": "now",
        "limit": 100,
    }
    resp = requests.get(url, headers=ASANA_HEADERS, params=params)
    resp.raise_for_status()
    return resp.json().get("data", [])

if __name__ == "__main__":
    print(f"Fetching tasks for project {TARGET_PROJECT_ID}...")
    tasks = fetch_asana_tasks()
    print(f"Found {len(tasks)} tasks.")
