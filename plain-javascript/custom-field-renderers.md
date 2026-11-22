---
layout: page
title: Custom Field Renderers in Formulate 5
---

# Custom Field Renderers

**Formulate 5.** For Formulate 3, see [Custom Field Types](/articles/custom-field-types).

In Formulate 5, a script in the browser (the renderer) builds each form from the data the page gives it. The renderer is a set of small JavaScript modules, not one bundle, so your own script can import the parts it needs. A custom field renderer can build on a built-in one and only change what is different.

The full reference, with every export and option, is in the [extending docs on GitHub](https://github.com/Nicholas-Westby/formulate/blob/v5/main/docs/extending.md#changing-how-forms-render-in-the-browser).

# The Renderer's Files

The files are in `/App_Plugins/Formulate/PlainJavaScript/`. Each module comes twice, side by side:

* `name.js` is readable, with its comments. Read it to see what a module does.
* `name.min.js` is minified. Formulate loads these, and your scripts should import these too.

The files you are most likely to use:

| File | What it is |
| --- | --- |
| `api.min.js` | The API: the function that registers a renderer, the base class, every built-in renderer and the helpers. Importing it starts nothing. |
| `formulate.min.js` | The entry. It renders the forms on the page and puts the API on `window.formulatePlainJs`. The page loads it for you. |
| `fields/` | The built-in renderers, such as `fields/plain-text.min.js`. |
| `utils/field.min.js` | `FieldRendererBase`, the base class of the built-in renderers. |
| `types.d.ts` | The TypeScript types. Each module has a `.d.ts` file too. |

In a TypeScript project, copy the `.d.ts` files into the project, and point the URL your imports use at the copy with a `paths` entry in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "/App_Plugins/Formulate/PlainJavaScript/*": ["./types/formulate/*"]
    }
  }
}
```

On a page with a form, Formulate adds a preload link for each module, then loads `formulate.min.js` as a module script, once per page. The browser asks for all the modules at once.

# A Phone Field in a Few Lines

A phone field is a text field with the input type `tel`. Save this as `wwwroot/scripts/phone-field.js`:

```js
import { RenderText, registerFieldRenderer } from "/App_Plugins/Formulate/PlainJavaScript/api.min.js";

class RenderPhone extends RenderText {
  static inputType = "tel";
}

registerFieldRenderer("phone", RenderPhone);
```

Load it as a module script in the template that shows your form:

```html
@await Component.InvokeAsync("FormulateForm", Model.Form)

<script type="module" src="/scripts/phone-field.js"></script>
```

That's all for the browser. The label, the wrapper and its classes (`formulate__field formulate__field--phone`), the placeholder, the validation messages and the value that is sent all come from the text field.

A few rules:

* Import the `.min.js` files by the same URL Formulate uses. A different URL (such as the readable `api.js`, or a URL with `?v=2`) makes the browser load a second copy of the renderer's code.
* If your site has a path base, such as `/site`, put it in the URL: `/site/App_Plugins/...`.
* If you bundle your own scripts, leave Formulate's modules out of the bundle and import them by URL.

# When to Register

Register before the forms render. Formulate renders the forms on the page when the page has loaded (at `DOMContentLoaded`). Module scripts (unless they have `async`) run before that, wherever they are on the page, so a module script that registers right away is in time.

A renderer registered later is used only by forms rendered after it, and when a form already rendered a field of that type, the browser console shows a warning.

A registration for a key replaces the built-in renderer with that key, so you can also change how a built-in field renders. The built-in keys are `text`, `textarea`, `date`, `select`, `checkbox`, `checkbox-list`, `radio-list`, `extended-radio-list`, `upload`, `hidden`, `header`, `rich-text`, `button` and `recaptcha`.

# A Renderer From Scratch

For a field that is not like a built-in one, extend `FieldRendererBase` and call `initializeField` in the constructor:

```js
import { FieldRendererBase, registerFieldRenderer } from "/App_Plugins/Formulate/PlainJavaScript/api.min.js";

class RenderNumber extends FieldRendererBase {
  constructor(fieldData, fieldValidators, cssClasses) {
    super(fieldData, fieldValidators);
    this.initializeField({ type: "number", cssClasses });
  }
}

