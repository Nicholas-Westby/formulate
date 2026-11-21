---
layout: page
title: Formulate Extensibility
---

# Extensibility

You can extend or replace much of Formulate. Here are some examples:

* **Fields.** You can create your own types of fields. A field has a back office part and a front-end renderer. The [custom field types](/articles/custom-field-types) page covers the front-end renderer, which works the same in Formulate 5.
* **Handlers.** A handler runs on the server when somebody submits a form. Formulate comes with handlers to store data, send emails, send designed emails and send data to external APIs. You can also write your own.
* **Validations.** Formulate comes with Mandatory and Regular Expression validations. If you need something more specific, you can create your own.
* **Data Values.** Formulate comes with List, Pair List and US States. You can create your own kind of data value, such as a list that comes from an API.
* **Form Rendering.** The front-end classes, events and field hooks are plain JavaScript and CSS. You can restyle forms or change what happens on submit. See [Render Form](/plain-javascript/render-form).

For the Formulate 5 extension points and code samples, see the [extending docs on GitHub](https://github.com/Nicholas-Westby/formulate/blob/v5/main/docs/extending.md).

The Formulate 3 extension points (AngularJS directives, the `IFormFieldType` interface and swappable persistence) are different. The AngularJS pages on this site apply to Formulate 3 only.
