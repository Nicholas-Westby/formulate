using System;
using System.IO;
using Formulate.Core.Utilities;
using Xunit;

namespace Formulate.Core.Tests.UtilityTests;

public sealed class ContentRootPathTests
{
    private static readonly string Root = Path.Combine(Path.GetTempPath(), "content-root");

    [Theory]
    [InlineData("~/Custom/Uploads")]
    [InlineData("~\\Custom\\Uploads")]
    [InlineData("Custom/Uploads")]
    public void Home_relative_and_relative_paths_start_at_the_content_root(string configured)
    {
        Assert.Equal(Path.Combine(Root, "Custom", "Uploads"), ContentRootPath.Resolve(configured, Root));
    }

    [Fact]
    public void A_backslash_separates_folders_only_where_the_system_does()
    {
        var resolved = ContentRootPath.Resolve("Custom\\Uploads", Root);

        // On Windows a backslash is a separator. Elsewhere it is part of one folder name.
        var expected = OperatingSystem.IsWindows()
            ? Path.Combine(Root, "Custom", "Uploads")
            : Path.Combine(Root, "Custom\\Uploads");
        Assert.Equal(expected, resolved);
    }

    [Fact]
    public void A_rooted_path_is_used_as_is()
    {
        var absolute = Path.Combine(Path.GetTempPath(), "elsewhere", "uploads");

        Assert.Equal(absolute, ContentRootPath.Resolve(absolute, Root));
    }
}
