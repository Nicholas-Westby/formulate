// Packs every Formulate package into artifacts/packages with a version of its own ("npm run pack:local"),
// and says how to run the browser tests or the dev site on it.
import { packLocal } from '../support/local-packages.ts';

const version = packLocal();

console.log(`
Packed Formulate ${version}.
Run the browser tests on it, in tests/e2e (add UMBRACO_SITE_VERSION for another Umbraco version):
  FORMULATE_PACKAGE_VERSION=${version} npx playwright test
Run the dev site on it, in the repository's root folder:
  dotnet run --project src/Website -p:FormulateFromPackages=true -p:FormulatePackageVersion=${version}`);
