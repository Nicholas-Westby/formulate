using Formulate.BackOffice.Api.Controllers.Config;
using Formulate.BackOffice.Api.Models.Config;
using Formulate.BackOffice.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public class ConfigControllerTests
{
    [Fact]
    public void Config_endpoint_returns_the_config()
    {
        var config = new FormulateConfigResponseModel
        {
            ButtonKinds = new[] { "Next" },
            FieldCategories = Array.Empty<FieldCategoryModel>(),
            RecaptchaConfigured = true,
        };
        var service = new Mock<IConfigApiService>();
        service.Setup(x => x.Get()).Returns(config);

        Assert.Same(config, Assert.IsType<OkObjectResult>(new ConfigController(service.Object).Get()).Value);
    }
}
