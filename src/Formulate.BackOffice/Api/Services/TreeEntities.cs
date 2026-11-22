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
