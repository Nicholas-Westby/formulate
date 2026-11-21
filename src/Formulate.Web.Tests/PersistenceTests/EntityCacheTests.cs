using Formulate.Core.Forms;
using Formulate.Core.Utilities;
using Formulate.Web.Persistence;
using Microsoft.Extensions.Logging;
using Xunit;

namespace Formulate.Web.Tests.PersistenceTests
{
    public class EntityCacheTests
    {
        [Fact]
        public void Get_after_external_file_edit_returns_new_content()
        {
            using var site = new PersistenceFixture();
            var repository = site.Forms();
            var form = PersistenceFixture.NewForm("Before");
            repository.Save(form);
            var path = Path.Combine(site.FormsFolder, form.Id.ToString("N") + ".form");
            Assert.Equal("Before", repository.Get(form.Id).Name);

            var edited = PersistenceFixture.NewForm("After");
            edited.Id = form.Id;
            File.WriteAllText(path, site.JsonUtility.Serialize(edited));
            File.SetLastWriteTimeUtc(path, File.GetLastWriteTimeUtc(path).AddMinutes(1));

            Assert.Equal("After", repository.Get(form.Id).Name);
        }

        [Fact]
        public void Corrupt_json_file_is_skipped_and_logged()
        {
            using var site = new PersistenceFixture();
            var repository = site.Forms();
            var good = PersistenceFixture.NewForm("Good");
            repository.Save(good);
            var corruptPath = Path.Combine(site.FormsFolder, Guid.NewGuid().ToString("N") + ".form");
            File.WriteAllText(corruptPath, "{ \"Id\": \"not finished");

            var items = repository.GetRootItems();

            var item = Assert.Single(items);
            Assert.Equal("Good", item.Name);
            var entry = Assert.Single(site.CacheLogger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains(corruptPath, entry.Message);
        }

        [Fact]
        public void Entity_file_without_an_Id_is_skipped_and_logged()
        {
            AssertInvalidFileIsSkipped(form => form.Id = Guid.Empty, "it has no Id");
        }

        [Fact]
        public void Entity_file_without_a_Path_is_skipped_and_logged()
        {
            AssertInvalidFileIsSkipped(form => form.Path = null!, "it has no Path");
        }

        [Fact]
        public void Entity_file_whose_Id_does_not_match_its_file_name_is_skipped_and_logged()
        {
            AssertInvalidFileIsSkipped(form => form.Id = Guid.NewGuid(), "does not match the file name");
        }

        [Fact]
        public void Empty_entity_file_is_skipped_and_logged()
        {
            using var site = new PersistenceFixture();
            var repository = site.Forms();
            repository.Save(PersistenceFixture.NewForm("Good"));
            var emptyPath = Path.Combine(site.FormsFolder, Guid.NewGuid().ToString("N") + ".form");
            File.WriteAllText(emptyPath, "");

            var item = Assert.Single(repository.GetRootItems());

            Assert.Equal("Good", item.Name);
            var entry = Assert.Single(site.CacheLogger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains(emptyPath, entry.Message);
            Assert.Contains("it is empty", entry.Message);
        }

        [Fact]
        public void Get_twice_without_an_edit_reads_the_file_once()
        {
            using var site = new PersistenceFixture();
            var form = PersistenceFixture.NewForm("Contact");
            site.Forms().Save(form);
            var path = Path.Combine(site.FormsFolder, form.Id.ToString("N") + ".form");
            var counting = new CountingJsonUtility(site.JsonUtility);
            var cache = new FileSystemPersistedEntityCache(counting,
                new CapturingLogger<FileSystemPersistedEntityCache>());

            var first = cache.Get<PersistedForm>(path);
            var second = cache.Get<PersistedForm>(path);

            Assert.Same(first, second);
            Assert.Equal(1, counting.DeserializeCalls);
        }

        [Fact]
        public void Get_after_the_file_is_deleted_returns_null()
        {
            using var site = new PersistenceFixture();
            var form = PersistenceFixture.NewForm("Contact");
            var repository = site.Forms();
            repository.Save(form);
            Assert.NotNull(repository.Get(form.Id));

            File.Delete(Path.Combine(site.FormsFolder, form.Id.ToString("N") + ".form"));

            Assert.Null(repository.Get(form.Id));
        }

        [Theory]
        [InlineData(typeof(IOException))]
        [InlineData(typeof(UnauthorizedAccessException))]
        public void A_file_that_could_not_be_read_is_retried_on_the_next_Get(Type failure)
        {
            using var site = new PersistenceFixture();
            var form = PersistenceFixture.NewForm("Contact");
            site.Forms().Save(form);
            var path = Path.Combine(site.FormsFolder, form.Id.ToString("N") + ".form");
            var reads = 0;
            var logger = new CapturingLogger<FileSystemPersistedEntityCache>();
            var cache = new FileSystemPersistedEntityCache(site.JsonUtility, logger, p =>
            {
                reads++;
                if (reads == 1)
                {
                    throw (Exception)Activator.CreateInstance(failure)!;
                }

                return File.ReadAllText(p);
            });

            var first = cache.Get<PersistedForm>(path);
            var second = cache.Get<PersistedForm>(path);

            Assert.Null(first);
            Assert.Single(logger.Entries, x => x.Level == LogLevel.Warning);
            Assert.NotNull(second);
            Assert.Equal("Contact", second.Name);
        }

        /// <summary>
        /// Writes a form file that parses but is broken by <paramref name="breakIt"/>, next to a good
        /// form, and checks both listings skip it and one warning names the file and the reason.
        /// </summary>
        private static void AssertInvalidFileIsSkipped(Action<PersistedForm> breakIt, string reason)
        {
            using var site = new PersistenceFixture();
            var repository = site.Forms();
            repository.Save(PersistenceFixture.NewForm("Good"));
            var broken = PersistenceFixture.NewForm("Broken");
            var brokenPath = Path.Combine(site.FormsFolder, broken.Id.ToString("N") + ".form");
            breakIt(broken);
            File.WriteAllText(brokenPath, site.JsonUtility.Serialize(broken));

            var rootItems = repository.GetRootItems();
            var children = repository.GetChildren(Guid.Empty);

            Assert.Equal("Good", Assert.Single(rootItems).Name);
            Assert.Equal("Good", Assert.Single(children).Name);

            // One warning across both listings: the broken file is remembered until it changes.
            var entry = Assert.Single(site.CacheLogger.Entries, x => x.Level == LogLevel.Warning);
            Assert.Contains(brokenPath, entry.Message);
            Assert.Contains(reason, entry.Message);
        }

        private sealed class CountingJsonUtility : IJsonUtility
        {
            private readonly IJsonUtility _inner;

            public CountingJsonUtility(IJsonUtility inner) => _inner = inner;

            public int DeserializeCalls { get; private set; }

            public T Deserialize<T>(string value)
            {
                DeserializeCalls++;
                return _inner.Deserialize<T>(value);
            }

            public string Serialize(object value) => _inner.Serialize(value);
        }
    }
}
