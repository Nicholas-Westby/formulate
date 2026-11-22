using System;
using System.Collections.Generic;
using Formulate.Core.Forms;
using Formulate.Core.Notifications;
using Formulate.Core.Persistence;
using Moq;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Scoping;
using Xunit;

namespace Formulate.Core.Tests.PersistenceTests
{
    public class EntityRepositoryTests
    {
        private sealed class TestFormRepository : EntityRepository<PersistedForm>
        {
            public TestFormRepository(IRepositoryUtilityFactory factory, ICoreScopeProvider scopeProvider)
                : base(factory, scopeProvider)
            {
            }
        }

        private readonly InMemoryRepositoryUtility<PersistedForm> _store = new();
        private readonly List<object> _published = new();

        private TestFormRepository CreateRepository()
        {
            var provider = new Mock<ICoreScopeProvider> { DefaultValue = DefaultValue.Mock };
            var scope = Mock.Get(provider.Object.CreateCoreScope());
            var publisher = new Mock<IScopedNotificationPublisher>();
            publisher.Setup(x => x.Publish(It.IsAny<INotification>())).Callback<INotification>(x => _published.Add(x));
            scope.SetupGet(x => x.Notifications).Returns(publisher.Object);

            return new TestFormRepository(_store, provider.Object);
        }

        private static PersistedForm NewForm(Guid? id = null)
        {
            var formId = id ?? Guid.NewGuid();
            return new PersistedForm { Id = formId, Path = new[] { Guid.NewGuid(), formId }, Name = "Form", Alias = "form" };
        }

        [Fact]
        public void Saving_an_entity_that_is_not_stored_yet_is_new()
        {
            var repository = CreateRepository();

            repository.Save(NewForm());

            Assert.True(Assert.Single(_published, x => x is EntitySavingNotification<PersistedForm>) is EntitySavingNotification<PersistedForm> saving && saving.IsNew);
            Assert.True(((EntitySavedNotification<PersistedForm>)Assert.Single(_published, x => x is EntitySavedNotification<PersistedForm>)).IsNew);
        }

        [Fact]
        public void Saving_a_stored_entity_again_is_not_new()
        {
            var repository = CreateRepository();
            var form = NewForm();
            repository.Save(form);
            _published.Clear();

            repository.Save(form);

            Assert.False(((EntitySavingNotification<PersistedForm>)Assert.Single(_published, x => x is EntitySavingNotification<PersistedForm>)).IsNew);
            Assert.False(((EntitySavedNotification<PersistedForm>)Assert.Single(_published, x => x is EntitySavedNotification<PersistedForm>)).IsNew);
        }

        [Theory]
        [InlineData(typeof(EntitySavingNotification<PersistedForm>))]
        [InlineData(typeof(EntitySavedNotification<PersistedForm>))]
        public void A_save_notification_can_only_be_made_by_saying_whether_the_entity_is_new(Type notification)
        {
            // A constructor without IsNew would quietly mean "not new", so listeners for new forms would miss some.
            var constructor = Assert.Single(notification.GetConstructors());

            Assert.Equal(new[] { typeof(PersistedForm), typeof(bool) }, Array.ConvertAll(constructor.GetParameters(), x => x.ParameterType));
        }
    }
}
