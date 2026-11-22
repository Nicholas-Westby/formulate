using Formulate.BackOffice.Api.Controllers.Config;
using Formulate.BackOffice.Api.Controllers.Definition;
using Formulate.BackOffice.Api.Controllers.Tree;
using Formulate.BackOffice.Api.Filters;
using Formulate.BackOffice.Api.Models.Definition;
using Formulate.BackOffice.Api.Models.Tree;
using Formulate.BackOffice.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class DefinitionControllerTests
{
    [Fact]
    public void Each_definition_endpoint_returns_what_the_service_gives()
    {
        var service = new Mock<IDefinitionApiService>();
        var fields = new[] { new FormFieldDefinitionModel { KindId = Guid.NewGuid(), Name = "n", Icon = "i", Category = "c", SupportsLabel = true, SupportsValidation = true, SupportsCategory = true, IsServerSideOnly = false, IsStored = true, IsHidden = false, IsTransitory = false } };
        var kinds = new[] { new KindDefinitionModel { KindId = Guid.NewGuid(), Name = "n", Icon = "i", EditorAlias = "e", IsLegacy = false } };
        service.Setup(x => x.GetFormFields()).Returns(fields);
        service.Setup(x => x.GetValidations()).Returns(kinds);
        var controller = new DefinitionController(service.Object);

        Assert.Same(fields, Assert.IsType<OkObjectResult>(controller.FormFields()).Value);
        Assert.Same(kinds, Assert.IsType<OkObjectResult>(controller.Validations()).Value);
        Assert.IsType<OkObjectResult>(controller.FormHandlers());
        Assert.IsType<OkObjectResult>(controller.DataValues());
        Assert.IsType<OkObjectResult>(controller.Layouts());
        Assert.IsType<OkObjectResult>(controller.Templates());
    }

    [Fact]
    public void Create_options_maps_service_results_to_responses()
    {
        var service = new Mock<ICreateOptionsApiService>();
        var parentId = Guid.NewGuid();
        service.Setup(x => x.GetCreateOptions("forms", parentId)).Returns(ServiceResult<IReadOnlyList<CreateOptionModel>>.Success(new[] { new CreateOptionModel { EntityType = "e", Name = "n", Icon = "i" } }));
        service.Setup(x => x.GetCreateOptions("nope", null)).Returns(ServiceResult<IReadOnlyList<CreateOptionModel>>.Invalid("treeAlias", "bad"));
        service.Setup(x => x.GetCreateOptions("forms", It.Is<Guid?>(g => g != parentId && g != null))).Returns(ServiceResult<IReadOnlyList<CreateOptionModel>>.NotFound("missing"));
        var controller = new FormulateTreeController(Mock.Of<IFormulateTreeService>(), service.Object);

        Assert.Single((IEnumerable<CreateOptionModel>)Assert.IsType<OkObjectResult>(controller.CreateOptions("forms", parentId)).Value!);
        Assert.Equal(StatusCodes.Status400BadRequest, Assert.IsAssignableFrom<ObjectResult>(controller.CreateOptions("nope")).StatusCode);
        Assert.Equal(StatusCodes.Status404NotFound, Assert.IsAssignableFrom<ObjectResult>(controller.CreateOptions("forms", Guid.NewGuid())).StatusCode);
    }

    [Fact]
    public void Only_create_options_requires_the_formulate_section()
    {
        var required = typeof(FormulateTreeController).GetMethods()
            .Where(method => method.GetCustomAttributes(typeof(RequireFormulateSectionAttribute), true).Any())
            .Select(method => method.Name);

        Assert.Equal(new[] { nameof(FormulateTreeController.CreateOptions) }, required);
        Assert.Empty(typeof(DefinitionController).GetCustomAttributes(typeof(RequireFormulateSectionAttribute), true));
        Assert.Empty(typeof(ConfigController).GetCustomAttributes(typeof(RequireFormulateSectionAttribute), true));
    }
}
