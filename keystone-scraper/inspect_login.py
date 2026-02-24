#!/usr/bin/env python3
"""Inspect the login page to understand the authentication flow"""

import requests
from bs4 import BeautifulSoup

url = "https://kppm.cincwebaxis.com"

print(f"Fetching {url}...")
response = requests.get(url, allow_redirects=True)
print(f"Status: {response.status_code}")
print(f"Final URL: {response.url}")
print(f"Content-Type: {response.headers.get('Content-Type', 'unknown')}")
print()

soup = BeautifulSoup(response.text, 'html.parser')

# Look for forms
forms = soup.find_all('form')
print(f"Found {len(forms)} form(s)")
print()

for i, form in enumerate(forms):
    print(f"=== Form {i+1} ===")
    print(f"Action: {form.get('action', 'N/A')}")
    print(f"Method: {form.get('method', 'N/A')}")

    # Find all input fields
    inputs = form.find_all('input')
    print(f"Input fields ({len(inputs)}):")
    for inp in inputs:
        name = inp.get('name', 'unnamed')
        input_type = inp.get('type', 'text')
        value = inp.get('value', '')
        print(f"  - {name} (type={input_type}, value={value[:50] if value else 'empty'})")
    print()

# Look for login-related elements
print("=== Login-related elements ===")
username_fields = soup.find_all(['input'], attrs={'type': 'email'}) + \
                  soup.find_all(['input'], attrs={'name': lambda x: x and 'user' in x.lower()})
password_fields = soup.find_all(['input'], attrs={'type': 'password'})

print(f"Username fields: {len(username_fields)}")
for field in username_fields:
    print(f"  - {field.get('name', 'unnamed')} id={field.get('id', 'none')}")

print(f"Password fields: {len(password_fields)}")
for field in password_fields:
    print(f"  - {field.get('name', 'unnamed')} id={field.get('id', 'none')}")

# Save HTML for inspection
with open('/tmp/login_page.html', 'w') as f:
    f.write(response.text)
print("\nSaved HTML to /tmp/login_page.html")
