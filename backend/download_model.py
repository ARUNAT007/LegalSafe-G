"""
Download spaCy en_core_web_sm model wheel with SSL verification disabled.
Run this with the venv Python when GitHub SSL fails.
"""
import ssl
import urllib.request
import os
import subprocess
import sys

# Disable SSL verification for this download only
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# spaCy model URL for spaCy 3.8.x
MODEL_URL = (
    "https://github.com/explosion/spacy-models/releases/download/"
    "en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl"
)
OUTPUT_FILE = "en_core_web_sm-3.8.0.whl"

print(f"Downloading spaCy model from:\n  {MODEL_URL}")
print("SSL verification disabled for this download (corporate network workaround)")
print("Please wait...")

try:
    with urllib.request.urlopen(MODEL_URL, context=ctx) as response:
        total = int(response.headers.get('Content-Length', 0))
        downloaded = 0
        chunk_size = 1024 * 64  # 64KB chunks

        with open(OUTPUT_FILE, 'wb') as f:
            while True:
                chunk = response.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                if total:
                    pct = downloaded * 100 // total
                    print(f"\r  Progress: {pct}% ({downloaded // 1024}KB / {total // 1024}KB)", end='', flush=True)

    print(f"\n\nDownloaded: {OUTPUT_FILE} ({os.path.getsize(OUTPUT_FILE) // 1024} KB)")
    print("\nInstalling model...")

    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", OUTPUT_FILE, "--no-deps"],
        capture_output=True, text=True
    )
    print(result.stdout)
    if result.returncode == 0:
        print("\n✅ en_core_web_sm installed successfully!")
        os.remove(OUTPUT_FILE)
    else:
        print(f"❌ Install failed:\n{result.stderr}")

except Exception as e:
    print(f"\n❌ Download failed: {e}")
    print("\nAlternative: Run manually in browser, download the .whl from:")
    print(f"  {MODEL_URL}")
    print("Then run: .\\venv\\Scripts\\pip.exe install en_core_web_sm-3.8.0.whl")
    sys.exit(1)
