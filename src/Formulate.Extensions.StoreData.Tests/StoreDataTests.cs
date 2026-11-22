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
            new StoreFields(),
            new StoreFiles(folders, settings, new CapturingLogger<StoreFiles>()),
            new TestJsonUtility(),
            new SubmissionRepository(_database),
            _pageUrls);
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
