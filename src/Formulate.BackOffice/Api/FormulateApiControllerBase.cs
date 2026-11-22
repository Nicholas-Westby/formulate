namespace Formulate.BackOffice.Api
{
    using Umbraco.Cms.Api.Common.Attributes;
    using Umbraco.Cms.Api.Management.Controllers;

    /// <summary>
    /// The base class for the Formulate Management API controllers.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <see cref="ManagementApiControllerBase"/> brings back office authentication, Umbraco's back office
    /// JSON options and the [ApiController] behaviour. It is the same class on Umbraco 17, 18 and 19.
    /// </para>
    /// <para>
    /// Each controller adds its own [ApiVersion("1.0")], as Umbraco's controllers do: Asp.Versioning
    /// declares that attribute with Inherited = false, so on this class it would not reach them. Each
    /// also adds [VersionedApiBackOfficeRoute("formulate/...")], which serves it under
    /// /umbraco/management/api/v1/formulate/..., and [ApiExplorerSettings(GroupName = "...")], without
    /// which the OpenAPI document leaves it out. Actions that change data, or show more than a content
    /// picker needs, also add [RequireFormulateSection].
    /// </para>
    /// </remarks>
    [MapToApi(Constants.ApiName)]
    public abstract class FormulateApiControllerBase : ManagementApiControllerBase
    {
    }
}
