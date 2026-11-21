---
layout: page
title: Configuration SMTP for Formulate Emails
---

# Configuring SMTP for Emails

The Email and Designed Email handlers send mail through Umbraco's email settings. To send email, configure SMTP in `appsettings.json` under `Umbraco:CMS:Global:Smtp`:

```json
{
  "Umbraco": {
    "CMS": {
      "Global": {
        "Smtp": {
          "From": "noreply@example.com",
          "Host": "smtp.example.com",
          "Port": 587,
          "Username": "...",
          "Password": "..."
        }
      }
    }
  }
}
```

Replace the values with the ones from your mail provider.

# Formulate 3

Formulate 3 (Umbraco 8) reads SMTP settings from `web.config`. To write emails to your file system as `.eml` files, add this to your `web.config`:

```
<configuration>
  <system.net>
    <mailSettings>
      <smtp deliveryMethod="SpecifiedPickupDirectory">
        <specifiedPickupDirectory pickupDirectoryLocation="c:\temp-email"/>
      </smtp>
    </mailSettings>
  </system.net>
</configuration>
```

Make sure the `temp-email` folder exists. Files appear there whenever you submit a form (assuming the form handler is set up).
