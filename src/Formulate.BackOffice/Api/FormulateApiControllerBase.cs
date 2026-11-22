namespace Formulate.BackOffice.Api
{
    using System;
    using Formulate.BackOffice.Api.Services;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Umbraco.Cms.Api.Common.Attributes;
    using Umbraco.Cms.Api.Common.Builders;
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
        /// <summary>
        /// Creates the problem response for a service result that did not succeed: 404 for an unknown item,
        /// 400 for an invalid request (naming the field) and 409 for a clash.
        /// </summary>
        /// <param name="result">The result.</param>
        /// <typeparam name="T">The type of the result's value.</typeparam>
        protected IActionResult ProblemFor<T>(ServiceResult<T> result)
        {
            var (status, title) = result.Status switch
            {
                ServiceStatus.NotFound => (StatusCodes.Status404NotFound, "Item not found"),
                ServiceStatus.Conflict => (StatusCodes.Status409Conflict, "Conflict"),
                ServiceStatus.Invalid => (StatusCodes.Status400BadRequest, "Invalid request"),
                _ => throw new InvalidOperationException("A successful result is not a problem."),
            };

            var detail = result.Field is null ? result.Message : $"{result.Field}: {result.Message}";
            var problem = new ProblemDetailsBuilder()
                .WithTitle(title)
                .WithDetail(detail ?? title)
                .Build();
            problem.Status = status;

            if (result.Field is not null)
            {
                problem.Extensions["field"] = result.Field;
            }

            return new ObjectResult(problem) { StatusCode = status };
        }
    }
}
