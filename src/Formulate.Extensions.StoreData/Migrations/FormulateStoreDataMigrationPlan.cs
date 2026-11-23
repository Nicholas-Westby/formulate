namespace Formulate.Extensions.StoreData.Migrations
{
    using Umbraco.Cms.Core.Packaging;

    /// <summary>
    /// The package migration plan for the Store Data extension.
    /// </summary>
    /// <remarks>
    /// Umbraco discovers package migration plans automatically and runs any
    /// that have not yet completed when the site starts.
    /// </remarks>
    public sealed class FormulateStoreDataMigrationPlan : PackageMigrationPlan
    {
        /// <inheritdoc cref="FormulateStoreDataMigrationPlan"/>
        /// <remarks>
        /// The package name is "Formulate", as for Formulate's own plan, because Umbraco's list of
        /// installed packages groups the plans by package name, and a name of its own would show
        /// Store Data there as a second package. The plan name stays "Formulate.Extensions.StoreData":
        /// Umbraco stores the plan's state in umbracoKeyValue under
        /// "Umbraco.Core.Upgrader.State+" and the plan name, so a new plan name would lose that state
        /// and run the plan again on every site that already ran it.
        /// </remarks>
        public FormulateStoreDataMigrationPlan()
            : base("Formulate", "Formulate.Extensions.StoreData")
        {
        }

        protected override void DefinePlan()
        {
            // "AddTable" is the state the v4 migration runner stored under this plan name,
            // so databases that ran it already count as migrated. The step is idempotent.
            To<AddSubmissionsTable>("AddTable");

            // Adds the page URL and the form index, to new and to existing databases alike.
            From("AddTable").To<AddSubmissionUrlAndFormIndex>("formulate-5-submissions-url");
        }
    }
}
