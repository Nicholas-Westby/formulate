namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.BackOffice.Persistence;
    using Formulate.Core.DataValues;
    using Formulate.Core.Folders;
    using Formulate.Core.Forms;
    using Formulate.Core.Layouts;
    using Formulate.Core.Persistence;
    using Formulate.Core.Validations;

    /// <summary>
    /// Works out which tree an entity lives in.
    /// </summary>
    internal static class TreeEntities
    {
        /// <summary>
        /// Gets the tree an entity lives in. Folders carry their tree's root ID at the start of their path.
        /// </summary>
        public static TreeTypes GetTree(IPersistedEntity entity)
        {
            return entity switch
            {
                PersistedForm or PersistedLayout => TreeTypes.Forms,
                PersistedDataValues => TreeTypes.DataValues,
                PersistedValidation => TreeTypes.Validations,
                PersistedFolder => GetFolderTree(entity),
                _ => TreeTypes.Unknown,
            };
        }

        /// <summary>
        /// Gets the ID of the folder, form or other item that holds the entity; null when it sits at the top of its tree.
        /// </summary>
        public static Guid? GetParentId(IPersistedEntity entity)
        {
            // The first path ID is the tree's root, which is not an item.
            return entity.Path.Length > 2 ? entity.Path[^2] : null;
        }

        /// <summary>
        /// Gets the tree a tree alias, as in a route or a request, names.
        /// </summary>
        /// <returns>False when the alias is not one of <see cref="TreeAliases"/>.</returns>
        public static bool TryGetTree(string? treeAlias, out TreeTypes tree)
        {
            tree = treeAlias switch
            {
                TreeAliases.Forms => TreeTypes.Forms,
                TreeAliases.DataValues => TreeTypes.DataValues,
                TreeAliases.Validations => TreeTypes.Validations,
                _ => TreeTypes.Unknown,
            };

            return tree != TreeTypes.Unknown;
        }

        /// <summary>
        /// Gets the alias of a tree, as in <see cref="TreeAliases"/>.
        /// </summary>
        public static string GetAlias(TreeTypes tree)
        {
            return tree switch
            {
                TreeTypes.Forms => TreeAliases.Forms,
                TreeTypes.DataValues => TreeAliases.DataValues,
                TreeTypes.Validations => TreeAliases.Validations,
                _ => throw new ArgumentOutOfRangeException(nameof(tree), tree, "Not a Formulate tree."),
            };
        }

        /// <summary>
        /// Gets the path of the place something new goes in a tree: the top of the tree, or a folder of that tree.
        /// </summary>
        /// <param name="repository">The tree entity repository.</param>
        /// <param name="tree">The tree.</param>
        /// <param name="parentId">The ID of the folder, or null for the top of the tree.</param>
        /// <returns>The parent's path; null when the parent is not a folder in the tree.</returns>
        public static Guid[]? GetParentPath(ITreeEntityRepository repository, TreeTypes tree, Guid? parentId)
        {
            if (parentId is null)
            {
                return new[] { repository.GetRootId(tree) };
            }

            var folder = repository.Get(parentId);

            return folder is PersistedFolder && GetTree(folder) == tree ? folder.Path : null;
        }

        private static TreeTypes GetFolderTree(IPersistedEntity folder)
        {
            if (folder.Path.Length == 0)
            {
                return TreeTypes.Unknown;
            }

            var root = folder.Path[0];

            if (root == Guid.Parse(FormConstants.RootId))
            {
                return TreeTypes.Forms;
            }

            if (root == Guid.Parse(DataValuesConstants.RootId))
            {
                return TreeTypes.DataValues;
            }

            return root == Guid.Parse(ValidationConstants.RootId) ? TreeTypes.Validations : TreeTypes.Unknown;
        }
    }
}
