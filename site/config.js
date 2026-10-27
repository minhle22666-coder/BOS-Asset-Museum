// Site settings. Edit, commit, done.
window.BOS_CONFIG = {
  // How sign-in works:
  //  "cloudflare-access" (recommended) - Cloudflare checks the Google account BEFORE any file is served.
  //                                      Real protection: images can't be opened without signing in.
  //  "google-signin"                   - Google button inside the page (for GitHub Pages).
  //                                      Only a front door: image links still work if someone has them.
  //  "none"                            - no sign-in (local testing).
  authMode: "cloudflare-access",

  // Who may enter (used by "google-signin"; mirror the same list in your Cloudflare Access policy).
  allowedEmails: ["bos@kamereo.vn"],
  allowedDomains: [], // e.g. ["kamereo.vn"] to let every company account in

  // Needed only for "google-signin": OAuth Web client ID from Google Cloud Console.
  googleClientId: "",

  siteTitle: "BOS Asset Museum",
};
