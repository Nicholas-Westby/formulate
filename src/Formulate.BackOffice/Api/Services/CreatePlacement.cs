namespace Formulate.BackOffice.Api.Services
{
    using System;
    using Formulate.BackOffice.Persistence;

    /// <summary>
    /// The checks that decide where something new goes in a tree: it has an ID nothing else uses, and a
    /// parent that is the top of the tree or a folder of that same tree.
    /// </summary>
    internal static class CreatePlacement
    {
        /// <summary>
        /// Checks the ID and the parent of something about to be created.
        /// </summary>
        /// <param name="repository">The tree entity repository.</param>
        /// <param name="tree">The tree the new item goes in.</param>
        /// <param name="treeLabel">The tree's name, for the message when the parent is wrong.</param>
        /// <param name="id">The new item's ID.</param>
        /// <param name="parentId">The parent folder's ID; null for the top of the tree.</param>
        /// <param name="parentPath">The parent's path, when the checks pass.</param>
        /// <typeparam name="T">The type of the service result value.</typeparam>
        /// <returns>The problem, or null when the item can be created.</returns>
        public static ServiceResult<T>? Check<T>(
            ITreeEntityRepository repository,
            TreeTypes tree,
            string treeLabel,
            Guid id,
            Guid? parentId,
            out Guid[] parentPath)
        {
            parentPath = Array.Empty<Guid>();

            if (id == Guid.Empty)
            {
                return ServiceResult<T>.Invalid("id", "The ID is required.");
            }

            var path = TreeEntities.GetParentPath(repository, tree, parentId);

            if (path is null)
            {
                return ServiceResult<T>.Invalid("parentId", $"The parent must be an existing folder in the {treeLabel} tree.");
            }

            if (repository.Get(id) is not null)
            {
                return ServiceResult<T>.Conflict("id", $"Something with the ID {id} already exists.");
            }

            parentPath = path;

            return null;
        }
    }
}
