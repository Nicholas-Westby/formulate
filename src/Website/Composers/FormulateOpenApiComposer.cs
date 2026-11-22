#if UMBRACO_18_OR_GREATER
using Umbraco.Cms.Api.Common.OpenApi;
using Umbraco.Cms.Api.Management.OpenApi;
#else
using Asp.Versioning;
using Formulate.BackOffice.Api;
using Microsoft.AspNetCore.Mvc.ApiExplorer;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.Options;
using Microsoft.OpenApi;
using Swashbuckle.AspNetCore.SwaggerGen;
using Umbraco.Cms.Api.Common.OpenApi;
using Umbraco.Cms.Api.Management.OpenApi;
#endif
using Umbraco.Cms.Core.Composing;
using Umbraco.Cms.Core.DependencyInjection;

namespace Website.Composers;

/// <summary>
/// Serves an OpenAPI document for the Formulate Management API, which the back office's TypeScript
/// client is generated from.
/// </summary>
/// <remarks>
/// This lives in the dev site, not in a Formulate package: Umbraco 18 replaced Swashbuckle with
/// Microsoft.AspNetCore.OpenApi, and an assembly with types built on the Umbraco 17 OpenAPI classes
/// stops Umbraco 18 from starting. The document is at /umbraco/swagger/formulate/swagger.json on
/// Umbraco 17 and at /umbraco/openapi/formulate.json on Umbraco 18 and later.
/// </remarks>
public sealed class FormulateOpenApiComposer : IComposer
{
    private const string Title = "Formulate Management API";

    public void Compose(IUmbracoBuilder builder)
    {
#if UMBRACO_18_OR_GREATER
        builder.AddBackOfficeOpenApiDocument(
            Formulate.BackOffice.Constants.ApiName,
            document => document
                .WithTitle(Title)
                .WithBackOfficeAuthentication()
                .WithJsonOptions(Umbraco.Cms.Core.Constants.JsonOptionsNames.BackOffice));
#else
        builder.Services.AddSingleton<IOperationIdHandler, FormulateOperationIdHandler>();
        builder.Services.Configure<SwaggerGenOptions>(options =>
        {
            options.SwaggerDoc(
                Formulate.BackOffice.Constants.ApiName,
                new OpenApiInfo { Title = Title, Version = "1.0" });
            options.OperationFilter<FormulateSecurityRequirementsOperationFilter>();
        });
#endif
    }

#if !UMBRACO_18_OR_GREATER
    /// <summary>
    /// Marks the Formulate operations as needing a signed-in back office user.
    /// </summary>
    public sealed class FormulateSecurityRequirementsOperationFilter : BackOfficeSecurityRequirementsOperationFilterBase
    {
        protected override string ApiName => Formulate.BackOffice.Constants.ApiName;
    }

    /// <summary>
    /// Gives the Formulate operations Management API style ids, such as GetFormulateConfig, so the
    /// generated client has readable function names. Umbraco 18 does this for every document itself.
    /// </summary>
    /// <remarks>
    /// Every controller built on <see cref="FormulateApiControllerBase"/> belongs to the Formulate
    /// document, including those in extensions such as Store Data, whatever their namespace.
    /// </remarks>
    public sealed class FormulateOperationIdHandler : OperationIdHandler
    {
        public FormulateOperationIdHandler(IOptions<ApiVersioningOptions> apiVersioningOptions)
            : base(apiVersioningOptions)
        {
        }

        protected override bool CanHandle(ApiDescription apiDescription, ControllerActionDescriptor controllerActionDescriptor)
            => typeof(FormulateApiControllerBase).IsAssignableFrom(controllerActionDescriptor.ControllerTypeInfo);
    }
#endif
}
