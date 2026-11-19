/* global http, output, LAB_PASSWORD, API_BASE_URL, MAIL_BASE_URL */
// Runs on the host (Maestro JS). Creates and verifies a fresh account that has no body stats or goals, so the
// Setup page appears after sign-in. The lab only seeds one fully set-up user.
// Inputs: LAB_PASSWORD, optional API_BASE_URL (default http://localhost:8090), MAIL_BASE_URL (default http://127.0.0.1:8026).
// Outputs: output.email.
let base =
  typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "http://localhost:8090";
let mail =
  typeof MAIL_BASE_URL !== "undefined" ? MAIL_BASE_URL : "http://127.0.0.1:8026";

function post(path, body) {
  let res = http.post(base + path, {
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error("POST " + path + " failed: " + res.status + " " + res.body);
}

let email = "newcomer+" + Date.now() + "@example.com";
post("/api/auth/register", {
  email: email,
  password: LAB_PASSWORD,
  name: "Lab Newcomer",
  timezone: "UTC",
});

// The code is in the newest message to this address; mail can lag the register call by a moment.
let code = null;
for (let i = 0; i < 15 && !code; i++) {
  let res = http.get(mail + "/api/v1/search?query=" + encodeURIComponent("to:" + email));
  let list = res.ok ? JSON.parse(res.body).messages : [];
  if (list && list.length > 0) {
    let msg = http.get(mail + "/api/v1/message/" + list[0].ID);
    let found = /code is:? *([0-9]+)/.exec(JSON.parse(msg.body).Text || "");
    if (found) code = found[1];
  }
  if (!code) {
    let until = Date.now() + 1000;
    while (Date.now() < until) {
      // wait one second between polls
    }
  }
}
if (!code) throw new Error("no verification email for the newcomer");
post("/api/auth/verify-email", { email: email, verificationCode: code });
output.email = email;
