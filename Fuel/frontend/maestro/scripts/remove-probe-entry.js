// Runs on the host (Maestro JS). Removes the entry and custom food made by add-probe-entry.js.
// Inputs: TOKEN, ENTRY_ID, FOOD_ID, optional API_BASE_URL (default http://localhost:8090).
var base = typeof API_BASE_URL !== 'undefined' ? API_BASE_URL : 'http://localhost:8090';
var headers = { Authorization: 'Bearer ' + TOKEN };

function remove(path) {
  var res = http.delete(base + path, { headers: headers });
  if (!res.ok) throw new Error('DELETE ' + path + ' failed: ' + res.status + ' ' + res.body);
}

remove('/api/tracking/entries/' + ENTRY_ID);
remove('/api/food/custom/' + FOOD_ID);
