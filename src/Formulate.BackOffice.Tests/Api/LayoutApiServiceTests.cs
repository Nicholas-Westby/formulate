using System.Text.Json;
using Formulate.BackOffice.Api.Json;
using Formulate.BackOffice.Api.Models.Layout;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Configuration;
using Formulate.BackOffice.Persistence;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.BackOffice.Utilities;
using Formulate.Core.DataValues;
using Formulate.Core.Folders;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Layouts.Basic;
using Formulate.Core.Templates;
using Formulate.Core.Validations;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class LayoutApiServiceTests
{
    private static readonly Guid BasicKind = Guid.Parse(BasicLayoutDefinition.Constants.KindId);
    private static readonly Guid DefaultTemplate = Guid.Parse("00000000-0000-0000-0000-0000000000aa");
    private static readonly Guid OtherTemplate = Guid.Parse("00000000-0000-0000-0000-0000000000bb");

    private readonly RepositoryHarness _harness = new();
    private readonly CapturingLogger<ConfigurationJson> _logger = new();
    private readonly List<ILayoutDefinition> _extraLayouts = new();
    private readonly List<ITemplateDefinition> _templates = new() { Template(DefaultTemplate, "Plain JavaScript"), Template(OtherTemplate, "Other") };

    private LayoutApiService CreateService()
    {
        var templates = new TemplateDefinitionCollection(() => _templates);

        return new(
            _harness.Layouts,
            _harness.Forms,
            new TreeEntityRepository(_harness.Forms, _harness.Layouts, _harness.Folders, _harness.DataValues, _harness.Validations),
            new LayoutDefinitionCollection(() => new ILayoutDefinition[] { new BasicLayoutDefinition(_harness.Forms, _harness.JsonUtility) }.Concat(_extraLayouts)),
            templates,
            new GetDefaultTemplateId(templates, Options.Create(new FormulateBackOfficeOptions())),
            new ConfigurationJson(_harness.JsonUtility, _logger));
    }

    private static ITemplateDefinition Template(Guid id, string name)
    {
        var template = new Mock<ITemplateDefinition>();
        template.SetupGet(x => x.KindId).Returns(id);
        template.SetupGet(x => x.Name).Returns(name);
        return template.Object;
    }

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
        var template = OtherTemplate;
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

    [Fact]
    public void Create_with_the_id_of_a_folder_validation_or_data_values_is_a_conflict_and_writes_nothing()
    {
        var form = AddForm();
        var service = CreateService();
        var folderId = Guid.NewGuid();
        _harness.Folders.Save(new PersistedFolder { Id = folderId, Name = "f", Path = new[] { RepositoryHarness.FormsRoot, folderId } });
        var validationId = Guid.NewGuid();
        _harness.Validations.Save(new PersistedValidation { Id = validationId, Name = "v", Path = new[] { Guid.Parse(ValidationConstants.RootId), validationId } });
        var dataValuesId = Guid.NewGuid();
        _harness.DataValues.Save(new PersistedDataValues { Id = dataValuesId, Name = "d", Path = new[] { Guid.Parse(DataValuesConstants.RootId), dataValuesId } });

        foreach (var id in new[] { folderId, validationId, dataValuesId })
        {
            Assert.Equal((ServiceStatus.Conflict, "id"), Tuple(service.Create(new CreateLayoutRequestModel { Id = id, FormId = form.Id, KindId = BasicKind, Name = "Clash" })));
        }

        Assert.Empty(_harness.LayoutStore.GetAll());
    }

    [Fact]
    public void Create_and_update_without_a_template_use_the_default_template()
    {
        var form = AddForm();
        var service = CreateService();
        var id = Guid.NewGuid();

        var created = Ok(service.Create(new CreateLayoutRequestModel { Id = id, FormId = form.Id, KindId = BasicKind, Name = "Main" }));
        Assert.Equal(DefaultTemplate, created.TemplateId);
        Assert.Equal(DefaultTemplate, _harness.Layouts.Get(id).TemplateId);

        Ok(service.Update(id, new UpdateLayoutRequestModel { Name = "Main", TemplateId = OtherTemplate }));
        Assert.Equal(OtherTemplate, _harness.Layouts.Get(id).TemplateId);
        var updated = Ok(service.Update(id, new UpdateLayoutRequestModel { Name = "Main" }));

        Assert.Equal(DefaultTemplate, updated.TemplateId);
        Assert.Equal(DefaultTemplate, _harness.Layouts.Get(id).TemplateId);
    }

    [Fact]
    public void A_template_that_is_not_installed_is_refused_on_create_and_update_naming_the_field()
    {
        var form = AddForm();
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateLayoutRequestModel { Id = id, FormId = form.Id, KindId = BasicKind, Name = "Main", TemplateId = OtherTemplate }));
        var unknown = Guid.NewGuid();

        var created = service.Create(new CreateLayoutRequestModel { Id = Guid.NewGuid(), FormId = form.Id, KindId = BasicKind, Name = "Second", TemplateId = unknown });
        var updated = service.Update(id, new UpdateLayoutRequestModel { Name = "Renamed", TemplateId = unknown });

        Assert.Equal((ServiceStatus.Invalid, "templateId"), Tuple(created));
        Assert.Equal((ServiceStatus.Invalid, "templateId"), Tuple(updated));
        var stored = Assert.Single(_harness.LayoutStore.GetAll());
        Assert.Equal(("Main", OtherTemplate), (stored.Name, stored.TemplateId));
    }

    [Fact]
    public void Without_an_installed_template_a_layout_is_refused_rather_than_stored_without_one()
    {
        _templates.Clear();
        var form = AddForm();

        var result = CreateService().Create(new CreateLayoutRequestModel { Id = Guid.NewGuid(), FormId = form.Id, KindId = BasicKind, Name = "Main" });

        Assert.Equal((ServiceStatus.Invalid, "templateId"), Tuple(result));
        Assert.Empty(_harness.LayoutStore.GetAll());
    }

    [Fact]
    public void Create_and_update_refuse_a_configuration_the_kind_cannot_read()
    {
        var form = AddForm();
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateLayoutRequestModel { Id = id, FormId = form.Id, KindId = BasicKind, Name = "Main", Configuration = Json("""{"autoPopulate":false,"rows":[]}""") }));

        var created = service.Create(new CreateLayoutRequestModel { Id = Guid.NewGuid(), FormId = form.Id, KindId = BasicKind, Name = "Second", Configuration = Json("[1]") });
        var updated = service.Update(id, new UpdateLayoutRequestModel { Name = "Renamed", Configuration = Json("[1]") });

        foreach (var result in new[] { created, updated })
        {
            Assert.Equal((ServiceStatus.Invalid, "configuration"), Tuple(result));
            Assert.Contains(BasicLayoutDefinition.Constants.Name, result.Message);
            Assert.DoesNotContain("deserialize", result.Message);
        }

        var stored = Assert.Single(_harness.LayoutStore.GetAll());
        Assert.Equal("Main", stored.Name);
    }

    [Fact]
    public void A_layout_whose_kind_is_not_installed_keeps_any_configuration()
    {
        var form = AddForm();
        var id = Guid.NewGuid();
        _harness.Layouts.Save(new PersistedLayout { Id = id, Name = "Orphan", KindId = Guid.NewGuid(), TemplateId = DefaultTemplate, Path = new[] { RepositoryHarness.FormsRoot, form.Id, id } });

        var updated = Ok(CreateService().Update(id, new UpdateLayoutRequestModel { Name = "Orphan", Configuration = Json("[1]") }));

        Assert.Equal("[1]", updated.Configuration!.Value.GetRawText());
    }

    [Fact]
    public void A_missing_body_is_refused_naming_the_request()
    {
        var form = AddForm();
        var service = CreateService();
        var id = Guid.NewGuid();
        Ok(service.Create(new CreateLayoutRequestModel { Id = id, FormId = form.Id, KindId = BasicKind, Name = "Main" }));

        Assert.Equal((ServiceStatus.Invalid, "request"), Tuple(service.Create(null!)));
        Assert.Equal((ServiceStatus.Invalid, "request"), Tuple(service.Update(id, null!)));
        Assert.Equal("Main", Assert.Single(_harness.LayoutStore.GetAll()).Name);
    }

    [Fact]
    public void Create_refuses_a_legacy_layout_kind()
    {
        var form = AddForm();
        var legacy = new Mock<ILayoutDefinition>();
        legacy.SetupGet(x => x.KindId).Returns(Guid.Parse("55555555-5555-5555-5555-555555555555"));
        legacy.SetupGet(x => x.Name).Returns("Old layout");
        legacy.SetupGet(x => x.IsLegacy).Returns(true);
        _extraLayouts.Add(legacy.Object);

        var result = CreateService().Create(new CreateLayoutRequestModel { Id = Guid.NewGuid(), FormId = form.Id, KindId = legacy.Object.KindId, Name = "Old" });

        Assert.Equal((ServiceStatus.Invalid, "kindId"), Tuple(result));
        Assert.Empty(_harness.LayoutStore.GetAll());
    }

    private static (ServiceStatus, string?) Tuple<T>(ServiceResult<T> result) => (result.Status, result.Field);
}
