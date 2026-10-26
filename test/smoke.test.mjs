// Smoke test against the live public server: protocol, tool contract, a real price, and a refusal.
// Run: node --test test/   (Node 20+, no dependencies). MCP_URL overrides the endpoint.
import test from 'node:test';
import assert from 'node:assert/strict';

const URL = process.env.MCP_URL || 'https://zzamnvhadwibvafqcfpd.supabase.co/functions/v1/mcp';
let id = 0;
async function rpc(method, params) {
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  assert.equal(res.status, 200, `${method}: HTTP ${res.status}`);
  const body = await res.json();
  assert.equal(body.jsonrpc, '2.0');
  return body;
}

test('initialize answers in the protocol version the client asks for', async () => {
  for (const v of ['2025-06-18', '2025-03-26', '2024-11-05']) {
    const r = await rpc('initialize', { protocolVersion: v, capabilities: {}, clientInfo: { name: 'smoke', version: '1' } });
    assert.equal(r.result.protocolVersion, v);
    assert.equal(r.result.serverInfo.name, '3descu-quote');
  }
});

test('exactly four tools, every one read-only', async () => {
  const { result } = await rpc('tools/list', {});
  assert.deepEqual(result.tools.map((t) => t.name).sort(), ['analyze_model', 'estimate_price', 'get_capabilities', 'list_materials']);
  for (const t of result.tools) {
    assert.equal(t.annotations.readOnlyHint, true, `${t.name} must be read-only`);
    assert.equal(t.annotations.destructiveHint, false, `${t.name} must not be destructive`);
  }
});

test('estimate_price returns a EUR price with tiers and a delivery estimate', async () => {
  const { result } = await rpc('tools/call', { name: 'estimate_price', arguments: {
    material_id: 'pla', quantity: 10, bounding_box_mm: { x: 40, y: 30, z: 20 }, volume_cm3: 12, destination_country: 'DE',
  } });
  assert.equal(result.isError, false);
  const q = result.structuredContent;
  assert.equal(q.currency, 'EUR');
  assert.ok(q.tiers.length >= 1, 'at least one production tier');
  for (const t of q.tiers) assert.ok(t.price_eur.low > 0 && t.price_eur.high >= t.price_eur.low, `${t.tier}: price range`);
  assert.equal(q.exact, false, 'no surface area given, so the answer must be a range');
  assert.equal(q.delivery.destination, 'DE');
});

test('out-of-range input is refused, never clamped', async () => {
  const { result } = await rpc('tools/call', { name: 'estimate_price', arguments: {
    material_id: 'pla', quantity: 10, bounding_box_mm: { x: 40, y: 30, z: 20 }, volume_cm3: 12, infill_percent: 300,
  } });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /infill_percent/);
});
