namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Formulate.BackOffice.Api.Models.Folder;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Persistence;
    using Formulate.Core.DataValues;
    using Formulate.Core.Folders;
    using Formulate.Core.Forms;
    using Formulate.Core.Layouts;
    using Formulate.Core.Persistence;
    using Formulate.Core.Validations;

    /// <summary>
    /// The default implementation of <see cref="IFolderApiService"/>.
    /// </summary>
    public sealed class FolderApiService : IFolderApiService
    {
        private readonly ITreeEntityRepository _treeRepository;

        private readonly IFolderEntityRepository _folderRepository;

        private readonly IFormEntityRepository _formRepository;

        private readonly ILayoutEntityRepository _layoutRepository;

        private readonly IDataValuesEntityRepository _dataValuesRepository;

        private readonly IValidationEntityRepository _validationRepository;

        /// <inheritdoc cref="FolderApiService"/>
        public FolderApiService(
            ITreeEntityRepository treeRepository,
            IFolderEntityRepository folderRepository,
            IFormEntityRepository formRepository,
            ILayoutEntityRepository layoutRepository,
            IDataValuesEntityRepository dataValuesRepository,
            IValidationEntityRepository validationRepository)
        {
            _treeRepository = treeRepository;
            _folderRepository = folderRepository;
            _formRepository = formRepository;
            _layoutRepository = layoutRepository;
            _dataValuesRepository = dataValuesRepository;
            _validationRepository = validationRepository;
        }

        /// <inheritdoc />
        public ServiceResult<FolderResponseModel> Get(Guid id)
        {
            var folder = _folderRepository.Get(id);

            return folder is null || IsOutsideTrees(folder) ? NotFound(id) : ServiceResult<FolderResponseModel>.Success(ToResponse(folder));
        }

        /// <inheritdoc />
        public ServiceResult<FolderResponseModel> Create(CreateFolderRequestModel request)
        {
            if (request is null)
            {
                return RequestBody.Missing<FolderResponseModel>();
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return ServiceResult<FolderResponseModel>.Invalid("name", "The name is required.");
            }

            if (!TreeEntities.TryGetTree(request.TreeAlias, out var tree))
            {
                return ServiceResult<FolderResponseModel>.Invalid(
                    "treeAlias",
                    $"The tree alias must be one of {TreeAliases.Forms}, {TreeAliases.DataValues} or {TreeAliases.Validations}.");
            }

            var problem = CreatePlacement.Check<FolderResponseModel>(_treeRepository, tree, request.TreeAlias, request.Id, request.ParentId, out var parentPath);

            if (problem is not null)
            {
                return problem;
            }

            var folder = new PersistedFolder
            {
                Id = request.Id,
                Path = parentPath.Append(request.Id).ToArray(),
                Name = request.Name,
            };

            return ServiceResult<FolderResponseModel>.Success(ToResponse(_folderRepository.Save(folder)));
        }

        /// <inheritdoc />
        public ServiceResult<FolderResponseModel> Update(Guid id, UpdateFolderRequestModel request)
        {
            if (request is null)
            {
                return RequestBody.Missing<FolderResponseModel>();
            }

            var existing = _folderRepository.Get(id);

            if (existing is null || IsOutsideTrees(existing))
            {
                return NotFound(id);
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return ServiceResult<FolderResponseModel>.Invalid("name", "The name is required.");
            }

            // Only the name changes. The alias and the path stay as they are stored.
            var folder = new PersistedFolder
            {
                Id = existing.Id,
                Path = existing.Path,
                Alias = existing.Alias,
                Name = request.Name,
            };

            return ServiceResult<FolderResponseModel>.Success(ToResponse(_folderRepository.Save(folder)));
        }

        /// <inheritdoc />
        public ServiceResult<DeleteResponseModel> Delete(Guid id)
        {
            var folder = _folderRepository.Get(id);

            // A folder outside the three trees is not found, as it is for get, update and move.
            if (folder is null || IsOutsideTrees(folder))
            {
                return ServiceResult<DeleteResponseModel>.NotFound($"The folder {id} does not exist.");
            }

            // One read of every repository finds everything under the folder, however deep. The deepest
            // items go first, so a failure part way never leaves an item without its parent.
            var doomed = _treeRepository.GetDescendants(id)
                .OrderByDescending(x => x.Path.Length)
                .ToList();

            // Check every type first, so an unexpected one fails before any file is touched.
            var unsupported = doomed.FirstOrDefault(x => x is not (PersistedFolder or PersistedForm or PersistedLayout or PersistedDataValues or PersistedValidation));

            if (unsupported is not null)
            {
                return ServiceResult<DeleteResponseModel>.Conflict("id", $"The folder holds {unsupported.Id}, which is not a kind of item that can be deleted here. Nothing was deleted.");
            }

            var deletedIds = new List<Guid>();

            foreach (var entity in doomed)
            {
                Delete(entity);
                deletedIds.Add(entity.Id);
            }

            _folderRepository.Delete(id);
            deletedIds.Add(id);

            return ServiceResult<DeleteResponseModel>.Success(new DeleteResponseModel { DeletedIds = deletedIds.ToArray() });
        }

        private static ServiceResult<FolderResponseModel> NotFound(Guid id) =>
            ServiceResult<FolderResponseModel>.NotFound($"The folder {id} does not exist.");

        /// <summary>
        /// Says whether a stored folder sits outside the three trees, such as one with an empty or unknown path.
        /// </summary>
        private static bool IsOutsideTrees(PersistedFolder folder) => TreeEntities.GetTree(folder) == TreeTypes.Unknown;

        private static FolderResponseModel ToResponse(PersistedFolder folder) => new()
        {
            Id = folder.Id,
            Name = folder.Name,
            ParentId = TreeEntities.GetParentId(folder),
            TreeAlias = TreeEntities.GetAlias(TreeEntities.GetTree(folder)),
        };

        private void Delete(IPersistedEntity entity)
        {
            switch (entity)
            {
                case PersistedFolder:
                    _folderRepository.Delete(entity.Id);
                    break;
                case PersistedForm:
                    _formRepository.Delete(entity.Id);
                    break;
                case PersistedLayout:
                    _layoutRepository.Delete(entity.Id);
                    break;
                case PersistedDataValues:
                    _dataValuesRepository.Delete(entity.Id);
                    break;
                case PersistedValidation:
                    _validationRepository.Delete(entity.Id);
                    break;
                default:
                    throw new NotSupportedException($"{entity.GetType()} can not be deleted.");
            }
        }
    }
}
