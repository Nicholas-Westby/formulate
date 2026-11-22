using Formulate.BackOffice.Api.Filters;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.AspNetCore.Mvc.Formatters;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Security;
using Xunit;

namespace Formulate.BackOffice.Tests.Api;

public sealed class RequireFormulateSectionFilterTests
{
    [Fact]
    public void The_attribute_describes_its_403_to_the_api_explorer()
    {
        // Swashbuckle (Umbraco 17) and Microsoft.AspNetCore.OpenApi (18 and later) both read this, so the document lists the 403.
        var metadata = Assert.IsAssignableFrom<IApiResponseMetadataProvider>(new RequireFormulateSectionAttribute());
        var contentTypes = new MediaTypeCollection();

        metadata.SetContentTypes(contentTypes);

        Assert.Equal((StatusCodes.Status403Forbidden, typeof(ProblemDetails)), (metadata.StatusCode, metadata.Type));
        Assert.Equal(new[] { "application/problem+json" }, contentTypes);
    }

    [Fact]
    public async Task Filter_returns_401_when_no_user()
    {
        var filter = new RequireFormulateSectionFilter(Accessor(user: null));
        var action = new FakeAction();

        await filter.OnActionExecutionAsync(action.Context, action.Next);

        Assert.Equal(StatusCodes.Status401Unauthorized, (action.Context.Result as IStatusCodeActionResult)?.StatusCode);
        Assert.False(action.Ran);
    }

    [Fact]
    public async Task Filter_returns_401_when_there_is_no_back_office_security()
    {
        var accessor = new Mock<IBackOfficeSecurityAccessor>();
        accessor.SetupGet(x => x.BackOfficeSecurity).Returns((IBackOfficeSecurity?)null);
        var filter = new RequireFormulateSectionFilter(accessor.Object);
        var action = new FakeAction();

        await filter.OnActionExecutionAsync(action.Context, action.Next);

        Assert.Equal(StatusCodes.Status401Unauthorized, (action.Context.Result as IStatusCodeActionResult)?.StatusCode);
        Assert.False(action.Ran);
    }

    [Fact]
    public async Task Filter_returns_403_when_user_lacks_section()
    {
        var filter = new RequireFormulateSectionFilter(Accessor(User("Umb.Section.Content", "content", "formulate")));
        var action = new FakeAction();

        await filter.OnActionExecutionAsync(action.Context, action.Next);

        var result = Assert.IsType<ObjectResult>(action.Context.Result);
        Assert.Equal(StatusCodes.Status403Forbidden, result.StatusCode);
        // Serializing the body uses the Management API JSON options; the camelCase output was checked against a running Umbraco 17.8.2 site.
        var problem = Assert.IsType<ProblemDetails>(result.Value);
        Assert.Equal(StatusCodes.Status403Forbidden, problem.Status);
        Assert.Equal("The Formulate section is required", problem.Title);
        Assert.False(action.Ran);
    }

    [Fact]
    public async Task Filter_allows_user_with_section()
    {
        var filter = new RequireFormulateSectionFilter(Accessor(User("content", "Formulate.Section")));
        var action = new FakeAction();

        await filter.OnActionExecutionAsync(action.Context, action.Next);

        Assert.Null(action.Context.Result);
        Assert.True(action.Ran);
    }

    [Theory]
    [InlineData(null, StatusCodes.Status401Unauthorized)]
    [InlineData(new[] { "content", "formulate" }, StatusCodes.Status403Forbidden)]
    [InlineData(new[] { "content", "Formulate.Section" }, null)]
    public async Task Attribute_creates_a_filter_that_requires_the_section(string[]? userSections, int? status)
    {
        // MVC asks the attribute for its filter with the request's services, as here.
        using var services = new ServiceCollection()
            .AddSingleton(Accessor(userSections is null ? null : User(userSections)))
            .BuildServiceProvider();
        var filter = Assert.IsAssignableFrom<IAsyncActionFilter>(
            new RequireFormulateSectionAttribute().CreateInstance(services));
        var action = new FakeAction();

        await filter.OnActionExecutionAsync(action.Context, action.Next);

        Assert.Equal(status, (action.Context.Result as IStatusCodeActionResult)?.StatusCode);
        Assert.Equal(status is null, action.Ran);
    }

    [Fact]
    public void Attribute_runs_before_model_validation()
    {
        // [ApiController] answers an invalid request with 400 from this filter. A user without the
        // section should get 403 whatever they send, so the section check has to come first.
        var modelValidation = new ModelStateInvalidFilter(
            new ApiBehaviorOptions { InvalidModelStateResponseFactory = _ => new BadRequestResult() },
            NullLogger.Instance);

        var attribute = new RequireFormulateSectionAttribute();

        Assert.True(attribute.Order < modelValidation.Order);
    }

    private static IBackOfficeSecurityAccessor Accessor(IUser? user)
    {
        var security = new Mock<IBackOfficeSecurity>();
        security.SetupGet(x => x.CurrentUser).Returns(user);
        var accessor = new Mock<IBackOfficeSecurityAccessor>();
        accessor.SetupGet(x => x.BackOfficeSecurity).Returns(security.Object);
        return accessor.Object;
    }

    private static IUser User(params string[] allowedSections)
    {
        var user = new Mock<IUser>();
        user.SetupGet(x => x.AllowedSections).Returns(allowedSections);
        return user.Object;
    }

    /// <summary>
    /// An action the filter runs in front of, which remembers whether it ran.
    /// </summary>
    private sealed class FakeAction
    {
        private readonly List<IFilterMetadata> _filters = new();

        public FakeAction()
        {
            var actionContext = new ActionContext(new DefaultHttpContext(), new RouteData(), new ActionDescriptor());
            Context = new ActionExecutingContext(actionContext, _filters, new Dictionary<string, object?>(), new object());
        }

        public ActionExecutingContext Context { get; }

        public bool Ran { get; private set; }

        public Task<ActionExecutedContext> Next()
        {
            Ran = true;
            return Task.FromResult(new ActionExecutedContext(Context, _filters, Context.Controller));
        }
    }
}
