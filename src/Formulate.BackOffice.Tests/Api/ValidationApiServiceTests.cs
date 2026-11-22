using System.Text.Json;
using Formulate.BackOffice.Api.Json;
using Formulate.BackOffice.Api.Models.Validation;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.Core.Validations;
using Formulate.Core.Validations.Mandatory;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class ValidationApiServiceTests
{
    private static readonly Guid MandatoryKind = Guid.Parse(MandatoryValidationDefinition.Constants.KindId);

    private readonly TreeHarness _tree = new();
    private readonly CapturingLogger<ConfigurationJson> _logger = new();

    private ValidationApiService CreateService() => new(
        _tree.Repositories.Validations,
        _tree.Tree,
        new ValidationDefinitionCollection(() => new IValidationDefinition[] { new MandatoryValidationDefinition(_tree.Repositories.JsonUtility) }),
        new ConfigurationJson(_tree.Repositories.JsonUtility, _logger));

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static T Ok<T>(ServiceResult<T> result)
    {
        Assert.True(result.Status == ServiceStatus.Success, $"{result.Status}: {result.Field} {result.Message}");
        return result.Value!;
    }

    private static (ServiceStatus, string?) Tuple<T>(ServiceResult<T> result) => (result.Status, result.Field);

    [Fact]
    public void Create_then_get_validation_roundtrips()
    {
        var folder = _tree.AddFolder(FormConstantsRoot.Validations);
        var service = CreateService();
        var id = Guid.NewGuid();

        Ok(service.Create(new CreateValidationRequestModel { Id = id, ParentId = folder.Id, KindId = MandatoryKind, Name = "Required", Alias = "required", Configuration = Json("""{"message":"Please fill this in"}""") }));
        var got = Ok(service.Get(id));

        Assert.Equal((id, folder.Id, MandatoryKind, "Required", "required"), (got.Id, got.ParentId, got.KindId, got.Name, got.Alias));
        Assert.Equal(JsonValueKind.Object, got.Configuration!.Value.ValueKind);
        Assert.Contains("Please fill this in", got.Configuration!.Value.GetRawText());
        Assert.Equal(new[] { FormConstantsRoot.Validations, folder.Id, id }, _tree.Repositories.Validations.Get(id).Path);
    }

    [Fact]
    public void Create_at_the_top_of_the_tree_has_no_parent()
    {
        var id = Guid.NewGuid();

        var created = Ok(CreateService().Create(new CreateValidationRequestModel { Id = id, KindId = MandatoryKind, Name = "Required" }));

        Assert.Null(created.ParentId);
        Assert.Equal(new[] { FormConstantsRoot.Validations, id }, _tree.Repositories.Validations.Get(id).Path);
    }

    [Fact]
    public void Update_replaces_content_and_keeps_kind_and_place()
    {
        var folder = _tree.AddFolder(FormConstantsRoot.Validations);
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateValidationRequestModel { Id = id, ParentId = folder.Id, KindId = MandatoryKind, Name = "Required" }));

        var updated = Ok(service.Update(id, new UpdateValidationRequestModel { Name = "Renamed", Alias = "renamed", Configuration = Json("""{"message":"New"}""") }));

        Assert.Equal(("Renamed", "renamed", folder.Id, MandatoryKind), (updated.Name, updated.Alias, updated.ParentId, updated.KindId));
        Assert.Contains("New", updated.Configuration!.Value.GetRawText());
        Assert.Equal(new[] { FormConstantsRoot.Validations, folder.Id, id }, _tree.Repositories.Validations.Get(id).Path);
    }

    [Fact]
    public void Create_validates_name_kind_id_and_parent_naming_the_field()
    {
        var service = CreateService();
        var taken = _tree.AddValidation();
        var form = _tree.AddForm();

        Assert.Equal((ServiceStatus.Invalid, "name"), Tuple(service.Create(new CreateValidationRequestModel { Id = Guid.NewGuid(), KindId = MandatoryKind, Name = " " })));
        Assert.Equal((ServiceStatus.Invalid, "kindId"), Tuple(service.Create(new CreateValidationRequestModel { Id = Guid.NewGuid(), KindId = Guid.NewGuid(), Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "id"), Tuple(service.Create(new CreateValidationRequestModel { Id = Guid.Empty, KindId = MandatoryKind, Name = "x" })));
        Assert.Equal((ServiceStatus.Conflict, "id"), Tuple(service.Create(new CreateValidationRequestModel { Id = taken.Id, KindId = MandatoryKind, Name = "x" })));
        Assert.Equal((ServiceStatus.Conflict, "id"), Tuple(service.Create(new CreateValidationRequestModel { Id = form.Id, KindId = MandatoryKind, Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "parentId"), Tuple(service.Create(new CreateValidationRequestModel { Id = Guid.NewGuid(), ParentId = Guid.NewGuid(), KindId = MandatoryKind, Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "parentId"), Tuple(service.Create(new CreateValidationRequestModel { Id = Guid.NewGuid(), ParentId = form.Id, KindId = MandatoryKind, Name = "x" })));
        Assert.Single(_tree.Repositories.ValidationStore.GetAll());
    }

    [Fact]
    public void Create_in_folder_of_other_tree_is_rejected()
    {
        var formsFolder = _tree.AddFolder(FormConstantsRoot.Forms);
        var dataValuesFolder = _tree.AddFolder(FormConstantsRoot.DataValues);
        var service = CreateService();

        Assert.Equal((ServiceStatus.Invalid, "parentId"), Tuple(service.Create(new CreateValidationRequestModel { Id = Guid.NewGuid(), ParentId = formsFolder.Id, KindId = MandatoryKind, Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "parentId"), Tuple(service.Create(new CreateValidationRequestModel { Id = Guid.NewGuid(), ParentId = dataValuesFolder.Id, KindId = MandatoryKind, Name = "x" })));
        Assert.Empty(_tree.Repositories.ValidationStore.GetAll());
    }

    [Fact]
    public void Update_rejects_an_empty_name_and_unknown_items_are_not_found()
    {
        var service = CreateService();
        var existing = _tree.AddValidation();

        Assert.Equal((ServiceStatus.Invalid, "name"), Tuple(service.Update(existing.Id, new UpdateValidationRequestModel { Name = "" })));
        Assert.Equal(ServiceStatus.NotFound, service.Get(Guid.NewGuid()).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Update(Guid.NewGuid(), new UpdateValidationRequestModel { Name = "x" }).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Delete(Guid.NewGuid()).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Get(_tree.AddForm().Id).Status);
    }

    [Fact]
    public void Delete_removes_the_validation_and_lists_its_id_even_when_a_form_uses_it()
    {
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateValidationRequestModel { Id = id, KindId = MandatoryKind, Name = "Required" }));
        var form = _tree.AddForm();

        var deleted = Ok(service.Delete(id));

        Assert.Equal(new[] { id }, deleted.DeletedIds);
        Assert.Null(_tree.Repositories.Validations.Get(id));
        Assert.NotNull(_tree.Repositories.Forms.Get(form.Id));
    }

    [Theory]
    [InlineData("""[1,"a",{"b":null}]""")]
    [InlineData("\"just text\"")]
    public void Configuration_that_is_not_an_object_roundtrips_when_the_kind_is_not_installed(string configuration)
    {
        // Only a kind with no installed definition keeps its configuration exactly as sent.
        var id = Guid.NewGuid();
        _tree.Repositories.Validations.Save(new PersistedValidation { Id = id, Name = "Odd", KindId = Guid.NewGuid(), Path = new[] { FormConstantsRoot.Validations, id } });
        var service = CreateService();

        Ok(service.Update(id, new UpdateValidationRequestModel { Name = "Odd", Configuration = Json(configuration) }));
        var got = Ok(service.Get(id));

        Assert.Equal(configuration, got.Configuration!.Value.GetRawText());
    }

    [Theory]
    [InlineData("""[1,"a",{"b":null}]""")]
    [InlineData("\"just text\"")]
    public void Create_and_update_refuse_a_configuration_the_kind_cannot_read(string configuration)
    {
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateValidationRequestModel { Id = id, KindId = MandatoryKind, Name = "Required" }));

        var created = service.Create(new CreateValidationRequestModel { Id = Guid.NewGuid(), KindId = MandatoryKind, Name = "Odd", Configuration = Json(configuration) });
        var updated = service.Update(id, new UpdateValidationRequestModel { Name = "Renamed", Configuration = Json(configuration) });

        foreach (var result in new[] { created, updated })
        {
            Assert.Equal((ServiceStatus.Invalid, "configuration"), Tuple(result));
            Assert.Contains(MandatoryValidationDefinition.Constants.Name, result.Message);
            Assert.DoesNotContain("deserialize", result.Message);
        }

        var stored = Assert.Single(_tree.Repositories.ValidationStore.GetAll());
        Assert.Equal("Required", stored.Name);
    }

    [Fact]
    public void Invalid_stored_configuration_is_returned_as_a_string_and_warned_about()
    {
        var id = Guid.NewGuid();
        _tree.Repositories.Validations.Save(new PersistedValidation { Id = id, Name = "Odd validation", KindId = MandatoryKind, Path = new[] { FormConstantsRoot.Validations, id }, Data = "<<oops" });

        var got = Ok(CreateService().Get(id));

        Assert.Equal("<<oops", got.Configuration!.Value.GetString());
        Assert.Contains(_logger.Entries, x => x.Level == Microsoft.Extensions.Logging.LogLevel.Warning && x.Message.Contains("Odd validation"));
    }
}
