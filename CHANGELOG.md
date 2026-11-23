# Changelog

All notable changes to Formulate are in this file. Formulate follows [semantic versioning](https://semver.org/).

## 5.0.0

Not released yet.

Formulate 5 is a rewrite of the parts of Formulate that depended on Umbraco 8. See [Upgrading from Formulate 3](docs/upgrading-from-v3.md) before you upgrade. Formulate 4 was never released.

### Breaking changes for Formulate 3 sites

Read [Upgrading from Formulate 3](docs/upgrading-from-v3.md) for the steps.

- The packages have new IDs (`Umbraco.Community.Formulate` and the packages it brings in), and the site must run Umbraco 17.8.2 or later, 18 or 19. There is no Umbraco 8 to 17 upgrade path in Formulate.
- The form picker is a new property editor, `Formulate.FormLayoutPicker`. It stores a layout id, not Formulate 3's configured form id, so every page needs its form picked again.
- Layouts and configured forms (`ConfiguredForms`) from Formulate 3 are not picked up. Add a layout to each form. The template is saved on the layout.
- Forms are shown with the `FormulateForm` view component, not a partial view path.
- `FormulateConfiguration.json` and Formulate 3's app settings are no longer read. Their replacements are `appsettings.json` keys under `Formulate:`.
- Send Data's JSON format sends a plain object by default. Formulate 3's `[ {...} ]` needs `Formulate:SendData:JsonMode` set to `WrappedArray`.
- "List Function" data values load with no items.
- `Formulate:Email:Headers` is not supported. Email and Designed Email views that came from Formulate Pro need updating from MVC 5 to ASP.NET Core Razor.
- Formulate 3's events and result handlers are now notifications, and Formulate 3's submissions stay in their old table and are not shown.

### Requirements

- Umbraco 17.8.2 or later 17.x (LTS), on .NET 10. It also runs on Umbraco 18 and on the Umbraco 19 release candidate (.NET 11). The packages depend on Umbraco `[17.8.2, 20.0.0)`.
- Use the latest 17.x.

### Packages

The packages are renamed, because the old IDs belong to another NuGet account. Install `Umbraco.Community.Formulate`. The other packages are parts of it:

- `Umbraco.Community.Formulate.Core`
- `Umbraco.Community.Formulate.Web`
- `Umbraco.Community.Formulate.BackOffice`
- `Umbraco.Community.Formulate.Extensions.PlainJavaScriptTemplate`
- `Umbraco.Community.Formulate.Extensions.SendEmail`
- `Umbraco.Community.Formulate.Extensions.SendData`
- `Umbraco.Community.Formulate.Extensions.StoreData`

### Added

- A new back office, built with Umbraco's own UI elements, in the Formulate section (`Formulate.Section`). A migration gives the section to the Administrators group and moves Formulate 3's `formulate` section permissions to it.
- A back office API on the Umbraco Management API, at `/umbraco/management/api/v1/formulate/...`, with its controllers mapped to the API name `formulate`. Changes need the Formulate section. The packages serve no OpenAPI document and register no Swagger or OpenAPI library, so they work with Umbraco 17's and with 18's. A site that wants a document can register one, as the dev site does in `src/Website/Composers/FormulateOpenApiComposer.cs`.
- Formulate Pro is part of Formulate: the Designed Email handler (same handler id) and the Basic theme. Sample email views ship at `~/Views/Formulate/Email/Sample (HTML|Text|Subject).cshtml`, and a site's own view at a sample's path replaces it.
- The fields Formulate 3 had and version 4 lacked, with Formulate 3's kind ids: Checkbox, Date, Extended Radio Button List and reCAPTCHA v2.
- Store Data: uploads stored outside the web root, in `App_Data/Formulate/Uploads` (`Formulate:StoreData:UploadsFolderPath`), with sanitized names capped by length. Each submission records the page's URL. A submissions API lists, downloads, exports to CSV (safe to open in Excel, with a UTF-8 byte order mark, including removed fields) and deletes submissions.
- A form's Submissions tab in the back office lists the submissions Store Data kept, newest first and 50 to a page. A submission opens in a sidebar, with its files to download. Export to CSV downloads them all, and Delete removes one, with its files, after asking. Only a form with an enabled Store Data handler keeps submissions.
- Settings: `Formulate:PlainJavaScript:IncludeScript` and `:Theme`, `Formulate:Website:Persistence:DataFolderPath`, `Formulate:Submissions:EnableServerSideValidation` and `:MaxUploadBytes`, `Formulate:Recaptcha:SiteKey` and `:SecretKey`, `Formulate:Email:Whitelist`, `Formulate:SendData:JsonMode`, `Formulate:StoreData:UploadsFolderPath` and `:MaxUploadBytes`, `Formulate:BackOffice:DefaultTemplateId`. See the [README](README.md#settings).
- Query string values fill fields by alias (`?source=newsletter`). For a hidden field the value replaces the configured text. An empty value is ignored.
- Placeholders in validation messages work as in Formulate 3: `{name}`, `{alias}` and `{label}` in the message of a Mandatory or Regular Expression validation are replaced with the field's values, in any letter case, in the browser and in the server's errors, and `{{}` gives `{`. Nothing changes for upgraders. A custom validation can use `ValidationMessage.ReplaceFieldTokens`.
- Server side checks for regular expressions run the same way as in the browser, apart from a few characters that `\s` matches (see the README).
- A browser API for custom field renderers and validators: `api.min.js` (also on `window.formulatePlainJs`) exports `registerFieldRenderer`, `registerValidator`, `FieldRendererBase`, every built-in renderer and the helpers, so a renderer can build on the built-in ones. A phone field is `class RenderPhone extends RenderText { static inputType = "tel"; }`. The window lists Formulate 3 used still work. See [Changing how forms render in the browser](docs/extending.md#changing-how-forms-render-in-the-browser).
- Extension points: `IVerifiedFormField` (a server check that waits on the network, used by reCAPTCHA), `IFormFieldValueFormatter` (how a field's value is written in emails and Send Data), `IBuildFormSubmissionFields`, `ISubmissionPageResolver`, `FormSubmittingNotification` (can cancel a submission with a message the visitor sees), `SendingDataNotification` and `SentDataNotification`. See [Extending Formulate](docs/extending.md).
- A compatibility check (`src/Formulate.CompatibilityCheck`) and CI that build, test and run browser tests on Umbraco 17.8, 18.3 and 19.0.0-rc1.
- Browser tests that also run against the packed NuGet packages, the way a site installs Formulate: CI packs first, then runs the browser tests on each Umbraco version on a site built from those packages, and a test checks that the site loaded that version. `npm run test:packages` in `tests/e2e` does the same on a developer's machine.
- Compile checks against Umbraco 18.3.2 and 19.0.0-rc1 that make every use of an `[Obsolete]` Umbraco member an error, so an API that Umbraco deprecates fails CI before a later major removes it. The back office client is also type-checked against the back office of Umbraco 18 and 19 (`npm run typecheck:18` and `typecheck:19`).
- The back office shows the package's own version, on the Formulate welcome page and in Umbraco's list of installed packages.
- A layout designer for Basic layouts. Fields are dragged, or moved with the keyboard, into the cells of rows that are 12 columns wide. Rows are added with the cells' widths chosen, step dividers split a form into steps, and the fields not yet placed are listed so that none is lost. Auto Populate shows every field one under another.
- Rich Text fields are edited in Umbraco's default rich text editor. On the page, links to content pages and images from the media library are resolved to their URLs, as Umbraco does for its own rich text.

### Changed

- Form data stays in `App_Data/Formulate/Json` in the content root, as in Formulate 3, and is never read from the web root. `Formulate:Website:Persistence:DataFolderPath` changes it (absolute, relative or `~/` paths).
- The plain JavaScript renderer is rewritten in TypeScript. It keeps Formulate 3's class names, events and custom field hooks. The renderer and the theme are added once per page, however many forms the page has.
- The renderer is ES modules, not one bundle: one file for each module in `/App_Plugins/Formulate/PlainJavaScript/`, readable (`name.js`) and minified (`name.min.js`), with type declarations. The view loads `formulate.min.js` with `<script type="module">`, after a `<link rel="modulepreload">` for each module (`modules.json` lists them). The files keep their URLs, with no `?v=`, and are sent with `Cache-Control: no-cache`, so browsers check them with the server and get a 304 when they have not changed. Sites with `Formulate:PlainJavaScript:IncludeScript` set to `false` must load `formulate.min.js` with `<script type="module">`, and should write the preload links from `IPlainJavaScriptAssets.GetModuleUrls`.
- Multi-step forms work with no theme: inactive steps are hidden by the `hidden` attribute.
- The Email handler is rebuilt on Umbraco's email sender (SMTP from `Umbraco:CMS:Global:Smtp`). A mail server failure is logged and does not fail the visitor's submission. Each email has one body. Dates use the submission's culture. Only the first value of a recipient field is used.
- Send Data is rebuilt on `IHttpClientFactory` (the named client `Formulate.SendData`, 30 second timeout). It reads Formulate 3's saved settings, sends only mapped fields, and never fails a submission. JSON is a plain object by default. `Formulate:SendData:JsonMode` = `WrappedArray` restores Formulate 3's `[ {...} ]`.
- Uploads are accepted only for Upload fields, one file per field, and each is checked against `Formulate:Submissions:MaxUploadBytes` (10 MB) before it is read. A larger file fails the submission with a message on its field. When a form stores its data, Store Data refuses files over `Formulate:StoreData:MaxUploadBytes` (10 MB) with a message.
- Values posted for display-only fields (Header, Rich Text, Text Constant, Button) are ignored. Each submission builds its fields once.
- A form can be created only with a kind. A layout saved without a template gets the default template. An unknown template is rejected.
- A Basic layout made in the back office starts with Auto Populate on, as the layout made with a new form does, so it shows the form's fields until they are laid out. In Formulate 3 it started with Auto Populate off and showed no fields.
- The back office API rejects configuration that a field, handler, validation, data values or layout kind cannot read (400, naming the item). Items of kinds that are not installed round-trip untouched.
- API writes are serialized within one process, so simultaneous moves, deletes and creates cannot corrupt the tree. Sites that load balance the back office across servers should edit on one server.
- Creating a form or layout with an id that another item already uses is rejected. A tree root id as a parent id gives 404.
- Radio button lists now follow their Orientation setting. The renderer adds `formulate__field--radio-list--horizontal` or `--vertical` (and the same for `extended-radio-list`) to the list's fieldset, and with the Basic theme a list set to Vertical stacks its choices and one set to Horizontal lays them out in a row that wraps. A list left on "As the template lays them out" looks as before. A reCAPTCHA field without a site key adds no Google script and logs one warning.

### Removed

- No telemetry anywhere. The five places version 4 turned on Umbraco's package telemetry are gone, and Formulate Pro's usage tracker is not carried over.
- `Formulate:Email:Headers` is not supported (Umbraco's email sender cannot add headers). A startup warning names the setting when it is present.
- Formulate 3's icon font. Every built-in field, handler and data values kind uses an icon of Umbraco's own. Kinds that still name an `icon-formulate-*` icon get a generic one.
- The `UseDefaultFolderIcon` back office option. Folders use the built-in folder icon.
- Support for Umbraco Deploy, extra back office languages, and automatic import of Formulate 3 data (all out of scope for 5.0).

### Changes for extenders

- `IHaveDirective` is renamed `IHaveEditor`.
- `ILayoutDefinition` has `GetDefaultConfiguration()`, the configuration a new layout of the kind starts with in the back office. By default it is what `GetBackOfficeConfiguration` gives for a layout stored without one.
- `IGetDataValuesItemsUtility.GetValues` has a `fieldId` parameter.
- `IEntityRepository<T>` and `IRepositoryUtility<T>` have `GetAll()`.
- `EntitySavingNotification<T>` and `EntitySavedNotification<T>` have `IsNew`. The constructors without `isNew` are removed.
- `ITreeEntityRepository.Delete`, `Move` and `HasChildren`, the `Formulate.BackOffice.EntityTypes` enum (use `Formulate.BackOffice.Api.EntityTypes`) and `FormulateTreeResult` are removed. Code compiled against version 4 that calls them fails with `MissingMethodException`. `ConfigApiService` no longer takes the back office options.
- `ISubmitFormSubmissionRequest.SubmitAsync` returns a result object (success plus errors) instead of a bool.
- `IValidateFormSubmissionRequest.Validate` and `IVerifyFormSubmissionRequest.VerifyAsync` take the built fields.
- Formulate 3's `resultHandler` (a type name created by reflection) is replaced by `SentDataNotification`. `SendingDataNotification` replaces the `SendingData` and `SerializingJson` events.

### Fixed

Form data:

- Written atomically with unique temporary files, so a save cut short cannot leave a broken file.
- Files changed on disk are reloaded. Unreadable files are retried. Files missing an id or path are skipped.
- The cache is safe under concurrent saves, and gives each caller its own copy.
- Global JSON settings in a site no longer break reading form data.

Handlers, fields and validations:

- Form handlers keep running after one fails, and finish when the visitor disconnects.
- Unknown handler kinds are rejected or skipped instead of crashing the form. The definition's kind id is used (a handler reported its own id as its kind).
- Deleted validations are skipped with a warning. Radio button lists work with no configuration. Fields with missing data values, and fields that cannot render, are logged.
- Items whose stored configuration cannot be read are skipped and logged, instead of breaking the page.
- Four source files under a lowercase folder name were left out of Linux builds.

Rendering and submitting:

- Forms render on Umbraco 18 and later (the page is looked up by key).
- Submissions from forms outside content pages are accepted.
- reCAPTCHA renders for every form on a page.
- A lone checkbox is pre-ticked only for a value that means yes.
- Validation errors are announced to screen readers. The failure event fires for every unsuccessful response.
- A submission times out after a minute. Scripts loaded later can add fields.
- Form JSON is escaped inside the script block, so a label cannot end it early.
- The step rows and button kinds reach the renderer. Empty query string values are ignored. The renderer is served at the site root.

Store Data and the back office:

- Store Data resolves scoped services for each submission and disposes each scope asynchronously.
- The Store Data CSV export works on Windows.
- Saving a form no longer adds another auto-generated layout each time. Only a new form gets one.
- Renaming a folder no longer clears its alias.
- A file posted under any field name is no longer taken as an upload. Text posted under an upload field no longer satisfies a required upload.
- Send Data could not read its own settings, so a form with a Send Data handler could not be saved or run. That includes forms brought over from Formulate 3.
