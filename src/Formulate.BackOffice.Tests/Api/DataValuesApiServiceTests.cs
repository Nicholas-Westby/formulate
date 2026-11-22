using System.Text.Json;
using Formulate.BackOffice.Api.Json;
using Formulate.BackOffice.Api.Models.DataValues;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.Core.DataValues;
using Formulate.Core.DataValues.Legacy;
using Formulate.Core.DataValues.List;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class DataValuesApiServiceTests
{
    private static readonly Guid ListKind = Guid.Parse(ListDataValuesDefinition.Constants.KindId);
    private static readonly Guid LegacyKind = Guid.Parse(LegacyDataValuesDefinition.Constants.KindId);

    private readonly TreeHarness _tree = new();
    private readonly CapturingLogger<ConfigurationJson> _logger = new();

    private DataValuesApiService CreateService() => new(
        _tree.Repositories.DataValues,
        _tree.Tree,
        new DataValuesDefinitionCollection(() => new IDataValuesDefinition[] { new ListDataValuesDefinition(_tree.Repositories.JsonUtility), new LegacyDataValuesDefinition() }),
        new ConfigurationJson(_tree.Repositories.JsonUtility, _logger));

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static T Ok<T>(ServiceResult<T> result)
    {
        Assert.True(result.Status == ServiceStatus.Success, $"{result.Status}: {result.Field} {result.Message}");
        return result.Value!;
    }

    private static (ServiceStatus, string?) Tuple<T>(ServiceResult<T> result) => (result.Status, result.Field);

    [Fact]
    public void Create_then_get_data_values_roundtrips()
    {
        var folder = _tree.AddFolder(FormConstantsRoot.DataValues);
        var service = CreateService();
        var id = Guid.NewGuid();

        Ok(service.Create(new CreateDataValuesRequestModel { Id = id, ParentId = folder.Id, KindId = ListKind, Name = "Colours", Alias = "colours", Configuration = Json("""{"items":[{"value":"Red"}]}""") }));
        var got = Ok(service.Get(id));

        Assert.Equal((id, folder.Id, ListKind, "Colours", "colours", false), (got.Id, got.ParentId, got.KindId, got.Name, got.Alias, got.IsLegacy));
        Assert.Contains("Red", got.Configuration!.Value.GetRawText());
        Assert.Equal(new[] { FormConstantsRoot.DataValues, folder.Id, id }, _tree.Repositories.DataValues.Get(id).Path);
    }

    [Fact]
    public void Update_replaces_content_and_keeps_kind_and_place()
    {
        var folder = _tree.AddFolder(FormConstantsRoot.DataValues);
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateDataValuesRequestModel { Id = id, ParentId = folder.Id, KindId = ListKind, Name = "Colours" }));

        var updated = Ok(service.Update(id, new UpdateDataValuesRequestModel { Name = "Shades", Alias = "shades", Configuration = Json("""{"items":[{"value":"Blue"}]}""") }));

        Assert.Equal(("Shades", "shades", folder.Id, ListKind), (updated.Name, updated.Alias, updated.ParentId, updated.KindId));
        Assert.Contains("Blue", updated.Configuration!.Value.GetRawText());
    }

    [Fact]
    public void Create_validates_name_kind_id_and_parent_and_refuses_legacy_kinds()
    {
        var service = CreateService();
        var validationsFolder = _tree.AddFolder(FormConstantsRoot.Validations);

        Assert.Equal((ServiceStatus.Invalid, "name"), Tuple(service.Create(new CreateDataValuesRequestModel { Id = Guid.NewGuid(), KindId = ListKind, Name = "" })));
        Assert.Equal((ServiceStatus.Invalid, "kindId"), Tuple(service.Create(new CreateDataValuesRequestModel { Id = Guid.NewGuid(), KindId = Guid.NewGuid(), Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "kindId"), Tuple(service.Create(new CreateDataValuesRequestModel { Id = Guid.NewGuid(), KindId = LegacyKind, Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "id"), Tuple(service.Create(new CreateDataValuesRequestModel { Id = Guid.Empty, KindId = ListKind, Name = "x" })));
        Assert.Equal((ServiceStatus.Conflict, "id"), Tuple(service.Create(new CreateDataValuesRequestModel { Id = _tree.AddDataValues().Id, KindId = ListKind, Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "parentId"), Tuple(service.Create(new CreateDataValuesRequestModel { Id = Guid.NewGuid(), ParentId = validationsFolder.Id, KindId = ListKind, Name = "x" })));
        Assert.Single(_tree.Repositories.DataValuesStore.GetAll());
    }

    [Fact]
    public void Legacy_data_values_cannot_be_updated()
    {
        var id = Guid.NewGuid();
        _tree.Repositories.DataValues.Save(new Formulate.Core.DataValues.PersistedDataValues { Id = id, Name = "Old", KindId = LegacyKind, Path = new[] { FormConstantsRoot.DataValues, id }, Data = "old stuff" });
        var service = CreateService();

        var got = Ok(service.Get(id));
        var result = service.Update(id, new UpdateDataValuesRequestModel { Name = "Changed" });

        Assert.True(got.IsLegacy);
        Assert.Equal("old stuff", got.Configuration!.Value.GetString());
        Assert.Equal(ServiceStatus.Conflict, result.Status);
        Assert.Contains("legacy", result.Message, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Old", _tree.Repositories.DataValues.Get(id).Name);
    }

    [Fact]
    public void Legacy_data_values_can_still_be_deleted()
    {
        var id = Guid.NewGuid();
        _tree.Repositories.DataValues.Save(new Formulate.Core.DataValues.PersistedDataValues { Id = id, Name = "Old", KindId = LegacyKind, Path = new[] { FormConstantsRoot.DataValues, id }, Data = "x" });

        var deleted = Ok(CreateService().Delete(id));

        Assert.Equal(new[] { id }, deleted.DeletedIds);
        Assert.Null(_tree.Repositories.DataValues.Get(id));
    }

    [Fact]
    public void Update_rejects_an_empty_name_and_unknown_items_are_not_found()
    {
        var service = CreateService();
        var existing = _tree.AddDataValues();
        existing.KindId = ListKind;

        Assert.Equal((ServiceStatus.Invalid, "name"), Tuple(service.Update(existing.Id, new UpdateDataValuesRequestModel { Name = " " })));
        Assert.Equal(ServiceStatus.NotFound, service.Get(Guid.NewGuid()).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Update(Guid.NewGuid(), new UpdateDataValuesRequestModel { Name = "x" }).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Delete(Guid.NewGuid()).Status);
    }

    [Fact]
    public void Create_and_update_refuse_list_items_sent_as_plain_strings()
    {
        // The configuration the Task 6 live run stored, which then broke the public page.
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateDataValuesRequestModel { Id = id, KindId = ListKind, Name = "Colors", Configuration = Json("""{"items":[{"value":"Red"}]}""") }));
        var strings = Json("""{"items":["red","green"]}""");

        var created = service.Create(new CreateDataValuesRequestModel { Id = Guid.NewGuid(), KindId = ListKind, Name = "Shades", Configuration = strings });
        var updated = service.Update(id, new UpdateDataValuesRequestModel { Name = "Colors", Configuration = strings });

        foreach (var result in new[] { created, updated })
        {
            Assert.Equal((ServiceStatus.Invalid, "configuration"), Tuple(result));
            Assert.Contains(ListDataValuesDefinition.Constants.Name, result.Message);
            Assert.DoesNotContain("Error converting", result.Message);
        }

        var stored = Assert.Single(_tree.Repositories.DataValuesStore.GetAll());
        Assert.Contains("Red", stored.Data);
    }

    [Fact]
    public void Data_values_whose_kind_is_not_installed_keep_any_configuration()
    {
        var id = Guid.NewGuid();
        _tree.Repositories.DataValues.Save(new Formulate.Core.DataValues.PersistedDataValues { Id = id, Name = "Orphan", KindId = Guid.NewGuid(), Path = new[] { FormConstantsRoot.DataValues, id } });

        var updated = Ok(CreateService().Update(id, new UpdateDataValuesRequestModel { Name = "Orphan", Configuration = Json("""{"items":["red","green"]}""") }));

        Assert.Equal("""{"items":["red","green"]}""", updated.Configuration!.Value.GetRawText());
    }

    [Fact]
    public void Invalid_stored_configuration_is_returned_as_a_string_and_warned_about()
    {
        var id = Guid.NewGuid();
        _tree.Repositories.DataValues.Save(new Formulate.Core.DataValues.PersistedDataValues { Id = id, Name = "Odd values", KindId = ListKind, Path = new[] { FormConstantsRoot.DataValues, id }, Data = "<<oops" });

        var got = Ok(CreateService().Get(id));

        Assert.Equal("<<oops", got.Configuration!.Value.GetString());
        Assert.Contains(_logger.Entries, x => x.Level == Microsoft.Extensions.Logging.LogLevel.Warning && x.Message.Contains("Odd values"));
    }
}
