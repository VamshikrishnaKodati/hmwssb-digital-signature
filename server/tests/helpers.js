// Shared test helpers. Not a test file itself (does not match *.test.js).
async function resolveLocation(request, token) {
  const regions = (await request('GET', '/api/lookups/regions', null, token)).body;
  if (!regions || !regions.length) throw new Error('no regions seeded');
  const wards = (await request('GET', '/api/lookups/wards', null, token)).body;
  if (!wards || !wards.length) throw new Error('no wards seeded');
  return { RegionID: regions[0].RegionID, WardID: wards[0].WardID };
}

module.exports = { resolveLocation };
