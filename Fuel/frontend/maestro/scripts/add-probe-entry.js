/* global http, output, API_BASE_URL, LAB_EMAIL, LAB_PASSWORD */
// Runs on the host (Maestro JS), not on the device. Adds a uniquely named custom food and logs it for today
// through the lab backend, so a flow can prove a pull-to-refresh really refetches.
// Inputs: LAB_EMAIL, LAB_PASSWORD, optional API_BASE_URL (default http://localhost:8090).
// Outputs: output.name, output.token, output.entryId, output.foodId.
let base =
  typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "http://localhost:8090";

function call(path, body, token) {
  let headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  let res = http.post(base + path, {
    headers: headers,
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error("POST " + path + " failed: " + res.status + " " + res.body);
  return JSON.parse(res.body).data;
}

let token = call("/api/auth/login", {
  email: LAB_EMAIL,
  password: LAB_PASSWORD,
}).accessToken;
let name = "Probe" + String(Date.now()).slice(-6);
let food = call(
  "/api/food/custom",
  {
    name: name,
    servingSize: 100,
    servingUnit: "g",
    calories: 100,
    protein: 1,
    carbs: 1,
    fat: 1,
  },
  token,
);
let entry = call(
  "/api/tracking/entries",
  {
    foodId: food.id,
    servingSize: 100,
    servingUnit: "g",
    quantity: 1,
    mealLabel: "snack",
  },
  token,
);

output.name = name;
output.token = token;
output.foodId = food.id;
output.entryId = entry.id;
