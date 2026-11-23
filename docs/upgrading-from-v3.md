# Upgrading from Formulate 3

Formulate 3 ran on Umbraco 8. Formulate 5 runs on Umbraco 17.6 or later, 18 and 19. There is no automatic migration of Formulate 3 data yet. This guide lists what is the same, what changed, and what you do by hand.

Formulate 4 was never released, so there is nothing to upgrade from there.

## Contents

- [Before you start](#before-you-start)
- [Steps](#steps)
- [Settings that moved](#settings-that-moved)
- [Layouts](#layouts)
- [What stays the same](#what-stays-the-same)
- [What changed for editors and site builders](#what-changed-for-editors-and-site-builders)
- [What changed for developers](#what-changed-for-developers)
- [What is not carried over](#what-is-not-carried-over)

## Before you start

- Formulate 5 has no Umbraco 8 to 17 upgrade path of its own. Upgrade the site to Umbraco 17, 18 or 19 first, using Umbraco's own documentation, or build a new site and bring your content across.
- Work on a copy of the site and its database. Keep a copy of the Formulate 3 files described below.
- The packages have new names. `Formulate`, `Formulate.Binaries`, `Formulate.Deploy` and `Formulate.Pro` are not used any more. The new one is `Umbraco.Community.Formulate`.

## Steps

1. Get the site running on Umbraco 17.6 or later (the latest 17.x is best), 18 or 19.
2. Remove the old Formulate packages, including Formulate Pro, from the site.
3. Install `Umbraco.Community.Formulate`:

   ```
   dotnet add package Umbraco.Community.Formulate
   ```

4. Copy Formulate 3's data folder into the new site's content root, keeping the same path: `App_Data/Formulate/Json`. Formulate 5 loads the forms (`Forms`), validations (`Validations`), data values (`DataValues`) and folders (`Folders`) in it. It does not load Formulate 3's layouts (`Layouts`) or configured forms (`ConfiguredForms`). See [Layouts](#layouts). Formulate 5 looks there by default (see `Formulate:Website:Persistence:DataFolderPath`), and Formulate 3 used the same path (`~/App_Data/Formulate/Json/`). Formulate 5 never reads the folder from the public web root.
5. Move your settings. See [Settings that moved](#settings-that-moved).
6. Start the site. Formulate gives the Formulate section to the Administrators group, and moves the permissions of groups that had Formulate 3's `formulate` section to the new section (`Formulate.Section`). Check the Users section if a group cannot see Formulate.
7. Open each form and check it in the back office. Kind ids are the same as in Formulate 3, so fields, handlers and validations keep their kinds. Items of a kind that is not installed are left as they are and skipped on the page, with a warning in the log.
8. Add a layout to each form. Formulate 3's layouts are not picked up (see [Layouts](#layouts)). Choose a template for each new layout (Plain JavaScript is the one that ships).
9. Re-create the form picker. Formulate 3's property editor was `Formulate.ConfiguredFormPicker`, and it stored the id of a configured form (`{"id": "..."}`). Formulate 5's is `Formulate.FormLayoutPicker`, and it expects the id of a layout, so you cannot switch an existing data type to the new editor. Create a data type with the new editor, use it on your document types, and pick the form and layout on each page again. There is no conversion of pages that used the old editor.
10. Update your templates. See [What changed for developers](#what-changed-for-developers). The view that shows a form is now the `FormulateForm` view component:

   ```cshtml
   @await Component.InvokeAsync("FormulateForm", Model.Form)
   ```

11. Turn on the theme if you want the Basic theme (see below), and send a test submission on every form.

### Steps 7 to 9 in the back office

- **Step 7, check each form.** In the Formulate section, open Forms and expand the tree. Open a form and look at its Fields and Handlers tabs. A field or handler of a kind that is not installed shows as "Not installed". Its name, alias and settings are kept as they are, and nothing is lost by saving the form. Open a few fields to check their settings, and the Send Data handlers (see below).
- **Step 8, add a layout.** Open the form's menu in the tree and choose Create to make a layout, then choose its Template (Plain JavaScript). A new Basic layout starts with Auto Populate on, so it shows every field one under another. Turn Auto Populate off to arrange the fields in rows, cells and steps in the layout designer. To skip the layout step on new forms, create them as Form with Basic Layout. The [README](../README.md#in-the-back-office) walks through the layout designer.
- **Step 9, re-create the form picker.** In Settings, create a data type with the property editor Formulate Form Layout Picker. Add a property that uses it to each document type that had Formulate 3's picker. Then open each page, choose Choose, pick the form's layout and save and publish. Remove the old property when no page needs it. The steps for the whole route, from a new form to a picked layout, are in the [README](../README.md#in-the-back-office).

Saving a migrated Send Data handler in the back office removes Formulate 3's `resultHandler` from it. Formulate 5 ignores that setting (use `SentDataNotification` instead), and until it is removed the log has a warning once for each such handler after each start of the site. The back office does not show the setting, so saving the form is enough: the form is saved without it.

## Layouts

Formulate 5 does not pick up Formulate 3's layouts. Two things differ:

- Formulate 3 kept layouts in their own tree (`Layouts`). Formulate 5 keeps a layout under its form, and takes the form from the layout's place in the tree. A Formulate 3 layout sits at the Layouts root, so no form owns it and it cannot be picked.
- Formulate 3 kept the template on the configured form (`ConfiguredForms/*.conform`), not on the layout. Formulate 5 keeps the template on the layout, and never reads `.conform` files. A layout with no template shows nothing on the page.

After you copy the folder, add a layout to each form in the back office, as above. That is the supported way.

### Optional: bring layouts across by hand

You can instead edit the copied files so that Formulate 5 finds each layout under its form. Back up the copied `App_Data/Formulate/Json` folder first, and do this on a copy of the site. For each file in `Layouts` that ends in `.layout`:

1. Read the form's id from the layout's `Data` (a JSON string with a `formId` property). Open that form's file in `Forms`.
2. Set the layout's `Path` to the form's `Path` followed by the layout's own `Id`. For example, a form with the path `[<forms root>, <form id>]` gives the layout the path `[<forms root>, <form id>, <layout id>]`.
3. Find the file in `ConfiguredForms` whose `LayoutId` is the layout's `Id`. Add its `TemplateId` value to the layout as a new `"TemplateId"` property.
4. Save the file, and restart the site if it was running.

The layout then shows under its form, leaves the Layouts root, and renders with its template. A layout whose form no longer exists stays unattached. This was tried on a form, a Basic layout and a configured form written in Formulate 3's file shapes, with Formulate 5's own tree repository and the `FormulateForm` view component. It was not tried on every layout kind or on every Formulate 3 release. You still re-pick the form on each page (step 9).


## Settings that moved

Formulate 3 read `App_Plugins/formulate/FormulateConfiguration.json` and a few app settings. Formulate 5 reads neither. It reads `appsettings.json` (and other .NET configuration, such as environment variables). Move them like this:

| Formulate 3 | Formulate 5 | Notes |
| --- | --- | --- |
| `Persistence.JsonBasePath` | `Formulate:Website:Persistence:DataFolderPath` | Default `App_Data/Formulate/Json`, from the content root. |
| `Persistence.FileStorageBasePath` | `Formulate:StoreData:UploadsFolderPath` | Default `App_Data/Formulate/Uploads`. Formulate 5 does not read files from Formulate 3's `FileStorage` folder. |
| `Templates` | not a setting | Templates are definitions in code, see [Extending](extending.md#layouts-and-templates). The Plain JavaScript template has the same id as before. Formulate 3 saved the template on the configured form. Formulate 5 saves it on the layout. |
| `Buttons` | `Formulate:Buttons` | A list of objects with a `Kind`. |
| `FieldCategories` | `Formulate:Fields:Categories` | A list of objects with a `Kind` and a `Group`. |
| `Submissions.EnableServerSideValidation` | `Formulate:Submissions:EnableServerSideValidation` | Default `true`. |
| `Email.Whitelist` (`Enabled` and `AllowedEmails`) | `Formulate:Email:Whitelist` | A list of strings. A string with an `@` is an address, and one without is a domain. Leave it out to allow any address (what `Enabled: false` did). See the warning below. |
| `Email.Headers` | none | Not supported. Formulate 5 sends email through Umbraco's email sender, which cannot add headers. A warning is logged at startup when `Formulate:Email:Headers` is set. |
| App setting `Formulate:RecaptchaSiteKey` | `Formulate:Recaptcha:SiteKey` | |
| App setting `Formulate:RecaptchaSecretKey` | `Formulate:Recaptcha:SecretKey` | |
| App setting `Formulate:Send Data JSON Mode` | `Formulate:SendData:JsonMode` | Formulate 3 sent `[ {...} ]` unless this was set to `JSON Object`. Formulate 5 sends a plain object by default. Set `WrappedArray` to keep the old default. The old name is not read. |
| `Formulate:EnableLogging`, `Formulate:EnableJSONFormLogging`, `Formulate:EnsureUsersCanAccess`, `Formulate:Version` | none | Not read. Formulate logs through Umbraco's logging. |

Formulate 3's SMTP settings were Umbraco's. In Umbraco 17 they are under `Umbraco:CMS:Global:Smtp`.

New settings in Formulate 5, such as `Formulate:PlainJavaScript:Theme` and `Formulate:Submissions:MaxUploadBytes`, are in the [README](../README.md#settings).

Check the whitelist when you move it. Formulate 3 checked addresses only when `Enabled` was true. In Formulate 5, a whitelist that is present but empty allows no typed address, and one that is absent allows every address. Set it when a form copies the visitor.

## What stays the same

- Kind ids of every Formulate 3 field, handler, validation, data values kind and layout.
- The JSON file layout of forms, validations, data values and folders, and their ids.
- The Plain JavaScript template's id, and its CSS class names, events and custom-field hooks. A site's own scripts that listen to `formulate form: submit: success` and the other events keep working.
- Send Data reads Formulate 3's saved handler settings (url, method, transmission format and fields). Query String, Form Body and HubSpot JSON send what Formulate 3 sent (HubSpot's `pageUri` is now absolute). JSON is the exception: it now sends a plain object. Set `Formulate:SendData:JsonMode` to `WrappedArray` to keep Formulate 3's default `[ {...} ]`. Check any receiver that expects an array.
- The fields. Formulate 5 has the four that were missing from version 4: Checkbox, Date, Extended Radio Button List and reCAPTCHA (v2).

## What changed for editors and site builders

- **A new back office.** The old back office was built with AngularJS, which Umbraco removed in version 14. Every screen is rebuilt with Umbraco's own UI elements. See [Show a form on a page](../README.md#in-the-back-office) for the steps.
- **The JSON files are in `App_Data`, in the content root.** This is where Formulate 3 kept them too. Formulate 5 never reads them from `wwwroot`.
- **Formulate Pro is part of Formulate.** Designed Email (the handler that renders emails from Razor views) and the Basic theme come with `Umbraco.Community.Formulate`. Remove `Formulate.Pro`. Its usage tracker is gone. Formulate sends no telemetry at all.
- **The Basic theme** is a setting now:

  ```json
  { "Formulate": { "PlainJavaScript": { "Theme": "basic" } } }
  ```

  See [the Basic theme](plain-javascript-theme.md).
- **Designed Email views** from Formulate Pro were MVC 5 Razor. Update them to ASP.NET Core Razor. A handler that points at one of Pro's `Formulate Pro Sample (...)` views uses the built-in sample instead. The built-in samples are at `~/Views/Formulate/Email/Sample (HTML|Text|Subject).cshtml`. A view in your site at the same path replaces the sample.
- **Email**, called Send Email in the back office, sends through Umbraco's email sender. A mail server failure is logged and does not fail the visitor's submission. Each email has one body: Email sends HTML, and Designed Email sends its HTML view or, with none, its text view. Only the first value of a recipient field is used.
- **Rich Text** fields are edited with Umbraco's default rich text editor. Text that Formulate 3 stored is shown as stored and is kept as it is until someone edits it. When it is edited, the editor simplifies markup it cannot keep, such as some embeds and `font` tags. On the page, links to content pages and images from the media library are resolved to their current URLs, as Umbraco does for its own rich text. A `<script>` in the text does not run, so an embed that needs its own script does not work. To add an image, use the editor's media picker. Pasting or dropping an image is not supported.
- **Query string values fill fields by alias** (`?source=newsletter`).
- **Uploads** are accepted only for Upload fields. Each file is checked against `Formulate:Submissions:MaxUploadBytes` (10 MB by default). Store Data keeps its own limit, `Formulate:StoreData:MaxUploadBytes`. Uploaded files go to a folder outside the web root, with sanitized names.
- **Store Data** has a new table, `FormulateSubmissions`. Formulate 3's submissions stay in the `FormulateSubmission` table, and their files in `App_Data/Formulate/FileStorage/Files`. Formulate 5 leaves them where they are. It does not show or export them. Keep them if you need them, or move them yourself.
- **Forms render on Umbraco 18 and 19**, and forms outside content pages can be submitted.
- **Several things Formulate 3 got wrong are fixed.** See the [changelog](../CHANGELOG.md).

## What changed for developers

- **.NET 10 and ASP.NET Core.** The assemblies are `Formulate.Core`, `Formulate.Web`, `Formulate.BackOffice` and the extension assemblies, in place of `formulate.api`, `formulate.app`, `formulate.core` and `formulate.meta`. Code written against Formulate 3's API has to be rewritten. The concepts are the same (definitions with kind ids), but the types are not.
- **Templates are view component views.** Formulate 3 used a partial view path from `FormulateConfiguration.json`. Formulate 5 uses a `TemplateDefinition` class and a view in `Views/Shared/Components/FormulateForm/`. See [Extending](extending.md#layouts-and-templates).
- **Events became notifications.** Formulate 3's events (for example `SendingData` and `SerializingJson`) are now Umbraco notifications. Use `FormSubmittingNotification`, `SendingDataNotification` and `SentDataNotification`. `SentDataNotification` replaces Send Data's `resultHandler`, which was a type name created by reflection.
- **The renderer is ES modules.** The Plain JavaScript template loads `/App_Plugins/Formulate/PlainJavaScript/formulate.min.js` with `<script type="module">`, after a `<link rel="modulepreload">` for each of its modules. If you load the renderer yourself (`Formulate:PlainJavaScript:IncludeScript` set to `false`), load it with `<script type="module">`, once per page, and write the preload links from `IPlainJavaScriptAssets.GetModuleUrls`. See [Loading the renderer yourself](extending.md#loading-the-renderer-yourself).
- **Custom field renderers** registered on `window["formulate-plain-js-fields"]` keep working. New ones can import the API (`api.min.js`) and extend a built-in renderer, such as a phone field built on the text field. See [Changing how forms render in the browser](extending.md#changing-how-forms-render-in-the-browser).
- **Back office editors** are written for the new back office. Custom AngularJS directives do not run. See [Back office editors](extending.md#back-office-editors) for how to write one.
- **The back office API** is the Umbraco Management API under `/umbraco/management/api/v1/formulate/`. Calls need a signed in back office user.
- **Notification constructors and interfaces changed.** `EntitySavingNotification<T>` and `EntitySavedNotification<T>` take an `isNew` argument. `IHaveDirective` is now `IHaveEditor`. `IGetDataValuesItemsUtility.GetValues` takes a `fieldId`. `IEntityRepository<T>` and `IRepositoryUtility<T>` have `GetAll()`. `ISubmitFormSubmissionRequest.SubmitAsync` returns a result object. `IValidateFormSubmissionRequest.Validate` and `IVerifyFormSubmissionRequest.VerifyAsync` take the built fields.
- **Compatibility across Umbraco versions.** Read [the rules](extending.md#compatibility-rules) before you compile an extension for 17 and run it on 18.

## What is not carried over

- Automatic import of Formulate 3's data. Copy the JSON files by hand, as above.
- Formulate 3's layouts and configured forms (`ConfiguredForms`). See [Layouts](#layouts).
- "List Function" data values. They load as a legacy kind with no items, and fields that use them get no items and log a warning. Re-create them as a List or US States data values item.
- Umbraco Deploy support (`Formulate.Deploy`).
- Extra back office languages. They are out of scope for 5.0.
- The Bootstrap and AngularJS sample template. Formulate 5 ships one template, Plain JavaScript.
- Formulate 3's submissions viewer data (see Store Data above), and the old `FileStorage` folder.
- The Formulate Pro usage tracker.
- `Formulate:Email:Headers`.
