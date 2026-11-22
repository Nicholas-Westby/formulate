using System.Text.Json;
using Formulate.BackOffice.Api.Json;
using Formulate.BackOffice.Api.Models.Layout;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Layouts.Basic;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class LayoutApiServiceTests
{
    private static readonly Guid BasicKind = Guid.Parse(BasicLayoutDefinition.Constants.KindId);

    private readonly RepositoryHarness _harness = new();
    private readonly CapturingLogger<ConfigurationJson> _logger = new();

    private LayoutApiService CreateService() => new(
        _harness.Layouts,
        _harness.Forms,
        new LayoutDefinitionCollection(() => new ILayoutDefinition[] { new BasicLayoutDefinition(_harness.Forms, _harness.JsonUtility) }),
        new ConfigurationJson(_harness.JsonUtility, _logger));

    private PersistedForm AddForm()
    {
        var id = Guid.NewGuid();
        var form = new PersistedForm { Id = id, Name = "Form", Path = new[] { RepositoryHarness.FormsRoot, id } };
        _harness.Forms.Save(form);
        return form;
    }

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static T Ok<T>(ServiceResult<T> result)
    {
        Assert.True(result.Status == ServiceStatus.Success, $"{result.Status}: {result.Field} {result.Message}");
        return result.Value!;
    }

    [Fact]
    public void Create_then_get_layout_roundtrips()
    {
        var form = AddForm();
        var service = CreateService();
        var template = Guid.NewGuid();
        var id = Guid.NewGuid();

        Ok(service.Create(new CreateLayoutRequestModel { Id = id, FormId = form.Id, KindId = BasicKind, Name = "Main", Alias = "main", TemplateId = template, Configuration = Json("""{"autoPopulate":false,"rows":[]}""") }));
        var got = Ok(service.Get(id));

        Assert.Equal(id, got.Id);
        Assert.Equal(form.Id, got.FormId);
        Assert.Equal(BasicKind, got.KindId);
        Assert.Equal("Main", got.Name);
        Assert.Equal("main", got.Alias);
        Assert.Equal(template, got.TemplateId);
        Assert.Equal(JsonValueKind.Object, got.Configuration!.Value.ValueKind);
        Assert.False(got.Configuration!.Value.GetProperty("autoPopulate").GetBoolean());
        Assert.Equal(new[] { RepositoryHarness.FormsRoot, form.Id, id }, _harness.Layouts.Get(id).Path);
    }

    [Fact]
    public void Update_replaces_content_and_keeps_the_form_and_kind()
    {
        var form = AddForm();
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateLayoutRequestModel { Id = id, FormId = form.Id, KindId = BasicKind, Name = "Main" }));

        var updated = Ok(service.Update(id, new UpdateLayoutRequestModel { Name = "Renamed", Alias = "renamed", Configuration = Json("""{"autoPopulate":true,"rows":[]}""") }));

        Assert.Equal("Renamed", updated.Name);
        Assert.Equal(form.Id, updated.FormId);
        Assert.Equal(BasicKind, updated.KindId);
        Assert.True(updated.Configuration!.Value.GetProperty("autoPopulate").GetBoolean());
    }

    [Fact]
    public void Create_validates_name_kind_form_and_id_naming_the_field()
    {
        var form = AddForm();
        var service = CreateService();

        Assert.Equal((ServiceStatus.Invalid, "name"), Tuple(service.Create(new CreateLayoutRequestModel { Id = Guid.NewGuid(), FormId = form.Id, KindId = BasicKind, Name = " " })));
        Assert.Equal((ServiceStatus.Invalid, "kindId"), Tuple(service.Create(new CreateLayoutRequestModel { Id = Guid.NewGuid(), FormId = form.Id, KindId = Guid.NewGuid(), Name = "x" })));
        Assert.Equal((ServiceStatus.Invalid, "formId"), Tuple(service.Create(new CreateLayoutRequestModel { Id = Guid.NewGuid(), FormId = Guid.NewGuid(), KindId = BasicKind, Name = "x" })));
        Assert.Equal((ServiceStatus.Conflict, "id"), Tuple(service.Create(new CreateLayoutRequestModel { Id = form.Id, FormId = form.Id, KindId = BasicKind, Name = "x" })));
        Assert.Empty(_harness.LayoutStore.GetAll());
    }

    [Fact]
    public void Update_rejects_an_empty_name()
    {
        var form = AddForm();
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateLayoutRequestModel { Id = id, FormId = form.Id, KindId = BasicKind, Name = "Main" }));

        Assert.Equal((ServiceStatus.Invalid, "name"), Tuple(service.Update(id, new UpdateLayoutRequestModel { Name = "" })));
    }

    [Fact]
    public void Unknown_layout_is_not_found_for_get_update_and_delete()
    {
        var service = CreateService();

        Assert.Equal(ServiceStatus.NotFound, service.Get(Guid.NewGuid()).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Update(Guid.NewGuid(), new UpdateLayoutRequestModel { Name = "x" }).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Delete(Guid.NewGuid()).Status);
    }

    [Fact]
    public void Delete_removes_only_the_layout_and_lists_its_id()
    {
        var form = AddForm();
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateLayoutRequestModel { Id = id, FormId = form.Id, KindId = BasicKind, Name = "Main" }));

        var deleted = Ok(service.Delete(id));

        Assert.Equal(new[] { id }, deleted.DeletedIds);
        Assert.Null(_harness.Layouts.Get(id));
        Assert.NotNull(_harness.Forms.Get(form.Id));
    }

    [Fact]
    public void Invalid_stored_configuration_is_returned_as_a_string_and_warned_about()
    {
        var form = AddForm();
        var id = Guid.NewGuid();
        _harness.Layouts.Save(new PersistedLayout { Id = id, Name = "Odd layout", KindId = Guid.NewGuid(), Path = new[] { RepositoryHarness.FormsRoot, form.Id, id }, Data = "<<oops" });

        var got = Ok(CreateService().Get(id));

        Assert.Equal("<<oops", got.Configuration!.Value.GetString());
        Assert.Contains(_logger.Entries, x => x.Level == Microsoft.Extensions.Logging.LogLevel.Warning && x.Message.Contains("Odd layout"));
    }

    private static (ServiceStatus, string?) Tuple<T>(ServiceResult<T> result) => (result.Status, result.Field);
}
