namespace Formulate.Extensions.StoreData.Migrations
{
    using Formulate.Extensions.StoreData.Models;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Infrastructure.Migrations;

    /// <summary>
    /// Adds the page URL column and the form index to the submissions table, when they are missing.
    /// </summary>
    /// <remarks>
    /// The table is created by <see cref="AddSubmissionsTable"/>, which databases that ran the v4
    /// migration have already completed, so these changes are a step of their own. Each part checks
    /// before it changes anything, so re-running the step is safe.
    /// </remarks>
    public sealed class AddSubmissionUrlAndFormIndex : AsyncMigrationBase
    {
        /// <summary>
        /// The name of the index on the form ID column.
        /// </summary>
        internal const string FormIdIndexName = "IX_FormulateSubmissions_FormId";

        public AddSubmissionUrlAndFormIndex(IMigrationContext context) : base(context)
        {
        }

        protected override Task MigrateAsync()
        {
            Logger.LogDebug("Running migration {MigrationStep}", nameof(AddSubmissionUrlAndFormIndex));

            if (ColumnExists(FormulateSubmissionDto.TableName, nameof(FormulateSubmissionDto.Url)) == false)
            {
                // Create.Column rather than Alter.Table: SQLite does not support the latter.
                Create.Column(nameof(FormulateSubmissionDto.Url))
                     .OnTable(FormulateSubmissionDto.TableName)
                     .AsString(FormulateSubmissionDto.UrlMaxLength)
                     .Nullable()
                     .Do();
            }

            if (IndexExists(FormIdIndexName) == false)
            {
                Create.Index(FormIdIndexName)
                      .OnTable(FormulateSubmissionDto.TableName)
                      .OnColumn(nameof(FormulateSubmissionDto.FormId))
                      .Ascending()
                      .WithOptions()
                      .NonClustered()
                      .Do();
            }

            return Task.CompletedTask;
        }
    }
}
