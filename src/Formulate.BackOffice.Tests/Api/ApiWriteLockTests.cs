using Formulate.BackOffice.Api;
using Formulate.BackOffice.Api.Json;
using Formulate.BackOffice.Api.Models.DataValues;
using Formulate.BackOffice.Api.Models.Folder;
using Formulate.BackOffice.Api.Models.Form;
using Formulate.BackOffice.Api.Models.Layout;
using Formulate.BackOffice.Api.Models.Validation;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Configuration;
using Formulate.BackOffice.Definitions.Forms;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.BackOffice.Utilities;
using Formulate.Core.DataValues;
using Formulate.Core.DataValues.List;
using Formulate.Core.Folders;
using Formulate.Core.FormFields;
using Formulate.Core.FormHandlers;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Layouts.Basic;
using Formulate.Core.Templates;
using Formulate.Core.Validations;
using Formulate.Core.Validations.Mandatory;
using Microsoft.Extensions.Options;
using Moq;
using Umbraco.Cms.Core.Strings;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

/// <summary>
/// The Management API's writes run one at a time; its reads do not wait for them.
/// </summary>
public class ApiWriteLockTests
{
    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(10);

    private readonly TreeHarness _tree = new();
    private readonly ApiWriteLock _writeLock = new();
    private readonly CapturingLogger<ConfigurationJson> _logger = new();

    private ConfigurationJson ConfigurationJson => new(_tree.Repositories.JsonUtility, _logger);

    private FormApiService Forms() => new(
        _tree.Repositories.Forms,
        _tree.Repositories.Layouts,
        _tree.Tree,
        _tree.Repositories.FormDefinitions,
        new FormFieldDefinitionCollection(() => Array.Empty<IFormFieldDefinition>()),
        new FormHandlerDefinitionCollection(() => Array.Empty<IFormHandlerDefinition>()),
        ConfigurationJson,
        new DefaultShortStringHelper(new DefaultShortStringHelperConfig()),
        _writeLock);

    private LayoutApiService Layouts()
    {
        var template = new Mock<ITemplateDefinition>();
        template.SetupGet(x => x.KindId).Returns(Guid.Parse("00000000-0000-0000-0000-0000000000aa"));
        template.SetupGet(x => x.Name).Returns("Template");
        var templates = new TemplateDefinitionCollection(() => new[] { template.Object });

        return new(
            _tree.Repositories.Layouts,
            _tree.Repositories.Forms,
            _tree.Tree,
            new LayoutDefinitionCollection(() => new ILayoutDefinition[] { new BasicLayoutDefinition(_tree.Repositories.Forms, _tree.Repositories.JsonUtility) }),
            templates,
            new GetDefaultTemplateId(templates, Options.Create(new FormulateBackOfficeOptions())),
            ConfigurationJson,
            _writeLock);
    }

    private FolderApiService Folders() => new(
        _tree.Tree,
        _tree.Repositories.Folders,
        _tree.Repositories.Forms,
        _tree.Repositories.Layouts,
        _tree.Repositories.DataValues,
        _tree.Repositories.Validations,
        _writeLock);

    private ValidationApiService Validations() => new(
        _tree.Repositories.Validations,
        _tree.Tree,
        new ValidationDefinitionCollection(() => new IValidationDefinition[] { new MandatoryValidationDefinition(_tree.Repositories.JsonUtility) }),
        ConfigurationJson,
        _writeLock);

    private DataValuesApiService DataValues() => new(
        _tree.Repositories.DataValues,
        _tree.Tree,
        new DataValuesDefinitionCollection(() => new IDataValuesDefinition[] { new ListDataValuesDefinition(_tree.Repositories.JsonUtility) }),
        ConfigurationJson,
        _writeLock);

    private static T Ok<T>(ServiceResult<T> result)
    {
        Assert.True(result.Status == ServiceStatus.Success, $"{result.Status}: {result.Field} {result.Message}");
        return result.Value!;
    }

    private static PersistedFolder Folder(FakeTreeEntityRepository repository)
    {
        var id = Guid.NewGuid();
        var folder = new PersistedFolder { Id = id, Name = "Folder", Path = new[] { FormConstantsRoot.Forms, id } };
        repository.Add(folder);
        return folder;
    }

    [Fact]
    public async Task Two_folders_moved_into_each_other_at_once_cannot_both_succeed()
    {
        var repository = new FakeTreeEntityRepository();
        var a = Folder(repository);
        var b = Folder(repository);
        using var firstChecked = new ManualResetEventSlim();
        using var resumeFirst = new ManualResetEventSlim();
        var lookups = 0;

        // The first move stops once it has checked its target, just before it writes.
        repository.OnGetDescendants = () =>
        {
            if (Interlocked.Increment(ref lookups) == 1)
            {
                firstChecked.Set();
                resumeFirst.Wait(Patience);
            }
        };

        // Each request has its own services, as each HTTP request has its own scope; the lock is shared.
        var token = TestContext.Current.CancellationToken;
        var first = Task.Run(() => new MoveService(repository, _writeLock).Move<PersistedFolder>(a.Id, b.Id), token);
        Assert.True(firstChecked.Wait(Patience, token));
        var second = Task.Run(() => new MoveService(repository, _writeLock).Move<PersistedFolder>(b.Id, a.Id), token);

        // Without the lock the second move finishes now, having checked a tree the first move is about to change.
        await Task.WhenAny(second, Task.Delay(TimeSpan.FromMilliseconds(300), token));
        resumeFirst.Set();
        var results = await Task.WhenAll(first, second);

        Assert.Equal(1, results.Count(x => x.Status == ServiceStatus.Success));
        Assert.Contains(results, x => (x.Status, x.Field) == (ServiceStatus.Invalid, "targetId"));
        Assert.True(a.Path.Length == 2 || b.Path.Length == 2, "One of the folders must still be at the top of the tree.");
    }

