/*
 * The entry point of formulate.js, the visitor-side renderer for forms that use
 * the Plain JavaScript template. Once DOMContentLoaded has fired, it renders the
 * forms the Razor view queued on window["formulate-plain-js-forms"], and it
 * renders any form pushed onto that array later. Register custom fields on
 * window["formulate-plain-js-fields"] and custom validators on
 * window["formulate-plain-js-validators"] before DOMContentLoaded (a deferred
 * script is early enough, even one after formulate.js).
 */
import { listenForForms } from "./steps/get-form-data";
import { renderForm, renderForms } from "./steps/render-forms";

if (window.formulatePlainJs) {
  console.warn("Formulate: the plain JavaScript renderer was loaded more than once, so this copy does nothing.");
} else {
  window.formulatePlainJs = { version: __FORMULATE_VERSION__, renderForm };
  whenDomContentLoaded(() => listenForForms(renderForms));
}

/**
 * Runs the callback once DOMContentLoaded has fired (straight away if it already
 * has). The view loads formulate.js with defer, and deferred scripts run before
 * DOMContentLoaded (while readyState is already "interactive"), so waiting for
 * the event lets the scripts deferred after formulate.js register their fields.
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
