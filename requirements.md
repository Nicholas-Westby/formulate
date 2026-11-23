---
layout: page
title: Formulate Requirements
---

# Formulate 5 Requirements

Formulate 5.0.0 supports these versions of Umbraco:

| Umbraco | .NET |
| --- | --- |
| 17.8.2 or later (17 is the LTS release) | .NET 10 |
| 18 | .NET 10 |
| 19 (release candidate) | .NET 11 |

* `Umbraco.Community.Formulate` says it works with Umbraco `[17.8.2, 20.0.0)`, so NuGet refuses to install it on an older Umbraco. The packages it brings in are built against Umbraco 17.7.2, because Umbraco 18.0.0 to 18.3.0 ship an older NPoco than 17.8.2 does. Formulate is checked on 17.8.2, 18.0.0, 18.3.2 and 19.0.0-rc1.
* Use the latest 17.x release of Umbraco that you can.
* On Umbraco 18.0.x, the page of a tree's root or folder shows no list and no Create button, since Umbraco added those in 18.1. Use Create in the tree item's menu instead.
* Formulate 5 does not run on Umbraco 16 or earlier. For Umbraco 8, use Formulate 3.
* Umbraco 19 runs on .NET 11, so a site on it needs the .NET 11 SDK.

Formulate 4 was never released. See the [README on GitHub](https://github.com/Nicholas-Westby/formulate/blob/v5/main/README.md#requirements) for the details.

# Formulate 3 Requirements

Formulate 3 requires:

* .NET 4.7.2.
* Umbraco 8.1

# Formulate 2 Requirements

The older version of Formulate, version 2, requires:

* .NET 4.5.2
* Umbraco 7.4.1

If you are using Umbraco Cloud and want to install Formulate.Deploy for improved Umbraco Cloud and Umbraco Deploy support, you will require at least **Umbraco 7.7** (ideally, 7.7.13 or greater).
