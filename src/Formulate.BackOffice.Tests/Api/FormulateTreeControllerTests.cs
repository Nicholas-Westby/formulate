using Formulate.BackOffice.Api.Controllers.Item;
using Formulate.BackOffice.Api.Controllers.Tree;
using Formulate.BackOffice.Api.Models.Item;
using Formulate.BackOffice.Api.Models.Tree;
using Formulate.BackOffice.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Umbraco.Cms.Api.Common.ViewModels.Pagination;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class FormulateTreeControllerTests
{
    private readonly Mock<IFormulateTreeService> _service = new();

    private FormulateTreeController CreateController() => new(_service.Object, Mock.Of<ICreateOptionsApiService>());

    private static ProblemDetails AssertProblem(IActionResult result, int status)
    {
        var objectResult = Assert.IsAssignableFrom<ObjectResult>(result);
        Assert.Equal(status, objectResult.StatusCode);
        var problem = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.False(string.IsNullOrEmpty(problem.Title));
        return problem;
    }

    [Fact]
    public void Unknown_tree_alias_gives_400_problem_details_on_every_action()
    {
        _service.Setup(x => x.GetRoot("nope", false, 0, 100))
            .Returns(ServiceResult<PagedViewModel<FormulateTreeItemResponseModel>>.Invalid("treeAlias", "unknown"));
        _service.Setup(x => x.GetChildren("nope", It.IsAny<Guid>(), false, 0, 100))
            .Returns(ServiceResult<PagedViewModel<FormulateTreeItemResponseModel>>.Invalid("treeAlias", "unknown"));
        _service.Setup(x => x.GetAncestors("nope", It.IsAny<Guid>()))
            .Returns(ServiceResult<IReadOnlyList<FormulateTreeItemResponseModel>>.Invalid("treeAlias", "unknown"));
        var controller = CreateController();

        // The same shape as create-options in this controller: the 400 names the field.
        foreach (var result in new[] { controller.Root("nope"), controller.Children("nope", Guid.NewGuid()), controller.Ancestors("nope", Guid.NewGuid()) })
        {
            Assert.Equal("treeAlias", AssertProblem(result, StatusCodes.Status400BadRequest).Extensions["field"]);
        }
    }

    [Fact]
    public void Unknown_parent_gives_404()
    {
        var parentId = Guid.NewGuid();
        _service.Setup(x => x.GetChildren("forms", parentId, false, 0, 100))
            .Returns(ServiceResult<PagedViewModel<FormulateTreeItemResponseModel>>.NotFound("gone"));

        AssertProblem(CreateController().Children("forms", parentId), StatusCodes.Status404NotFound);
    }

    [Fact]
    public void Unknown_descendant_gives_404()
    {
        var descendantId = Guid.NewGuid();
        _service.Setup(x => x.GetAncestors("forms", descendantId))
            .Returns(ServiceResult<IReadOnlyList<FormulateTreeItemResponseModel>>.NotFound("gone"));

        AssertProblem(CreateController().Ancestors("forms", descendantId), StatusCodes.Status404NotFound);
    }

    [Fact]
    public void Success_gives_200_with_the_page()
    {
        var page = new PagedViewModel<FormulateTreeItemResponseModel> { Total = 0, Items = Array.Empty<FormulateTreeItemResponseModel>() };
        _service.Setup(x => x.GetRoot("forms", true, 5, 7)).Returns(ServiceResult<PagedViewModel<FormulateTreeItemResponseModel>>.Success(page));

        var result = CreateController().Root("forms", 5, 7, true);

        Assert.Same(page, Assert.IsType<OkObjectResult>(result).Value);
    }

    [Fact]
    public void Item_endpoint_passes_ids_in_order_and_treats_none_as_empty()
    {
        var ids = new[] { Guid.NewGuid(), Guid.NewGuid() };
        _service.Setup(x => x.GetItems(It.IsAny<IEnumerable<Guid>>())).Returns(Array.Empty<FormulateItemResponseModel>());
        var controller = new FormulateItemController(_service.Object);

        Assert.IsType<OkObjectResult>(controller.Items(ids));
        Assert.IsType<OkObjectResult>(controller.Items(null));
        _service.Verify(x => x.GetItems(It.Is<IEnumerable<Guid>>(g => g.SequenceEqual(ids))), Times.Once);
        _service.Verify(x => x.GetItems(It.Is<IEnumerable<Guid>>(g => !g.Any())), Times.Once);
    }
}
