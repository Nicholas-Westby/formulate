namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Formulate.BackOffice.Api.Models.Item;
    using Formulate.BackOffice.Api.Models.Tree;
    using Formulate.BackOffice.Persistence;
    using Formulate.Core.DataValues;
    using Formulate.Core.Folders;
    using Formulate.Core.Forms;
    using Formulate.Core.Layouts;
    using Formulate.Core.Persistence;
    using Formulate.Core.Types;
    using Formulate.Core.Validations;
    using Umbraco.Cms.Api.Common.ViewModels.Pagination;
    using Umbraco.Cms.Api.Management.ViewModels;

    /// <summary>
    /// The default implementation of <see cref="IFormulateTreeService"/>.
    /// </summary>
    public sealed class FormulateTreeService : IFormulateTreeService
    {
        private readonly ITreeEntityRepository _treeEntityRepository;

        private readonly DataValuesDefinitionCollection _dataValuesDefinitions;

        private readonly ValidationDefinitionCollection _validationDefinitions;

        /// <summary>
        /// Initializes a new instance of the <see cref="FormulateTreeService"/> class.
        /// </summary>
        public FormulateTreeService(ITreeEntityRepository treeEntityRepository, DataValuesDefinitionCollection dataValuesDefinitions, ValidationDefinitionCollection validationDefinitions)
        {
            _treeEntityRepository = treeEntityRepository;
            _dataValuesDefinitions = dataValuesDefinitions;
            _validationDefinitions = validationDefinitions;
        }

        /// <inheritdoc />
        public ServiceResult<PagedViewModel<FormulateTreeItemResponseModel>> GetRoot(string treeAlias, bool foldersOnly, int skip, int take)
        {
            if (!TreeEntities.TryGetTree(treeAlias, out var tree))
            {
                return TreeEntities.UnknownTree<PagedViewModel<FormulateTreeItemResponseModel>>(treeAlias);
            }

            var entities = _treeEntityRepository.GetRootItems(tree);

            return ServiceResult<PagedViewModel<FormulateTreeItemResponseModel>>.Success(CreatePage(tree, entities, foldersOnly, skip, take));
        }

        /// <inheritdoc />
        public ServiceResult<PagedViewModel<FormulateTreeItemResponseModel>> GetChildren(string treeAlias, Guid parentId, bool foldersOnly, int skip, int take)
        {
            if (!TreeEntities.TryGetTree(treeAlias, out var tree))
            {
                return TreeEntities.UnknownTree<PagedViewModel<FormulateTreeItemResponseModel>>(treeAlias);
            }

            var parent = _treeEntityRepository.Get(parentId);

            if (parent is null || TreeEntities.GetTree(parent) != tree)
            {
                return TreeEntities.NotInTree<PagedViewModel<FormulateTreeItemResponseModel>>(parentId, treeAlias);
            }

            var entities = _treeEntityRepository.GetChildren(parentId);

            return ServiceResult<PagedViewModel<FormulateTreeItemResponseModel>>.Success(CreatePage(tree, entities, foldersOnly, skip, take));
        }

        /// <inheritdoc />
        public ServiceResult<IReadOnlyList<FormulateTreeItemResponseModel>> GetAncestors(string treeAlias, Guid descendantId)
        {
            if (!TreeEntities.TryGetTree(treeAlias, out var tree))
            {
                return TreeEntities.UnknownTree<IReadOnlyList<FormulateTreeItemResponseModel>>(treeAlias);
            }

            var descendant = _treeEntityRepository.Get(descendantId);

            if (descendant is null || TreeEntities.GetTree(descendant) != tree)
            {
                return TreeEntities.NotInTree<IReadOnlyList<FormulateTreeItemResponseModel>>(descendantId, treeAlias);
            }

            // The first path ID is the tree's root, which exists only in the client.
            var ancestors = new List<FormulateTreeItemResponseModel>();
            var hasChildren = CreateHasChildren(tree, foldersOnly: false);

            foreach (var id in descendant.Path.Skip(1).Where(x => x != descendant.Id))
            {
                var ancestor = _treeEntityRepository.Get(id);

                if (ancestor is not null)
                {
                    ancestors.Add(CreateTreeItem(ancestor, hasChildren));
                }
            }

            ancestors.Add(CreateTreeItem(descendant, hasChildren));

            return ServiceResult<IReadOnlyList<FormulateTreeItemResponseModel>>.Success(ancestors);
        }

        /// <inheritdoc />
        public IReadOnlyList<FormulateItemResponseModel> GetItems(IEnumerable<Guid> ids)
        {
            var items = new List<FormulateItemResponseModel>();

            foreach (var id in ids)
            {
                var entity = _treeEntityRepository.Get(id);

                if (entity is not null)
                {
                    items.Add(CreateItem(entity));
                }
            }

            return items;
        }

        private static string GetEntityType(IPersistedEntity entity)
        {
            return entity switch
            {
                PersistedForm => EntityTypes.Form,
                PersistedLayout => EntityTypes.Layout,
                PersistedDataValues => EntityTypes.DataValues,
                PersistedValidation => EntityTypes.Validation,
                PersistedFolder => TreeEntities.GetTree(entity) switch
                {
                    TreeTypes.DataValues => EntityTypes.DataValuesFolder,
                    TreeTypes.Validations => EntityTypes.ValidationFolder,
                    _ => EntityTypes.FormFolder,
                },
                _ => throw new NotSupportedException($"{entity.GetType()} is not a tree item."),
            };
        }

        private static Guid? GetKindId(IPersistedEntity entity)
        {
            return entity switch
            {
                PersistedLayout layout => layout.KindId,
                PersistedDataValues dataValues => dataValues.KindId,
                PersistedValidation validation => validation.KindId,
                _ => null,
            };
        }

        private static int Compare(IPersistedEntity x, IPersistedEntity y)
        {
            var byFolder = y.IsFolder().CompareTo(x.IsFolder());

            return byFolder != 0 ? byFolder : StringComparer.OrdinalIgnoreCase.Compare(x.Name, y.Name);
        }

        /// <summary>
        /// Creates a way to ask whether an entity has children that reads the repositories at most once,
        /// and not at all when nothing asks about an entity that can have children.
        /// </summary>
        private Func<IPersistedEntity, bool> CreateHasChildren(TreeTypes tree, bool foldersOnly)
        {
            var parentIds = new Lazy<HashSet<Guid>>(() => new HashSet<Guid>(_treeEntityRepository.GetParentIds(tree, foldersOnly)));

            return entity =>
            {
                // Only folders and forms can have children, and with foldersOnly only folder children count.
                var canHaveChildren = entity is PersistedFolder || (entity is PersistedForm && !foldersOnly);

                return canHaveChildren && parentIds.Value.Contains(entity.Id);
            };
        }

        private PagedViewModel<FormulateTreeItemResponseModel> CreatePage(TreeTypes tree, IEnumerable<IPersistedEntity> entities, bool foldersOnly, int skip, int take)
        {
            var hasChildren = CreateHasChildren(tree, foldersOnly);
            var sorted = entities
                .Where(x => !foldersOnly || x.IsFolder())
                .OrderBy(x => x, Comparer<IPersistedEntity>.Create(Compare))
                .ThenBy(x => x.Id)
                .ToArray();

            return new PagedViewModel<FormulateTreeItemResponseModel>
            {
                Total = sorted.Length,
                Items = sorted
                    .Skip(Math.Max(skip, 0))
                    .Take(Math.Max(take, 0))
                    .Select(x => CreateTreeItem(x, hasChildren))
                    .ToArray(),
            };
        }

        private FormulateTreeItemResponseModel CreateTreeItem(IPersistedEntity entity, Func<IPersistedEntity, bool> hasChildren)
        {
            var entityType = GetEntityType(entity);
            var parentId = TreeEntities.GetParentId(entity);
            var definition = GetDefinition(entity);

            return new FormulateTreeItemResponseModel
            {
                Id = entity.Id,
                Name = entity.Name,
                EntityType = entityType,
                HasChildren = hasChildren(entity),
                IsFolder = entity.IsFolder(),
                Icon = FormulateIcons.For(entityType, (definition as IDataValuesDefinition)?.Icon),
                Parent = parentId is null ? null : new ReferenceByIdModel(parentId.Value),
                KindId = GetKindId(entity),
                IsLegacy = definition?.IsLegacy ?? false,
            };
        }

        private FormulateItemResponseModel CreateItem(IPersistedEntity entity)
        {
            var entityType = GetEntityType(entity);
            var parentId = TreeEntities.GetParentId(entity);
            var parent = parentId is null ? null : _treeEntityRepository.Get(parentId);
            var definition = GetDefinition(entity);

            return new FormulateItemResponseModel
            {
                Id = entity.Id,
                Name = entity.Name,
                EntityType = entityType,
                Icon = FormulateIcons.For(entityType, (definition as IDataValuesDefinition)?.Icon),
                KindId = GetKindId(entity),
                ParentId = parent?.Id,
                ParentName = parent?.Name,
            };
        }

        private IDefinition? GetDefinition(IPersistedEntity entity)
        {
            return entity switch
            {
                PersistedDataValues dataValues => _dataValuesDefinitions.FirstOrDefault(dataValues.KindId),
                PersistedValidation validation => _validationDefinitions.FirstOrDefault(validation.KindId),
                _ => null,
            };
        }
    }
}
