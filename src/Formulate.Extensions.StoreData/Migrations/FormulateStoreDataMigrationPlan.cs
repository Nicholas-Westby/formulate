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
        public FormulateStoreDataMigrationPlan() : base("Formulate.Extensions.StoreData")
        {
        }

        protected override void DefinePlan()
        {
            // "AddTable" is the state the v4 migration runner stored under this plan name,
            // so databases that ran it already count as migrated. The step is idempotent.
            To<AddSubmissionsTable>("AddTable");
        }
    }
}
