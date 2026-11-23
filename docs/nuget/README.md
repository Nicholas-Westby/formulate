# Formulate

Formulate is a form builder for Umbraco. You build forms in the back office, lay them out, and add them to pages with a form picker. When a visitor submits a form, its handlers act on the data. They can send an email (plain or designed from Razor views), send the data to another service, or store the submission.

## Requirements

Umbraco 17.8.2 or later 17.x (LTS), 18 or 19, which means .NET 10 or .NET 11. Use the latest 17.x release you can.

## Install

```
dotnet add package Umbraco.Community.Formulate
```

This is the only package you need. The other `Umbraco.Community.Formulate.*` packages are parts of Formulate that it brings in.

## Show a form

A form picker property gives your view a form. Show it with the `FormulateForm` view component:

```cshtml
@await Component.InvokeAsync("FormulateForm", Model.Form)
```

To style the form, set `Formulate:PlainJavaScript:Theme` to `basic` in `appsettings.json`.

## Learn more

- Settings, extending and upgrading from Formulate 3: [github.com/Nicholas-Westby/formulate](https://github.com/Nicholas-Westby/formulate)
- Website: [www.formulate.rocks](https://www.formulate.rocks/)
- Issues: [github.com/Nicholas-Westby/formulate/issues](https://github.com/Nicholas-Westby/formulate/issues)

Formulate sends no telemetry.
