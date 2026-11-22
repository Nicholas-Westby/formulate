namespace Formulate.BackOffice.Migrations
{
    using Umbraco.Cms.Core.Packaging;

    /// <summary>
    /// The package migration plan for Formulate.
    /// </summary>
    /// <remarks>
    /// Umbraco discovers package migration plans automatically and runs any that have not yet
    /// completed when the site starts. It stores the plan's progress in umbracoKeyValue under
    /// "Umbraco.Core.Upgrader.State+Formulate". Since sites store these states, never rename one:
    /// add each new step after the current final state.
    /// </remarks>
    public sealed class FormulateMigrationPlan : PackageMigrationPlan
    {
        /// <summary>
        /// The state Formulate 3 (for Umbraco 8) left under the same plan name.
        /// </summary>
        private const string Formulate3State = "state-1";

        /// <inheritdoc cref="FormulateMigrationPlan"/>
        public FormulateMigrationPlan()
            : base("Formulate")
        {
        }

        /// <inheritdoc />
        protected override void DefinePlan()
        {
            const string sectionGranted = "formulate-5-section-granted";
            const string formulate3SectionMoved = "formulate-5-legacy-section-moved";

            To<GrantSectionToAdministrators>(sectionGranted);
            To<MoveFormulate3SectionPermissions>(formulate3SectionMoved);

            // A site upgraded from Formulate 3 starts at that version's final state. Without this
            // transition, Umbraco would refuse to run the plan and the site would fail to start.
            From(Formulate3State).To<GrantSectionToAdministrators>(sectionGranted);
        }
    }
}
