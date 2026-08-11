import os
import requests
from dotenv import load_dotenv

load_dotenv()

ASANA_PAT = os.getenv("ASANA_ACCESS_TOKEN")
TARGET_PROJECT_ID = os.getenv("ASANA_TARGET_PROJECT_ID")
WEBHOOK_URL = os.getenv("FIREBASE_WEBHOOK_URL", "https://syncasanatasks-scqfsophtq-ts.a.run.app")

def register_webhook():
    if not ASANA_PAT or not TARGET_PROJECT_ID:
        print("Error: ASANA_ACCESS_TOKEN and ASANA_TARGET_PROJECT_ID must be set in .env")
        return

    headers = {
        "Authorization": f"Bearer {ASANA_PAT}",
        "Content-Type": "application/json"
    }

    payload = {
        "data": {
            "resource": TARGET_PROJECT_ID,
            "target": WEBHOOK_URL,
            "filters": [
                { "resource_type": "task", "action": "changed" },
                { "resource_type": "task", "action": "added" }
            ]
        }
    }

    print(f"Registering webhook for project {TARGET_PROJECT_ID} at {WEBHOOK_URL}...")
    response = requests.post("https://app.asana.com/api/1.0/webhooks", json=payload, headers=headers)
    print(f"Status: {response.status_code}")
    print(response.text)

if __name__ == "__main__":
    register_webhook()
