namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Linq;
    using Formulate.BackOffice.Persistence;
    using Formulate.Core.Folders;
    using Formulate.Core.Persistence;

    /// <summary>
    /// The default implementation of <see cref="IMoveService"/>.
    /// </summary>
    public sealed class MoveService : IMoveService
    {
        private readonly ITreeEntityRepository _treeEntityRepository;

        /// <inheritdoc cref="MoveService"/>
        public MoveService(ITreeEntityRepository treeEntityRepository)
        {
            _treeEntityRepository = treeEntityRepository;
        }

        /// <inheritdoc />
        public ServiceResult<bool> Move<TEntity>(Guid id, Guid? targetId)
            where TEntity : class, IPersistedEntity
        {
            if (_treeEntityRepository.Get(id) is not TEntity entity)
            {
                return ServiceResult<bool>.NotFound($"The item {id} does not exist.");
            }

            var tree = TreeEntities.GetTree(entity);

            if (tree == TreeTypes.Unknown)
            {
                return ServiceResult<bool>.NotFound($"The item {id} is not in a Formulate tree.");
            }

            Guid[] newParentPath;

            if (targetId is null)
            {
                newParentPath = new[] { _treeEntityRepository.GetRootId(tree) };
            }
            else
            {
                var target = _treeEntityRepository.Get(targetId);

                if (target is not PersistedFolder)
                {
                    return ServiceResult<bool>.Invalid("targetId", "The target must be an existing folder.");
                }

                if (TreeEntities.GetTree(target) != tree)
                {
                    return ServiceResult<bool>.Invalid("targetId", "The target folder is in a different tree.");
                }

                if (target.Id == entity.Id || target.Path.Contains(entity.Id))
                {
                    return ServiceResult<bool>.Invalid("targetId", "An item cannot be moved into itself or into something under it.");
                }

                newParentPath = target.Path;
            }

            // One read of every repository finds everything under the item, however deep.
            var descendants = _treeEntityRepository.GetDescendants(entity.Id);
            var newPath = newParentPath.Append(entity.Id).ToArray();

            var moves = descendants
                .Select(x => (Entity: x, Path: newPath.Concat(x.Path.Skip(Array.IndexOf(x.Path, entity.Id) + 1)).ToArray()))
                .ToList();

            // Each item is saved on its own, so a failure part way can leave a mix. Moving again finishes
            // the job, because everything is found through the item's ID, wherever its path says it is.
            _treeEntityRepository.UpdatePath(entity, newPath);

            foreach (var (descendant, path) in moves.OrderBy(x => x.Path.Length))
            {
                _treeEntityRepository.UpdatePath(descendant, path);
            }

            return ServiceResult<bool>.Success(true);
        }
    }
}
