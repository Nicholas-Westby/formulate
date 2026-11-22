using System.Text.Json;
using Formulate.BackOffice.Api.Json;
using Formulate.BackOffice.Api.Models.Form;
using Formulate.BackOffice.Api.Services;
using Formulate.BackOffice.Definitions.Forms;
using Formulate.BackOffice.Persistence;
using Formulate.BackOffice.Tests.TestSupport;
using Formulate.Core.DataValues;
using Formulate.Core.Folders;
using Formulate.Core.FormFields;
using Formulate.Core.FormFields.Button;
using Formulate.Core.FormHandlers;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Layouts.Basic;
using Formulate.Core.Validations;
using Moq;
using Umbraco.Cms.Core.Strings;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class FormApiServiceTests
{
    private static readonly Guid BasicFormKind = new FormWithBasicLayoutDefinition().KindId;
    private static readonly Guid PlainFormKind = new DefaultFormLayoutDefinition().KindId;
    private static readonly Guid TextKind = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid UnknownKind = Guid.Parse("99999999-9999-9999-9999-999999999999");
    private static readonly Guid HandlerKind = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid StrictHandlerKind = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid ButtonKind = Guid.Parse(ButtonFieldDefinition.Constants.KindId);
    private static readonly Guid ValidationsRoot = Guid.Parse(ValidationConstants.RootId);
    private static readonly Guid DataValuesRoot = Guid.Parse(DataValuesConstants.RootId);

    private readonly RepositoryHarness _harness = new();
    private readonly CapturingLogger<ConfigurationJson> _logger = new();

    /// <summary>Field kinds added to the service's definitions, beside the mocked text field.</summary>
    private readonly List<IFormFieldDefinition> _extraFields = new();

    /// <summary>Handler kinds added to the service's definitions, beside the mocked handler.</summary>
    private readonly List<IFormHandlerDefinition> _extraHandlers = new();

    private FormApiService CreateService()
    {
        var textField = new Mock<IFormFieldDefinition>();
        textField.SetupGet(x => x.KindId).Returns(TextKind);
        textField.Setup(x => x.GetBackOfficeConfiguration(It.IsAny<IFormFieldSettings>())).Returns((object?)null!);
        var handler = new Mock<IFormHandlerDefinition>();
        handler.SetupGet(x => x.KindId).Returns(HandlerKind);
        handler.Setup(x => x.GetBackOfficeConfiguration(It.IsAny<IFormHandlerSettings>())).Returns((object?)null!);

        return new FormApiService(
            _harness.Forms,
            _harness.Layouts,
            new TreeEntityRepository(_harness.Forms, _harness.Layouts, _harness.Folders, _harness.DataValues, _harness.Validations),
            _harness.FormDefinitions,
            new FormFieldDefinitionCollection(() => new[] { textField.Object }.Concat(_extraFields)),
            new FormHandlerDefinitionCollection(() => new[] { handler.Object }.Concat(_extraHandlers)),
            new ConfigurationJson(_harness.JsonUtility, _logger),
            new DefaultShortStringHelper(new DefaultShortStringHelperConfig()));
    }

    private static JsonElement Json(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private static CreateFormRequestModel CreateRequest(Guid? kind = null, Guid? id = null, FormFieldModel[]? fields = null, FormHandlerModel[]? handlers = null, Guid? parentId = null, string name = "Contact") => new()
    {
        Id = id ?? Guid.NewGuid(),
        KindId = kind ?? PlainFormKind,
        ParentId = parentId,
        Name = name,
        Alias = "contact",
        Fields = fields ?? Array.Empty<FormFieldModel>(),
        Handlers = handlers ?? Array.Empty<FormHandlerModel>(),
    };

    private static T Ok<T>(ServiceResult<T> result)
    {
        Assert.True(result.Status == ServiceStatus.Success, $"{result.Status}: {result.Field} {result.Message}");
        return result.Value!;
    }

    private PersistedFolder AddFolder(params Guid[] parents)
    {
        var id = Guid.NewGuid();
        var folder = new PersistedFolder { Id = id, Name = "Folder", Alias = "folder", Path = new[] { RepositoryHarness.FormsRoot }.Concat(parents).Append(id).ToArray() };
        _harness.Folders.Save(folder);
        return folder;
    }

    [Fact]
    public void Create_then_get_form_roundtrips_fields_and_handlers()
    {
        var service = CreateService();
        var validation = Guid.NewGuid();
        var fieldId = Guid.NewGuid();
        var handlerId = Guid.NewGuid();
        var request = CreateRequest(
            fields: new[]
            {
                new FormFieldModel { Id = fieldId, KindId = TextKind, Name = "Email", Alias = "email", Label = "Your email", Category = "Input", Validations = new[] { validation }, Configuration = Json("""{"placeholder":"a@b.c"}""") },
                new FormFieldModel { Id = Guid.NewGuid(), KindId = TextKind, Name = "Name" },
            },
            handlers: new[] { new FormHandlerModel { Id = handlerId, KindId = HandlerKind, Name = "Store", Alias = "store", Enabled = true, Configuration = Json("""{"fields":["x"]}""") } });

        var created = Ok(service.Create(request));
        var got = Ok(service.Get(request.Id));

        Assert.Equal(request.Id, got.Id);
        Assert.Equal("Contact", got.Name);
        Assert.Equal("contact", got.Alias);
        Assert.Null(got.ParentId);
        Assert.Equal(2, got.Fields.Length);
        var email = got.Fields[0];
        Assert.Equal(fieldId, email.Id);
        Assert.Equal(TextKind, email.KindId);
        Assert.Equal("Email", email.Name);
        Assert.Equal("email", email.Alias);
        Assert.Equal("Your email", email.Label);
        Assert.Equal("Input", email.Category);
        Assert.Equal(new[] { validation }, email.Validations);
        Assert.Equal("""{"placeholder":"a@b.c"}""", email.Configuration!.Value.GetRawText());
        var handler = Assert.Single(got.Handlers);
        Assert.Equal(handlerId, handler.Id);
        Assert.True(handler.Enabled);
        Assert.Equal("""{"fields":["x"]}""", handler.Configuration!.Value.GetRawText());
        Assert.Equal(got.Id, created.Id);
    }

    [Fact]
    public void Create_in_a_folder_puts_the_form_under_it()
    {
        var folder = AddFolder();
        var service = CreateService();
        var request = CreateRequest(parentId: folder.Id);

        Ok(service.Create(request));

        Assert.Equal(folder.Id, Ok(service.Get(request.Id)).ParentId);
        Assert.Equal(new[] { RepositoryHarness.FormsRoot, folder.Id, request.Id }, _harness.Forms.Get(request.Id).Path);
    }

    [Fact]
    public void Field_with_unknown_kind_survives_get_then_put()
    {
        var service = CreateService();
        var fieldId = Guid.NewGuid();
        var request = CreateRequest(fields: new[]
        {
            new FormFieldModel { Id = fieldId, KindId = UnknownKind, Name = "Orphan", Alias = "orphan", Label = "L", Category = "C", Configuration = Json("""{"a":[1,2,{"b":null}]}""") },
        });
        Ok(service.Create(request));

        var got = Ok(service.Get(request.Id));
        Ok(service.Update(request.Id, new UpdateFormRequestModel { Name = got.Name, Alias = got.Alias, Fields = got.Fields, Handlers = got.Handlers }));
        var again = Ok(service.Get(request.Id));

        var field = Assert.Single(again.Fields);
        Assert.Equal(fieldId, field.Id);
        Assert.Equal(UnknownKind, field.KindId);
        Assert.Equal("Orphan", field.Name);
        Assert.Equal("L", field.Label);
        Assert.Equal("""{"a":[1,2,{"b":null}]}""", field.Configuration!.Value.GetRawText());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("{}")]
    [InlineData("\"text\"")]
    [InlineData("[1,\"two\",null]")]
    [InlineData("{\"nested\":{\"k\":[true,false]}}")]
    public void Configuration_null_object_string_array_roundtrip(string? configuration)
    {
        var service = CreateService();
        var element = configuration is null ? (JsonElement?)null : Json(configuration);
        var request = CreateRequest(
            fields: new[] { new FormFieldModel { Id = Guid.NewGuid(), KindId = UnknownKind, Configuration = element } },
            handlers: new[] { new FormHandlerModel { Id = Guid.NewGuid(), KindId = UnknownKind, Configuration = element } });

        Ok(service.Create(request));
        var got = Ok(service.Get(request.Id));
        var put = Ok(service.Update(request.Id, new UpdateFormRequestModel { Name = "n", Fields = got.Fields, Handlers = got.Handlers }));

        foreach (var model in new[] { got, put })
        {
            Assert.Equal(configuration, model.Fields[0].Configuration?.GetRawText());
            Assert.Equal(configuration, model.Handlers[0].Configuration?.GetRawText());
        }
    }

    [Fact]
    public void Invalid_stored_configuration_is_returned_as_a_string_and_warned_about()
    {
        var service = CreateService();
        var form = new PersistedForm
        {
            Id = Guid.NewGuid(),
            Name = "Broken form",
            Path = new[] { RepositoryHarness.FormsRoot, Guid.NewGuid() },
            Fields = new[] { new PersistedFormField { Id = Guid.NewGuid(), KindId = TextKind, Name = "Bad field", Data = "{not json" } },
            Handlers = new[] { new PersistedFormHandler { Id = Guid.NewGuid(), KindId = UnknownKind, Name = "Bad handler", Data = "also {{ bad" } },
        };
        form.Path = new[] { RepositoryHarness.FormsRoot, form.Id };
        _harness.Forms.Save(form);

        var got = Ok(service.Get(form.Id));

        Assert.Equal(JsonValueKind.String, got.Fields[0].Configuration!.Value.ValueKind);
        Assert.Equal("{not json", got.Fields[0].Configuration!.Value.GetString());
        Assert.Equal("also {{ bad", got.Handlers[0].Configuration!.Value.GetString());
        var warnings = _logger.Entries.Where(x => x.Level == Microsoft.Extensions.Logging.LogLevel.Warning).Select(x => x.Message).ToArray();
        Assert.Contains(warnings, x => x.Contains("Bad field") && x.Contains("Broken form"));
        Assert.Contains(warnings, x => x.Contains("Bad handler") && x.Contains("Broken form"));
    }

    [Fact]
    public void Create_form_with_basic_layout_kind_creates_autogenerated_layout()
    {
        var service = CreateService();
        var request = CreateRequest(kind: BasicFormKind);

        Ok(service.Create(request));
        Ok(service.Update(request.Id, new UpdateFormRequestModel { Name = "Renamed" }));

        var layout = Assert.Single(_harness.Layouts.GetChildren(request.Id));
        Assert.Equal("Contact (Autogenerated)", layout.Name);
        Assert.Equal(new[] { RepositoryHarness.FormsRoot, request.Id, layout.Id }, layout.Path);
    }

    [Fact]
    public void Update_keeps_path_and_replaces_content()
    {
        var folder = AddFolder();
        var service = CreateService();
        var request = CreateRequest(parentId: folder.Id, fields: new[] { new FormFieldModel { Id = Guid.NewGuid(), KindId = TextKind, Name = "Old" } });
        Ok(service.Create(request));
        var pathBefore = _harness.Forms.Get(request.Id).Path;

        var updated = Ok(service.Update(request.Id, new UpdateFormRequestModel { Name = "New name", Alias = "newName", Fields = Array.Empty<FormFieldModel>() }));

        Assert.Equal("New name", updated.Name);
        Assert.Equal("newName", updated.Alias);
        Assert.Empty(updated.Fields);
        Assert.Equal(pathBefore, _harness.Forms.Get(request.Id).Path);
        Assert.Equal(folder.Id, updated.ParentId);
    }

    [Fact]
    public void Update_unknown_form_returns_not_found()
    {
        var result = CreateService().Update(Guid.NewGuid(), new UpdateFormRequestModel { Name = "x" });

        Assert.Equal(ServiceStatus.NotFound, result.Status);
    }

    [Fact]
    public void Get_and_delete_and_duplicate_unknown_form_return_not_found()
    {
        var service = CreateService();

        Assert.Equal(ServiceStatus.NotFound, service.Get(Guid.NewGuid()).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Delete(Guid.NewGuid()).Status);
        Assert.Equal(ServiceStatus.NotFound, service.Duplicate(Guid.NewGuid(), new DuplicateFormRequestModel()).Status);
    }

    [Fact]
    public void Create_rejects_an_empty_name_an_unknown_kind_and_a_bad_parent_naming_the_field()
    {
        var service = CreateService();
        var file = new PersistedForm { Id = Guid.NewGuid(), Name = "A form", Path = new[] { RepositoryHarness.FormsRoot, Guid.NewGuid() } };
        file.Path = new[] { RepositoryHarness.FormsRoot, file.Id };
        _harness.Forms.Save(file);
        var otherTreeFolder = new PersistedFolder { Id = Guid.NewGuid(), Name = "x", Path = new[] { Guid.Parse(Formulate.Core.Validations.ValidationConstants.RootId), Guid.NewGuid() } };
        _harness.Folders.Save(otherTreeFolder);

        var empty = service.Create(CreateRequest(name: " "));
        var kind = service.Create(CreateRequest(kind: UnknownKind));
        var parentMissing = service.Create(CreateRequest(parentId: Guid.NewGuid()));
        var parentIsForm = service.Create(CreateRequest(parentId: file.Id));
        var parentOtherTree = service.Create(CreateRequest(parentId: otherTreeFolder.Id));
        var idTaken = service.Create(CreateRequest(id: file.Id));

        Assert.Equal((ServiceStatus.Invalid, "name"), (empty.Status, empty.Field));
        Assert.Equal((ServiceStatus.Invalid, "kindId"), (kind.Status, kind.Field));
        Assert.Equal((ServiceStatus.Invalid, "parentId"), (parentMissing.Status, parentMissing.Field));
        Assert.Equal((ServiceStatus.Invalid, "parentId"), (parentIsForm.Status, parentIsForm.Field));
        Assert.Equal((ServiceStatus.Invalid, "parentId"), (parentOtherTree.Status, parentOtherTree.Field));
        Assert.Equal((ServiceStatus.Conflict, "id"), (idTaken.Status, idTaken.Field));
        Assert.Single(_harness.FormStore.GetAll());
    }

    [Fact]
    public void Update_rejects_an_empty_name()
    {
        var service = CreateService();
        var request = CreateRequest();
        Ok(service.Create(request));

        var result = service.Update(request.Id, new UpdateFormRequestModel { Name = "" });

        Assert.Equal((ServiceStatus.Invalid, "name"), (result.Status, result.Field));
        Assert.Equal("Contact", _harness.Forms.Get(request.Id).Name);
    }

    [Fact]
    public void Delete_form_deletes_its_layouts_and_returns_ids()
    {
        var service = CreateService();
        var request = CreateRequest(kind: BasicFormKind);
        Ok(service.Create(request));
        var other = CreateRequest(kind: BasicFormKind);
        Ok(service.Create(other));
        var layoutId = Assert.Single(_harness.Layouts.GetChildren(request.Id)).Id;

        var deleted = Ok(service.Delete(request.Id));

        Assert.Equal(new[] { layoutId, request.Id }.OrderBy(x => x), deleted.DeletedIds.OrderBy(x => x));
        Assert.Null(_harness.Forms.Get(request.Id));
        Assert.Null(_harness.Layouts.Get(layoutId));
        Assert.NotNull(_harness.Forms.Get(other.Id));
        Assert.Single(_harness.Layouts.GetChildren(other.Id));
    }

    [Fact]
    public void Delete_reads_the_layouts_once_however_many_there_are()
    {
        var service = CreateService();
        var request = CreateRequest();
        Ok(service.Create(request));
        for (var i = 0; i < 5; i++)
        {
            var id = Guid.NewGuid();
            _harness.Layouts.Save(new PersistedLayout { Id = id, Name = "l" + i, KindId = Guid.NewGuid(), Path = new[] { RepositoryHarness.FormsRoot, request.Id, id } });
        }
        var readsBefore = _harness.LayoutStore.FullReads + _harness.FormStore.FullReads;

        var deleted = Ok(service.Delete(request.Id));

        Assert.Equal(6, deleted.DeletedIds.Length);
        Assert.Equal(readsBefore + 1, _harness.LayoutStore.FullReads + _harness.FormStore.FullReads);
    }

    [Fact]
    public void Duplicate_form_copies_layouts_with_remapped_field_ids()
    {
        var service = CreateService();
        var fieldA = Guid.NewGuid();
        var fieldB = Guid.NewGuid();
        var validation = Guid.NewGuid();
        var handlerId = Guid.NewGuid();
        var source = CreateRequest(
            fields: new[]
            {
                new FormFieldModel { Id = fieldA, KindId = TextKind, Name = "A", Validations = new[] { validation } },
                new FormFieldModel { Id = fieldB, KindId = UnknownKind, Name = "B" },
            },
            handlers: new[] { new FormHandlerModel { Id = handlerId, KindId = HandlerKind, Name = "H", Enabled = true, Configuration = Json($$"""{"to":"{{fieldA:D}}","include":["{{fieldB:N}}","{{validation:D}}"],"n":1.5}""") } });
        Ok(service.Create(source));
        var layoutId = Guid.NewGuid();
        _harness.Layouts.Save(new PersistedLayout
        {
            Id = layoutId,
            Name = "Two column",
            Alias = "twoColumn",
            KindId = Guid.Parse(BasicLayoutDefinition.Constants.KindId),
            TemplateId = Guid.NewGuid(),
            Path = new[] { RepositoryHarness.FormsRoot, source.Id, layoutId },
            Data = $$"""{"autoPopulate":false,"rows":[{"cells":[{"columnSpan":6,"fields":[{"id":"{{fieldA:D}}"}]},{"columnSpan":6,"fields":[{"id":"{{fieldB:N}}"}]}]}]}""",
        });

        var copy = Ok(service.Duplicate(source.Id, new DuplicateFormRequestModel()));

        Assert.NotEqual(source.Id, copy.Id);
        Assert.Equal("Contact (copy)", copy.Name);
        Assert.Equal(2, copy.Fields.Length);
        Assert.DoesNotContain(copy.Fields, x => x.Id == fieldA || x.Id == fieldB);
        Assert.Equal(new[] { "A", "B" }, copy.Fields.Select(x => x.Name));
        Assert.Equal(new[] { validation }, copy.Fields[0].Validations);
        var newA = copy.Fields[0].Id;
        var newB = copy.Fields[1].Id;
        var handler = Assert.Single(copy.Handlers);
        Assert.NotEqual(handlerId, handler.Id);
        Assert.Equal($$"""{"to":"{{newA:D}}","include":["{{newB:N}}","{{validation:D}}"],"n":1.5}""", handler.Configuration!.Value.GetRawText());
        var copiedLayout = Assert.Single(_harness.Layouts.GetChildren(copy.Id));
        Assert.NotEqual(layoutId, copiedLayout.Id);
        Assert.Equal("Two column", copiedLayout.Name);
        Assert.Equal("twoColumn", copiedLayout.Alias);
        Assert.Equal(_harness.Layouts.Get(layoutId).TemplateId, copiedLayout.TemplateId);
        Assert.Equal(new[] { RepositoryHarness.FormsRoot, copy.Id, copiedLayout.Id }, copiedLayout.Path);
        Assert.Contains(newA.ToString("D"), copiedLayout.Data);
        Assert.Contains(newB.ToString("N"), copiedLayout.Data);
        Assert.DoesNotContain(fieldA.ToString("D"), copiedLayout.Data);
        Assert.DoesNotContain(fieldB.ToString("N"), copiedLayout.Data);
        // The original is untouched.
        Assert.Contains(fieldA.ToString("D"), _harness.Layouts.Get(layoutId).Data);
        Assert.Equal(2, Ok(service.Get(source.Id)).Fields.Length);
    }

    [Fact]
    public void Duplicate_basic_layout_form_does_not_add_an_extra_layout()
    {
        var service = CreateService();
        var source = CreateRequest(kind: BasicFormKind);
        Ok(service.Create(source));
        var sourceLayout = Assert.Single(_harness.Layouts.GetChildren(source.Id));

        var copy = Ok(service.Duplicate(source.Id, new DuplicateFormRequestModel()));

        var layout = Assert.Single(_harness.Layouts.GetChildren(copy.Id));
        Assert.Equal(sourceLayout.Name, layout.Name);
        Assert.NotEqual(sourceLayout.Id, layout.Id);
        Assert.Single(_harness.Layouts.GetChildren(source.Id));
    }

    [Fact]
    public void Duplicate_places_the_copy_beside_the_original_or_in_the_requested_folder()
    {
        var folder = AddFolder();
        var target = AddFolder();
        var service = CreateService();
        var source = CreateRequest(parentId: folder.Id);
        Ok(service.Create(source));

        var beside = Ok(service.Duplicate(source.Id, new DuplicateFormRequestModel()));
        var elsewhere = Ok(service.Duplicate(source.Id, new DuplicateFormRequestModel { ParentId = target.Id }));

        Assert.Equal(folder.Id, beside.ParentId);
        Assert.Equal(target.Id, elsewhere.ParentId);
        var bad = service.Duplicate(source.Id, new DuplicateFormRequestModel { ParentId = source.Id });
        Assert.Equal((ServiceStatus.Invalid, "parentId"), (bad.Status, bad.Field));
    }

    [Fact]
    public void Duplicate_remaps_sibling_field_ids_in_field_data_but_not_validation_ids()
    {
        var service = CreateService();
        var fieldA = Guid.NewGuid();
        var fieldB = Guid.NewGuid();
        var validation = Guid.NewGuid();
        var source = CreateRequest(fields: new[]
        {
            new FormFieldModel { Id = fieldA, KindId = UnknownKind, Name = "A" },
            new FormFieldModel { Id = fieldB, KindId = UnknownKind, Name = "B", Configuration = Json($$"""{"dependsOn":"{{fieldA:D}}","validation":"{{validation:D}}"}""") },
        });
        Ok(service.Create(source));

        var copy = Ok(service.Duplicate(source.Id, new DuplicateFormRequestModel()));

        var data = copy.Fields[1].Configuration!.Value;
        Assert.Equal(copy.Fields[0].Id.ToString("D"), data.GetProperty("dependsOn").GetString());
        Assert.Equal(validation.ToString("D"), data.GetProperty("validation").GetString());
    }

    [Fact]
    public void Create_and_update_reject_the_same_field_or_handler_id_twice_naming_the_property()
    {
        var service = CreateService();
        var id = Guid.NewGuid();
        var twoFields = new[] { new FormFieldModel { Id = id, KindId = UnknownKind }, new FormFieldModel { Id = id, KindId = UnknownKind } };
        var twoHandlers = new[] { new FormHandlerModel { Id = id, KindId = UnknownKind }, new FormHandlerModel { Id = id, KindId = UnknownKind } };
        var existing = CreateRequest();
        Ok(service.Create(existing));

        var createFields = service.Create(CreateRequest(fields: twoFields));
        var createHandlers = service.Create(CreateRequest(handlers: twoHandlers));
        var updateFields = service.Update(existing.Id, new UpdateFormRequestModel { Name = "n", Fields = twoFields });
        var updateHandlers = service.Update(existing.Id, new UpdateFormRequestModel { Name = "n", Handlers = twoHandlers });

        Assert.Equal((ServiceStatus.Invalid, "fields"), (createFields.Status, createFields.Field));
        Assert.Equal((ServiceStatus.Invalid, "handlers"), (createHandlers.Status, createHandlers.Field));
        Assert.Equal((ServiceStatus.Invalid, "fields"), (updateFields.Status, updateFields.Field));
        Assert.Equal((ServiceStatus.Invalid, "handlers"), (updateHandlers.Status, updateHandlers.Field));
        Assert.Single(_harness.FormStore.GetAll());
        Assert.Equal("Contact", _harness.Forms.Get(existing.Id).Name);
    }

    [Fact]
    public void Create_with_the_id_of_a_folder_validation_or_data_values_is_a_conflict_and_writes_nothing()
    {
        var service = CreateService();
        var folder = AddFolder();
        var validationId = Guid.NewGuid();
        _harness.Validations.Save(new PersistedValidation { Id = validationId, Name = "v", Path = new[] { ValidationsRoot, validationId } });
        var dataValuesId = Guid.NewGuid();
        _harness.DataValues.Save(new PersistedDataValues { Id = dataValuesId, Name = "d", Path = new[] { DataValuesRoot, dataValuesId } });

        foreach (var id in new[] { folder.Id, validationId, dataValuesId })
        {
            // A basic layout form would also write a layout, so this shows nothing at all is written.
            var result = service.Create(CreateRequest(id: id, kind: BasicFormKind));

            Assert.Equal((ServiceStatus.Conflict, "id"), (result.Status, result.Field));
        }

        Assert.Empty(_harness.FormStore.GetAll());
        Assert.Empty(_harness.LayoutStore.GetAll());
    }

    [Fact]
    public void Create_and_update_refuse_a_field_configuration_its_kind_cannot_read_naming_the_field()
    {
        _extraFields.Add(new ButtonFieldDefinition(_harness.JsonUtility));
        var service = CreateService();
        var existing = CreateRequest();
        Ok(service.Create(existing));
        var fields = new[]
        {
            new FormFieldModel { Id = Guid.NewGuid(), KindId = TextKind, Name = "Email" },
            new FormFieldModel { Id = Guid.NewGuid(), KindId = UnknownKind, Name = "Orphan", Configuration = Json("\"opaque\"") },
            new FormFieldModel { Id = Guid.NewGuid(), KindId = ButtonKind, Name = "Send", Configuration = Json("\"Submit\"") },
        };

        var created = service.Create(CreateRequest(fields: fields));
        var updated = service.Update(existing.Id, new UpdateFormRequestModel { Name = "Changed", Fields = fields });

        foreach (var result in new[] { created, updated })
        {
            Assert.Equal((ServiceStatus.Invalid, "fields[2].configuration"), (result.Status, result.Field));
            Assert.Contains("'Send'", result.Message);
            Assert.Contains(ButtonFieldDefinition.Constants.Name, result.Message);
            Assert.DoesNotContain("Error converting", result.Message);
        }

        Assert.Single(_harness.FormStore.GetAll());
        Assert.Equal("Contact", _harness.Forms.Get(existing.Id).Name);
    }

    [Fact]
    public void Create_and_update_refuse_a_handler_configuration_its_kind_cannot_read_naming_the_handler()
    {
        var strict = new Mock<IFormHandlerDefinition>();
        strict.SetupGet(x => x.KindId).Returns(StrictHandlerKind);
        strict.SetupGet(x => x.Name).Returns("Strict handler");
        strict.Setup(x => x.CreateHandler(It.IsAny<IFormHandlerSettings>()))
            .Returns<IFormHandlerSettings>(settings => settings.Data == """{"ok":true}""" ? Mock.Of<IFormHandler>() : throw new InvalidOperationException("secret detail"));
        _extraHandlers.Add(strict.Object);
        var service = CreateService();
        var existing = CreateRequest();
        Ok(service.Create(existing));
        var handlers = new[]
        {
            new FormHandlerModel { Id = Guid.NewGuid(), KindId = StrictHandlerKind, Name = "Notify", Configuration = Json("""{"ok":false}""") },
        };

        var created = service.Create(CreateRequest(handlers: handlers));
        var updated = service.Update(existing.Id, new UpdateFormRequestModel { Name = "Changed", Handlers = handlers });
        var readable = service.Create(CreateRequest(handlers: new[] { new FormHandlerModel { Id = Guid.NewGuid(), KindId = StrictHandlerKind, Name = "Notify", Configuration = Json("""{"ok":true}""") } }));

        foreach (var result in new[] { created, updated })
        {
            Assert.Equal((ServiceStatus.Invalid, "handlers[0].configuration"), (result.Status, result.Field));
            Assert.Contains("'Notify'", result.Message);
            Assert.Contains("Strict handler", result.Message);
            Assert.DoesNotContain("secret detail", result.Message);
        }

        Assert.Equal(ServiceStatus.Success, readable.Status);
        Assert.Equal(2, _harness.FormStore.GetAll().Count);
        Assert.Equal("Contact", _harness.Forms.Get(existing.Id).Name);
    }

    [Fact]
    public void Items_sent_without_an_id_get_distinct_new_ids()
    {
        var service = CreateService();
        var request = CreateRequest(fields: new[] { new FormFieldModel { KindId = UnknownKind }, new FormFieldModel { KindId = UnknownKind } });

        var created = Ok(service.Create(request));

        Assert.All(created.Fields, x => Assert.NotEqual(Guid.Empty, x.Id));
        Assert.NotEqual(created.Fields[0].Id, created.Fields[1].Id);
    }
}
