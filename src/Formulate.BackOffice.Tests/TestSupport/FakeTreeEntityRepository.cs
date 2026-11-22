using Formulate.BackOffice.Persistence;
using Formulate.Core.DataValues;
using Formulate.Core.Folders;
using Formulate.Core.Forms;
using Formulate.Core.Persistence;
using Formulate.Core.Validations;

namespace Formulate.BackOffice.Tests.TestSupport;

internal static class FormConstantsRoot
{
    public static readonly Guid Forms = Guid.Parse(FormConstants.RootId);
    public static readonly Guid DataValues = Guid.Parse(DataValuesConstants.RootId);
    public static readonly Guid Validations = Guid.Parse(ValidationConstants.RootId);
}

/// <summary>An in-memory stand-in for the repository, with the same tree rules as the real one.</summary>
/// <summary>An in-memory stand-in for the repository, with the same tree rules as the real one.</summary>
internal sealed class FakeTreeEntityRepository : ITreeEntityRepository
{
    private readonly List<IPersistedEntity> _entities = new();

    public void Add(IPersistedEntity entity) => _entities.Add(entity);

    public IPersistedEntity? Get(Guid? id) => _entities.FirstOrDefault(x => x.Id == id);

    /// <summary>Gets how many times a child lookup (which reads every repository) ran.</summary>
    public int ChildLookups { get; private set; }

    /// <summary>Gets how many times the parent IDs were listed.</summary>
    public int ParentListings { get; private set; }

    public IReadOnlyCollection<IPersistedEntity> GetChildren(Guid parentId)
    {
        ChildLookups++;
        return _entities.Where(x => x.Path.Length > 1 && x.Path[^2] == parentId).ToArray();
    }

    public bool HasChildren(Guid parentId, Func<IPersistedEntity, bool>? filter = null) =>
        filter is null ? GetChildren(parentId).Any() : GetChildren(parentId).Any(filter);

    public IReadOnlyCollection<Guid> GetParentIds(TreeTypes treeType, bool foldersOnly)
    {
        ParentListings++;
        return _entities
            .Where(x => x.Path.Length > 2 && (!foldersOnly || x is PersistedFolder))
            .Select(x => x.Path[^2])
            .ToHashSet();
    }

    public IReadOnlyCollection<IPersistedEntity> GetRootItems(TreeTypes treeRootType) =>
        _entities.Where(x => x.Path.Length == 2 && x.Path[0] == GetRootId(treeRootType)).ToArray();

    public Guid GetRootId(TreeTypes treeRootType) => treeRootType switch
    {
        TreeTypes.Forms => FormConstantsRoot.Forms,
        TreeTypes.DataValues => FormConstantsRoot.DataValues,
        TreeTypes.Validations => FormConstantsRoot.Validations,
        _ => Guid.Empty,
    };

    public IReadOnlyCollection<Guid> Delete(IPersistedEntity entity) => throw new NotSupportedException();

    /// <summary>Gets how many descendant lookups ran.</summary>
    public int DescendantLookups { get; private set; }

    /// <summary>Gets the paths written, in order.</summary>
    public List<(Guid Id, Guid[] Path)> PathUpdates { get; } = new();

    /// <summary>Gets or sets what runs at the start of each descendant lookup, such as a pause.</summary>
    public Action? OnGetDescendants { get; set; }

    public IReadOnlyCollection<IPersistedEntity> GetDescendants(Guid id)
    {
        OnGetDescendants?.Invoke();
        DescendantLookups++;
        return _entities.Where(x => x.Id != id && x.Path.Contains(id)).ToArray();
    }

    public void UpdatePath(IPersistedEntity entity, Guid[] path)
    {
        PathUpdates.Add((entity.Id, path));
        ((PersistedEntity)entity).Path = path;
    }

    public Guid[] Move(IPersistedEntity entity, Guid[] parentPath) => throw new NotSupportedException();
}
