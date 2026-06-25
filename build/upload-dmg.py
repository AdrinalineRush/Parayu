#!/usr/bin/env python3
# build/upload-dmg.py — Auto-uploads the final built DMG to Google Drive.

import os
import os.path
import sys
import subprocess

# Ensure necessary Google API libraries are installed
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
except ImportError:
    print("==> Installing Google API python libraries...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", "google-api-python-client", "google-auth-httplib2", "google-auth-oauthlib"])
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
        print("✅ Libraries installed successfully.")
    except Exception as e:
        print(f"Error installing dependencies: {e}")
        print("Please run manually: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib")
        sys.exit(1)

# API Scope for accessing files created/accessible by this app
SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']
FOLDER_ID = '1Hmxt5-qASaBMx6WE6MSj1worpiG0wZpf'
DMG_PATH = 'dist/Parayu-0.1.0-arm64.dmg'

def main():
    if not os.path.exists(DMG_PATH):
        print(f"Error: {DMG_PATH} not found. Please build the DMG first.")
        sys.exit(1)

    build_dir = os.path.dirname(os.path.abspath(__file__))
    token_path = os.path.join(build_dir, 'token.json')
    creds_path = os.path.join(build_dir, 'credentials.json')

    creds = None
    # Load token cache if it exists
    if os.path.exists(token_path):
        creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        
    # If there are no valid credentials, prompt user to log in
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("==> Refreshing expired Google Drive credentials...")
            creds.refresh(Request())
        else:
            if not os.path.exists(creds_path):
                print("\n========================================================")
                print("🔑 GOOGLE DRIVE AUTHENTICATION SETUP REQUIRED")
                print("========================================================")
                print(f"Please download your client secrets JSON from the Google Cloud Console,")
                print(f"rename it to 'credentials.json', and save it in: {creds_path}\n")
                print("Setup Instructions:")
                print("1. Go to: https://console.cloud.google.com/")
                print("2. Create a new project and enable the 'Google Drive API'.")
                print("3. Configure your OAuth Consent Screen (Set status to 'Testing', add your email as a test user).")
                print("4. Go to 'Credentials' -> 'Create Credentials' -> 'OAuth Client ID' (Select 'Desktop App').")
                print("5. Click Download JSON, rename it to 'credentials.json', and save it to the build/ folder.")
                print("========================================================\n")
                sys.exit(1)
                
            print("==> Authorizing Google Drive access...")
            flow = InstalledAppFlow.from_client_secrets_file(creds_path, SCOPES)
            creds = flow.run_local_server(port=0)
            
        # Save credentials for future runs
        with open(token_path, 'w') as token:
            token.write(creds.to_json())
        print("✅ Credentials authorized and cached.")

    service = build('drive', 'v3', credentials=creds)

    filename = os.path.basename(DMG_PATH)
    print(f"==> Searching for existing '{filename}' in Drive folder...")
    
    # Search for an existing file with the same name in the target folder
    query = f"name = '{filename}' and '{FOLDER_ID}' in parents and trashed = false"
    try:
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        items = results.get('files', [])
    except Exception as e:
        print(f"Error querying Drive: {e}")
        sys.exit(1)

    media = MediaFileUpload(DMG_PATH, mimetype='application/x-apple-diskimage', resumable=True)

    try:
        if items:
            file_id = items[0]['id']
            print(f"🔄 Replacing existing file (File ID: {file_id})...")
            file = service.files().update(
                fileId=file_id,
                media_body=media
            ).execute()
            print("🎉 DMG replaced successfully in Google Drive!")
        else:
            print(f"📤 Uploading new file to Google Drive folder...")
            file_metadata = {
                'name': filename,
                'parents': [FOLDER_ID]
            }
            file = service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id'
            ).execute()
            print(f"🎉 DMG uploaded successfully! File ID: {file.get('id')}")
    except Exception as e:
        print(f"Error uploading file: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
