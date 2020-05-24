---
layout: page
title: Formulate Extensibility
---

# Extensibility

Most everything in Formulate can be extended or replaced. Here are some examples:

* **Fields.** You can create your own types of fields. If you want to create a field that allows users to choose their favorite cat pictures, you absolutely can do so. No judgement. Read more [here](/articles/custom-field-types).
* **Layout Designers.** If you would like to create your own layout designer that supports grouping fields into wizard steps, this muggle isn't going to stand in your way. More power to you.
* **Form Templates.** By default, Formulate comes with a form template that allows for responsive, Bootstrap, AngularJS forms. You can easily create your own jQuery version, if that's your thing. Or you could copy the existing AngularJS version and modify it slightly.
* **Form Persistence.** Formulate stores all information about forms (fields, layouts, data values, validations, and so on) in JSON format on the file system, but it doesn't have to. The entire persistence layer can be swapped out. You could, for example, create a persistence layer that stores to SQL Server. Or XML, if you prefer inequality over curly braces. Heck, you could even store everything in a file format composed entirely of emojis  
:+1:
* **Handlers.** The basic idea is that when somebody clicks a button to submit their form to the website, server-side "handlers" can then do something with that data. Formulate comes with handlers to send emails, send data to external API's, and to store submissions to the database (which you can then view in the Formulate section). You can also create your own form submission handlers.
* **Validations.** If you need something a little more sophisticated than a regular expression or a mandatory validation, it would be valid for you to create your own custom validation.
* **Data Values.** You can currently create a simple list of strings. Here are some more ideas for custom data values you could create:
  * You could fetch a list of strings from an uploaded file. You could then display that in a drop down.
  * You could retrieve the latest background image from the Bing homepage. Once you have that, you could use the image in your custom image editor field.
  * You could return pi to a specified number of digits. You could then display that in a read only text box.
