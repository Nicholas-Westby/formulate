using System.Text.Json;
using Formulate.BackOffice.Api.Models.Form;
using Formulate.BackOffice.Api.Models.DataValues;
using Formulate.BackOffice.Api.Models.Folder;
using Formulate.BackOffice.Api.Models.Layout;
using Formulate.BackOffice.Api.Models.Validation;
using Formulate.BackOffice.Api.Models.Shared;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class RequestModelJsonTests
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    [Fact]
    public void Request_models_accept_guids_in_any_format()
    {
        var id = Guid.NewGuid();
        var kind = Guid.NewGuid();
        var validation = Guid.NewGuid();

        var form = JsonSerializer.Deserialize<CreateFormRequestModel>(
            $$"""{"id":"{{id:N}}","parentId":"{{id:B}}","kindId":"{{kind.ToString("N").ToUpperInvariant()}}","name":"n","fields":[{"id":"{{id:N}}","kindId":"{{kind:N}}","validations":["{{validation:N}}","{{validation:D}}"]}],"handlers":[{"id":"{{id:N}}","kindId":"{{kind:N}}"}]}""",
            Options)!;
        var layout = JsonSerializer.Deserialize<CreateLayoutRequestModel>($$"""{"id":"{{id:N}}","formId":"{{id:N}}","kindId":"{{kind:N}}","templateId":"{{id:N}}","name":"n"}""", Options)!;
        var move = JsonSerializer.Deserialize<MoveRequestModel>($$"""{"targetId":"{{id:N}}"}""", Options)!;
        var emptyMove = JsonSerializer.Deserialize<MoveRequestModel>("""{"targetId":null}""", Options)!;

        Assert.Equal((id, id, kind), (form.Id, form.ParentId, form.KindId));
        Assert.Equal(new[] { validation, validation }, form.Fields[0].Validations);
        Assert.Equal((id, kind), (form.Handlers[0].Id, form.Handlers[0].KindId));
        Assert.Equal((id, id, kind, id), (layout.Id, layout.FormId, layout.KindId, layout.TemplateId));
        Assert.Equal(id, move.TargetId);
        Assert.Null(emptyMove.TargetId);
    }

    [Fact]
    public void Validation_data_values_and_folder_request_models_accept_guids_in_any_format()
    {
        var id = Guid.NewGuid();
        var kind = Guid.NewGuid();

        var validation = JsonSerializer.Deserialize<CreateValidationRequestModel>($$"""{"id":"{{id:N}}","parentId":"{{id:B}}","kindId":"{{kind.ToString("N").ToUpperInvariant()}}","name":"n","configuration":[1]}""", Options)!;
        var dataValues = JsonSerializer.Deserialize<CreateDataValuesRequestModel>($$"""{"id":"{{id:N}}","parentId":null,"kindId":"{{kind:N}}","name":"n"}""", Options)!;
        var folder = JsonSerializer.Deserialize<CreateFolderRequestModel>($$"""{"id":"{{id:N}}","parentId":"{{id:P}}","treeAlias":"forms","name":"n"}""", Options)!;

        Assert.Equal((id, id, kind), (validation.Id, validation.ParentId, validation.KindId));
        Assert.Equal(JsonValueKind.Array, validation.Configuration!.Value.ValueKind);
        Assert.Equal((id, null, kind), (dataValues.Id, dataValues.ParentId, dataValues.KindId));
        Assert.Equal((id, id, "forms"), (folder.Id, folder.ParentId, folder.TreeAlias));
    }

    [Fact]
    public void Guids_are_written_in_the_d_format()
    {
        var id = Guid.NewGuid();

        var json = JsonSerializer.Serialize(new FormFieldModel { Id = id, KindId = id, Validations = new[] { id } }, Options);

        Assert.Contains($"\"id\":\"{id:D}\"", json);
        Assert.Contains($"\"validations\":[\"{id:D}\"]", json);
    }
}
