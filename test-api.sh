#!/bin/bash

# Test API với GET request
echo "=== Testing API with GET request ==="
curl -X GET "https://crypto-research-kappa.vercel.app/api/research?query=What%20is%20Bitcoin?" \
  -H "Content-Type: application/json"

echo -e "\n\n=== Testing API with POST request ==="
# Test API với POST request
curl -X POST "https://crypto-research-kappa.vercel.app/api/research" \
  -H "Content-Type: application/json" \
  -d '{"query": "What is Ethereum and how does it work?"}'

