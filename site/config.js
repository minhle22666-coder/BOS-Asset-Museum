// Site settings. Edit, commit, done.
window.BOS_CONFIG = {
  // How sign-in works:
  //  "cloudflare-access" (default) - Cloudflare Access checks the email BEFORE any file is served.
  //                                  Who may enter is set in the Cloudflare dashboard, not here.
  //                                  This file only shows the signed-in email + Sign out button.
  //  "google-signin"               - Google button inside the page (only a front door; image links stay open).
  //  "none"                        - no sign-in (local testing).
  authMode: "cloudflare-access",

  // How each hall opens the first time: "carousel" (Orbit, the spinning spiral) or "grid" (Wall, everything at once).
  // After that, each person's last choice is remembered in their browser.
  defaultView: "carousel",

  // Used only by "google-signin".
  allowedEmails: ["bos@kamereo.vn"],
  allowedDomains: [],
  googleClientId: "",

  siteTitle: "BOS Asset Museum",
};
