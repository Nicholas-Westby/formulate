namespace Formulate.BackOffice.Api.Filters
{
    using System.Linq;
    using System.Threading.Tasks;
    using Microsoft.AspNetCore.Http;
    using Microsoft.AspNetCore.Mvc;
    using Microsoft.AspNetCore.Mvc.Filters;
    using Umbraco.Cms.Api.Common.Builders;
    using Umbraco.Cms.Core.Models.Membership;
    using Umbraco.Cms.Core.Security;

    /// <summary>
    /// Stops a request when the current back office user lacks the Formulate section.
    /// </summary>
    /// <remarks>
    /// It reads the user's sections rather than using an authorization policy, because Umbraco 19
    /// changes the authentication schemes a custom policy has to name. By the time an action filter
    /// runs, the controller's back office access policy has already authenticated the user.
    /// </remarks>
    public sealed class RequireFormulateSectionFilter : IAsyncActionFilter
    {
        private readonly IBackOfficeSecurityAccessor _backOfficeSecurityAccessor;

        /// <inheritdoc cref="RequireFormulateSectionFilter"/>
        public RequireFormulateSectionFilter(IBackOfficeSecurityAccessor backOfficeSecurityAccessor)
        {
            _backOfficeSecurityAccessor = backOfficeSecurityAccessor;
        }

        /// <inheritdoc />
        public Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            IUser? user = _backOfficeSecurityAccessor.BackOfficeSecurity?.CurrentUser;
            if (user is null)
            {
                context.Result = new UnauthorizedResult();
                return Task.CompletedTask;
            }

            // An exact match, as the back office's section condition uses.
            if (user.AllowedSections.Contains(Constants.SectionAlias) == false)
            {
                ProblemDetails problem = new ProblemDetailsBuilder()
                    .WithTitle("The Formulate section is required")
                    .WithDetail("The current user does not have access to the Formulate section. An administrator can add the section to one of their user groups.")
                    .Build();
                problem.Status = StatusCodes.Status403Forbidden;
                context.Result = new ObjectResult(problem) { StatusCode = StatusCodes.Status403Forbidden };
                return Task.CompletedTask;
            }

            return next();
        }
    }
}