registerFieldRenderer("number", RenderNumber);
```

`initializeField` makes the element, its label and its wrapper. The base class then sends the field's value with the form, checks it with the field's validations and shows their messages.

The value comes from `getValue()`. By default it is the value of the field's input, select or textarea. For anything else, such as a widget made of buttons, override it:

```js
getValue() {
  return this.rating === 0 ? "" : String(this.rating);
}
```

# Validators

A validation type, such as one you add in C#, gets its browser check from a validator class. Each method returns true when the value is valid. The message shown is the one set on the validation in the back office.

```js
import { registerValidator } from "/App_Plugins/Formulate/PlainJavaScript/api.min.js";

class NoPizzaValidator {
  validateText(value) {
    return !/pizza/i.test(value ?? "");
  }
}

registerValidator("no-pizza", NoPizzaValidator);
```

The server checks the validations again when the form is submitted.

# Scripts That Are Not Modules

The window lists from Formulate 3 still work, in any script that runs before the forms render:

```html
<script>
  window["formulate-plain-js-fields"] = window["formulate-plain-js-fields"] || [];
  window["formulate-plain-js-fields"].push({ key: "star-rating", renderer: StarRating });
</script>
```

Push onto the list, as above. Assigning the list replaces it, along with every renderer registered before it.

To use the built-in renderers from a script that is not a module, read them from `window.formulatePlainJs` in a script with `defer`, placed after the form:

```js
const { RenderText, registerFieldRenderer } = window.formulatePlainJs;
```

# The Server Side

A custom field also needs a few C# classes. The [Form fields](https://github.com/Nicholas-Westby/formulate/blob/v5/main/docs/extending.md#form-fields) part of the extending docs shows them for the phone field:

1. **The field and its definition.** `PhoneField` and `PhoneFieldDefinition`, with the field's kind id, name, icon and category. Formulate finds the definition when the site starts.
2. **A map** that says what the browser gets for the field. The field type is the key the renderer is registered under:

   ```csharp
   using Formulate.Extensions.PlainJavaScriptTemplate.Core;
   using Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields;
   using Umbraco.Cms.Core.Mapping;

   public sealed class PhoneFieldMapDefinition : FormFieldMapDefinition<PhoneField>
   {
       protected override PlainJavaScriptFormField Map(PhoneField field, MapperContext context)
       {
           return new PlainJavaScriptFormField("phone");
       }
   }
   ```

3. **A composer** that adds the map:

   ```csharp
   using Umbraco.Cms.Core.Composing;
   using Umbraco.Cms.Core.DependencyInjection;

   public sealed class PhoneFieldComposer : IComposer
   {
       public void Compose(IUmbracoBuilder builder)
       {
           builder.MapDefinitions().Add<PhoneFieldMapDefinition>();
       }
   }
   ```

4. **A back office editor**, only if the field has settings. A field with no editor shows "No settings" in the form editor. The extending docs explain [how to write one](https://github.com/Nicholas-Westby/formulate/blob/v5/main/docs/extending.md#an-editor-for-the-fields-settings).

Restart the site, and the Phone field is in the list of fields you can add to a form. Its values are stored and sent to handlers like any other field's.

# Caching

The renderer's files have no version in their URLs, so that each module has one URL. Formulate sends them with `Cache-Control: no-cache`: the browser keeps its copy, but checks with the site each time, and the site answers "not modified" when the file has not changed. After you upgrade Formulate, visitors get the new files on their next page view.

If a CDN sits in front of your site, make sure it follows `no-cache` for `/App_Plugins/Formulate/PlainJavaScript/`, or clear it when you deploy. If your site serves static files with middleware of its own, before Umbraco's (`app.UseUmbraco()`), Formulate cannot set the header on them, so do not give this folder long-lived caching there.

# Loading the Renderer Yourself

With `"IncludeScript": false` under `Formulate:PlainJavaScript` in `appsettings.json`, Formulate adds no script tag, and you add it. Load `formulate.min.js` with `type="module"`, once per page, and add the preload links too, so the page stays fast. `IPlainJavaScriptAssets` gives both:

```cshtml
@inject Formulate.Extensions.PlainJavaScriptTemplate.Core.IPlainJavaScriptAssets FormulateAssets
@foreach (var url in FormulateAssets.GetModuleUrls(Context.Request.PathBase))
{
    <link rel="modulepreload" href="@url" />
}
<script type="module" src="@FormulateAssets.GetScriptUrl(Context.Request.PathBase)"></script>
```

Next up: [render a form](/plain-javascript/render-form), or [style it](/plain-javascript/styles).
