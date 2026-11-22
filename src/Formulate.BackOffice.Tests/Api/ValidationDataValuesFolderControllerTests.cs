using Formulate.BackOffice.Api.Controllers.DataValues;
using Formulate.BackOffice.Api.Controllers.Folder;
using Formulate.BackOffice.Api.Controllers.Validation;
using Formulate.BackOffice.Api.Filters;
using Formulate.BackOffice.Api.Models.DataValues;
using Formulate.BackOffice.Api.Models.Folder;
using Formulate.BackOffice.Api.Models.Shared;
using Formulate.BackOffice.Api.Models.Validation;
using Formulate.BackOffice.Api.Services;
using Formulate.Core.DataValues;
using Formulate.Core.Folders;
using Formulate.Core.Validations;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class ValidationDataValuesFolderControllerTests
{
    private readonly Mock<IMoveService> _move = new();

    private static ProblemDetails AssertProblem(IActionResult result, int status)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        Assert.Equal(status, objectResult.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal(status, problem.Status);
        return problem;
    }

    [Fact]
    public void All_three_controllers_require_the_section_and_declare_the_api_version()
    {
        foreach (var type in new[] { typeof(ValidationController), typeof(DataValuesController), typeof(FolderController) })
        {
            Assert.NotEmpty(type.GetCustomAttributes(typeof(RequireFormulateSectionAttribute), true));
            Assert.NotEmpty(type.GetCustomAttributes(typeof(Asp.Versioning.ApiVersionAttribute), false));
            Assert.True(typeof(Formulate.BackOffice.Api.FormulateApiControllerBase).IsAssignableFrom(type));
        }

        foreach (var (type, route, group) in new[]
        {
            (typeof(ValidationController), "formulate/validation", "Validation"),
            (typeof(DataValuesController), "formulate/data-values", "DataValues"),
            (typeof(FolderController), "formulate/folder", "Folder"),
        })
        {
            var template = Assert.Single(type.GetCustomAttributes(typeof(RouteAttribute), false).Cast<RouteAttribute>()).Template;
            Assert.EndsWith("/" + route, template);
            Assert.Equal(group, Assert.Single(type.GetCustomAttributes(typeof(ApiExplorerSettingsAttribute), false).Cast<ApiExplorerSettingsAttribute>()).GroupName);
        }
    }

    [Fact]
    public void Validation_statuses_map_to_problem_details_and_success_to_200()
    {
        var service = new Mock<IValidationApiService>();
        var controller = new ValidationController(service.Object, _move.Object);
        var id = Guid.NewGuid();
        var model = new ValidationResponseModel { Id = id, Name = "n", KindId = Guid.NewGuid() };
        var deleted = new DeleteResponseModel { DeletedIds = new[] { id } };
        service.Setup(x => x.Get(id)).Returns(ServiceResult<ValidationResponseModel>.Success(model));
        service.Setup(x => x.Update(id, It.IsAny<UpdateValidationRequestModel>())).Returns(ServiceResult<ValidationResponseModel>.Invalid("name", "required"));
        service.Setup(x => x.Create(It.IsAny<CreateValidationRequestModel>())).Returns(ServiceResult<ValidationResponseModel>.Conflict("id", "taken"));
        service.Setup(x => x.Delete(id)).Returns(ServiceResult<DeleteResponseModel>.Success(deleted));
        _move.Setup(x => x.Move<PersistedValidation>(id, null)).Returns(ServiceResult<bool>.NotFound("gone"));

        Assert.Same(model, Assert.IsType<OkObjectResult>(controller.ById(id)).Value);
        Assert.Equal("name", AssertProblem(controller.Update(id, new UpdateValidationRequestModel()), 400).Extensions["field"]);
        AssertProblem(controller.Create(new CreateValidationRequestModel()), 409);
        Assert.Same(deleted, Assert.IsType<OkObjectResult>(controller.Delete(id)).Value);
        AssertProblem(controller.Move(id, new MoveRequestModel()), 404);
    }

    [Fact]
    public void Data_values_update_of_a_legacy_item_is_a_409_with_the_message()
    {
        var service = new Mock<IDataValuesApiService>();
        var controller = new DataValuesController(service.Object, _move.Object);
        var id = Guid.NewGuid();
        service.Setup(x => x.Update(id, It.IsAny<UpdateDataValuesRequestModel>())).Returns(ServiceResult<DataValuesResponseModel>.Conflict("kindId", "Legacy data values can not be changed."));
        service.Setup(x => x.Get(id)).Returns(ServiceResult<DataValuesResponseModel>.NotFound("gone"));
        var target = Guid.NewGuid();
        _move.Setup(x => x.Move<PersistedDataValues>(id, target)).Returns(ServiceResult<bool>.Success(true));

        var problem = AssertProblem(controller.Update(id, new UpdateDataValuesRequestModel()), 409);

        Assert.Contains("Legacy", problem.Detail);
        AssertProblem(controller.ById(id), 404);
        Assert.IsType<OkResult>(controller.Move(id, new MoveRequestModel { TargetId = target }));
    }

    [Fact]
    public void Folder_controller_maps_statuses_and_moves_folders()
    {
        var service = new Mock<IFolderApiService>();
        var controller = new FolderController(service.Object, _move.Object);
        var id = Guid.NewGuid();
        var deleted = new DeleteResponseModel { DeletedIds = new[] { Guid.NewGuid(), id } };
        service.Setup(x => x.Get(id)).Returns(ServiceResult<FolderResponseModel>.NotFound("gone"));
        service.Setup(x => x.Create(It.IsAny<CreateFolderRequestModel>())).Returns(ServiceResult<FolderResponseModel>.Invalid("treeAlias", "unknown"));
        service.Setup(x => x.Delete(id)).Returns(ServiceResult<DeleteResponseModel>.Success(deleted));
        _move.Setup(x => x.Move<PersistedFolder>(id, It.IsAny<Guid?>())).Returns(ServiceResult<bool>.Invalid("targetId", "inside itself"));

        AssertProblem(controller.ById(id), 404);
        Assert.Equal("treeAlias", AssertProblem(controller.Create(new CreateFolderRequestModel()), 400).Extensions["field"]);
        Assert.Same(deleted, Assert.IsType<OkObjectResult>(controller.Delete(id)).Value);
        Assert.Equal("targetId", AssertProblem(controller.Move(id, new MoveRequestModel { TargetId = Guid.NewGuid() }), 400).Extensions["field"]);
    }
}