    [Fact]
    public void Every_write_of_every_api_service_runs_inside_the_lock()
    {
        var writes = new List<bool>();
        var stores = new Action<Action?>[]
        {
            x => _tree.Repositories.FormStore.OnWrite = x,
            x => _tree.Repositories.LayoutStore.OnWrite = x,
            x => _tree.Repositories.FolderStore.OnWrite = x,
            x => _tree.Repositories.ValidationStore.OnWrite = x,
            x => _tree.Repositories.DataValuesStore.OnWrite = x,
        };
        foreach (var store in stores)
        {
            store(() => writes.Add(_writeLock.IsHeldByCurrentThread));
        }

        var folder = Ok(Folders().Create(new CreateFolderRequestModel { Id = Guid.NewGuid(), TreeAlias = TreeAliases.Forms, Name = "Folder" }));
        Ok(Folders().Update(folder.Id, new UpdateFolderRequestModel { Name = "Renamed" }));

        // The basic layout kind also writes a layout, from the notification the save sends.
        var form = Ok(Forms().Create(new CreateFormRequestModel { Id = Guid.NewGuid(), ParentId = folder.Id, KindId = new FormWithBasicLayoutDefinition().KindId, Name = "Form" }));
        Ok(Forms().Update(form.Id, new UpdateFormRequestModel { Name = "Renamed" }));
        var layout = Ok(Layouts().Create(new CreateLayoutRequestModel { Id = Guid.NewGuid(), FormId = form.Id, KindId = Guid.Parse(BasicLayoutDefinition.Constants.KindId), Name = "Layout" }));
        Ok(Layouts().Update(layout.Id, new UpdateLayoutRequestModel { Name = "Renamed" }));
        var copy = Ok(Forms().Duplicate(form.Id, new DuplicateFormRequestModel()));
        Ok(new MoveService(_tree.Tree, _writeLock).Move<PersistedForm>(copy.Id, null));
        Ok(Layouts().Delete(layout.Id));
        Ok(Forms().Delete(copy.Id));

        var validation = Ok(Validations().Create(new CreateValidationRequestModel { Id = Guid.NewGuid(), KindId = Guid.Parse(MandatoryValidationDefinition.Constants.KindId), Name = "Required" }));
        Ok(Validations().Update(validation.Id, new UpdateValidationRequestModel { Name = "Renamed" }));
        Ok(Validations().Delete(validation.Id));
        var dataValues = Ok(DataValues().Create(new CreateDataValuesRequestModel { Id = Guid.NewGuid(), KindId = Guid.Parse(ListDataValuesDefinition.Constants.KindId), Name = "Colors" }));
        Ok(DataValues().Update(dataValues.Id, new UpdateDataValuesRequestModel { Name = "Renamed" }));
        Ok(DataValues().Delete(dataValues.Id));

        // Deleting the folder deletes the form in it, and that form's layout.
        Ok(Folders().Delete(folder.Id));

        Assert.True(writes.Count >= 20, $"Only {writes.Count} writes were seen.");
        Assert.All(writes, Assert.True);
        Assert.False(_writeLock.IsHeldByCurrentThread);
    }

    [Fact]
    public async Task Reads_do_not_wait_for_a_write()
    {
        var folder = _tree.AddFolder(FormConstantsRoot.Forms);
        var form = _tree.AddForm();
        var layout = _tree.AddLayout(form);
        var validation = _tree.AddValidation();
        var dataValues = _tree.AddDataValues();
        using var writing = new ManualResetEventSlim();
        using var finishWrite = new ManualResetEventSlim();
        var token = TestContext.Current.CancellationToken;
        var write = Task.Run(
            () => _writeLock.Run(() =>
            {
                writing.Set();
                return finishWrite.Wait(Patience);
            }),
            token);
        Assert.True(writing.Wait(Patience, token));

        var reads = Task.Run(
            () => new[]
            {
                Forms().Get(form.Id).Status,
                Layouts().Get(layout.Id).Status,
                Folders().Get(folder.Id).Status,
                Validations().Get(validation.Id).Status,
                DataValues().Get(dataValues.Id).Status,
            },
            token);
        var readsFinished = await Task.WhenAny(reads, Task.Delay(Patience, token)) == reads;
        finishWrite.Set();

        Assert.True(readsFinished, "The reads waited for the write.");
        Assert.All(await reads, status => Assert.Equal(ServiceStatus.Success, status));
        Assert.True(await write);
    }
}
