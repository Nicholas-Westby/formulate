---
layout: page
title: Installing Formulate
---

# Installing Formulate 5

Install Formulate with NuGet. From your Umbraco project folder, run:

```
dotnet add package Umbraco.Community.Formulate
```

Then run your website. Formulate adds a "Formulate" section to the back office. Administrators get access to it automatically. For other user groups, go to Users > User Groups and add the Formulate section to the group. Back office users without the Formulate section can list forms and layouts, so the form picker works for them, but they cannot open or change them.

Formulate 5 needs Umbraco 17.8.2 or later. See [Requirements](/requirements). The packages the main package brings in are listed in the [README on GitHub](https://github.com/Nicholas-Westby/formulate/blob/v5/main/README.md#install), and the settings you can change are in its [settings table](https://github.com/Nicholas-Westby/formulate/blob/v5/main/README.md#settings).

The package ID is `Umbraco.Community.Formulate`. The old `Formulate` package on NuGet is Formulate 3 for Umbraco 8. It was published from Rhythm Agency's NuGet account and won't get any more updates.

# Where Formulate Stores Data

* **Form definitions** are JSON files under `App_Data/Formulate/Json`. This is outside the public web root.
* **Submissions** from the Store Data handler go in the Umbraco database.
* **Uploaded files** go under `App_Data/Formulate/Uploads`.

# Installing Formulate 3

Formulate 3 is for Umbraco 8. You can install it with the [Formulate](https://www.nuget.org/packages/Formulate/) NuGet package, or by downloading the ZIP file from [Umbraco.com](https://our.umbraco.org/projects/backoffice-extensions/formulate/) and using "Install local package" in the Packages section of the Umbraco back office.
