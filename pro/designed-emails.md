---
layout: page
title: Formulate Designed Emails
---

# Designed Emails

Designed Emails used to be part of Formulate Pro. Formulate Pro is now part of Formulate, so this feature is in the main package, for free.

The "Designed Email" form handler sends an email that you design with Razor views. It renders three parts:

* The subject.
* The HTML body.
* The text body.

When somebody submits a contact form, they get an email that looks the way you want. The Email handler sends a plain list of field labels and values instead.

![A form with a Designed Email handler, showing the settings for the subject, HTML body and text body views](/images/v5/designed-email-handler.png)

# How to Set Up a Designed Email

1. Write the Razor views for the subject, HTML body and text body.
2. Open your form in the Formulate section of the back office.
3. Add a handler and choose "Designed Email".
4. Enter the paths to your views.
5. Make sure [SMTP is configured](/smtp-configuration).

![A Razor view for the HTML body of a designed email](/images/v5/designed-email-view.png)

For the model your views receive and the available helpers, see the [extending docs on GitHub](https://github.com/Nicholas-Westby/formulate/blob/v5/main/docs/extending.md).

# Formulate 3

In Formulate 3, Designed Emails came with the separate Formulate Pro package. The views inherited from `TemplateBase<EmailData>`. That version is documented in the [Formulate Pro source](https://github.com/Formulate-Pro/Formulate-Pro).
