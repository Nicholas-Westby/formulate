/*
 * The entry point of the visitor-side renderer for forms that use the Plain
 * JavaScript template. The build makes it formulate.js (readable) and
 * formulate.min.js (minified, which the Razor view loads as a module script).
 * Once DOMContentLoaded has fired, it renders the forms the view queued on
 * window["formulate-plain-js-forms"], and it renders any form pushed onto that
 * array later.
 *
 * It exports the API (api.js) and puts it on window.formulatePlainJs. Register
 * custom fields and validators before DOMContentLoaded, with
 * registerFieldRenderer and registerValidator or on the window arrays
 * window["formulate-plain-js-fields"] and window["formulate-plain-js-validators"]
 * (a module or deferred script is early enough, even one after
 * formulate.min.js). This is the only module that starts anything when it is
 * imported.
 */
import * as api from "./api.js";
import { listenForForms } from "./steps/get-form-data.js";
import { renderForms } from "./steps/render-forms.js";

export * from "./api.js";

if (window.formulatePlainJs) {
  console.warn("Formulate: the plain JavaScript renderer was loaded more than once, so this copy does nothing.");
} else {
  window.formulatePlainJs = { version: __FORMULATE_VERSION__, ...api };
  whenDomContentLoaded(() => listenForForms(renderForms));
}

/**
 * Runs the callback once DOMContentLoaded has fired (straight away if it already
 * has). The view loads formulate.min.js as a module script, and module scripts,
 * like deferred scripts, run before DOMContentLoaded (while readyState is
 * already "interactive"), so waiting for the event lets the module and deferred
 * scripts after formulate.min.js register their fields.
 */
function whenDomContentLoaded(callback: () => void): void {
  if (hasDomContentLoadedFired()) {
    callback();
    return;
  }
  let called = false;
  const callOnce = () => {
    if (!called) {
      called = true;
      callback();
    }
  };
  document.addEventListener("DOMContentLoaded", callOnce, { once: true });
  // In case DOMContentLoaded had fired after all (a privacy setting can round
  // the navigation timing down to 0), load still starts the forms.
  window.addEventListener("load", callOnce, { once: true });
}

function hasDomContentLoadedFired(): boolean {
  if (document.readyState !== "interactive") {
    return document.readyState === "complete";
  }
  // While "interactive", the navigation timing tells whether DOMContentLoaded has
  // started. Without it (as in jsdom), assume it has, as readyState suggests.
  const [navigation] = (performance.getEntriesByType?.("navigation") ?? []) as PerformanceNavigationTiming[];
  return navigation ? navigation.domContentLoadedEventStart > 0 : true;
}
