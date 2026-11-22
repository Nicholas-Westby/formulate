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

The built-in handler kinds are Email, Designed Email, Send Data and Store Data.

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

<!-- pass 2: the editor contract. Describe the kind editor extension types in TypeScript, how a definition's EditorAlias selects the editor, how the editor receives and saves configuration, manifests, and a worked example for a custom field. Source: Plan C Task 3's kind-editor contract and src/Formulate.BackOffice/Client/src/core/kind-editor.ts and extension-types.ts. -->

Each definition names a back office editor with its `EditorAlias`. The new back office is built with Umbraco's own UI elements, and custom editors for custom kinds are written as Umbraco extensions. This part of the guide comes with the back office documentation.

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

Implement it on the field's definition to change how the value is written for people and receivers. The Email handler and Send Data call it. Designed Email views get the posted values unchanged. Store Data always keeps the posted value.

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

Store Data and the Email handlers publish no notifications of their own. To change an email, handle Umbraco's `SendEmailNotification`, which Formulate's email handlers go through. When a site handles it, it sends the email itself.

`FormSubmittingNotification`'s `Request` is a `FormSubmissionRequest`: the `Form`, the `PageId` (null when the form is not on a content page), the posted `FieldValues` and `FilesValues` by field id, and `ExtraContext`.

## Changing how forms render in the browser

The Plain JavaScript template writes each form's data into the page and loads one script, `/App_Plugins/Formulate/PlainJavaScript/formulate.js`. The script builds the form. Everything below runs in the browser, before or after that script loads.

### Add or replace a field renderer

Add registrations to `window["formulate-plain-js-fields"]`: an object, or an array of objects, with a `key` (the field type) and a `renderer` (a class). A registered renderer replaces the built-in one with the same key.

```html
<script>
  window["formulate-plain-js-fields"] = [
    {
      key: "phone",
      renderer: class PhoneRenderer {
        constructor(fieldData, fieldValidators, cssClasses, extraOptions) {
          this.fieldData = fieldData;
          this.input = document.createElement("input");
          this.input.type = "tel";
        }
        getElement() { return this.input; }
        setData(data, options) {
          if (options && options.rawDataByAlias) { data[this.fieldData.alias] = this.input.value; }
          else { data.append(this.fieldData.id, this.input.value); }
        }
        checkValidity() { return { success: true }; }
      }
    }
  ];
</script>
```

- A field with no map of its own gets a field type from its class name: lower case, with `field` taken out. `PhoneField` becomes `phone`. A map (see below) sets it explicitly.
- A renderer needs `getElement()`. `setData`, `checkValidity` and `toggleSubmitButton` are optional.
- A field with no renderer is skipped, and a warning is written to the console.
- The built-in field types are `text`, `button`, `rich-text`, `checkbox`, `textarea`, `hidden`, `select`, `header`, `upload`, `checkbox-list`, `date`, `radio-list`, `extended-radio-list` and `recaptcha`. The modules in `src/Formulate.Extensions.PlainJavaScriptTemplate/Client/src/fields` define them. The C# side maps each built-in field to its key (the `Mapping/FormFields` folder), so a key is not always the class name.

### Add a validator

Add registrations to `window["formulate-plain-js-validators"]`: objects with a `key` (the validation type, such as `required` or `regex`) and a `validator` (a class whose constructor takes the validation's configuration). Its methods `validateText`, `validateBool`, `validateTextArray` and `validateFile` each return true (or a promise of true) when the value is valid. A missing method counts as valid. A validation type with no validator is checked only by the server, and a warning is written to the console.

### Send custom data to the renderer from C#

The data the browser gets is built by mapping definitions (`IMapDefinition`, for Umbraco's mapper). To give a custom field its own field type name or configuration, add a map from your field class to `PlainJavaScriptFormField`:

```csharp
using Formulate.Extensions.PlainJavaScriptTemplate.Core;
using Formulate.Extensions.PlainJavaScriptTemplate.Core.Mapping.FormFields;
using Umbraco.Cms.Core.Mapping;

public sealed class PhoneFieldMapDefinition : FormFieldMapDefinition<PhoneField>
{
    protected override PlainJavaScriptFormField Map(PhoneField field, MapperContext context)
    {
        return new PlainJavaScriptFormField(new { pattern = "[0-9 +-]+" }, "phone");
    }
}
```

Register it in a composer with `builder.MapDefinitions().Add<PhoneFieldMapDefinition>()`. The configuration is passed to the renderer as `fieldData.configuration`. Validations map the same way (`ValidationMapDefinition<T>` and `PlainJavaScriptValidation`).

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

- `window["formulate-plain-js-forms"]` is the queue of forms. After the script loads, pushing a form onto it renders the form straight away, so forms added to the page later (for example in a dialog) work.
- `window.formulatePlainJs.renderForm(form, placeholder)` renders one form into an element.
- `window.formulateMultiStepAnimationDelay` (milliseconds, default 500) sets how long the step animation classes stay on.
- `window.labelAfterTextInput = false` places text inputs after their labels (Formulate 3's option).
- `Formulate:PlainJavaScript:IncludeScript` set to `false` stops the view adding the script, so you can bundle it yourself. The theme has its own setting. See [the Basic theme](plain-javascript-theme.md).
- Custom validation messages and the reCAPTCHA and Date visitor messages are fixed English text for now.

## Compatibility rules

Formulate's packages are built against Umbraco 17.6 and run on 17, 18 and 19. If your extension also needs to run on all three:

- Do not call members Umbraco 18 moved from `IPublishedContent` to `IPublishedElement`: `Id`, `Name`, `SortOrder`, `CreatorId`, `CreateDate`, `WriterId`, `UpdateDate`, `Cultures` and `ItemType`. The source compiles against both, but an assembly built against 17 throws `MissingMethodException` on 18 when it runs the call. Use `Key` (with `IIdKeyMap`) or an extension method.
- Do not use an `[Obsolete]` member. Formulate's own build treats using one as an error.
- Do not register an OpenAPI or Swagger library in a package. Umbraco 18 replaced the library that 17 uses, and a package that registers the old one crashes an 18 site when it starts.

`src/Formulate.CompatibilityCheck` is a small tool that reads built assemblies and confirms that every Umbraco member they use exists in Umbraco 18 and 19. Run it on your own assemblies in the same way as `.github/workflows/ci.yml` does.
