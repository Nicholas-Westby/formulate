using Formulate.Core.Forms;
using Xunit;

namespace Formulate.Web.Tests.PersistenceTests
{
    public class WebHostRepositoryUtilityTests
    {
        [Fact]
        public void Save_then_Get_roundtrips_form()
        {
            using var site = new PersistenceFixture();
            var repository = site.Forms();
            var form = PersistenceFixture.NewForm("Contact");

            repository.Save(form);
            var loaded = repository.Get(form.Id);

            Assert.NotNull(loaded);
            Assert.Equal(form.Id, loaded.Id);
            Assert.Equal("Contact", loaded.Name);
        }

        [Fact]
        public void GetRootItems_on_missing_folder_returns_empty()
        {
            using var site = new PersistenceFixture();

            var items = site.Forms().GetRootItems();

            Assert.Empty(items);
            Assert.False(Directory.Exists(site.FormsFolder));
        }

        [Fact]
        public void Files_are_written_under_content_root_App_Data_not_wwwroot()
        {
            using var site = new PersistenceFixture();
            var form = PersistenceFixture.NewForm("Contact");

            site.Forms().Save(form);

            var expected = Path.Combine(site.ContentRoot, "App_Data", "Formulate", "Json", "Forms",
                form.Id.ToString("N") + ".form");
            Assert.True(File.Exists(expected), expected);
            Assert.Empty(Directory.GetFiles(site.WebRoot, "*", SearchOption.AllDirectories));
        }

        [Fact]
        public void Absolute_data_folder_path_is_used_as_is()
        {
            var absolute = Path.Combine(Path.GetTempPath(), "formulate-abs-" + Guid.NewGuid().ToString("N"));
            try
            {
                using var site = new PersistenceFixture(absolute);
                var form = PersistenceFixture.NewForm("Contact");

                site.Forms().Save(form);

                Assert.True(File.Exists(Path.Combine(absolute, "Forms", form.Id.ToString("N") + ".form")));
            }
            finally
            {
                if (Directory.Exists(absolute))
                {
                    Directory.Delete(absolute, true);
                }
            }
        }

        [Theory]
        [InlineData("~/Custom/Json")]
        [InlineData("~\\Custom\\Json")]
        public void Tilde_path_resolves_under_content_root(string configured)
        {
            using var site = new PersistenceFixture(configured);
            var form = PersistenceFixture.NewForm("Contact");

            site.Forms().Save(form);

            var expected = Path.Combine(site.ContentRoot, "Custom", "Json", "Forms", form.Id.ToString("N") + ".form");
            Assert.True(File.Exists(expected), expected);
        }

        [Fact]
        public void Resolved_data_folder_is_logged_once_at_information_level()
        {
            using var site = new PersistenceFixture();

            site.Forms();
            site.Factory.Create<Formulate.Core.Layouts.PersistedLayout>();

            var entry = Assert.Single(site.FactoryLogger.Entries, x => x.Level == Microsoft.Extensions.Logging.LogLevel.Information);
            Assert.Contains(Path.Combine(site.ContentRoot, "App_Data", "Formulate", "Json"), entry.Message);
        }

        [Fact]
        public void Leftover_tmp_files_are_ignored_by_listings()
        {
            using var site = new PersistenceFixture();
            var repository = site.Forms();
            var form = PersistenceFixture.NewForm("Contact");
            repository.Save(form);
            var leftover = Path.Combine(site.FormsFolder, form.Id.ToString("N") + ".form.tmp");
            File.WriteAllText(leftover, "{ \"Id\": \"half written");

            var items = repository.GetRootItems();

            Assert.Single(items);
            Assert.Empty(site.CacheLogger.Entries);
        }

        [Fact]
        public void Save_leaves_no_tmp_file_behind_and_overwrites_existing_content()
        {
            using var site = new PersistenceFixture();
            var repository = site.Forms();
            var form = PersistenceFixture.NewForm("First");
            repository.Save(form);
            form.Name = "Second";

            repository.Save(form);

            Assert.Equal("Second", repository.Get(form.Id).Name);
            Assert.Empty(Directory.GetFiles(site.FormsFolder, "*.tmp"));
        }

        [Fact]
        public void Failed_save_removes_its_temp_file()
        {
            using var site = new PersistenceFixture();
            var repository = site.Forms();
            var form = PersistenceFixture.NewForm("Blocked");

            // A folder where the entity file should go makes the final move fail.
            Directory.CreateDirectory(Path.Combine(site.FormsFolder, form.Id.ToString("N") + ".form"));

            Assert.ThrowsAny<IOException>(() => repository.Save(form));
            Assert.Empty(Directory.GetFiles(site.FormsFolder, "*.tmp"));
        }
    }
}
