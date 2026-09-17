// Paste this into the DevTools console on https://www.backgammongalaxy.com/play while
// logged in. It reads your own Galaxy session tokens out of the page and copies them to
// the clipboard so the scraper can use them. Nothing leaves the browser.
(async () => {
  const claimsOf = (token) => {
    try {
      if (!/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token)) return null;
      return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return null;
    }
  };
  const found = { access: null, refresh: null };
  const newer = (current, candidate) =>
    !current || (claimsOf(candidate).exp ?? 0) > (claimsOf(current).exp ?? 0);
  const consider = (value, depth = 0) => {
    if (value && typeof value === "object" && depth < 3) {
      for (const inner of Object.values(value)) consider(inner, depth + 1);
      return;
    }
    if (typeof value !== "string") return;
    let token = value.trim().replace(/^Bearer\s+/i, "");
    try {
      token = decodeURIComponent(token);
    } catch {}
    const claims = claimsOf(token);
    if (!claims) {
      try {
        consider(JSON.parse(token), depth + 1);
      } catch {}
      return;
    }
    if (claims.typ === "Refresh" || claims.typ === "Offline") {
      if (newer(found.refresh, token)) found.refresh = token;
    } else if (claims.typ === "Bearer" || claims.bg_id) {
      if (newer(found.access, token)) found.access = token;
    }
  };

  // 1. Cookies the web client writes itself (JWT_ACCESS, bg-app-token, bg-app-refresh-token).
  for (const pair of document.cookie.split(";")) {
    const eq = pair.indexOf("=");
    if (eq > 0) consider(pair.slice(eq + 1));
  }

  // 2. Web storage, including flutter_secure_storage entries, which are AES-GCM encrypted as
  //    "<iv>.<ciphertext>" with the raw key kept base64-encoded under "FlutterSecureStorage".
  const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  for (const store of [localStorage, sessionStorage]) {
    try {
      let key = null;
      const rawKey = store.getItem("FlutterSecureStorage");
      if (rawKey) {
        try {
          key = await crypto.subtle.importKey("raw", bytes(rawKey), "AES-GCM", false, ["decrypt"]);
        } catch {}
      }
      for (let i = 0; i < store.length; i++) {
        const name = store.key(i);
        const raw = store.getItem(name);
        consider(raw);
        if (key && name.startsWith("FlutterSecureStorage.")) {
          try {
            const [iv, data] = raw.split(".").map(bytes);
            const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
            consider(new TextDecoder().decode(plain));
          } catch {}
        }
      }
    } catch {}
  }

  const daysLeft = (token) =>
    (((claimsOf(token).exp ?? 0) * 1000 - Date.now()) / 864e5).toFixed(1) + " days left";
  const deliver = () => {
    const out = JSON.stringify(found);
    copy(out);
    console.log(
      `Access token: ${daysLeft(found.access)}. Refresh token: ${
        found.refresh
          ? daysLeft(found.refresh)
          : "not found — you'll be asked again when the access token expires"
      }.`,
    );
    console.log("Copied to the clipboard. Paste it into the terminal.");
    console.log(out);
  };
  if (found.access) return deliver();

  // 3. Nothing stored on this page yet: catch the token off the next API request instead.
  const original = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (
      typeof value === "string" &&
      /^authorization$/i.test(name) &&
      claimsOf(value.replace(/^Bearer\s+/i, ""))
    ) {
      XMLHttpRequest.prototype.setRequestHeader = original;
      consider(value);
      deliver();
    }
    return original.call(this, name, value);
  };
  console.log(
    "No token stored on this page yet. Click any tab (e.g. Blunders); it will be caught from the next request.",
  );
})();
