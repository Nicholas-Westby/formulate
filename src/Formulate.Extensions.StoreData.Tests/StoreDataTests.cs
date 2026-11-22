using Formulate.Core.FormFields;
using Formulate.Core.Forms;
using Formulate.Core.Submissions.Requests;
using Formulate.Extensions.StoreData.Migrations;
using Formulate.Extensions.StoreData.Utilities;
using Microsoft.Extensions.Options;
using Umbraco.Cms.Infrastructure.Migrations;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class StoreDataTests : IDisposable
{
    private readonly SqliteSubmissionDatabase _database = new();
    private readonly FixedPageUrls _pageUrls = new();
    private readonly string _root = Path.Combine(Path.GetTempPath(), "formulate-storedata-" + Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        _database.Dispose();
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, true);
        }
    }

    private IStoreData CreateStoreData()
    {
        var settings = Options.Create(new StoreDataSettings());
        var folders = new UploadFolders(_root, settings.Value.UploadsFolderPath);
        return new Utilities.StoreData(
            new StoreFields(new Formulate.Core.FormFields.FormFieldDefinitionCollection(() => Array.Empty<Formulate.Core.FormFields.IFormFieldDefinition>())),
            new StoreFiles(folders, settings, new CapturingLogger<StoreFiles>()),
            new TestJsonUtility(),
            new SubmissionRepository(_database),
            _pageUrls,
            folders,
            new CapturingLogger<Utilities.StoreData>());
    }

    private static (PersistedForm Form, PersistedFormField Field) CreateForm()
    {
        var field = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.NewGuid(), Name = "Email" };
        return (new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { field } }, field);
    }

    private static FormSubmissionRequest Request(PersistedForm form, PersistedFormField field, int? pageId) =>
        new(
            form,
            pageId,
            new Dictionary<Guid, IStringFormFieldValues> { [field.Id] = new StringFormFieldValues("a@example.com") },
            new Dictionary<Guid, IFileFormFieldValues>());

    [Fact]
    public async Task The_page_url_is_stored_with_the_submission()
    {
        var (form, field) = CreateForm();
        var request = Request(form, field, 1234);
        _pageUrls.Url = "https://example.com/contact/";

        await CreateStoreData().ExecuteAsync(request, TestContext.Current.CancellationToken);

        var stored = new SubmissionRepository(_database).Get(request.Id);
        Assert.NotNull(stored);
        Assert.Equal(1234, stored.PageId);
        Assert.Equal("https://example.com/contact/", stored.Url);
        Assert.Equal(form.Id, stored.FormId);
    }

    [Fact]
    public async Task A_submission_from_no_page_has_no_url()
    {
        var (form, field) = CreateForm();
        var request = Request(form, field, null);
        _pageUrls.Url = "https://example.com/contact/";

        await CreateStoreData().ExecuteAsync(request, TestContext.Current.CancellationToken);

        var stored = new SubmissionRepository(_database).Get(request.Id);
        Assert.NotNull(stored);
        Assert.Null(stored.PageId);
        Assert.Null(stored.Url);
    }

    [Fact]
    public async Task A_file_the_file_system_refuses_does_not_lose_the_submission()
    {
        var upload = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(Formulate.Core.FormFields.Upload.UploadFieldDefinition.Constants.KindId), Name = "CV" };
        var (form, field) = CreateForm();
        form.Fields = new[] { field, upload };
        var request = new FormSubmissionRequest(
            form,
            null,
            new Dictionary<Guid, IStringFormFieldValues> { [field.Id] = new StringFormFieldValues("a@example.com") },
            new Dictionary<Guid, IFileFormFieldValues>
            {
                [upload.Id] = new FilesFormFieldValues(new[] { new FormFileValue { Name = "cv.pdf", Data = new byte[] { 1 } } }),
            });

        // A file where the field's folder should be makes creating that folder fail.
        var folders = new UploadFolders(_root, null);
        Directory.CreateDirectory(folders.SubmissionFolder(request.Id));
        File.WriteAllText(folders.FieldFolder(request.Id, upload.Id), "in the way");

        await CreateStoreData().ExecuteAsync(request, TestContext.Current.CancellationToken);

        var stored = new SubmissionRepository(_database).Get(request.Id);
        Assert.NotNull(stored);
        Assert.Contains("a@example.com", stored.DataValues);
        Assert.Equal("[]", stored.FileValues);
    }

    [Fact]
    public async Task A_row_that_cannot_be_inserted_leaves_no_uploads_behind()
    {
        var upload = new PersistedFormField { Id = Guid.NewGuid(), KindId = Guid.Parse(Formulate.Core.FormFields.Upload.UploadFieldDefinition.Constants.KindId), Name = "CV" };
        var form = new PersistedForm { Id = Guid.NewGuid(), Fields = new[] { upload } };
        var request = new FormSubmissionRequest(
            form,
            null,
            new Dictionary<Guid, IStringFormFieldValues>(),
            new Dictionary<Guid, IFileFormFieldValues>
            {
                [upload.Id] = new FilesFormFieldValues(new[] { new FormFileValue { Name = "cv.pdf", Data = new byte[] { 1 } } }),
            });
        var repository = new FakeSubmissionRepository { OnInsert = _ => throw new InvalidOperationException("database is down") };
        var settings = Options.Create(new StoreDataSettings());
        var folders = new UploadFolders(_root, null);
        var logger = new CapturingLogger<Utilities.StoreData>();
        var store = new Utilities.StoreData(
            new StoreFields(new Formulate.Core.FormFields.FormFieldDefinitionCollection(() => Array.Empty<Formulate.Core.FormFields.IFormFieldDefinition>())),
            new StoreFiles(folders, settings, new CapturingLogger<StoreFiles>()),
            new TestJsonUtility(),
            repository,
            _pageUrls,
            folders,
            logger);

        var thrown = await Assert.ThrowsAsync<InvalidOperationException>(() => store.ExecuteAsync(request, TestContext.Current.CancellationToken));

        Assert.Equal("database is down", thrown.Message);
        Assert.False(Directory.Exists(folders.SubmissionFolder(request.Id)));
        Assert.Contains(logger.Entries, x => x.Level == Microsoft.Extensions.Logging.LogLevel.Warning && x.Message.Contains(request.Id.ToString()));
    }

    [Fact]
    public void The_fixture_schema_matches_the_dto_and_the_index_the_migration_defines()
    {
        // The fixture table is hand-written, because Umbraco's migration expressions need a full Umbraco
        // database to run. So compare what SQLite actually holds with the DTO and with the step's own
        // definitions. This does not run the step: the live upgrade and fresh boots do.
        var dtoColumns = typeof(Models.FormulateSubmissionDto).GetProperties()
            .Select(x => ((NPoco.ColumnAttribute)x.GetCustomAttributes(typeof(NPoco.ColumnAttribute), false).Single()).Name)
            .OrderBy(x => x)
            .ToArray();
        var table = _database.Run(db => db.Fetch<(string name, string type, int pk)>("SELECT name, type, pk FROM pragma_table_info('FormulateSubmissions')"));
        var indexes = _database.Run(db => db.Fetch<(string name, int unique)>("SELECT name, \"unique\" FROM pragma_index_list('FormulateSubmissions')"));
        var indexColumns = _database.Run(db => db.Fetch<string>($"SELECT name FROM pragma_index_info('{AddSubmissionUrlAndFormIndex.IndexName}') ORDER BY seqno"));

        Assert.Equal(dtoColumns, table.Select(x => x.name).OrderBy(x => x).ToArray());
        Assert.Equal("SubmissionId", Assert.Single(table, x => x.pk == 1).name);
        Assert.Equal($"NVARCHAR({Models.FormulateSubmissionDto.UrlMaxLength})", Assert.Single(table, x => x.name == "Url").type);

        var index = Assert.Single(indexes, x => x.name == AddSubmissionUrlAndFormIndex.IndexName);
        Assert.Equal(0, index.unique);
        Assert.Equal(AddSubmissionUrlAndFormIndex.IndexColumns, indexColumns);
        Assert.Equal(new[] { "FormId", "CreationDate", "SubmissionId" }, indexColumns);
    }

    [Fact]
    public void The_migration_plan_adds_the_url_step_after_the_v4_table_step()
    {
        var plan = new FormulateStoreDataMigrationPlan();

        // A fresh install runs both steps.
        Assert.Equal(
            new[] { typeof(AddSubmissionsTable), typeof(AddSubmissionUrlAndFormIndex) },
            Walk(plan, string.Empty));

        // A database that ran the v4 step, which stored the state "AddTable", runs only the new one.
        Assert.Equal(new[] { typeof(AddSubmissionUrlAndFormIndex) }, Walk(plan, "AddTable"));
        Assert.Empty(Walk(plan, plan.FinalState));
        Assert.Equal("formulate-5-submissions-url", plan.FinalState);
    }

    private static List<Type> Walk(MigrationPlan plan, string state)
    {
        var steps = new List<Type>();
        while (plan.Transitions.TryGetValue(state, out var transition) && transition is not null)
        {
            steps.Add(transition.MigrationType);
            state = transition.TargetState;
            Assert.True(steps.Count <= plan.Transitions.Count, "The plan has a loop.");
        }

        return steps;
    }
}
