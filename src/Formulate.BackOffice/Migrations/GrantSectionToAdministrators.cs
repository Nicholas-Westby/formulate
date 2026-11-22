namespace Formulate.BackOffice.Migrations
{
    using System.Linq;
    using System.Threading.Tasks;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core.Models.Membership;
    using Umbraco.Cms.Core.Services;
    using Umbraco.Cms.Infrastructure.Migrations;

    /// <summary>
    /// Gives the administrators user group access to the Formulate section.
    /// </summary>
    /// <remarks>
    /// Safe to run again: it leaves the group alone when it already has the section. When the group
    /// is missing or Umbraco refuses the change, it logs a warning instead of failing, so the site
    /// still starts and an administrator can add the section from the Users section.
    /// </remarks>
    public sealed class GrantSectionToAdministrators : AsyncMigrationBase
    {
        private readonly IUserGroupService _userGroupService;

        /// <inheritdoc cref="GrantSectionToAdministrators"/>
        public GrantSectionToAdministrators(IMigrationContext context, IUserGroupService userGroupService)
            : base(context)
        {
            _userGroupService = userGroupService;
        }

        /// <inheritdoc />
        protected override async Task MigrateAsync()
        {
            const string groupAlias = Umbraco.Cms.Core.Constants.Security.AdminGroupAlias;

            IUserGroup? administrators = await _userGroupService.GetAsync(groupAlias);
            if (administrators is null)
            {
                Logger.LogWarning(
                    "Did not grant the {Section} section: there is no {UserGroupAlias} user group.",
                    Constants.SectionAlias,
                    groupAlias);
                return;
            }

            if (administrators.AllowedSections.Contains(Constants.SectionAlias))
            {
                Logger.LogInformation(
                    "The {UserGroupAlias} user group already has the {Section} section.",
                    groupAlias,
                    Constants.SectionAlias);
                return;
            }

            administrators.AddAllowedSection(Constants.SectionAlias);
            var result = await _userGroupService.UpdateAsync(
                administrators,
                Umbraco.Cms.Core.Constants.Security.SuperUserKey);

            if (result.Success == false)
            {
                Logger.LogWarning(
                    "Did not grant the {Section} section to the {UserGroupAlias} user group: {OperationStatus}.",
                    Constants.SectionAlias,
                    groupAlias,
                    result.Status);
                return;
            }

            Logger.LogInformation(
                "Granted the {Section} section to the {UserGroupAlias} user group.",
                Constants.SectionAlias,
                groupAlias);
        }
    }
}
