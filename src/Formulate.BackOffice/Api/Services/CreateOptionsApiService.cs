namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Formulate.BackOffice.Api.Models.Tree;
    using Formulate.BackOffice.Definitions.Forms;
    using Formulate.BackOffice.Persistence;
    using Formulate.Core.DataValues;
    using Formulate.Core.Folders;
    using Formulate.Core.Forms;
    using Formulate.Core.Layouts;
    using Formulate.Core.Persistence;
    using Formulate.Core.Validations;

    /// <summary>
    /// The default implementation of <see cref="ICreateOptionsApiService"/>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The top of any tree and folders offer a folder and the kinds that tree holds: forms, or
    /// non-legacy data values and validations sorted by name. A form offers its layout kinds. Layouts and
    /// the items of the other trees offer nothing.
    /// </para>
    /// </remarks>
    public sealed class CreateOptionsApiService : ICreateOptionsApiService
    {
        private readonly ITreeEntityRepository _treeRepository;

        private readonly FormDefinitionCollection _formDefinitions;

        private readonly LayoutDefinitionCollection _layoutDefinitions;

        private readonly DataValuesDefinitionCollection _dataValuesDefinitions;

        private readonly ValidationDefinitionCollection _validationDefinitions;

        /// <inheritdoc cref="CreateOptionsApiService"/>
        public CreateOptionsApiService(
            ITreeEntityRepository treeRepository,
            FormDefinitionCollection formDefinitions,
            LayoutDefinitionCollection layoutDefinitions,
            DataValuesDefinitionCollection dataValuesDefinitions,
            ValidationDefinitionCollection validationDefinitions)
        {
            _treeRepository = treeRepository;
            _formDefinitions = formDefinitions;
            _layoutDefinitions = layoutDefinitions;
            _dataValuesDefinitions = dataValuesDefinitions;
            _validationDefinitions = validationDefinitions;
        }

        /// <inheritdoc />
        public ServiceResult<IReadOnlyList<CreateOptionModel>> GetCreateOptions(string treeAlias, Guid? parentId)
        {
            if (!TreeEntities.TryGetTree(treeAlias, out var tree))
            {
                return ServiceResult<IReadOnlyList<CreateOptionModel>>.Invalid("treeAlias", $"'{treeAlias}' is not a Formulate tree. Use forms, data-values or validations.");
            }

            // Null means the top of the tree, as it does for create and move. A tree's root ID is not an item,
            // so it is not found, as it is not a parent for create or a target for move either.
            var parent = parentId is null ? null : _treeRepository.Get(parentId);

            if (parentId is not null && (parent is null || TreeEntities.GetTree(parent) != tree))
            {
                return ServiceResult<IReadOnlyList<CreateOptionModel>>.NotFound($"The item {parentId} does not exist in the {treeAlias} tree.");
            }

            return ServiceResult<IReadOnlyList<CreateOptionModel>>.Success(GetOptions(tree, parent));
        }

        private IReadOnlyList<CreateOptionModel> GetOptions(TreeTypes tree, IPersistedEntity? parent)
        {
            switch (tree)
            {
                case TreeTypes.Forms:
                    return GetFormOptions(parent);

                case TreeTypes.DataValues:
                    return parent is null or PersistedFolder
                        ? WithFolder(EntityTypes.DataValuesFolder, _dataValuesDefinitions
                            .Where(definition => !definition.IsLegacy)
                            .Select(definition => Option(EntityTypes.DataValues, definition.KindId, definition.Name, null, definition.Icon)))
                        : Array.Empty<CreateOptionModel>();

                default:
                    return parent is null or PersistedFolder
                        ? WithFolder(EntityTypes.ValidationFolder, _validationDefinitions
                            .Where(definition => !definition.IsLegacy)
                            .Select(definition => Option(EntityTypes.Validation, definition.KindId, definition.Name, null, null)))
                        : Array.Empty<CreateOptionModel>();
            }
        }

        private IReadOnlyList<CreateOptionModel> GetFormOptions(IPersistedEntity? parent)
        {
            if (parent is PersistedForm)
            {
                return _layoutDefinitions
                    .Where(definition => !definition.IsLegacy)
                    .Select(definition => Option(EntityTypes.Layout, definition.KindId, definition.Name, null, null))
                    .OrderBy(option => option.Name, StringComparer.OrdinalIgnoreCase)
                    .ToArray();
            }

            if (parent is not null and not PersistedFolder)
            {
                return Array.Empty<CreateOptionModel>();
            }

            // Forms keep the order they are registered in, which in this order.
            var options = new List<CreateOptionModel> { FolderOption(EntityTypes.FormFolder) };

            options.AddRange(_formDefinitions
                .Where(definition => !definition.IsLegacy)
                .Select(definition => Option(EntityTypes.Form, definition.KindId, definition.Name, definition.Description, definition.Icon)));

            return options;
        }

        private static IReadOnlyList<CreateOptionModel> WithFolder(string folderEntityType, IEnumerable<CreateOptionModel> kinds)
        {
            var options = new List<CreateOptionModel> { FolderOption(folderEntityType) };

            options.AddRange(kinds.OrderBy(option => option.Name, StringComparer.OrdinalIgnoreCase));

            return options;
        }

        private static CreateOptionModel FolderOption(string folderEntityType) =>
            new() { EntityType = folderEntityType, Name = "Folder", Icon = FormulateIcons.Folder };

        private static CreateOptionModel Option(string entityType, Guid kindId, string name, string? description, string? definitionIcon) =>
            new()
            {
                EntityType = entityType,
                KindId = kindId,
                Name = name,
                Description = string.IsNullOrEmpty(description) ? null : description,
                Icon = FormulateIcons.For(entityType, definitionIcon),
            };
    }
}
