#!/usr/bin/env python3
"""Check if the page uses JavaScript/AJAX for login"""

import requests
from bs4 import BeautifulSoup

url = "https://kppm.cincwebaxis.com"

print(f"Fetching {url}...")
response = requests.get(url, allow_redirects=True)

soup = BeautifulSoup(response.text, 'html.parser')

# Look for modal dialogs or hidden login forms
print("=== Checking for hidden/modal login elements ===")

# Find all divs with common modal/dialog class names
modal_divs = soup.find_all('div', class_=lambda x: x and any(
    term in str(x).lower() for term in ['modal', 'dialog', 'login', 'signin']
))

print(f"Found {len(modal_divs)} potential modal/dialog divs")

for div in modal_divs[:5]:  # Limit to first 5
    print(f"\nDiv id={div.get('id')} class={div.get('class')}")
    # Look for inputs inside
    inputs = div.find_all('input')
    for inp in inputs:
        print(f"  Input: name={inp.get('name')} type={inp.get('type')} id={inp.get('id')}")

# Look for script tags that might set up login
scripts = soup.find_all('script')
print(f"\n=== Found {len(scripts)} script tags ===")

# Check if there's a reference to login endpoints
login_keywords = ['login', 'signin', 'authenticate', 'auth']
for script in scripts:
    if script.string:
        for keyword in login_keywords:
            if keyword.lower() in script.string.lower():
                snippet = script.string[:200] if len(script.string) > 200 else script.string
                print(f"\nScript with '{keyword}':")
                print(snippet)
                break

# Check for buttons with login text
print("\n=== Login buttons ===")
buttons = soup.find_all(['button', 'a'], text=lambda x: x and any(
    term in str(x).lower() for term in ['log in', 'sign in', 'login', 'signin']
))
for btn in buttons:
    print(f"Button/Link: text='{btn.get_text().strip()}' id={btn.get('id')} class={btn.get('class')}")

# Look for input with name/id containing email/username
print("\n=== All inputs ===")
all_inputs = soup.find_all('input')
for inp in all_inputs:
    name = inp.get('name', '')
    id_attr = inp.get('id', '')
    input_type = inp.get('type', '')
    if any(term in name.lower() or term in id_attr.lower()
           for term in ['email', 'user', 'login', 'pass']):
        print(f"  Input: name={name} id={id_attr} type={input_type}")
