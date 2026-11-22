namespace Formulate.BackOffice.Migrations
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using System.Threading.Tasks;
    using Microsoft.Extensions.Logging;
    using Umbraco.Cms.Core.Models;
    using Umbraco.Cms.Core.Models.Membership;
    using Umbraco.Cms.Core.Services;
    using Umbraco.Cms.Infrastructure.Migrations;

    /// <summary>
    /// Moves user groups from the Formulate 3 section to the Formulate section.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Formulate 3 (for Umbraco 8) stored its section as "formulate". Umbraco keeps that alias through its
    /// own upgrades, but the back office only shows the section to groups that have
    /// <see cref="Constants.SectionAlias"/>, so each group with the old alias gets the new one instead.
    /// </para>
    /// <para>
    /// The migration is unscoped, so each group is saved in its own transaction. In a scoped migration, a
    /// save that Umbraco refuses leaves the shared transaction incomplete, and Umbraco would silently roll
    /// back every other group, and the plan's progress, with it. Without that outer scope, Umbraco also
    /// publishes its usual save notifications, which refresh its user group cache.
    /// </para>
    /// <para>
    /// Safe to run again: groups without the old alias are left alone. When Umbraco refuses to save a
    /// group, or saving it throws, the migration logs a warning that names the group and moves on to the
    /// next one, so an administrator can fix that group from the Users section.
    /// </para>
    /// </remarks>
    public sealed class MoveFormulate3SectionPermissions : UnscopedAsyncMigrationBase
    {
        /// <summary>
        /// The section alias Formulate 3 stored for each user group.
        /// </summary>
        private const string Formulate3SectionAlias = "formulate";

        /// <summary>
        /// How many user groups to ask Umbraco for at a time.
        /// </summary>
        private const int PageSize = 100;

        private readonly IUserGroupService _userGroupService;

        /// <inheritdoc cref="MoveFormulate3SectionPermissions"/>
        public MoveFormulate3SectionPermissions(IMigrationContext context, IUserGroupService userGroupService)
            : base(context)
        {
            _userGroupService = userGroupService;
        }

        /// <inheritdoc />
        protected override async Task MigrateAsync()
        {
            foreach (IUserGroup group in await GetAllUserGroupsAsync())
            {
                if (group.AllowedSections.Contains(Formulate3SectionAlias))
                {
                    await MoveAsync(group);
                }
            }

            // Umbraco only records an unscoped migration as done when the migration completes its context.
            Context.Complete();
        }

        /// <summary>
        /// Reads every user group before any is changed, so saving a group cannot shift the pages.
        /// </summary>
        private async Task<List<IUserGroup>> GetAllUserGroupsAsync()
        {
            var groups = new List<IUserGroup>();
            while (true)
            {
                PagedModel<IUserGroup> page = await _userGroupService.GetAllAsync(groups.Count, PageSize);
                IUserGroup[] items = page.Items.ToArray();
                groups.AddRange(items);

                if (items.Length == 0 || groups.Count >= page.Total)
                {
                    return groups;
                }
            }
        }

        private async Task MoveAsync(IUserGroup group)
        {
            group.RemoveAllowedSection(Formulate3SectionAlias);
            if (group.AllowedSections.Contains(Constants.SectionAlias) == false)
            {
                group.AddAllowedSection(Constants.SectionAlias);
            }

            try
            {
                var result = await _userGroupService.UpdateAsync(
                    group,
                    Umbraco.Cms.Core.Constants.Security.SuperUserKey);

                if (result.Success == false)
                {
                    Logger.LogWarning(
                        "Did not move the {UserGroupName} user group ({UserGroupAlias}) from the Formulate 3 section to the "
                            + "{Section} section: {OperationStatus}.",
                        group.Name,
                        group.Alias,
                        Constants.SectionAlias,
                        result.Status);
                    return;
                }
            }
            catch (Exception exception)
            {
                Logger.LogWarning(
                    exception,
                    "Did not move the {UserGroupName} user group ({UserGroupAlias}) from the Formulate 3 section to the "
                        + "{Section} section: saving the group failed.",
                    group.Name,
                    group.Alias,
                    Constants.SectionAlias);
                return;
            }

            Logger.LogInformation(
                "Moved the {UserGroupName} user group ({UserGroupAlias}) from the Formulate 3 section to the "
                    + "{Section} section.",
                group.Name,
                group.Alias,
                Constants.SectionAlias);
        }
    }
}
