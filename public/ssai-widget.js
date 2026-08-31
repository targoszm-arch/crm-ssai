/**
 * Skill Studio AI — website visitor tracking.
 *
 * Drop this into Framer (Site Settings → General → Custom Code → End of <body>):
 *
 *   <script async
 *     src="https://your-crm-domain/visitor-tracking.js"
 *     data-site-key="YOUR_SITE_KEY"></script>
 *
 * It reports page views to the track-website-visit edge function, which resolves
 * each visitor's IP to a company. Everything is wrapped so that a failure — a
 * blocked request, an offline endpoint, an ad blocker — stays silent: no thrown
 * errors, no console output, no impact on the page.
 */
(function () {
  "use strict";

  try {
    // document.currentScript is null whenever the snippet is injected rather than
    // parsed inline — which is what Framer's custom-code block does. Falling back to
    // finding our own tag by its data-site-key is what makes this work there; without
    // it the tracker returns silently and looks like nothing is wrong.
    var script = document.currentScript ||
      document.querySelector("script[data-site-key]");
    if (!script) return;

    var siteKey = script.getAttribute("data-site-key");
    if (!siteKey) return;

    // Opt-in logging, so setup can be confirmed without guessing. Add
    // data-debug="true" to the snippet, load the page, read the console.
    var debug = script.getAttribute("data-debug") === "true";
    function log(msg, extra) {
      if (debug) console.log("[ssai-visitor] " + msg, extra === undefined ? "" : extra);
    }
    log("tracker loaded", { siteKey: siteKey });

    var endpoint = script.getAttribute("data-endpoint") ||
      "https://getqcxnjsohtlagscmfc.supabase.co/functions/v1/track-website-visit";

    // The Framer editor renders the site inside an iframe on the canvas. Without
    // this, every design session would show up as a visit from Framer's own IPs.
    if (window.top !== window.self) return;

    if (script.getAttribute("data-respect-dnt") === "true") {
      if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;
    }

    // Session id lives in sessionStorage, not a cookie: it groups the pages of
    // one browsing session and disappears when the tab closes.
    var sessionId;
    try {
      sessionId = sessionStorage.getItem("ssai_vt_session");
      if (!sessionId) {
        sessionId = Date.now().toString(36) +
          Math.random().toString(36).slice(2, 10);
        sessionStorage.setItem("ssai_vt_session", sessionId);
      }
    } catch (e) {
      // Private mode or storage disabled — carry on without a session id.
      sessionId = null;
    }

    var lastPath = null;
    var lastSentAt = 0;

    function param(name) {
      try {
        return new URLSearchParams(window.location.search).get(name) || null;
      } catch (e) {
        return null;
      }
    }

    function send() {
      try {
        var path = window.location.pathname + window.location.search;
        var now = Date.now();

        // Framer's router can fire more than once for a single navigation.
        if (path === lastPath && now - lastSentAt < 2000) return;
        lastPath = path;
        lastSentAt = now;

        var payload = JSON.stringify({
          site_key: siteKey,
          session_id: sessionId,
          path: path,
          title: document.title || null,
          // Only the referrer that brought the visitor to the site, not our own
          // internal page-to-page navigation.
          referrer: document.referrer &&
            document.referrer.indexOf(window.location.host) === -1
            ? document.referrer
            : null,
          utm_source: param("utm_source"),
          utm_medium: param("utm_medium"),
          utm_campaign: param("utm_campaign"),
          utm_term: param("utm_term"),
          utm_content: param("utm_content")
        });

        // text/plain keeps this a "simple" request, so the browser sends it
        // straight through with no CORS preflight.
        if (navigator.sendBeacon) {
          var blob = new Blob([payload], { type: "text/plain;charset=UTF-8" });
          if (navigator.sendBeacon(endpoint, blob)) {
            log("sent via sendBeacon", endpoint);
            return;
          }
        }

        // no-cors means a network or CORS failure can never reach the console.
        fetch(endpoint, {
          method: "POST",
          mode: "no-cors",
          keepalive: true,
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: payload
        }).then(function () {
          log("sent via fetch", endpoint);
        }).catch(function (err) {
          log("send failed", err);
        });
      } catch (e) {}
    }

    // Framer is a single-page app: real navigations replace the URL without
    // reloading, so patch the history API to catch them.
    function watchRouteChanges() {
      try {
        ["pushState", "replaceState"].forEach(function (method) {
          var original = history[method];
          if (typeof original !== "function") return;
          history[method] = function () {
            var result = original.apply(this, arguments);
            setTimeout(send, 0);
            return result;
          };
        });
        window.addEventListener("popstate", function () {
          setTimeout(send, 0);
        });
      } catch (e) {}
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", send, { once: true });
    } else {
      send();
    }
    watchRouteChanges();
  } catch (e) {
    // Tracking must never break the site it runs on.
  }
})();
