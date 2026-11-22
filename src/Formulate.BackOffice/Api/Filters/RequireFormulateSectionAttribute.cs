namespace Formulate.BackOffice.Api.Filters
{
    using System;
    using Microsoft.AspNetCore.Mvc;

    /// <summary>
    /// Requires the current back office user to have access to the Formulate section.
    /// </summary>
    /// <remarks>
    /// Without the section, a request gets 403, and without a back office user, 401.
    /// </remarks>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = false, Inherited = true)]
    public sealed class RequireFormulateSectionAttribute : TypeFilterAttribute
    {
        /// <inheritdoc cref="RequireFormulateSectionAttribute"/>
        public RequireFormulateSectionAttribute()
            : base(typeof(RequireFormulateSectionFilter))
        {
            // Run before the other action filters, including [ApiController]'s model validation, so a
            // user without the section gets 403 even when the request itself is invalid.
            Order = int.MinValue;
        }
    }
}
