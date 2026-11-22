namespace Formulate.BackOffice.Api.Filters
{
    using System;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Mvc.ApiExplorer;
    using Microsoft.AspNetCore.Mvc.Formatters;

    /// <summary>
    /// Requires the current back office user to have access to the Formulate section.
    /// </summary>
    /// <remarks>
    /// Without the section, a request gets 403, and without a back office user, 401. The 403 is described
    /// to the API explorer, so the OpenAPI document lists it for every operation this guards.
    /// </remarks>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
    public sealed class RequireFormulateSectionAttribute : TypeFilterAttribute, IApiResponseMetadataProvider
    {
        /// <inheritdoc cref="RequireFormulateSectionAttribute"/>
        public RequireFormulateSectionAttribute()
            : base(typeof(RequireFormulateSectionFilter))
        {
            // Run before the other action filters, including [ApiController]'s model validation, so a
            // user without the section gets 403 even when the request itself is invalid.
            Order = int.MinValue;
        }

        /// <inheritdoc />
        Type IApiResponseMetadataProvider.Type => typeof(ProblemDetails);

        /// <inheritdoc />
        int IApiResponseMetadataProvider.StatusCode => StatusCodes.Status403Forbidden;

        /// <inheritdoc />
        void IApiResponseMetadataProvider.SetContentTypes(MediaTypeCollection contentTypes)
        {
            contentTypes.Clear();
            contentTypes.Add("application/problem+json");
        }
    }
}
