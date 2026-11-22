using Formulate.BackOffice.Migrations;
using Microsoft.Extensions.Logging;
using Moq;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Services.OperationStatus;
using Umbraco.Cms.Infrastructure.Migrations;
using Xunit;

namespace Formulate.BackOffice.Tests.Migrations;

public sealed class GrantSectionToAdministratorsTests
{
    [Fact]
    public async Task Grants_the_section_to_administrators_when_missing()
    {
        var site = new FakeSite("content", "users");

        await site.Migration().RunAsync();

        Assert.Equal(new[] { "content", "users", "Formulate.Section" }, site.AdministratorSections);
        site.UserGroups.Verify(
            x => x.UpdateAsync(site.Administrators, Umbraco.Cms.Core.Constants.Security.SuperUserKey),
            Times.Once);
    }

    [Fact]
    public async Task Leaves_administrators_alone_when_they_already_have_the_section()
    {
        var site = new FakeSite("content", "Formulate.Section");

        await site.Migration().RunAsync();

        Assert.Equal(new[] { "content", "Formulate.Section" }, site.AdministratorSections);
        site.UserGroups.Verify(x => x.UpdateAsync(It.IsAny<IUserGroup>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task Warns_and_carries_on_when_there_is_no_administrators_group()
    {
        var site = new FakeSite("content") { AdministratorsExist = false };

        await site.Migration().RunAsync();

        site.UserGroups.Verify(x => x.UpdateAsync(It.IsAny<IUserGroup>(), It.IsAny<Guid>()), Times.Never);
        Assert.Contains(site.Log.Entries, x => x.Level == LogLevel.Warning && x.Message.Contains("admin"));
    }

    [Fact]
    public async Task Warns_and_carries_on_when_the_update_fails()
    {
        var site = new FakeSite("content") { UpdateStatus = UserGroupOperationStatus.CancelledByNotification };

        await site.Migration().RunAsync();

        Assert.Contains(
            site.Log.Entries,
            x => x.Level == LogLevel.Warning && x.Message.Contains(nameof(UserGroupOperationStatus.CancelledByNotification)));
    }

    /// <summary>
    /// The administrators group and the services the migration uses.
    /// </summary>
    private sealed class FakeSite
    {
        public FakeSite(params string[] administratorSections)
        {
            AdministratorSections = new List<string>(administratorSections);

            var administrators = new Mock<IUserGroup>();
            administrators.SetupGet(x => x.Id).Returns(1);
            administrators.SetupGet(x => x.Alias).Returns("admin");
            administrators.SetupGet(x => x.Name).Returns("Administrators");
            administrators.SetupGet(x => x.AllowedSections).Returns(AdministratorSections);
            administrators
                .Setup(x => x.AddAllowedSection(It.IsAny<string>()))
                .Callback<string>(AdministratorSections.Add);
            Administrators = administrators.Object;

            UserGroups
                .Setup(x => x.GetAsync("admin"))
                .ReturnsAsync(() => AdministratorsExist ? Administrators : null);
            UserGroups
                .Setup(x => x.UpdateAsync(It.IsAny<IUserGroup>(), It.IsAny<Guid>()))
                .ReturnsAsync((IUserGroup group, Guid _) => UpdateStatus == UserGroupOperationStatus.Success
                    ? Attempt.SucceedWithStatus(UpdateStatus, group)
                    : Attempt.FailWithStatus(UpdateStatus, group));
        }

        public List<string> AdministratorSections { get; }

        public IUserGroup Administrators { get; }

        public bool AdministratorsExist { get; init; } = true;

        public UserGroupOperationStatus UpdateStatus { get; init; } = UserGroupOperationStatus.Success;

        public Mock<IUserGroupService> UserGroups { get; } = new();

        public CapturingLogger<IMigrationContext> Log { get; } = new();

        public GrantSectionToAdministrators Migration()
        {
            var context = new Mock<IMigrationContext>();
            context.SetupGet(x => x.Logger).Returns(Log);
            return new GrantSectionToAdministrators(context.Object, UserGroups.Object);
        }
    }
}
