---
layout: page
title: Formulate Requirements
---

# Formulate 5 Requirements

Formulate 5.0.0 supports these versions of Umbraco:

| Umbraco | .NET |
| --- | --- |
| 17.6 or later (17 is the LTS release) | .NET 10 |
| 18 | .NET 10 |
| 19 (release candidate) | .NET 11 |

* The packages say they work with Umbraco `[17.6.0, 20.0.0)`. Formulate is built against 17.6 and checked on 17.6, 17.8, 18.3 and 19.0.0-rc1.
* Use the latest 17.x release of Umbraco that you can. The 17.6.0 floor pulls in dependencies that have published security advisories, and later 17.x releases fix them.
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
