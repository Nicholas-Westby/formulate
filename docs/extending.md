# Extending Formulate

This guide is for developers who add to Formulate in C# and in the browser. Formulate is built from definitions. Each kind of field, handler, validation, data values and layout has a definition class with a fixed kind id. Formulate finds definitions when the site starts. Forms store only the kind id and the item's own configuration.

## Contents

- [The idea](#the-idea)
- [Kind ids](#kind-ids)
- [Form fields](#form-fields)
- [Form handlers](#form-handlers)
- [Validations](#validations)
- [Data values](#data-values)
- [Layouts and templates](#layouts-and-templates)
- [Back office editors](#back-office-editors)
- [Fields that check with a service, or write their value](#fields-that-check-with-a-service-or-write-their-value)
- [The submission pipeline](#the-submission-pipeline)
- [Notifications](#notifications)
- [Changing how forms render in the browser](#changing-how-forms-render-in-the-browser)
- [Compatibility rules](#compatibility-rules)

## The idea

| Kind | Implement | Found automatically when it derives from |
| --- | --- | --- |
| Form field | `FormFieldDefinition<TField>` and a `FormField` class | `FormFieldDefinitionBase<>` |
| Form handler | `FormHandlerDefinition` and a `FormHandler` or `AsyncFormHandler` class | `FormHandlerDefinition` |
| Validation | `IValidationDefinition` and a `Validation` class | `IValidationDefinition` |
| Data values | `DataValuesDefinition` (or `IDataValuesDefinition`) | `IDataValuesDefinition` |
| Layout | `ILayoutDefinition` and an `ILayout` class | `ILayoutDefinition` |
| Template | `TemplateDefinition` | not automatic: add it with `builder.TemplateDefinitions().Append<T>()` |

"Found automatically" means Umbraco's type scanner finds your class in any assembly the site loads. You do not register it. Definitions that need services (such as `IJsonUtility`) take them in the constructor.

To add or remove definitions in code instead, use the collection builders in a composer. They are extension methods on `IUmbracoBuilder`, in `Formulate.Core.DependencyInjection`:

```csharp
using Formulate.Core.DependencyInjection;
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

public sealed class MyComposer : IComposer
{
    public void Compose(IUmbracoBuilder builder)
    {
        builder.FormFieldDefinitions().Exclude<Formulate.Core.FormFields.Date.DateFieldDefinition>();
    }
}
```

`FormFieldDefinitions()`, `FormHandlerDefinitions()`, `ValidationDefinitions()`, `DataValuesDefinitions()`, `LayoutDefinitions()` and `TemplateDefinitions()` return the builders.

## Kind ids

Every definition has a `KindId`, a GUID. Forms store it, so it must never change after forms use it. Make a new one for each kind you add. Formulate 3's kinds keep their ids, so the forms, validations and data values you copy from Formulate 3 keep their kinds.

If a form uses a kind that is not installed, Formulate skips that item and logs a warning. The back office keeps the item's stored data so that it comes back when the kind is installed again.

## Form fields

A field has two classes: a definition (what kind of field it is) and a field (one instance on a form, with its validation).

```csharp
using System;
using Formulate.Core.FormFields;

public sealed class PhoneField : FormField
{
    public PhoneField(IFormFieldSettings settings) : base(settings)
    {
    }
}

public sealed class PhoneFieldDefinition : FormFieldDefinition<PhoneField>
{
    public override Guid KindId => Guid.Parse("6A7E3C1B-5C0B-4C57-9B5A-3D4B1D6B2F11");

    public override string Name => "Phone";

    public override string Icon => "icon-phone";

    public override string Category => FormFieldConstants.Categories.Inputs;

    // The alias of the back office editor for this field.
    public override string EditorAlias => "my-phone-field";

    public override FormField CreateField(IFormFieldSettings settings)
    {
        return new PhoneField(settings);
    }
}
```

The `Icon` is a name from Umbraco's own icon set (such as `icon-phone`). Formulate 3's `icon-formulate-*` icon font is gone, and the back office shows a generic icon for those names.

The definition can override these features. Each defaults to the value shown.

| Property | Default | Meaning |
| --- | --- | --- |
| `IsTransitory` | `false` | The field is for display or navigation only (such as a Button). Values posted for it are ignored. |
| `IsServerSideOnly` | `false` | The field never goes to the browser. |
| `IsHidden` | `false` | The field is a hidden input. |
| `IsStored` | `true` | The field's value is stored and passed to handlers. |
| `SupportsValidation` | `true` | The editor shows validations for the field. |
| `SupportsLabel` | `true` | The editor shows a label for the field. |
| `SupportsCategory` | `true` | The editor shows a category for the field. |

Field categories are in `FormFieldConstants.Categories`: `Content`, `Inputs`, `Constants`, `Actions`, `Specialized` and `Uncategorized` (the default).

### A field with its own configuration

Use `FormField<TConfig>`. Read the configuration in `CreateField` from `settings.Data`, the JSON the editor saved, with `IJsonUtility` (in `Formulate.Core.Utilities`). Return the configuration for the editor from `GetBackOfficeConfiguration`. Configuration that cannot be read makes the API refuse the save with a 400 that names the item. A stored item whose configuration cannot be read is skipped and logged when the form renders.

### Validating a value on the server

Override `ValidateStrings` (or `ValidateFiles`) on the field. Return the messages for the visitor. The base class runs the field's validations, so call it too:

```csharp
protected override FormFieldValidationResult ValidateStrings(IStringFormFieldValues strings)
{
    var result = base.ValidateStrings(strings);

    // Check strings.GetValues() and add messages to the result.
    return result;
}
```

A field with no validations is still checked by these methods.

## Form handlers

A handler does something with a submission. Derive from `FormHandler` (synchronous) or `AsyncFormHandler`, and from `FormHandlerDefinition`.

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using Formulate.Core.FormHandlers;
using Formulate.Core.Submissions.Requests;
using Microsoft.Extensions.Logging;

public sealed class LogHandler : AsyncFormHandler
{
    private readonly ILogger<LogHandler> _logger;

    public LogHandler(IFormHandlerSettings settings, ILogger<LogHandler> logger) : base(settings)
    {
        _logger = logger;
    }

    public override Task HandleAsync(FormSubmissionRequest submission, CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Form {Form} was submitted.", submission.Form.Name);
        return Task.CompletedTask;
    }
}

public sealed class LogHandlerDefinition : FormHandlerDefinition
{
    private readonly ILoggerFactory _loggerFactory;

    public LogHandlerDefinition(ILoggerFactory loggerFactory)
    {
        _loggerFactory = loggerFactory;
    }

    public override Guid KindId => Guid.Parse("0E2A3C6B-1D6E-4B2B-8D55-5F0E6C8F7A21");

    public override string Name => "Log";

    public override string Icon => "icon-list";

    public override string EditorAlias => "my-log-handler";

    public override string Category => FormHandlerConstants.Categories.Notify;

    public override IFormHandler CreateHandler(IFormHandlerSettings settings)
    {
        return new LogHandler(settings, _loggerFactory.CreateLogger<LogHandler>());
    }

    public override object GetBackOfficeConfiguration(IFormHandlerSettings settings)
    {
        return new { };
    }
}
```

How handlers run:

- Each enabled handler runs on its own. When one throws, Formulate logs the handler's name and the form, and the others still run.
- Handlers run to the end even when the visitor closes the page. The cancellation token is not passed to them.
- A handler whose definition is not installed is skipped with a warning.
- Definitions are created once and live for the whole site. A handler that needs scoped services (such as a database scope) takes an `IServiceScopeFactory` in its definition and opens a scope for each submission, as `StoreDataFormHandlerDefinition` does.
- Do not let a handler's failure change what the visitor sees. Log it, as the built-in handlers do. To stop a submission, use `FormSubmittingNotification`.

The built-in handler kinds are Send Email, Designed Email, Send Data and Store Data.

## Validations

A validation checks values. Derive from `Validation` (or `Validation<TConfig>`) and implement `IValidationDefinition`.

```csharp
using System;
using System.Collections.Generic;
using System.Linq;
using Formulate.Core.Validations;
using Microsoft.Extensions.Primitives;

public sealed class NoUrlsValidation : Validation
{
    public NoUrlsValidation(IValidationSettings settings) : base(settings)
    {
    }

    public override IReadOnlyCollection<string> ValidateStrings(StringValues values)
    {
        return values.Any(x => x.Contains("http")) ? new[] { "Links are not allowed." } : Array.Empty<string>();
    }
}
```

`ValidateFiles` is for upload fields. The definition is a class that implements `IValidationDefinition`. It has no base class, so it also implements `KindId`, `Name`, `IsLegacy` and `EditorAlias`. Its `CreateValidation(PersistedValidation entity)` returns the validation, and `GetBackOfficeConfiguration(PersistedValidation entity)` the editor's configuration.

The browser runs validations too, with a validator registered under the validation's type name (see [the browser section](#changing-how-forms-render-in-the-browser)). The server always runs them again. Regular Expression validations run on the server when `Formulate:Submissions:EnableServerSideValidation` is `true` (the default). The setting does not affect Mandatory validations. The server and the browser can disagree on a few characters: .NET's ECMAScript `\s` is narrower than JavaScript's, and does not match no-break space or U+2028 and U+2029.

A validation of a kind that is not installed is skipped, with a warning that names the field and the validation.

## Data values

Data values are lists of items for fields such as drop downs and radio button lists. Derive from `DataValuesDefinition`:

- `CreateDataValues(PersistedDataValues entity)` returns an `IDataValues` (`new DataValues(entity, items)`, where `items` is a list of `KeyValuePair<string, string>`).
- `GetBackOfficeConfiguration(PersistedDataValues entity)` returns the editor's configuration.

`IGetDataValuesItemsUtility.GetValues` takes a `fieldId` (new in 5.0). Fields with a data values reference that is missing log a warning.

## Layouts and templates

A layout places a form's fields in rows and cells. Implement `ILayoutDefinition` (see `BasicLayoutDefinition` for an example). A new layout starts in the back office with the configuration `GetDefaultConfiguration()` gives. By default that is what `GetBackOfficeConfiguration` gives for a layout stored without one. A layout is shown by a template. A template is a Razor view in a view component folder:

```csharp
using System;
using Formulate.Core.Templates;

public sealed class MyTemplateDefinition : TemplateDefinition
{
    public override Guid KindId => Guid.Parse("2B0A6F8E-8B53-4F8A-9F5C-0B9A6C7D4E33");

    public override string Name => "My template";

    // The view is Views/Shared/Components/FormulateForm/My template.cshtml, without the extension.
    public override string ViewName => "My template";
}
```

Register it in a composer:

```csharp
builder.TemplateDefinitions().Append<MyTemplateDefinition>();
```

`FormulateFormViewComponent` looks the view up by `ViewName`. Its model is `FormLayoutRenderModel`. A layout needs a template to render. A layout saved without one gets the default template, and a layout with an unknown template is refused. Set the default with `Formulate:BackOffice:DefaultTemplateId`. A site with no template installed cannot render forms.

## Back office editors

Each definition names a back office editor with its `EditorAlias`. The back office is built with Umbraco's own UI elements, and an editor for a custom kind is an Umbraco extension: a manifest, and an element that shows the kind's settings. This part of the guide describes the contract between Formulate and such an editor.

### Three manifest types, and how an editor is found

| Extension type | Edits the settings of | Shown in |
| --- | --- | --- |
| `formulateFieldEditor` | a form field kind | the dialog of a field |
| `formulateHandlerEditor` | a form handler kind | the dialog of a handler |
| `formulateLayoutEditor` | a layout kind | the Design view of a layout, under the template |

Validations and data values have the same kind of editor (`formulateValidationEditor` and `formulateDataValuesEditor`), shown on the page of the validation or data values item. They work the same way, apart from `context`, which they do not get.

A manifest's `meta.editorAlias` must be the `EditorAlias` of the definitions it edits. The back office reads each definition's `EditorAlias` from the definitions endpoints, then shows the editor of the same extension type whose `meta.editorAlias` matches. Several kinds can share one editor by giving the same `EditorAlias`: Formulate's Drop Down and Checkbox List do.

- When two editors of a type have the same alias, the one with the highest `weight` is used. An editor can replace another with `overwrites`, as with any Umbraco extension.
- Editors that arrive later, such as from a package that loads after Formulate, are shown when they arrive.
- When no editor matches, or the definition has no `EditorAlias`, the dialog or view shows "This kind has no settings." and leaves the stored configuration as it is. Kinds that store nothing, such as Checkbox and Date, rely on this.
- When an editor matches but cannot be shown (its element fails to load, or its conditions do not allow it), the back office says "The editor for this kind is not available, so its settings cannot be changed here.", logs the reason to the browser console, and still leaves the configuration alone.
- A kind that is not installed has no definition, so it has no editor. Its configuration is kept as it is.

### The element

An editor is a custom element. Register it with the manifest's `element` (the path of a JavaScript module whose default export is the element class, or an `import()` function) and, if you need them, `weight`, `overwrites` and `conditions`. Formulate sets these properties on it:

| Property | What it is |
| --- | --- |
| `value` | The kind's configuration, exactly as the API stores it: whatever JSON your definition reads, or `undefined` (or `null`) when the item has none yet. |
| `context` | Where the editor is shown: `{ formFields, formId }`. `formFields` are the fields of the form being edited (a handler editor can offer them to pick from). `formId` is the form's id, and is missing while the form is new and not yet saved. A layout always has a form. Validation and data values editors get no `context`. |
| `readonly` | `true` when nothing may be changed. |
| `manifest` | The editor's own manifest, so one element can serve several aliases and read its `meta`. |

The back office sets `value`, `context` and `readonly` again whenever they change, so the element shows what it is given each time.

To save a change, the element sets `value` to the new configuration and then dispatches a `change` event from itself. Formulate takes the element's `value` as the new configuration. It listens only for the `change` event that comes from the element itself, so an input inside your element can fire its own `change` without Formulate taking it for a save. While `readonly` is `true`, Formulate takes no change and gives the element its old `value` back.

Two rules keep configuration safe:

- **Never store on first render.** Do not set `value` or dispatch `change` when the element appears or is given a value, even to fill in defaults. It would count as a change by the user, so merely opening an item would mark it changed and could save settings nobody chose. Show defaults in the interface, and store them only when the user changes something.
- **Keep the keys you do not edit.** Build each new value from the old one, as in `{ ...this.value, autocomplete: input.value }`. A configuration made by a newer version of your definition, or by hand, can have keys your editor does not know, and they must survive a save. Make a new object for each change. Do not change the old one: Umbraco freezes the data its workspaces hold, so the value an editor is given can be frozen.

### The contract is duck-typed for now

Formulate publishes no import map and no TypeScript types for these extension types yet. An editor is therefore a plain custom element that imports nothing from Formulate: it needs only the properties and the `change` event above. The built-in editors extend a base class inside Formulate's own bundle (`FormulateKindEditorElementBase`, whose `updateValue` sets `value` and dispatches the event), which another package cannot import. A plain element does the same two steps by hand. If you use Lit or Umbraco's own base classes, take them from Umbraco as usual.

### An editor for a field or a handler

The worked example is under [an editor for the field's settings](#an-editor-for-the-fields-settings), in the guide to a custom field. It registers a `formulateFieldEditor`, edits one setting, keeps the others, and stores nothing until the user changes the input. Formulate runs the same element in its own tests (`src/Formulate.BackOffice/Client/src/core/plain-element-kind-editor.test.ts`), so the example is kept in one place.

A handler editor is written the same way, with the type `formulateHandlerEditor` and the handler definition's `EditorAlias`. It can read `context.formFields` to offer the form's fields.

### An editor for a custom layout

A custom layout kind gets its editor the same way: implement `ILayoutDefinition`, give it an `EditorAlias`, and register a `formulateLayoutEditor` whose `meta.editorAlias` is that alias. Its `value` is the layout's configuration, whatever JSON your definition reads. A new layout starts with the configuration `GetDefaultConfiguration()` gives (see [Layouts and templates](#layouts-and-templates)). `context` is `{ formFields, formId }` for the layout's form, so the editor can lay out those fields. The template choice is above your editor and is not yours to draw. Formulate's Basic layout editor is the built-in example (`src/Formulate.BackOffice/Client/src/editors/layouts/basic`).

### The Management API

The back office talks to the server through the Umbraco Management API, at `/umbraco/management/api/v1/formulate/...`. The OpenAPI document is named `formulate`. Formulate's package does not register Swagger or any OpenAPI library, so it does not conflict with the one Umbraco uses on 17 (Swashbuckle) and on 18 and later (`Microsoft.AspNetCore.OpenApi`). Formulate's section alias is `Formulate.Section`. Calls need a signed in back office user. Changing anything needs the Formulate section.

## Fields that check with a service, or write their value

Two optional interfaces on a field give it more behavior. Neither is needed for ordinary fields.

### `IVerifiedFormField`

Implement it on the field class for a check that needs the network. The reCAPTCHA field uses it.

```csharp
Task<FormFieldValidationResult> VerifyAsync(IFormFieldValues values, CancellationToken cancellationToken);
```

Formulate calls it only after every field of the form passed its synchronous validation, so a single-use token is not spent on a form the visitor has to fix. The token is cancelled when the visitor goes away. Return a `FormFieldValidationResult` with messages, or one with none when the field is valid.

### `IFormFieldValueFormatter`

Implement it on the field's definition to change how the value is written for people and receivers. The Send Email handler and Send Data call it. Designed Email views get the posted values unchanged. Store Data always keeps the posted value.

```csharp
string FormatValue(string value);
```

The Date field uses it to write `MMMM dd, yyyy` in the submission's culture. A definition that does not implement it has values written as posted.

## The submission pipeline

These services are in `Formulate.Core.Utilities.Submissions`. Replace one with your own implementation by registering yours in a composer after Formulate's. Most sites do not need to.

| Service | Does |
| --- | --- |
| `IBuildFormSubmissionFields` | `Build(FormSubmissionRequest)` creates the form's fields once for the submission. |
| `IValidateFormSubmissionRequest` | `Validate(request, fields)` runs each built field's validation. |
| `IVerifyFormSubmissionRequest` | `VerifyAsync(request, fields, cancellationToken)` runs the checks that need the network. Call it only when `Validate` found no errors. |
| `ISubmitFormSubmissionRequest` | `SubmitAsync(request, cancellationToken)` publishes `FormSubmittingNotification`, then runs the form's enabled handlers. It returns a result object (success, or the errors) instead of a bool. |
| `ISubmissionPageResolver` | Finds the page a submission came from (its URL and name). Email, Send Data and Store Data share it. |

`IValidateFormSubmissionRequest.Validate` and `IVerifyFormSubmissionRequest.VerifyAsync` take the built fields.

The order is: build the fields, validate, verify (when valid), submit.

Uploads are accepted only for Upload fields, one file each, within `Formulate:Submissions:MaxUploadBytes`.

## Notifications

Formulate uses Umbraco's notification system. Write a class that implements `INotificationHandler<T>` (or `INotificationAsyncHandler<T>`) and register it in a composer with `builder.AddNotificationHandler<TNotification, THandler>()`.

| Notification | When | What a handler can do |
| --- | --- | --- |
| `FormSubmittingNotification` (`Formulate.Core.Notifications`) | After validation, before any handler runs. | Read the request, add to `Request.ExtraContext`, or cancel with `notification.CancelSubmission("message")`. No handler runs and the visitor sees the message. The first message is kept when several handlers cancel. |
| `EntitySavingNotification<T>` and `EntitySavedNotification<T>` (`Formulate.Core.Notifications`) | When forms, layouts, folders, validations or data values are saved. | `IsNew` says whether the entity is stored for the first time. Construct them with the `isNew` argument. The constructors without it are gone. |
| `SendingDataNotification` (`Formulate.Extensions.SendData.Notifications`) | Before Send Data sends. | Change `Data`, add `Headers` (such as an API key), or set `Cancel`. It replaces Formulate 3's `SendingData` and `SerializingJson` events. |
| `SentDataNotification` (`Formulate.Extensions.SendData.Notifications`) | After Send Data sent, whatever came back. | Read `StatusCode`, `ResponseBody` (at most the first 1 MiB, see `IsBodyTruncated`), `Error` and `IsSuccess`. It replaces Formulate 3's result handler, which was a type name created by reflection. |

Store Data and the email handlers publish no notifications of their own. To change an email, handle Umbraco's `SendEmailNotification`, which Formulate's email handlers go through. When a site handles it, it sends the email itself.

`FormSubmittingNotification`'s `Request` is a `FormSubmissionRequest`: the `Form`, the `PageId` (null when the form is not on a content page), the posted `FieldValues` and `FilesValues` by field id, and `ExtraContext`.

## Changing how forms render in the browser

The Plain JavaScript template writes each form's data into the page, and a script in the browser (the renderer) builds the form from it. The renderer is a set of small JavaScript modules, not one bundle, so your own scripts can import its parts and build field renderers on the built-in ones.

- [The renderer's files](#the-renderers-files)
- [Importing the renderer's modules](#importing-the-renderers-modules)
- [Registering a renderer or a validator](#registering-a-renderer-or-a-validator)
- [A renderer built on a built-in one](#a-renderer-built-on-a-built-in-one)
- [A renderer from scratch](#a-renderer-from-scratch)
- [Add a validator](#add-a-validator)
- [Scripts that are not modules](#scripts-that-are-not-modules)
- [The server side of a custom field](#the-server-side-of-a-custom-field)
- [Caching](#caching)
- [Loading the renderer yourself](#loading-the-renderer-yourself)
- [What the renderer's API exports](#what-the-renderers-api-exports)
- [Events](#events)
- [Other hooks](#other-hooks)

### The renderer's files

The renderer's files are in `/App_Plugins/Formulate/PlainJavaScript/` (under the site's path base, if it has one). Each module comes twice, side by side:

- `name.js` is readable, with its comments. Read it to see what its minified twin does. There are no source maps.
- `name.min.js` is minified. Formulate loads these, and your scripts should import these too.

The minified files import only minified files, and the readable files only readable ones. For TypeScript, each module has `name.d.ts`, and `name.min.d.ts` re-exports it. To use them in a TypeScript project, copy the `.d.ts` files into it (the `Umbraco.Community.Formulate.Extensions.PlainJavaScriptTemplate` package has them in `staticwebassets/App_Plugins/Formulate/PlainJavaScript/`), and map the URL your imports use to the copy with a `paths` entry in `tsconfig.json`. A `declare module` does not work here, because TypeScript treats a name that starts with `/` as a relative path.

```json
{
  "compilerOptions": {
    "paths": {
      "/App_Plugins/Formulate/PlainJavaScript/*": ["./types/formulate/*"]
    }
  }
}
```

With that, `import { RenderText } from "/App_Plugins/Formulate/PlainJavaScript/api.min.js"` gets its types from `types/formulate/api.min.d.ts`.

| File | What it is |
| --- | --- |
| `formulate.min.js` | The entry. It renders the forms on the page, exports the API and puts it on `window.formulatePlainJs`. The view loads it. |
| `api.min.js` | The API. It exports the same as the entry, and importing it starts nothing. Import this one. |
| `fields/` | The built-in field renderers, such as `fields/plain-text.min.js`. |
| `validators/` | The built-in validators. |
| `steps/` | The steps that render and submit a form. |
| `utils/` | Helpers, such as the base class of the renderers (`utils/field.min.js`) and the validation helpers (`utils/validation.min.js`). |
| `types.d.ts` | The types of the data the server sends, and of the renderer and validator contracts. It has no script. |
| `modules.json` | The list of every minified module, the entry first. |
| `themes/` | The [Basic theme](plain-javascript-theme.md). |

Importing any module other than `formulate.min.js` starts nothing. On each page with a form, the view adds a `<link rel="modulepreload">` for each module in `modules.json`, then `<script type="module" src="/App_Plugins/Formulate/PlainJavaScript/formulate.min.js">`, once however many forms the page has. The links let the browser ask for every module at once, instead of finding the imports one level at a time.

### Importing the renderer's modules

Your script is a module script. Load it on the pages that have forms, after or before the form:

```html
<script type="module" src="/scripts/phone-field.js"></script>
```

In it, import from `api.min.js` by its URL:

```js
import { RenderText, registerFieldRenderer } from "/App_Plugins/Formulate/PlainJavaScript/api.min.js";
```

- Import the `.min.js` files, by the URL the renderer uses. A browser loads a module once for each URL, so the readable `api.js`, or `api.min.js` with a query string, would be a second copy of the renderer's code. Registrations still reach the renderer, because they go on the window, but the page loads the modules twice.
- On a site with a path base, such as `/site`, put it in the URL (`/site/App_Plugins/...`), or import with a path relative to your own script.
- If you bundle your scripts, leave Formulate's modules out of the bundle and import them by URL (most bundlers call these "external" imports).

### Registering a renderer or a validator

`registerFieldRenderer(key, renderer)` registers a renderer class for a field type, such as `phone`. `registerValidator(key, validator)` registers a validator class for a validation type, such as `required`. A registration replaces the built-in one with the same key, and a later registration for a key replaces an earlier one. A key that is not text, or a renderer or validator that is not a class, throws a `TypeError`.

Register before the forms render. The renderer renders the page's forms at `DOMContentLoaded`, and every module script (unless it has `async`) and every script with `defer` runs before that, wherever it is on the page. A renderer registered later is used by the forms rendered after it (such as forms pushed onto `window["formulate-plain-js-forms"]`), and when a form on the page already rendered a field of that type, the console shows a warning. Validators work the same way.

The registrations go on `window["formulate-plain-js-fields"]` and `window["formulate-plain-js-validators"]`, the lists Formulate 3 used, so every copy of the renderer on the page sees them. See [scripts that are not modules](#scripts-that-are-not-modules).

The built-in field types are `text`, `button`, `rich-text`, `checkbox`, `textarea`, `hidden`, `select`, `header`, `upload`, `checkbox-list`, `date`, `radio-list`, `extended-radio-list` and `recaptcha`. The modules in `src/Formulate.Extensions.PlainJavaScriptTemplate/Client/src/fields` define them. The C# side maps each built-in field to its key (the `Mapping/FormFields` folder), so a key is not always the class name.

The radio button list and the extended radio button list add the orientation chosen in the back office to their fieldset: `formulate__field--radio-list--horizontal` or `formulate__field--radio-list--vertical`, and `formulate__field--extended-radio-list--horizontal` or `formulate__field--extended-radio-list--vertical`. The letter case of the setting does not matter. A list left on "As the template lays them out", or with a value the renderer does not know, gets neither class and is laid out as the template or theme lays it out. The class is built from the field's type, so a custom field that extends the radio list renderer gets `formulate__field--<its type>--horizontal` or `--vertical`.

The reCAPTCHA field loads Google's script only when a site key is set (`Formulate:Recaptcha:SiteKey`). Without one, no script is added, the field is an empty `formulate__field--recaptcha` wrapper (without the `g-recaptcha` class or a `data-sitekey`), and the console shows one warning for the page.

### A renderer built on a built-in one

A phone field is a text field with the input type `tel`. This is the whole renderer:

```js
import { RenderText, registerFieldRenderer } from "/App_Plugins/Formulate/PlainJavaScript/api.min.js";

class RenderPhone extends RenderText {
  static inputType = "tel";
}

registerFieldRenderer("phone", RenderPhone);
```

Everything else comes from `RenderText`: the label, the wrapper with its classes (`formulate__field formulate__field--phone`), the placeholder, the validation messages and what the field posts. `RenderDate` is built the same way. The dev site has this sample (`src/Website/wwwroot/scripts/phone-field.js`, with its C# side in `src/Website/SampleFields`), and a browser test checks it.

Any built-in renderer can be extended: see [what the API exports](#what-the-renderers-api-exports).

### A renderer from scratch

Extend `FieldRendererBase`, and in the constructor call `initializeField`:

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

The base class sets up the field's validators. `initializeField` makes the element, its label and its wrapper, with the classes and the placeholder the built-in fields have. Then the base class does the rest:

- `getValue()` gives the field's value: the element's value for an input, select or textarea, and `undefined` (nothing) for any other element. Override it for any other value.
- `setData(data, options)` posts `getValue()`. An array is posted one item at a time, and `undefined` posts nothing.
- `checkValidity()` checks `getValue()` with the field's validators and shows their messages in the field. A value of `undefined` is always valid. The static `validatorMethod` says which validator method checks the value: `"validateText"` (the default), `"validateBool"`, `"validateTextArray"` or `"validateFile"`.

The constructor gets the field's data (`fieldData`, with `id`, `alias`, `label`, `fieldType`, `validations`, `configuration` and `initialValue`), the validator classes by validation type, the CSS classes for the wrapper, and `{ formElement, placeholderElement, stepIndex }`.

`initializeField` takes these options:

| Option | Default | What it does |
| --- | --- | --- |
| `nodeName` | `"input"` | The element to make. |
| `type` | none | Its `type` attribute. |
| `name`, `value` | none | Its `name` and `value` attributes. |
| `cssClasses` | none | The wrapper's classes. Pass the constructor's `cssClasses`. |
| `usePlaceholder` | `true` | Use the label as the placeholder. |
| `useLabel` | `true` | Make a label for the element. |
| `useWrapper` | `true` | Put the element and its label in a wrapper. |
| `wrapperElementType` | `"div"` | The wrapper to make. |
| `wrapperElement` | none | A wrapper that exists already, such as the fieldset from `initializeGroup`. |
| `nestFieldInLabel` | `false` | Put the element inside its label. |
| `fieldBeforeLabelText` | not set | Where the element goes. Not set or `true`, it goes before its label, and `false` puts it after. Inside a label, `true` puts it before the label's text, and otherwise it goes after the text. |
| `wrapLabelText` | `false` | Put the label's text in a span (`formulate__field__label-text`). |
| `label` | the field's label | The label's text. |
| `label2` | none | A second text after the label's text, used with `wrapLabelText` (the extended radio buttons' descriptions). |

The checkbox and radio button lists call `initializeField` once for each item, with `wrapperElement` (the fieldset), `nestFieldInLabel`, `wrapLabelText` and `fieldBeforeLabelText: true`.

`initializeGroup(cssClasses)` makes a fieldset with a legend, for a field made of several inputs. A widget with a value of its own overrides `getValue`:

```js
class RenderRating extends FieldRendererBase {
  constructor(fieldData, fieldValidators, cssClasses) {
    super(fieldData, fieldValidators);
    this.rating = 0;
    const fieldset = this.initializeGroup(cssClasses);
    for (let stars = 1; stars <= 5; stars++) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = `${stars} stars`;
      button.addEventListener("click", () => { this.rating = stars; });
      fieldset.appendChild(button);
    }
  }

  getValue() {
    return this.rating === 0 ? "" : String(this.rating);
  }
}
```

A renderer does not have to extend anything. A class with `getElement()` works, as in Formulate 3, and `setData(data, options)`, `checkValidity()` and `toggleSubmitButton(enabled)` are optional. `setData` gets a `FormData` (append the value under the field's `id`) or, when `options.rawDataByAlias` is set, an object (set the value under the field's `alias`).

A field with no renderer is skipped, and a warning is written to the console.

### Add a validator

A validator is a class whose constructor takes the validation's configuration. Its methods `validateText`, `validateBool`, `validateTextArray` and `validateFile` each return true, or a promise of true, when the value is valid. A missing method counts as valid. The message shown is the one configured on the validation.

```js
import { registerValidator } from "/App_Plugins/Formulate/PlainJavaScript/api.min.js";

class NoPizzaValidator {
  validateText(value) {
    return !/pizza/i.test(value ?? "");
  }
}

registerValidator("no-pizza", NoPizzaValidator);
```

A validation type with no validator is checked only by the server, and a warning is written to the console. See [Validations](#validations) for the server side. A validation's type name and configuration come from a map, as for fields: `ValidationMapDefinition<T>` and `PlainJavaScriptValidation`.

### Scripts that are not modules

The window lists work in any script that runs before `DOMContentLoaded`, as in Formulate 3:

```html
<script>
  window["formulate-plain-js-fields"] = window["formulate-plain-js-fields"] || [];
  window["formulate-plain-js-fields"].push({ key: "star-rating", renderer: StarRating });
</script>
```

Push onto the list, as above. Assigning the list replaces it, and with it every registration made before, such as one a module made with `registerFieldRenderer`. Formulate 3's single registration (`window["formulate-plain-js-fields"] = { key, renderer }`) is an assignment, so it works only in a script that runs before any other registration. The validators' list, `window["formulate-plain-js-validators"]`, works the same way.

`window.formulatePlainJs` holds the API, with `version`, once `formulate.min.js` has run. A script that is not a module can use it when it runs after the renderer: a script file with `defer` placed after the form. (A script in the page itself runs as the page is read, before the renderer.)

```js
// phone-field-classic.js, loaded with <script src="/scripts/phone-field-classic.js" defer></script> after the form.
const { RenderText, registerFieldRenderer } = window.formulatePlainJs;

class RenderPhone extends RenderText {
  static inputType = "tel";
}

registerFieldRenderer("phone", RenderPhone);
```

### The server side of a custom field

A custom field needs these parts. The dev site's sample (`src/Website/SampleFields`) has them all.

1. The field and its definition, as in [Form fields](#form-fields): `PhoneField` and `PhoneFieldDefinition`. Formulate finds the definition when the site starts.
2. A map to `PlainJavaScriptFormField`, which says what the browser gets for the field: its field type (the key the renderer is registered under) and, if you like, a configuration.

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

   To send a configuration, pass it first: `new PlainJavaScriptFormField(new { autocomplete = "tel" }, "phone")`. The renderer reads it as `fieldData.configuration`. A field with no map of its own gets a field type from its class name: lower case, with `field` taken out, so `PhoneField` becomes `phone`.
3. A composer that adds the map:

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

4. The renderer, as in [a renderer built on a built-in one](#a-renderer-built-on-a-built-in-one), loaded on the pages that have forms.
5. A back office editor for the field's settings, if it has any. It is optional: a field whose `EditorAlias` has no editor shows "No settings". See [the editor](#an-editor-for-the-fields-settings) below.

The server checks the field's validations again when the form is submitted, and Store Data and the other handlers get its value like any other field's.

#### An editor for the field's settings

An editor is an Umbraco back office extension of the type `formulateFieldEditor`, whose `meta.editorAlias` is the definition's `EditorAlias`. Register it in an `umbraco-package.json` in your site's `App_Plugins` folder:

```json
{
  "name": "My Fields",
  "extensions": [
    {
      "type": "formulateFieldEditor",
      "alias": "My.FieldEditor.Phone",
      "name": "Phone field editor",
      "element": "/App_Plugins/MyFields/phone-field-editor.js",
      "meta": { "editorAlias": "my-phone-field" }
    }
  ]
}
```

The element gets these properties:

- `value`: the field's configuration as it is saved (any JSON your field reads), or nothing for a new field. Keep the settings you do not edit, and set a new object for each change rather than changing the old one.
- `readonly`: true when nothing may be changed.
- `context`: where the editor is shown, such as `{ formId, formFields }`.

After each change, the element sets `value` to the new configuration and dispatches a `change` event from itself. The back office sets `value` and `readonly` again whenever they change, so the element shows them each time. A test in the back office (`src/Formulate.BackOffice/Client/src/core/plain-element-kind-editor.test.ts`) runs this editor.

```js
// /App_Plugins/MyFields/phone-field-editor.js
export default class PhoneFieldEditor extends HTMLElement {
  #value;
  #readonly = false;
  #input = document.createElement("input");

  constructor() {
    super();
    this.#input.addEventListener("change", () => {
      // A new object, which keeps the settings this editor does not edit.
      this.#value = { ...this.#value, autocomplete: this.#input.value };
      this.dispatchEvent(new Event("change"));
    });
  }

  get value() {
    return this.#value;
  }

  set value(value) {
    this.#value = value;
    this.#update();
  }

  get readonly() {
    return this.#readonly;
  }

  set readonly(readonly) {
    this.#readonly = readonly;
    this.#update();
  }

  connectedCallback() {
    this.append(this.#input);
    this.#update();
  }

  #update() {
    this.#input.value = this.#value?.autocomplete ?? "";
    this.#input.disabled = this.#readonly;
  }
}

customElements.define("my-phone-field-editor", PhoneFieldEditor);
```

The field reads the saved configuration in its definition's `CreateField`, as in [a field with its own configuration](#a-field-with-its-own-configuration).

### Caching

Formulate sends `Cache-Control: no-cache` with every file in `/App_Plugins/Formulate/PlainJavaScript/` that Umbraco serves, and it replaces any other `Cache-Control` that Umbraco's static file settings give those files. The files have no version in their URLs, so that each module has one URL. A browser keeps its copy, but checks with the server each time it uses it, and the server answers `304 Not Modified` when the file has not changed. After you upgrade Formulate, visitors get the new files with their next page.

- The theme follows the same rule: its URL has no version either.
- Static file middleware that your site adds before `app.UseUmbraco()` serves the files before Umbraco sees the request, so Formulate cannot set the header. Do not give this folder long-lived caching there: with one URL for each file, visitors would keep old modules after an upgrade.
- A CDN or proxy in front of the site should keep to `no-cache` too, or be cleared when you deploy.
- Your own scripts can have a version in their URLs (`/scripts/phone-field.js?v=2`). The URLs they import Formulate's modules by must not.

### Loading the renderer yourself

With `Formulate:PlainJavaScript:IncludeScript` set to `false`, the view adds no script and no preload links, and you add them. `IPlainJavaScriptAssets` gives the URLs:

```cshtml
@inject Formulate.Extensions.PlainJavaScriptTemplate.Core.IPlainJavaScriptAssets FormulateAssets
@foreach (var url in FormulateAssets.GetModuleUrls(Context.Request.PathBase))
{
    <link rel="modulepreload" href="@url" />
}
<script type="module" src="@FormulateAssets.GetScriptUrl(Context.Request.PathBase)"></script>
```

The script tag needs `type="module"`, as `formulate.min.js` is a module. Load it once per page. `GetModuleUrls` is empty when `modules.json` is missing or cannot be read (a warning is logged), and the forms still work, only more slowly. The site reads `modules.json` once, so it picks up a changed list when it restarts. Until then, an old list only means some preloads are not needed or are missing: the imports still load the right files.

### What the renderer's API exports

`api.min.js` (in `/App_Plugins/Formulate/PlainJavaScript/`) exports the renderer's API, and importing it starts nothing. `formulate.min.js` exports the same names, and `window.formulatePlainJs` holds them too, with `version`.

<!-- The renderer's tests (Client/test/api.test.ts) check that these two tables list exactly what api.js exports. -->
<!-- api-exports:start -->
| Export | What it is |
| --- | --- |
| `registerFieldRenderer(key, renderer)` | Registers a renderer class for a field type, such as `phone`. It replaces the built-in renderer with that key. |
| `registerValidator(key, validator)` | Registers a validator class for a validation type, such as `required`. |
| `renderForm(form, placeholder)` | Renders one form's data in place of a placeholder element, and returns the form element. |
| `FieldRendererBase` | The base class of the built-in renderers. |
| `RenderText` | The `text` field. Its `static inputType` (`"text"`) is the input's type. |
| `RenderTextarea` | The `textarea` field. |
| `RenderDate` | The `date` field: `RenderText` with the `inputType` `"date"`. |
| `RenderSelect` | The `select` field (a drop down). |
| `RenderCheckbox` | The `checkbox` field. Its value is `true` or `false`. |
| `RenderCheckboxList` | The `checkbox-list` field. Its value is the array of checked values. |
| `RenderRadioList` | The `radio-list` field. |
| `RenderExtendedRadioList` | The `extended-radio-list` field: radio buttons with descriptions. |
| `RenderUpload` | The `upload` field. Its value is the chosen `File`. |
| `RenderHidden` | The `hidden` field. |
| `RenderHeader` | The `header` field. It posts nothing. |
| `RenderRichText` | The `rich-text` field. It posts nothing. |
| `RenderButton` | The `button` field: a submit, next or previous button. |
| `RenderRecaptcha` | The `recaptcha` field. |
| `RegexValidator` | The `regex` validator. |
| `RequiredValidator` | The `required` validator. |
| `setData(data, value, options, alias, id)` | Adds a value to the submission: to the `FormData` under the field's ID, or to the values by alias. |
| `getInitialValues(field)` | The field's initial values (such as a value from the query string), as an array. |
| `prepareValidators(validations, fieldValidators)` | Creates a validator for each of a field's validations. The base class does this for you. |
| `checkValidityCommon(renderer, validators, value, container, method)` | Runs the validators' `method` (such as `validateText`) on the value and shows the messages in the container. |
| `checkTextValidity(renderer, validators, value, container)` | `checkValidityCommon` with `validateText`. |
| `checkTextArrayValidity(renderer, validators, value, container)` | `checkValidityCommon` with `validateTextArray`. |
| `checkBoolValidity(renderer, validators, value, container)` | `checkValidityCommon` with `validateBool`. |
| `checkFileValidity(renderer, validators, value, container)` | `checkValidityCommon` with `validateFile`. |
| `showFieldValidity(renderer, container, validity)` | Shows a field's messages and error class, or removes them when it is valid. |
| `addValidationMessages(container, messages, priorList)` | Replaces the list of messages in a container. |
| `toFieldValidity(outcome)` | Turns what a validator or a `checkValidity` returned into `{ success, messages }`. |
| `resolveFieldValidity(check)` | Waits for a `checkValidity` result (a promise, or an array of them) and turns it into `{ success, messages }`. |
| `addClasses(element, cssClasses)` | Adds CSS classes to an element, skipping empty names. |
| `generateId(prefix)` | Makes an element ID that is unique on the page. |
| `FormulateEvents` | The names of the events below. |
| `dispatchFormEvent(target, name, detail, cancelable)` | Dispatches a custom event that bubbles, and returns it. |
<!-- api-exports:end -->

The types (for TypeScript, from `api.d.ts`) are every type in `types.d.ts`, such as `FormulateField`, `FieldRenderer` and `FieldValidator`, plus these:

<!-- api-types:start -->
| Type | What it is |
| --- | --- |
| `InitializeFieldOptions` | The options of `FieldRendererBase`'s `initializeField`. |
| `PreparedValidator` | A validator made for one of a field's validations, with that validation's data. |
| `FieldValidity` | A field's `{ success, messages }`. |
<!-- api-types:end -->

### Events

The renderer dispatches events on the form's `.formulate-wrapper` element. They bubble, and their names are the same as in Formulate 3.

| Event name | When | Detail |
| --- | --- | --- |
| `formulate: submit: started` | The visitor starts a submit. | |
| `formulate: validation: success` | Every field is valid. | `{ cancelSubmit, fields, payload }`. A listener can cancel or change the submission. |
| `formulate: submit: cancelled` | A listener cancelled it. | |
| `formulate form: submit: success` | The server accepted the submission. | `{ dataByAlias }` |
| `formulate form: submit: failure` | The server answered with anything but success (every unsuccessful response). | |
| `formulate: submit: validation errors` | The server (or the form) reports errors. | `{ messages, isStep }`. Call `preventDefault()` to hide the built-in summary. |
| `formulate: submit: next`, `formulate: submit: previous` | The visitor moves between steps. | |
| `formulate: validation: next: success` | A step is valid. | `{ fields, payload }` |

### Other hooks

- `window["formulate-plain-js-forms"]` is the queue of forms. Once the renderer has started, pushing a form onto it renders the form straight away, so forms added to the page later (for example in a dialog) work.
- `renderForm(form, placeholder)` (also `window.formulatePlainJs.renderForm`) renders one form in place of a placeholder element.
- `window.formulateMultiStepAnimationDelay` (milliseconds, default 500) sets how long the step animation classes stay on.
- `window.labelAfterTextInput = false` places text inputs after their labels (Formulate 3's option).
- The theme has its own setting. See [the Basic theme](plain-javascript-theme.md).
- Custom validation messages and the reCAPTCHA and Date visitor messages are fixed English text for now.

## Compatibility rules

Formulate's packages are built against Umbraco 17.6 and run on 17, 18 and 19. If your extension also needs to run on all three:

- Do not call members Umbraco 18 moved from `IPublishedContent` to `IPublishedElement`: `Id`, `Name`, `SortOrder`, `CreatorId`, `CreateDate`, `WriterId`, `UpdateDate`, `Cultures` and `ItemType`. The source compiles against both, but an assembly built against 17 throws `MissingMethodException` on 18 when it runs the call. Use `Key` (with `IIdKeyMap`) or an extension method.
- Do not use an `[Obsolete]` member. Formulate's own build treats using one as an error.
- Do not register an OpenAPI or Swagger library in a package. Umbraco 18 replaced the library that 17 uses, and a package that registers the old one crashes an 18 site when it starts.

`src/Formulate.CompatibilityCheck` is a small tool that reads built assemblies and confirms that every Umbraco member they use exists in Umbraco 18 and 19. Run it on your own assemblies in the same way as `.github/workflows/ci.yml` does.
