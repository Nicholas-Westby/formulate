namespace Formulate.Extensions.StoreData.Migrations
{
    using Formulate.Extensions.StoreData.Models;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Infrastructure.Migrations.Expressions.Create.Index;
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
        /// The name of the index that serves a form's submissions in list order.
        /// </summary>
        internal const string IndexName = "IX_FormulateSubmissions_FormId_CreationDate";

        /// <summary>
        /// The columns of the index: the form, then the list order (newest first, then by ID).
        /// </summary>
        internal static readonly string[] IndexColumns =
        {
            nameof(FormulateSubmissionDto.FormId),
            nameof(FormulateSubmissionDto.CreationDate),
            nameof(FormulateSubmissionDto.SubmissionId),
        };

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

            if (IndexExists(IndexName) == false)
            {
                var index = Create.Index(IndexName).OnTable(FormulateSubmissionDto.TableName);

                foreach (var column in IndexColumns)
                {
                    index = index.OnColumn(column).Ascending();
                }

                index.WithOptions().NonClustered().Do();
            }

            return Task.CompletedTask;
        }
    }
}
