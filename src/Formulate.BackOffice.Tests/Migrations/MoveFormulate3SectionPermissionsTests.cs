using Formulate.BackOffice.Migrations;
using Microsoft.Extensions.Logging;
using Moq;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.Membership;
using Umbraco.Cms.Core.Services;
using Umbraco.Cms.Core.Services.OperationStatus;
using Umbraco.Cms.Infrastructure.Migrations;
using Xunit;

namespace Formulate.BackOffice.Tests.Migrations;

public sealed class MoveFormulate3SectionPermissionsTests
{
    /// <summary>
    /// The section alias Formulate 3 (for Umbraco 8) stored for each user group.
    /// </summary>
    private const string Formulate3Section = "formulate";

    private const string Section = "Formulate.Section";

    [Fact]
    public async Task Moves_a_group_from_the_Formulate_3_section_to_the_new_section()
    {
        var site = new FakeSite();
        var editors = site.AddGroup("editor", "content", Formulate3Section, "media");

        await site.RunMigrationAsync();

        Assert.Equal(new[] { "content", "media", Section }, editors.Sections);
        site.VerifyUpdated(editors, Times.Once());
        site.VerifyCompleted();
    }

    [Fact]
    public async Task Only_removes_the_Formulate_3_section_when_the_group_already_has_the_new_one()
    {
        var site = new FakeSite();
        var administrators = site.AddGroup("admin", Formulate3Section, "content", Section);

        await site.RunMigrationAsync();

        Assert.Equal(new[] { "content", Section }, administrators.Sections);
        site.VerifyUpdated(administrators, Times.Once());
    }

    [Fact]
    public async Task Leaves_groups_without_the_Formulate_3_section_alone()
    {
        var site = new FakeSite();
        var writers = site.AddGroup("writer", "content");
        var administrators = site.AddGroup("admin", "content", Section);

        await site.RunMigrationAsync();

        Assert.Equal(new[] { "content" }, writers.Sections);
        Assert.Equal(new[] { "content", Section }, administrators.Sections);
        site.UserGroups.Verify(x => x.UpdateAsync(It.IsAny<IUserGroup>(), It.IsAny<Guid>()), Times.Never);
        site.VerifyCompleted();
    }

    [Fact]
    public async Task Warns_and_carries_on_when_a_group_cannot_be_updated()
    {
        var site = new FakeSite();
        var editors = site.AddGroup("editor", Formulate3Section);
        editors.UpdateStatus = UserGroupOperationStatus.DuplicateAlias;
        var writers = site.AddGroup("writer", Formulate3Section);

        await site.RunMigrationAsync();

        Assert.Contains(
            site.Log.Entries,
            x => x.Level == LogLevel.Warning
                && x.Message.Contains("editor")
                && x.Message.Contains(nameof(UserGroupOperationStatus.DuplicateAlias)));
        Assert.Equal(new[] { Section }, writers.Sections);
        site.VerifyUpdated(writers, Times.Once());
        site.VerifyCompleted();
    }

    [Fact]
    public async Task Warns_and_carries_on_when_updating_a_group_throws()
    {
        var site = new FakeSite();
        var editors = site.AddGroup("editor", Formulate3Section);
        editors.UpdateException = new InvalidOperationException("The database is unavailable.");
        var writers = site.AddGroup("writer", Formulate3Section);

        await site.RunMigrationAsync();

        Assert.Contains(
            site.Log.Entries,
            x => x.Level == LogLevel.Warning
                && x.Message.Contains("editor")
                && x.Exception == editors.UpdateException);
        site.VerifyUpdated(writers, Times.Once());
        site.VerifyCompleted();
    }

    [Fact]
    public async Task Moves_the_groups_on_every_page()
    {
        var site = new FakeSite { PageSize = 2 };
        var groups = Enumerable.Range(1, 5)
            .Select(x => site.AddGroup($"group{x}", Formulate3Section))
            .ToList();

        await site.RunMigrationAsync();

        Assert.All(groups, x => Assert.Equal(new[] { Section }, x.Sections));
    }

    /// <summary>
    /// The user groups and the services the migration uses.
    /// </summary>
    private sealed class FakeSite
    {
        private readonly List<FakeGroup> _groups = new();

        public FakeSite()
        {
            Context.SetupGet(x => x.Logger).Returns(Log);

            UserGroups
                .Setup(x => x.GetAllAsync(It.IsAny<int>(), It.IsAny<int>()))
                .ReturnsAsync((int skip, int take) => new PagedModel<IUserGroup>(
                    _groups.Count,
                    _groups.Skip(skip).Take(Math.Min(take, PageSize)).Select(x => x.Group).ToArray()));
            UserGroups
                .Setup(x => x.UpdateAsync(It.IsAny<IUserGroup>(), It.IsAny<Guid>()))
                .Returns((IUserGroup group, Guid _) => _groups.Single(x => x.Group == group).Update());
        }

        /// <summary>
        /// The most user groups the service returns at a time, however many the migration asks for.
        /// </summary>
        public int PageSize { get; init; } = int.MaxValue;

        public Mock<IUserGroupService> UserGroups { get; } = new();

        public Mock<IMigrationContext> Context { get; } = new();

        public CapturingLogger<IMigrationContext> Log { get; } = new();

        public FakeGroup AddGroup(string alias, params string[] sections)
        {
            var group = new FakeGroup(alias, sections);
            _groups.Add(group);
            return group;
        }

        public Task RunMigrationAsync()
        {
            return new MoveFormulate3SectionPermissions(Context.Object, UserGroups.Object).RunAsync();
        }

        public void VerifyUpdated(FakeGroup group, Times times)
        {
            UserGroups.Verify(
                x => x.UpdateAsync(group.Group, Umbraco.Cms.Core.Constants.Security.SuperUserKey),
                times);
        }

        /// <summary>
        /// Umbraco only records an unscoped migration as done when the migration completes its context.
        /// </summary>
        public void VerifyCompleted()
        {
            Context.Verify(x => x.Complete(), Times.Once);
        }
    }

    /// <summary>
    /// A user group with the sections it allows.
    /// </summary>
    private sealed class FakeGroup
    {
        public FakeGroup(string alias, string[] sections)
        {
            Sections = new List<string>(sections);

            var group = new Mock<IUserGroup>();
            group.SetupGet(x => x.Alias).Returns(alias);
            group.SetupGet(x => x.Name).Returns($"{alias} group");
            group.SetupGet(x => x.AllowedSections).Returns(Sections);
            group.Setup(x => x.AddAllowedSection(It.IsAny<string>())).Callback<string>(Sections.Add);
            group.Setup(x => x.RemoveAllowedSection(It.IsAny<string>())).Callback<string>(x => Sections.Remove(x));
            Group = group.Object;
        }

        public IUserGroup Group { get; }

        public List<string> Sections { get; }

        public UserGroupOperationStatus UpdateStatus { get; set; } = UserGroupOperationStatus.Success;

        public Exception? UpdateException { get; set; }

        public Task<Attempt<IUserGroup, UserGroupOperationStatus>> Update()
        {
            if (UpdateException is not null)
            {
                return Task.FromException<Attempt<IUserGroup, UserGroupOperationStatus>>(UpdateException);
            }

            return Task.FromResult(UpdateStatus == UserGroupOperationStatus.Success
                ? Attempt.SucceedWithStatus(UpdateStatus, Group)
                : Attempt.FailWithStatus(UpdateStatus, Group));
        }
    }
}
