using System;
using Formulate.Core.Utilities.Submissions;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Umbraco.Cms.Core;
using Umbraco.Cms.Core.Models;
using Umbraco.Cms.Core.Models.Entities;
using Umbraco.Cms.Core.Models.PublishedContent;
using Umbraco.Cms.Core.Routing;
using Umbraco.Cms.Core.Services;
using Xunit;

namespace Formulate.Core.Tests.SubmissionTests
{
    /// <summary>
    /// The page lookup the Email, Send Data and Store Data handlers share.
    /// </summary>
    public sealed class SubmissionPageResolverTests
    {
        private static readonly Guid PageKey = Guid.NewGuid();

        private readonly Mock<IIdKeyMap> _idKeyMap = new Mock<IIdKeyMap>();
        private readonly Mock<IPublishedUrlProvider> _urls = new Mock<IPublishedUrlProvider>();
        private readonly Mock<IEntityService> _entities = new Mock<IEntityService>();

        private SubmissionPageResolver Create()
        {
            return new SubmissionPageResolver(_idKeyMap.Object, _urls.Object, _entities.Object, NullLogger<SubmissionPageResolver>.Instance);
        }

        private void PageExists(string url, string name)
        {
            _idKeyMap.Setup(x => x.GetKeyForId(1234, UmbracoObjectTypes.Document)).Returns(Attempt.Succeed(PageKey));
            _urls.Setup(x => x.GetUrl(PageKey, UrlMode.Absolute, null)).Returns(url);
            var entity = new Mock<IEntitySlim>();
            entity.SetupGet(x => x.Name).Returns(name);
            _entities.Setup(x => x.Get(1234, UmbracoObjectTypes.Document)).Returns(entity.Object);
        }

        [Fact]
        public void No_page_id_is_no_page()
        {
            Assert.Same(SubmissionPage.None, Create().Resolve(null));
        }

        [Fact]
        public void Page_gives_its_absolute_url_and_name()
        {
            PageExists("https://site.test/contact/", "Contact");

            var page = Create().Resolve(1234);

            Assert.Equal("https://site.test/contact/", page.Url);
            Assert.Equal("Contact", page.Name);
        }

        [Fact]
        public void Page_umbraco_cannot_route_has_no_url()
        {
            PageExists("#", "Contact");

            var page = Create().Resolve(1234);

            Assert.Null(page.Url);
            Assert.Null(page.Name);
        }

        [Fact]
        public void Unpublished_or_trashed_page_has_neither_url_nor_name()
        {
            PageExists(null, "Secret draft");

            var page = Create().Resolve(1234);

            Assert.Null(page.Url);
            Assert.Null(page.Name);
        }

        [Fact]
        public void Unknown_page_has_neither_url_nor_name()
        {
            _idKeyMap.Setup(x => x.GetKeyForId(5, UmbracoObjectTypes.Document)).Returns(Attempt<Guid>.Fail());
            var entity = new Mock<IEntitySlim>();
            entity.SetupGet(x => x.Name).Returns("Hidden");
            _entities.Setup(x => x.Get(5, UmbracoObjectTypes.Document)).Returns(entity.Object);

            var page = Create().Resolve(5);

            Assert.Null(page.Url);
            Assert.Null(page.Name);
        }

        [Fact]
        public void Failing_lookups_are_left_out_and_do_not_throw()
        {
            _idKeyMap.Setup(x => x.GetKeyForId(1234, UmbracoObjectTypes.Document)).Throws(new InvalidOperationException());
            _entities.Setup(x => x.Get(1234, UmbracoObjectTypes.Document)).Throws(new InvalidOperationException());

            var page = Create().Resolve(1234);

            Assert.Null(page.Url);
            Assert.Null(page.Name);
        }
    }
}
