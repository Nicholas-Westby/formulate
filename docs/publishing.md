# Publishing Formulate

This guide is for you, the maintainer. It takes you from a finished `v5/main` branch to Formulate on NuGet, the Umbraco Marketplace and formulate.rocks. Nothing here happens by itself. Each step is yours to do.

## Contents

- [What gets published](#what-gets-published)
- [One-time setup](#one-time-setup)
- [Make a release](#make-a-release)
- [Prereleases](#prereleases)
- [Publish by hand](#publish-by-hand)
- [Umbraco Marketplace](#umbraco-marketplace)
- [Old packages](#old-packages)
- [The website](#the-website)
- [If something goes wrong](#if-something-goes-wrong)

## What gets published

Eight packages, all at the same version, all from this repository:

| Package ID | Notes |
| --- | --- |
| `Umbraco.Community.Formulate` | The one people install. Carries the `umbraco-marketplace` tag. |
| `Umbraco.Community.Formulate.Core` | |
| `Umbraco.Community.Formulate.Web` | |
| `Umbraco.Community.Formulate.BackOffice` | |
| `Umbraco.Community.Formulate.Extensions.PlainJavaScriptTemplate` | |
| `Umbraco.Community.Formulate.Extensions.SendEmail` | |
| `Umbraco.Community.Formulate.Extensions.SendData` | |
| `Umbraco.Community.Formulate.Extensions.StoreData` | |

The IDs come from `src/Directory.Build.props` (`Umbraco.Community.` plus the project name). The old IDs `Formulate`, `Formulate.Binaries` and `Formulate.Deploy` belong to Rhythm Agency's NuGet account, and `Formulate.Core` belongs to an unrelated account. That is why Formulate 5 has new IDs.

The version is `5.0.0`, set in `src/Directory.Build.props` as `VersionPrefix`. A release overrides it with the tag (see below). `Umbraco.Community.Formulate` depends on Umbraco `[17.8.2, 20.0.0)`, the versions sites may run (`UmbracoSupportedRange`). It depends on `Umbraco.Cms` as well as `Umbraco.Cms.Core`, so NuGet refuses to install it on a site below 17.8.2 (a downgrade, NU1605) instead of raising only some of the site's Umbraco packages. The other packages are built against Umbraco 17.7.2 and depend on `[17.7.2, 20.0.0)` (`UmbracoCompileRange`), because Umbraco 18.0.0 to 18.3.0 ship an older NPoco than 17.8.2. Both ranges are set in `src/Directory.Build.props`.

## One-time setup

### 1. Put the repository where it belongs

1. Push the branches: `git push origin v5/main`.
2. On GitHub, open the repository's Settings, then Branches, and make `v5/main` the default branch. Visitors see its README, and the release workflow only accepts tags on `v5/main`.
3. Turn on Issues. The repository is a fork, and GitHub turns Issues off on forks. Open Settings, then General, then Features, and tick Issues. The README, the NuGet page and the Marketplace file send people to the issue tracker.
4. Allow GitHub Actions. Forks start with workflows turned off. Open the Actions tab and choose to enable workflows. Then open Settings, then Actions, then General, and check that Actions are allowed. CI and the release workflow do nothing until you do this.
5. Check CI. Open the Actions tab and confirm that the CI workflow runs on `v5/main` and passes before you make a release.

### 2. Create a NuGet API key

1. Sign in to [nuget.org](https://www.nuget.org/) with the account you will publish from. Your Formulate Pro account works.
2. Open the account menu and choose API Keys, then Create.
3. Give it a name such as `formulate-release`.
4. Set Select Scopes to "Push", and choose "Push new packages and package versions".
5. Under Select Packages, set Glob Pattern to `Umbraco.Community.Formulate*`. This limits the key to the Formulate packages, so a leaked key cannot touch your other packages.
6. Set an expiry. The longest NuGet allows is one year. Put a reminder in your calendar, because a release will fail on an expired key.
7. Create the key and copy it. NuGet shows it only once.

A glob key that matches only packages that do not exist yet works for the first push. NuGet creates the packages under your account when they are first pushed.

### 3. Give the key to GitHub

1. In the repository, open Settings, then Secrets and variables, then Actions.
2. Choose New repository secret.
3. Name it `NUGET_API_KEY` (exactly) and paste the key.

Only the publish job of `release.yml` reads the secret. The job that runs the repository's code has a read-only token and no secret.

### 4. Optional: reserve the ID prefix

NuGet can reserve a prefix, so that nobody else can publish packages whose IDs start with it, and so that your packages show a reserved mark. You may ask for `Umbraco.Community.Formulate`.

- It is optional. Without it, the packages still publish, but another account could publish an ID such as `Umbraco.Community.Formulate.Fake`.
- It is a request that NuGet's staff review. They may decline it. Their rules say a prefix should match the owner's identity or product.
- Other accounts already use `Umbraco.Community.`, so you cannot reserve that whole prefix. A prefix is the start of an ID, so `Umbraco.Community.Formulate` also covers the sub-packages.
- There is no form for it on nuget.org. Send an email to account@nuget.org with your display name on nuget.org and the prefix you want to reserve. Read NuGet's page on [ID prefix reservation](https://learn.microsoft.com/nuget/nuget-org/id-prefix-reservation) first.

Do this after the first release, so the prefix is in use when NuGet looks at it.

## Make a release

A release is a tag. The tag is the version. `release.yml` does the rest.

1. Check that `v5/main` is green. Open the Actions tab and look at the latest CI run on `v5/main`. It builds, tests, checks Umbraco 18 and 19 compatibility, packs, and runs the browser tests on those packages on Umbraco 17.8.2, 18.3.2 and 19.0.0-rc1. To run the browser tests on packages from your own checkout, run `npm run test:packages` in `tests/e2e` (see the [README](../README.md#running-the-tests)).
2. Update `CHANGELOG.md`. Move the notes under the new version and date. Commit and push to `v5/main`.
3. Make sure your local checkout is the commit you mean to release:

   ```
   git switch v5/main
   git pull
   git log -1
   ```

4. Create the tag and push it:

   ```
   git tag v5.0.0
   git push origin v5.0.0
   ```

5. Open the Actions tab and watch the Release workflow. It does these things:
   - Checks that the tagged commit is on `v5/main`. If it is not, the workflow stops and says so.
   - Reads the version from the tag. `v5.0.0` becomes `5.0.0`. The tag must look like `v5.0.0` or `v5.0.0-rc.1`.
   - Builds, runs the .NET tests, and packs all eight packages with that version.
   - In a second job that runs none of the repository's code, pushes the packages to NuGet with `NUGET_API_KEY` and creates a GitHub release with the packages attached and generated notes.
6. When it finishes, check [nuget.org/packages/Umbraco.Community.Formulate](https://www.nuget.org/packages/Umbraco.Community.Formulate). New versions take a few minutes to be indexed and to pass NuGet's validation.
7. Open the GitHub release and edit its notes if you want. Copy the highlights from `CHANGELOG.md`.

The push uses `--skip-duplicate`. If the workflow runs again for the same tag, versions already on NuGet are skipped and the rest are pushed. The step that creates the GitHub release then fails, because the release already exists. That is harmless. NuGet never accepts the same version twice, so to fix a bad release, publish the next version.

## Prereleases

A tag with a suffix, such as `v5.0.0-rc.1`, builds `5.0.0-rc.1`. NuGet marks it as a prerelease, and the GitHub release is marked as one too. People find it only when they ask for prereleases (`dotnet add package Umbraco.Community.Formulate --prerelease`, or the prerelease box in Visual Studio).

Use a prerelease to try the whole process before 5.0.0. Prerelease versions can never be removed from NuGet, only unlisted, so use a suffix such as `-rc.1`, not `-test`.

Advise people to use the latest Umbraco 17.x. The README says so.

## Publish by hand

Use this only if GitHub Actions is not available.

1. Pack:

   ```
   DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet pack src/Formulate.sln -c Release -p:Version=5.0.0 -o artifacts/packages
   ```

2. Push, with your key in the `NUGET_API_KEY` environment variable:

   ```
   DOTNET_CLI_TELEMETRY_OPTOUT=1 dotnet nuget push "artifacts/packages/*.nupkg" --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json --skip-duplicate
   ```

3. Create the tag and the GitHub release yourself.

Packing needs Node.js 24, because `dotnet pack` builds both TypeScript clients.

## Umbraco Marketplace

The Umbraco Marketplace lists a package when its NuGet package carries the tag `umbraco-marketplace` and depends on an Umbraco package. Formulate meets both. Only the main package has the tag, so only it is listed. The `Umbraco.Community.Formulate` meta package depends on `Umbraco.Cms.Core` and `Umbraco.Cms` directly, both with the supported range, so the Marketplace can read the supported Umbraco versions from the dependency range.

1. The Marketplace scans NuGet for newly tagged packages every 24 hours at 04:00 UTC. Known packages refresh every 2 hours. Wait for the first scan, or trigger one by hand. Send a `POST` to `https://functions.marketplace.umbraco.com/api/InitiateSinglePackageSyncFunction` with the header `Content-Type: application/json` and the body `{"PackageId": "Umbraco.Community.Formulate"}`. Umbraco limits this to one request a minute per package.
2. The listing's details come from `umbraco-marketplace.json`. It has the title, description, category, license, tags and author. Anything it leaves out falls back to the NuGet package's data.
3. The Marketplace reads the file from the folder the package's project URL points to. Formulate's project URL is `https://www.formulate.rocks/`, so it reads `https://www.formulate.rocks/umbraco-marketplace.json`, which is the root of the `gh-pages` branch. The copy in the root of the repository is the one you edit. Copy it to the root of `gh-pages` after each change.
4. Check the file at [marketplace.umbraco.com/validate](https://marketplace.umbraco.com/validate).
5. A package with no screenshots in the file is listed without them. To add some later, add objects with an `ImageUrl` and a `Caption` to the `Screenshots` field.

Keep the repository copy and the website copy the same. The schema is documented at [docs.umbraco.com](https://docs.umbraco.com/umbraco-dxp/marketplace/listing-your-package).

## Old packages

You cannot do anything to the old Rhythm packages (`Formulate`, `Formulate.Binaries`, `Formulate.Deploy`), because they belong to Rhythm Agency's NuGet account, and you do not have access to it. They cannot be deprecated from your account. The README tells people to use `Umbraco.Community.Formulate` instead.

`Formulate.Pro` is yours. Formulate Pro is now part of Formulate. To tell its users:

1. Sign in to nuget.org with the account that owns `Formulate.Pro`.
2. Open the package's page and choose Manage package, then Deprecation.
3. Tick "Legacy" and every version.
4. In "Suggested alternatives", enter the package `Umbraco.Community.Formulate`.
5. In the message, say that Formulate Pro is now part of Formulate 5. Designed Email and the Basic theme come with `Umbraco.Community.Formulate`.
6. Save.

Do this after `Umbraco.Community.Formulate` 5.0.0 is on NuGet, so the suggested alternative exists.

## The website

formulate.rocks is a Jekyll site. It is the `gh-pages` branch of `Nicholas-Westby/formulate`. GitHub Pages serves it. The domain's DNS is at GoDaddy. Today `www.formulate.rocks` points to Rhythm Agency's old GitHub Pages (`rhythmagency.github.io`), and that repository is archived but still served. Move the site so that it comes from your repository.

The old site keeps working until step 4.

1. Push the updated site: `git push origin gh-pages`.
2. Turn on GitHub Pages. In `Nicholas-Westby/formulate`, open Settings, then Pages. Choose "Deploy from a branch", branch `gh-pages`, folder `/ (root)`, and save.
3. Set the custom domain. On the same page, enter `www.formulate.rocks` and save. If GitHub says the domain is taken (the archived Rhythm repository still claims it), verify it:
   1. Open your account's Settings, then Pages, then "Add a domain".
   2. Enter `formulate.rocks`.
   3. GitHub shows a TXT record. Add it at GoDaddy (step 4 shows where).
   4. Press Verify. Then set the custom domain on the repository again.

   If the old account had verified `formulate.rocks` with GitHub, GitHub can refuse yours. Ask whoever has the old account to remove the domain under their Settings, then Pages. If that is not possible, ask GitHub Support to release it, and show that you control the domain with a DNS TXT record.
4. Change the DNS at GoDaddy. Open Domain Portfolio, choose `formulate.rocks`, then DNS.

   | Type | Name | Value | What to do |
   | --- | --- | --- | --- |
   | CNAME | `www` | `nicholas-westby.github.io` | Edit the existing record. It points to `rhythmagency.github.io`. |
   | A | `@` | `185.199.108.153` | Replace the existing `@` A records. Remove the domain forwarding rule under Forwarding too, because it owns those records. |
   | A | `@` | `185.199.109.153` | |
   | A | `@` | `185.199.110.153` | |
   | A | `@` | `185.199.111.153` | |
   | AAAA | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` | Optional (IPv6). One record per address. |
   | MX, TXT | `@` | (existing) | Leave them as they are. They are the GoDaddy email records and a Google verification record. |

5. Wait for the check. On the repository's Pages settings, wait for "DNS check successful". This takes minutes to a few hours. Then tick "Enforce HTTPS". GitHub sends `formulate.rocks` visitors to `www.formulate.rocks` itself.
6. Confirm. `https://www.formulate.rocks` shows the new home page, and `https://formulate.rocks` redirects to it.

The repository has a `CNAME` file on `gh-pages`. If you change the domain, change that file too. The Pages settings page writes it for you when you set the custom domain.

## If something goes wrong

| Problem | What to do |
| --- | --- |
| The Release workflow says the commit is not on `v5/main`. | Merge or push the commit to `v5/main`. Delete the tag (`git push origin :refs/tags/v5.0.0`, then `git tag -d v5.0.0`) and tag again. |
| The tag is not a version. | The tag must look like `v5.0.0` or `v5.0.0-rc.1`. Delete it and tag again. |
| The push step fails with 401 or 403. | The key is missing, expired, or its glob does not match. Create a new key and update the `NUGET_API_KEY` secret. |
| The push says a package already exists. | `--skip-duplicate` skips it. Nothing to do. To change a published package, publish the next version. |
| A bad version is on NuGet. | You cannot delete it. On nuget.org, unlist it (Manage package) and publish a fixed version. Deprecate the bad one if people may still have it. |
| The Marketplace shows no listing after a day. | Check that the main package has the `umbraco-marketplace` tag on nuget.org, then trigger a sync (see above). |
