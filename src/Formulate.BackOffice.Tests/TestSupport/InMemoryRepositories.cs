using Formulate.BackOffice.Definitions.Forms;
using Formulate.BackOffice.NotificationHandlers;
using Formulate.BackOffice.Utilities;
using Formulate.Core.Forms;
using Formulate.Core.Layouts;
using Formulate.Core.Notifications;
using Formulate.Core.Persistence;
using Formulate.Core.Utilities;
using Formulate.Core.Utilities.Internal;
using Moq;
using Umbraco.Cms.Core.Events;
using Umbraco.Cms.Core.Notifications;
using Umbraco.Cms.Core.Scoping;
using Umbraco.Cms.Core.Strings;

namespace Formulate.BackOffice.Tests.TestSupport;

/// <summary>An in-memory repository utility that counts how often it is read.</summary>
internal sealed class InMemoryStore<TEntity> : IRepositoryUtility<TEntity>, IRepositoryUtilityFactory
    where TEntity : class, IPersistedEntity
{
    private readonly Dictionary<Guid, TEntity> _entities = new();

    /// <summary>Gets how many full reads (children, root items, all) ran.</summary>
    public int FullReads { get; private set; }

    public TEntity Save(TEntity entity)
    {
        _entities[entity.Id] = entity;
        return entity;
    }

    public void Delete(Guid entityId) => _entities.Remove(entityId);

    public TEntity Get(Guid entityId) => (_entities.TryGetValue(entityId, out var entity) ? entity : null)!;

    public IReadOnlyCollection<TEntity> GetChildren(Guid parentId)
    {
        FullReads++;
        return _entities.Values.Where(x => x.ParentId() == parentId).ToArray();
    }

    public IReadOnlyCollection<TEntity> GetRootItems()
    {
        FullReads++;
        return _entities.Values.Where(x => x.Path.Length == 2).ToArray();
    }

    public IReadOnlyCollection<TEntity> GetAll()
    {
        FullReads++;
        return _entities.Values.ToArray();
    }

    public Guid[] Move(TEntity entity, Guid[] newPath)
    {
        Save(entity);
        return entity.Path;
    }

    IRepositoryUtility<T> IRepositoryUtilityFactory.Create<T>() => (IRepositoryUtility<T>)(object)this;
}

internal sealed class TestFormRepository : EntityRepository<PersistedForm>, IFormEntityRepository
{
    public TestFormRepository(IRepositoryUtilityFactory factory, ICoreScopeProvider scopeProvider) : base(factory, scopeProvider) { }
}

internal sealed class TestLayoutRepository : EntityRepository<PersistedLayout>, ILayoutEntityRepository
{
    public TestLayoutRepository(IRepositoryUtilityFactory factory, ICoreScopeProvider scopeProvider) : base(factory, scopeProvider) { }
}

/// <summary>
/// Real entity repositories over in-memory stores, with Formulate's real "basic layout" handler
/// listening to the form notifications, as it does in a site.
/// </summary>
internal sealed class RepositoryHarness
{
    public static readonly Guid FormsRoot = Guid.Parse(FormConstants.RootId);

    public RepositoryHarness()
    {
        var provider = new Mock<ICoreScopeProvider> { DefaultValue = DefaultValue.Mock };
        var scope = Mock.Get(provider.Object.CreateCoreScope());
        var publisher = new Mock<IScopedNotificationPublisher>();
        publisher.Setup(x => x.Publish(It.IsAny<INotification>())).Callback<INotification>(Dispatch);
        scope.SetupGet(x => x.Notifications).Returns(publisher.Object);

        Forms = new TestFormRepository(FormStore, provider.Object);
        Layouts = new TestLayoutRepository(LayoutStore, provider.Object);

        var templateId = new Mock<IGetDefaultTemplateId>();
        templateId.Setup(x => x.GetValue()).Returns(Guid.Parse("00000000-0000-0000-0000-0000000000aa"));
        JsonUtility = new JsonUtility(new NewtonsoftJsonSerializer());
        FormDefinitions = new FormDefinitionCollection(() => new IFormDefinition[] { new FormWithBasicLayoutDefinition(), new DefaultFormLayoutDefinition() });
        Handler = new FormSavedWithBasicLayoutNotificationHandler(
            FormDefinitions,
            new DefaultShortStringHelper(new DefaultShortStringHelperConfig()),
            Layouts,
            JsonUtility,
            templateId.Object);
    }

    public InMemoryStore<PersistedForm> FormStore { get; } = new();

    public InMemoryStore<PersistedLayout> LayoutStore { get; } = new();

    public TestFormRepository Forms { get; }

    public TestLayoutRepository Layouts { get; }

    public IJsonUtility JsonUtility { get; }

    public FormDefinitionCollection FormDefinitions { get; }

    public FormSavedWithBasicLayoutNotificationHandler Handler { get; }

    private void Dispatch(INotification notification)
    {
        if (notification is EntitySavedNotification<PersistedForm> saved)
        {
            Handler.Handle(saved);
        }
    }
}
