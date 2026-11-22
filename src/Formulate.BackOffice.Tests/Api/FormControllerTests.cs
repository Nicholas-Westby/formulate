using Formulate.BackOffice.Api.Controllers.Form;
using Formulate.BackOffice.Api.Controllers.Layout;
using Formulate.BackOffice.Api.Filters;
using Formulate.BackOffice.Api.Models.Form;
using Formulate.BackOffice.Api.Models.Layout;
using Formulate.BackOffice.Api.Models.Shared;
using Formulate.BackOffice.Api.Services;
using Formulate.Core.Forms;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class FormControllerTests
{
    private readonly Mock<IFormApiService> _forms = new();
    private readonly Mock<IMoveService> _move = new();
    private readonly Mock<ILayoutApiService> _layouts = new();

    private static FormResponseModel Form(Guid id) => new() { Id = id, Name = "n", Fields = Array.Empty<FormFieldModel>(), Handlers = Array.Empty<FormHandlerModel>() };

    private static ProblemDetails AssertProblem(IActionResult result, int status)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        Assert.Equal(status, objectResult.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Equal(status, problem.Status);
        return problem;
    }

    [Fact]
    public void Both_controllers_require_the_section_and_declare_the_api_version()
    {
        foreach (var type in new[] { typeof(FormController), typeof(LayoutController) })
        {
            Assert.NotEmpty(type.GetCustomAttributes(typeof(RequireFormulateSectionAttribute), true));
            Assert.NotEmpty(type.GetCustomAttributes(typeof(Asp.Versioning.ApiVersionAttribute), false));
        }
    }

    [Fact]
    public void A_move_without_a_body_is_refused_rather_than_moving_to_the_top()
    {
        var result = new FormController(_forms.Object, _move.Object).Move(Guid.NewGuid(), null!);

        Assert.Equal("request", AssertProblem(result, 400).Extensions["field"]);
        _move.VerifyNoOtherCalls();
    }

    [Fact]
    public void Statuses_map_to_problem_details_and_name_the_field()
    {
        var controller = new FormController(_forms.Object, _move.Object);
        var id = Guid.NewGuid();
        _forms.Setup(x => x.Get(id)).Returns(ServiceResult<FormResponseModel>.NotFound("gone"));
        _forms.Setup(x => x.Update(id, It.IsAny<UpdateFormRequestModel>())).Returns(ServiceResult<FormResponseModel>.Invalid("name", "The name is required."));
        _forms.Setup(x => x.Create(It.IsAny<CreateFormRequestModel>())).Returns(ServiceResult<FormResponseModel>.Conflict("id", "taken"));
        _move.Setup(x => x.Move<PersistedForm>(id, null)).Returns(ServiceResult<bool>.NotFound("gone"));

        AssertProblem(controller.ById(id), 404);
        var invalid = AssertProblem(controller.Update(id, new UpdateFormRequestModel()), 400);
        Assert.Contains("name", invalid.Detail);
        Assert.Equal("name", invalid.Extensions["field"]);
        AssertProblem(controller.Create(new CreateFormRequestModel()), 409);
        AssertProblem(controller.Move(id, new MoveRequestModel()), 404);
    }

    [Fact]
    public void Success_gives_200_with_the_value_and_delete_lists_ids()
    {
        var controller = new FormController(_forms.Object, _move.Object);
        var id = Guid.NewGuid();
        var form = Form(id);
        _forms.Setup(x => x.Get(id)).Returns(ServiceResult<FormResponseModel>.Success(form));
        var deleted = new DeleteResponseModel { DeletedIds = new[] { id } };
        _forms.Setup(x => x.Delete(id)).Returns(ServiceResult<DeleteResponseModel>.Success(deleted));
        var target = Guid.NewGuid();
        _move.Setup(x => x.Move<PersistedForm>(id, target)).Returns(ServiceResult<bool>.Success(true));

        Assert.Same(form, Assert.IsType<OkObjectResult>(controller.ById(id)).Value);
        Assert.Same(deleted, Assert.IsType<OkObjectResult>(controller.Delete(id)).Value);
        Assert.IsType<OkResult>(controller.Move(id, new MoveRequestModel { TargetId = target }));
    }

    [Fact]
    public void Layout_controller_maps_not_found_and_success()
    {
        var controller = new LayoutController(_layouts.Object);
        var id = Guid.NewGuid();
        _layouts.Setup(x => x.Get(id)).Returns(ServiceResult<LayoutResponseModel>.NotFound("gone"));
        _layouts.Setup(x => x.Delete(id)).Returns(ServiceResult<DeleteResponseModel>.Success(new DeleteResponseModel { DeletedIds = new[] { id } }));

        AssertProblem(controller.ById(id), StatusCodes.Status404NotFound);
        Assert.IsType<OkObjectResult>(controller.Delete(id));
    }
}
