#!/usr/bin/env bash
# Price 10 PLA parts for delivery to Germany, straight from the public endpoint.
# No key, no account. Needs curl; python only to pretty-print.
set -euo pipefail
URL="https://zzamnvhadwibvafqcfpd.supabase.co/functions/v1/mcp"
rpc() {
  curl -s -X POST "$URL" \
    -H 'content-type: application/json' \
    -H 'accept: application/json, text/event-stream' \
    -d "$1"
}
rpc '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"example","version":"1.0"}}}'
echo
rpc '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"estimate_price","arguments":{
  "material_id":"pla","quantity":10,
  "bounding_box_mm":{"x":40,"y":30,"z":20},"volume_cm3":12,
  "destination_country":"DE"}}}' | python -m json.tool
