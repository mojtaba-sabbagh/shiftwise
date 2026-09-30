import assert from "node:assert/strict";

async function main() {
  for (const path of ["/", "/login", "/signup", "/admin/login"]) {
    const response = await fetch(`http://localhost:3000${path}`);
    assert.equal(response.status, 200, `${path} status`);
    const html = await response.text();
    assert.match(html, /<html[^>]*lang="fa"[^>]*dir="rtl"/);
    assert.match(html, /شیفت‌یار/);
  }
  const font = await fetch("http://localhost:3000/fonts/Yekan.woff2");
  assert.equal(font.status, 200);
  assert.match(font.headers.get("content-type") || "", /font\/woff2|application\/font-woff/);
  const dashboard = await fetch("http://localhost:3000/dashboard", { redirect:"manual" });
  assert.ok([303, 307, 308].includes(dashboard.status));
  assert.match(dashboard.headers.get("location") || "", /\/login/);
  const admin = await fetch("http://localhost:3000/admin", { redirect:"manual" });
  assert.match(admin.headers.get("location") || "", /\/admin\/login/);
  console.log("Persian RTL pages, font asset, and role-specific auth redirects passed.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
