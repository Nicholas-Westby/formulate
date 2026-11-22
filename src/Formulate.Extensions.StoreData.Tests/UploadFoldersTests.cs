using Formulate.Extensions.StoreData.Utilities;
using Xunit;

namespace Formulate.Extensions.StoreData.Tests;

public sealed class UploadFoldersTests
{
    private static readonly string ContentRoot = Path.Combine(Path.GetTempPath(), "content-root");

    [Theory]
    [InlineData("~/Custom/Uploads")]
    [InlineData("~\\Custom\\Uploads")]
    [InlineData("Custom/Uploads")]
    public void A_home_relative_or_relative_path_starts_at_the_content_root(string configured)
    {
        var folders = new UploadFolders(ContentRoot, configured);

        Assert.Equal(Path.Combine(ContentRoot, "Custom", "Uploads"), folders.Root);
    }

    [Fact]
    public void An_absolute_path_is_used_as_is()
    {
        var absolute = Path.Combine(Path.GetTempPath(), "elsewhere", "uploads");

        Assert.Equal(absolute, new UploadFolders(ContentRoot, absolute).Root);
    }

    [Fact]
    public void No_setting_uses_the_default_under_the_content_root()
    {
        Assert.Equal(Path.Combine(ContentRoot, "App_Data", "Formulate", "Uploads"), new UploadFolders(ContentRoot, null).Root);
    }
}
