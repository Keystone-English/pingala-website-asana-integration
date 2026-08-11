import os
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

load_dotenv()

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "asana-to-website-intergr-1f753")

cred = credentials.ApplicationDefault()
firebase_admin.initialize_app(cred, {"projectId": FIREBASE_PROJECT_ID})
db = firestore.client()

print("Reading tasks from Firestore 'public_asana_tasks'...")
docs = db.collection("public_asana_tasks").stream()
for doc in docs:
    data = doc.to_dict()
    print(f"ID: {doc.id} | Name: {data.get('name')} | Status: {data.get('status')}")
