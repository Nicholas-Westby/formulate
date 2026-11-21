using Formulate.Core.Forms;
using Formulate.Core.Persistence;
using Formulate.Core.Utilities;
using Formulate.Core.Utilities.Internal;
using Formulate.Web.Configuration;
using Formulate.Web.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;

namespace Formulate.Web.Tests.PersistenceTests
{
    /// <summary>
    /// A temporary site (content root plus web root) with the persistence objects wired to it.
    /// </summary>
    internal sealed class PersistenceFixture : IDisposable
    {
        public PersistenceFixture(string? dataFolderPath = null)
        {
            ContentRoot = Path.Combine(Path.GetTempPath(), "formulate-tests-" + Guid.NewGuid().ToString("N"));
            WebRoot = Path.Combine(ContentRoot, "wwwroot");
            Directory.CreateDirectory(WebRoot);

            var environment = new Mock<IWebHostEnvironment>();
            environment.SetupGet(x => x.ContentRootPath).Returns(ContentRoot);
            environment.SetupGet(x => x.WebRootPath).Returns(WebRoot);

            var options = new FormulateWebsiteOptions();
            if (dataFolderPath is not null)
            {
                options.Persistence.DataFolderPath = dataFolderPath;
            }

            JsonUtility = new JsonUtility(new NewtonsoftJsonSerializer());
            CacheLogger = new CapturingLogger<FileSystemPersistedEntityCache>();
            FactoryLogger = new CapturingLogger<WebHostRepositoryUtilityFactory>();
            Cache = new FileSystemPersistedEntityCache(JsonUtility, CacheLogger);
            Factory = new WebHostRepositoryUtilityFactory(Options.Create(options), environment.Object,
                JsonUtility, Cache, FactoryLogger);
        }

        public string ContentRoot { get; }

        public string WebRoot { get; }

        public IJsonUtility JsonUtility { get; }

        public CapturingLogger<FileSystemPersistedEntityCache> CacheLogger { get; }

        public CapturingLogger<WebHostRepositoryUtilityFactory> FactoryLogger { get; }

        public IPersistedEntityCache Cache { get; }

        public WebHostRepositoryUtilityFactory Factory { get; }

        public string FormsFolder => Path.Combine(ContentRoot, "App_Data", "Formulate", "Json", "Forms");

        public IRepositoryUtility<PersistedForm> Forms() => Factory.Create<PersistedForm>();

        public static PersistedForm NewForm(string name)
        {
            var id = Guid.NewGuid();
            return new PersistedForm { Id = id, Path = new[] { Guid.Empty, id }, Name = name, Alias = "alias" };
        }

        public void Dispose()
        {
            try
            {
                Directory.Delete(ContentRoot, true);
            }
            catch (IOException)
            {
            }
        }
    }
}
