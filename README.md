![Formulate](assets/images/formulate-icon-zoomed-out.png?raw=true "Formulate")

# Formulate

Formulate is a form builder for Umbraco. You build forms in the back office, lay them out, and add them to pages with a form picker. When a visitor submits a form, its handlers act on the data. They can send an email, send the data to another service, or store the submission.

Website: [www.formulate.rocks](https://www.formulate.rocks/)

![Formulate](assets/images/formulate.png?raw=true "Formulate")

<!-- pass 2: replace the picture above with a screenshot of the Formulate 5 back office. -->

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Show a form on a page](#show-a-form-on-a-page)
- [Settings](#settings)
- [What Formulate does with submissions](#what-formulate-does-with-submissions)
- [Extending Formulate](#extending-formulate)
- [Upgrading from Formulate 3](#upgrading-from-formulate-3)
- [Building from source](#building-from-source)
- [Running the tests](#running-the-tests)
- [Contributing](#contributing)
- [Maintainers](#maintainers)
- [About this project](#about-this-project)

## Requirements

| Formulate | Umbraco | .NET |
| --- | --- | --- |
| 5.x | 17.6.0 or later 17.x (LTS), 18, and the 19 release candidate | .NET 10 (Umbraco 17 and 18), .NET 11 (Umbraco 19) |

- The packages say they work with Umbraco `[17.6.0, 20.0.0)`. Formulate is built against 17.6 and checked on 17.6, 17.8, 18.3 and 19.0.0-rc1.
- Use the latest 17.x release of Umbraco that you can. The 17.6.0 floor pulls in dependencies that have published security advisories, and later 17.x releases fix them.
- Formulate 5 does not run on Umbraco 16 or earlier. For Umbraco 8, use Formulate 3.
- A site with a prerelease of Umbraco 19 needs the .NET 11 SDK. A package built for .NET 10 loads inside a .NET 11 site.

## Install

Add the main package to your Umbraco site:

```
dotnet add package Umbraco.Community.Formulate
```

That is the only package you need. It brings in the others:

| Package | What it contains |
| --- | --- |
| `Umbraco.Community.Formulate` | The one you install. It has no code of its own and pulls in everything below. |
| `Umbraco.Community.Formulate.Core` | Forms, fields, validations, handlers and the submission pipeline. |
| `Umbraco.Community.Formulate.Web` | Storage of forms and rendering on the site. |
| `Umbraco.Community.Formulate.BackOffice` | The back office API and screens. |
| `Umbraco.Community.Formulate.Extensions.PlainJavaScriptTemplate` | The form renderer (plain JavaScript) and the Basic theme. |
| `Umbraco.Community.Formulate.Extensions.SendEmail` | The Email and Designed Email handlers. |
| `Umbraco.Community.Formulate.Extensions.SendData` | The Send Data handler. |
| `Umbraco.Community.Formulate.Extensions.StoreData` | The Store Data handler and the submissions API. |

Restart the site. On first start Formulate gives the Formulate section to the Administrators user group. Add it to other user groups in the Users section. Users without the Formulate section can list forms and layouts (so the form picker works) but cannot open or change them.

Formulate stores forms, layouts, validations and data values as JSON files under `App_Data/Formulate/Json` in the site's content root. Back that folder up, and put it in source control if you deploy forms with your code. Store Data creates one database table, `FormulateSubmissions`, through an Umbraco package migration the first time the site starts.

Formulate sends no telemetry. It makes no network calls of its own, apart from the ones you set up (Send Data, reCAPTCHA, and your mail server).

## Show a form on a page

<!-- pass 2: add the back office steps: create a form, add fields, add a layout, add the form picker data type to a document type, and pick the form on a page. Add screenshots. -->

A form picker property gives your template a `FormLayout` value. To show it, use the `FormulateForm` view component. In a Razor view, where `Model.Form` is a form picker property:

```cshtml
@await Component.InvokeAsync("FormulateForm", Model.Form)
```

The picker's property editor alias is `Formulate.FormLayoutPicker`. The component renders nothing, and writes nothing to the log, when no form is picked, when the picked layout was deleted or does not belong to a form, or when the form was deleted or has no fields. It renders nothing and logs a warning when the layout has no template or its template is not installed.

The Plain JavaScript template (the built-in one) writes the form's data into a script block and loads the renderer script, which builds the form in the browser. The script and the theme are added once per page, even when the page has several forms. Forms render with no styles unless you turn on the Basic theme.

Settings for the script and the theme are in the table below. To change how the form looks, see [the Plain JavaScript Basic theme](docs/plain-javascript-theme.md).

Query string values fill fields by alias. With `?source=newsletter`, the field whose alias is `source` starts with `newsletter`. For a hidden field the value replaces the configured text. An empty value (`?source=`) is ignored.

## Settings

Set these in `appsettings.json`, or with environment variables (a double underscore replaces the colon: `Formulate__Email__Whitelist`). None are required. The defaults below come from the code.

```json
{
  "Formulate": {
    "PlainJavaScript": {
      "Theme": "basic"
    }
  }
}
```

| Key | Type | Default | What it does |
| --- | --- | --- | --- |
| `Formulate:PlainJavaScript:IncludeScript` | boolean | `true` | Adds the renderer script to the page. Set to `false` to load the script yourself, for example in your own bundle. |
| `Formulate:PlainJavaScript:Theme` | string | `"none"` | `"none"` or `"basic"` (not case sensitive). Any other value is treated as `"none"` and logs a warning. |
| `Formulate:Website:Persistence:DataFolderPath` | string | `App_Data/Formulate/Json` | Where the JSON files are kept. A relative path (or one starting with `~/`) starts at the content root, never the web root. An absolute path is used as it is. |
| `Formulate:Submissions:EnableServerSideValidation` | boolean | `true` | Checks Regular Expression validations on the server when a form is submitted. It does not affect Mandatory validations. |
| `Formulate:Submissions:MaxUploadBytes` | number | `10485760` (10 MB) | The largest file a visitor can upload. A larger file fails the submission with an error on its field, before it is read into memory. |
| `Formulate:Recaptcha:SiteKey` | string | not set | The reCAPTCHA v2 site key. It is sent to the visitor's browser. |
| `Formulate:Recaptcha:SecretKey` | string | not set | The reCAPTCHA v2 secret key. Only the server uses it. A reCAPTCHA field without keys rejects every submission. |
| `Formulate:Email:Whitelist` | array or string | not set | Limits the addresses taken from a form field. See [Email](#email). |
| `Formulate:SendData:JsonMode` | string | `"Object"` | The top level of the JSON format of Send Data: `"Object"`, or `"WrappedArray"` for `[ {...} ]` as Formulate 3 sent it. Not case sensitive. |
| `Formulate:StoreData:UploadsFolderPath` | string | `App_Data/Formulate/Uploads` | Where Store Data keeps uploaded files. A relative path starts at the content root, so the files cannot be requested directly. |
| `Formulate:StoreData:MaxUploadBytes` | number | `10485760` (10 MB) | The largest file Store Data stores. See [Upload limits](#upload-limits). |
| `Formulate:BackOffice:DefaultTemplateId` | GUID | not set | The template given to new layouts. When not set or not installed, the first installed template is used. The Plain JavaScript template's id is `F3FB1485-C1D1-4806-B419-0D7ABDE39530`. |
| `Formulate:Buttons` | array | `Next`, `Previous`, `Submit` | The button kinds the form editor offers, as a list of objects with a `Kind`. When empty, the default three are used. |
| `Formulate:Fields:Categories` | array | empty | Objects with a `Group` and a `Kind`, sent to the back office with the other configuration. |

<!-- pass 2: confirm Formulate:Buttons and Formulate:Fields:Categories against the final form editor, and update their descriptions. -->

`Formulate:Email:Headers` is not read. See [Email](#email).

Umbraco's own settings also matter: Email and Designed Email send through Umbraco's email sender, which uses `Umbraco:CMS:Global:Smtp`.

### Upload limits

Two limits exist, and both default to 10 MB.

- `Formulate:Submissions:MaxUploadBytes` applies to every submission. Each file is checked before it is read.
- `Formulate:StoreData:MaxUploadBytes` applies to the files Store Data keeps. When a form has an enabled Store Data handler and a file is larger than this, the submission is stopped and the visitor sees a message that names the field and the limit.

To allow larger files in Store Data, raise both settings. The submissions limit is checked first, so raising only Store Data's changes nothing.

ASP.NET Core and Kestrel have request size limits of their own. Raise those too when you raise the Formulate limits. Formulate only reads files for Upload fields. Files posted under any other name, and text posted under an upload field, are ignored.

## What Formulate does with submissions

When a visitor submits a form, Formulate does these things in order:

1. It builds the form's fields once.
2. It runs each field's validations. Errors go back to the browser, shown on their fields.
3. It runs server checks that need the network, such as reCAPTCHA. This happens only when every field is valid, so a reCAPTCHA token is not used up on a form the visitor has to fix.
4. It publishes `FormSubmittingNotification`. Code can cancel the submission with a message that the visitor sees.
5. It runs every enabled handler. A handler that fails is logged and the others still run. Handlers finish even when the visitor closes the page.
6. It tells the browser the result. A submission times out in the browser after one minute.

Values posted for display-only fields (Header, Rich Text, Text Constant and Button) are ignored.

### Email

The Email and Designed Email handlers send through Umbraco's email sender, so set up SMTP in `Umbraco:CMS:Global:Smtp`.

- A mail server failure is logged. It does not fail the visitor's submission.
- Each email has one body. Email sends HTML. Designed Email sends its HTML view, or its text view when there is no HTML view.
- Only the first value of a recipient field is used.
- The Email handler writes dates in the submission's culture, for example "March 05, 2027". Designed Email views get the posted values unchanged.
- `Formulate:Email:Whitelist` limits addresses taken from a form field. Recipients chosen on the handler, and ones code adds, are always allowed. Entries are domains (`example.com`) or addresses (`sales@example.com`). A domain does not allow its subdomains. Set it as an array, or as one value with entries separated by commas or semicolons (`Formulate__Email__Whitelist=example.com;sales@example.org`).
  - When the setting is absent, any address typed into a recipient field gets an email. If a form copies the visitor, set the whitelist, or the form can be used to send mail to anyone.
  - When the setting is present but has no entries (an empty value, or only separators), no typed address is allowed, and a warning is logged at startup.
  - A JSON `null` counts as not set.
  - When the setting is given both as an array and as one value, the single value wins.
- `Formulate:Email:Headers` from Formulate 3 is not supported, because Umbraco's email sender cannot add headers. A startup warning names the setting when it is present. To add headers, handle Umbraco's `SendEmailNotification` for these emails and send them yourself.
- Designed Email views are Razor views in your site. The handler's view paths are saved on the handler. Sample views ship in the package at `~/Views/Formulate/Email/Sample (HTML).cshtml`, `Sample (Text).cshtml` and `Sample (Subject).cshtml`. To change one, copy it to your site and set the handler's path to the copy. A view of your own at a sample's path replaces the sample.

### Send Data

Send Data sends the submitted values to a URL. Formulate 3's formats are all there: query string, form body, JSON and HubSpot JSON.

- It sends only mapped fields, one value per field. Several values of one field are joined with `, `. A mapping with no name uses the field's alias, then its name.
- The JSON format sends a plain object by default. Set `Formulate:SendData:JsonMode` to `WrappedArray` for Formulate 3's `[ {...} ]`. It does not change HubSpot JSON.
- Values are sent as posted, except Date values, which are written as `MMMM dd, yyyy` in the submission's culture. Uploaded files are not sent.
- Failures are logged. They never fail the visitor's submission.
- The handler uses the named HTTP client `Formulate.SendData` (30 second timeout). It never keeps cookies between visitors, never follows redirects, and reads at most 1 MiB of the reply. A 3xx reply is logged at Information. Logs never include a URL's query or user information. If you configure this client's message handler yourself, keep `AllowAutoRedirect = false` and `UseCookies = false`.
- A query string URL carries the visitor's values. Application performance monitoring and tracing tools can record it. Use the form body or JSON formats for private data.
- The HubSpot format sends `pageUri` as an absolute URL. Formulate 3's was usually relative.
- To change or cancel what is sent, handle `SendingDataNotification`. To read the reply, handle `SentDataNotification`. It replaces Formulate 3's result handler. See [Extending](docs/extending.md).

### Store Data

Store Data saves each submission to the `FormulateSubmissions` database table, with the page's URL. Uploaded files go to the uploads folder, outside the web root, with sanitized, length-limited names.

- The submissions API lists, downloads, exports to CSV, and deletes submissions. The CSV is safe to open in Excel, starts with a UTF-8 byte order mark, and includes fields that have since been removed from the form.
- Formulate 3 kept submissions in a table called `FormulateSubmission` and its files in `App_Data/Formulate/FileStorage/Files`. Formulate 5 leaves them where they are and does not read them.

<!-- pass 2: describe the submissions screen in the back office. -->

### Fields that need a note

- **reCAPTCHA** (v2) needs `Formulate:Recaptcha:SiteKey` and `Formulate:Recaptcha:SecretKey`. The server checks the answer with Google only after every other field is valid. Without keys, or when Google cannot be reached, the submission is refused with a message. The answer is never stored, emailed or sent, unless you map it in Send Data. The visitor messages for reCAPTCHA and Date are in English and cannot be changed yet.
  - Google's check goes through the named HTTP client `Formulate.Recaptcha` (10 second timeout). To use a proxy, configure that client with `AddHttpClient("Formulate.Recaptcha")`. Keep `AllowAutoRedirect = false` and `UseCookies = false` on its handler: the secret key must not follow a redirect, and the handler is shared between visitors.
  - The renderer loads Google's script. If your page already loads it, the script can be added twice.
- **Checkbox**: Mandatory means it must be ticked. A lone checkbox is pre-ticked only for a value that means yes.
- **Date**: `yyyy-MM-dd`. Emails and Send Data write `MMMM dd, yyyy` in the submission's culture.
- **Extended Radio Button List** uses Pair List data values (a value and a description).

### Limits to know about

- **Several servers.** Formulate serializes back office writes within one process. When the back office is served from more than one server (load balancing), edit forms on one server. The JSON files must be shared or deployed to all servers, and a changed file is picked up by each server's cache the next time it checks the file's modified time.
- **Regular expressions** run in .NET on the server and in JavaScript in the browser. They can disagree on a few characters: .NET's ECMAScript `\s` is narrower and does not match no-break space or U+2028 and U+2029. An invalid pattern, or one that takes longer than one second to run, is logged as a warning on each submission and the value passes.
- **Messages.** The visitor messages of the reCAPTCHA and Date fields are fixed English text for now.
- **Layouts need a template.** A site with no template extension installed cannot create layouts or render forms. The Plain JavaScript template comes with the main package.

## Extending Formulate

You can add your own field types, handlers, validations, data values, layouts and templates in C#, react to notifications, and change how the browser renders forms. See [Extending Formulate](docs/extending.md).

## Upgrading from Formulate 3

Formulate 5 loads Formulate 3's forms, validations, data values and folders, and keeps its kind ids. It does not pick up Formulate 3's layouts, so you add a layout to each form. There is no automatic migration. See [Upgrading from Formulate 3](docs/upgrading-from-v3.md) and the [changelog](CHANGELOG.md).

The old Formulate packages on NuGet (`Formulate`, `Formulate.Binaries` and `Formulate.Deploy`) were published from Rhythm Agency's NuGet account, which this project does not control, so they cannot be changed from here. They will keep saying they are current. Formulate 5 is published as `Umbraco.Community.Formulate`. Formulate Pro, which was a separate package, is now part of Formulate (the Designed Email handler and the Basic theme), so `Formulate.Pro` is no longer needed.

## Building from source

You need:

- the .NET 10 SDK (`global.json` asks for `10.0.100` and accepts any later SDK, including 11, but not previews);
- Node.js 24 and npm, for the two TypeScript clients (the back office and the site renderer);
- the .NET 11 SDK only to build the dev site against Umbraco 19.

Build everything:

```
dotnet build src/Formulate.sln
```

`dotnet build` also runs `npm` for both clients. On a machine without Node, skip that step:

```
dotnet build src/Formulate.sln -p:SkipClientBuild=true
```

Run the dev site (`src/Website`), which uses the libraries directly:

```
dotnet run --project src/Website
```

Build the dev site on another Umbraco version with `-p:UmbracoSiteVersion=18.3.2`. The default is set in `src/Directory.Build.props`. Umbraco 19 needs the .NET 11 SDK.

Create the NuGet packages in `artifacts/packages`:

```
dotnet pack src/Formulate.sln -c Release -o artifacts/packages
```

The projects:

| Folder under `src` | Purpose |
| --- | --- |
| `Formulate` | The meta package. No code. |
| `Formulate.Core` | The model and the submission pipeline. |
| `Formulate.Web` | Storage of forms as JSON, the view component and the submission endpoint. |
| `Formulate.BackOffice` | The back office API and the back office client (`Client`, built with Vite). |
| `Formulate.Extensions.PlainJavaScriptTemplate` | The renderer (`Client`, TypeScript) and the Basic theme (Sass). |
| `Formulate.Extensions.SendEmail`, `SendData`, `StoreData` | The handlers. |
| `Formulate.CompatibilityCheck` | Checks that the built assemblies only use Umbraco members that exist in Umbraco 18 and 19. |
| `Website` | The dev site. It is not packaged. |
| `*.Tests` | The .NET tests. |

## Running the tests

.NET tests:

```
DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet test src/Formulate.sln
```

Client tests and type checks, in each of `src/Formulate.BackOffice/Client` and `src/Formulate.Extensions.PlainJavaScriptTemplate/Client`:

```
npm ci
npm test
npm run typecheck
```

Browser tests (Playwright, against the dev site on a new empty database), in `tests/e2e`:

```
npm ci
npm run install-browser
npm test
```

The site runs over HTTPS on `https://localhost:44331`, so trust the .NET development certificate first with `dotnet dev-certs https --trust`.

Set `UMBRACO_SITE_VERSION` (for example `18.3.2`) to run them on another Umbraco version, `FORMULATE_E2E_PORT` to use another port (so two runs can go at once), and `DOTNET_EXE` to point at a different `dotnet` (Umbraco 19 needs the .NET 11 SDK).

The compatibility check runs in CI. It reads the built Formulate assemblies and confirms that every Umbraco member they use exists in Umbraco 18 and 19. Code compiled against 17.6 must not use members that Umbraco 18 moved from `IPublishedContent` to `IPublishedElement`, such as `Id` and `Name`. The source compiles against both 17 and 18, but an assembly built against 17 throws `MissingMethodException` on 18 when it runs the call. Use `Key` or an extension method instead.

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs the build, the tests, the compatibility check and the browser tests on every pull request and on every push to `v5/main`.

## Contributing

Issues and pull requests are welcome at [github.com/Nicholas-Westby/formulate](https://github.com/Nicholas-Westby/formulate). Work from the `v5/main` branch. Run the .NET tests and the client tests before you open a pull request. Commit messages follow Conventional Commits (`feat(sendemail): ...`, `fix(web): ...`).

## Maintainers

To publish a release, see [Publishing Formulate](docs/publishing.md).

## About this project

Formulate was first published by Rhythm Agency, by Nicholas Westby, Jamie Pollock and Josef Kohout among others. It is now maintained at [github.com/Nicholas-Westby/formulate](https://github.com/Nicholas-Westby/formulate). Its default branch is `v5/main`. The website is the `gh-pages` branch of that repository.

Thanks to the creators of these Umbraco packages, which were good points of reference while building Formulate:

- [Archetype](https://github.com/imulus/Archetype)
- [Umbraco Bookshelf](https://github.com/kgiszewski/UmbracoBookshelf)
- [Form Editor](https://github.com/kjac/FormEditor)
- [Merchello](https://github.com/Merchello/Merchello)

Formulate is released under the [MIT license](LICENSE).
