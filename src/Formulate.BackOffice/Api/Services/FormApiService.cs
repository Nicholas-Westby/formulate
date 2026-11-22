namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Formulate.BackOffice.Api.Json;
    using Formulate.BackOffice.Api.Models.Form;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Definitions.Forms;
    using Formulate.Core.Folders;
    using Formulate.Core.FormFields;
    using Formulate.Core.FormHandlers;
    using Formulate.Core.Forms;
    using Formulate.Core.Layouts;
    using Formulate.Core.Persistence;
    using Formulate.Core.Types;
    using Umbraco.Cms.Core.Strings;
    using Umbraco.Extensions;

    /// <summary>
    /// The default implementation of <see cref="IFormApiService"/>.
    /// </summary>
    public sealed class FormApiService : IFormApiService
    {
        private readonly IFormEntityRepository _formRepository;

        private readonly ILayoutEntityRepository _layoutRepository;

        private readonly IFolderEntityRepository _folderRepository;

        private readonly FormDefinitionCollection _formDefinitions;

        private readonly FormFieldDefinitionCollection _fieldDefinitions;

        private readonly FormHandlerDefinitionCollection _handlerDefinitions;

        private readonly ConfigurationJson _configurationJson;

        private readonly IShortStringHelper _shortStringHelper;

        /// <inheritdoc cref="FormApiService"/>
        public FormApiService(
            IFormEntityRepository formRepository,
            ILayoutEntityRepository layoutRepository,
            IFolderEntityRepository folderRepository,
            FormDefinitionCollection formDefinitions,
            FormFieldDefinitionCollection fieldDefinitions,
            FormHandlerDefinitionCollection handlerDefinitions,
            ConfigurationJson configurationJson,
            IShortStringHelper shortStringHelper)
        {
            _formRepository = formRepository;
            _layoutRepository = layoutRepository;
            _folderRepository = folderRepository;
            _formDefinitions = formDefinitions;
            _fieldDefinitions = fieldDefinitions;
            _handlerDefinitions = handlerDefinitions;
            _configurationJson = configurationJson;
            _shortStringHelper = shortStringHelper;
        }

        /// <inheritdoc />
        public ServiceResult<FormResponseModel> Get(Guid id)
        {
            var form = _formRepository.Get(id);

            return form is null ? NotFound(id) : ServiceResult<FormResponseModel>.Success(ToResponse(form));
        }

        /// <inheritdoc />
        public ServiceResult<FormResponseModel> Create(CreateFormRequestModel request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return ServiceResult<FormResponseModel>.Invalid("name", "The name is required.");
            }

            if (_formDefinitions.FirstOrDefault(request.KindId) is null)
            {
                return ServiceResult<FormResponseModel>.Invalid("kindId", $"{request.KindId} is not a form kind.");
            }

            if (request.Id == Guid.Empty)
            {
                return ServiceResult<FormResponseModel>.Invalid("id", "The ID is required.");
            }

            if (_formRepository.Get(request.Id) is not null || _layoutRepository.Get(request.Id) is not null)
            {
                return ServiceResult<FormResponseModel>.Conflict("id", $"Something with the ID {request.Id} already exists.");
            }

            var duplicate = FindDuplicateIds(request.Fields, request.Handlers);

            if (duplicate is not null)
            {
                return duplicate;
            }

            var parentPath = GetParentPath(request.ParentId, "parentId", out var problem);

            if (parentPath is null)
            {
                return problem!;
            }

            var form = new PersistedForm
            {
                Id = request.Id,
                Name = request.Name,
                Alias = request.Alias,
                Path = parentPath.Append(request.Id).ToArray(),
                KindId = request.KindId,
                Fields = request.Fields.Select(ToPersisted).ToArray(),
                Handlers = request.Handlers.Select(ToPersisted).ToArray(),
            };

            // The kind rides along on the new form so listeners, such as the one that generates a layout, can see it.
            return ServiceResult<FormResponseModel>.Success(ToResponse(_formRepository.Save(form)));
        }

        /// <inheritdoc />
        public ServiceResult<FormResponseModel> Update(Guid id, UpdateFormRequestModel request)
        {
            var existing = _formRepository.Get(id);

            if (existing is null)
            {
                return NotFound(id);
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return ServiceResult<FormResponseModel>.Invalid("name", "The name is required.");
            }

            var duplicate = FindDuplicateIds(request.Fields, request.Handlers);

            if (duplicate is not null)
            {
                return duplicate;
            }

            var form = new PersistedForm
            {
                Id = existing.Id,
                Path = existing.Path,
                KindId = existing.KindId,
                Name = request.Name,
                Alias = request.Alias,
                Fields = request.Fields.Select(ToPersisted).ToArray(),
                Handlers = request.Handlers.Select(ToPersisted).ToArray(),
            };

            return ServiceResult<FormResponseModel>.Success(ToResponse(_formRepository.Save(form)));
        }

        /// <inheritdoc />
        public ServiceResult<DeleteResponseModel> Delete(Guid id)
        {
            var form = _formRepository.Get(id);

            if (form is null)
            {
                return ServiceResult<DeleteResponseModel>.NotFound($"The form {id} does not exist.");
            }

            var deleted = new List<Guid>();

            // One read finds every layout of the form.
            foreach (var layout in _layoutRepository.GetChildren(id))
            {
                _layoutRepository.Delete(layout.Id);
                deleted.Add(layout.Id);
            }

            _formRepository.Delete(id);
            deleted.Add(id);

            return ServiceResult<DeleteResponseModel>.Success(new DeleteResponseModel { DeletedIds = deleted.ToArray() });
        }

        /// <inheritdoc />
        public ServiceResult<FormResponseModel> Duplicate(Guid id, DuplicateFormRequestModel request)
        {
            var source = _formRepository.Get(id);

            if (source is null)
            {
                return NotFound(id);
            }

            var parentId = request.ParentId ?? TreeEntities.GetParentId(source);
            var parentPath = GetParentPath(parentId, "parentId", out var problem);

            if (parentPath is null)
            {
                return problem!;
            }

            var newId = Guid.NewGuid();

            // The fields and handlers get new IDs, and whatever refers to them follows.
            var map = new Dictionary<Guid, Guid>();

            foreach (var field in source.Fields)
            {
                map[field.Id] = Guid.NewGuid();
            }

            foreach (var handler in source.Handlers)
            {
                map[handler.Id] = Guid.NewGuid();
            }

            var name = $"{source.Name} (copy)";
            var path = parentPath.Append(newId).ToArray();

            var copy = new PersistedForm
            {
                Id = newId,
                Path = path,
                Name = name,
                Alias = string.IsNullOrWhiteSpace(source.Alias) ? source.Alias : name.ToSafeAlias(_shortStringHelper, true),

                // No kind: a form kind only matters when a form is created, and a copy brings its own
                // layouts, so the layout generation for "Form with Basic Layout" must stay quiet.
                KindId = null,
                Fields = source.Fields.Select(x => new PersistedFormField
                {
                    Id = map[x.Id],
                    KindId = x.KindId,
                    Name = x.Name,
                    Alias = x.Alias,
                    Label = x.Label,
                    Category = x.Category,
                    Validations = x.Validations?.ToArray() ?? Array.Empty<Guid>(),
                    Data = GuidRemapper.Remap(x.Data, map),
                }).ToArray(),
                Handlers = source.Handlers.Select(x => new PersistedFormHandler
                {
                    Id = map[x.Id],
                    KindId = x.KindId,
                    Name = x.Name,
                    Alias = x.Alias,
                    Enabled = x.Enabled,
                    Data = GuidRemapper.Remap(x.Data, map),
                }).ToArray(),
            };

            var layouts = _layoutRepository.GetChildren(id);

            // The form is saved and then each layout, with no rollback: a failure part way leaves a copy
            // with some of its layouts, which can be deleted like any form (as MoveService notes for moves).
            _formRepository.Save(copy);

            foreach (var layout in layouts)
            {
                var layoutId = Guid.NewGuid();

                _layoutRepository.Save(new PersistedLayout
                {
                    Id = layoutId,
                    Path = path.Append(layoutId).ToArray(),
                    Name = layout.Name,
                    Alias = layout.Alias,
                    KindId = layout.KindId,
                    TemplateId = layout.TemplateId,
                    Data = GuidRemapper.Remap(layout.Data, map),
                });
            }

            return ServiceResult<FormResponseModel>.Success(ToResponse(copy));
        }

        /// <summary>
        /// Finds an ID used twice among the fields, or among the handlers. Items sent with no ID get a new one, so only real IDs count.
        /// </summary>
        private static ServiceResult<FormResponseModel>? FindDuplicateIds(FormFieldModel[] fields, FormHandlerModel[] handlers)
        {
            var field = fields.Where(x => x.Id != Guid.Empty).GroupBy(x => x.Id).FirstOrDefault(x => x.Count() > 1);

            if (field is not null)
            {
                return ServiceResult<FormResponseModel>.Invalid("fields", $"The field ID {field.Key} is used more than once.");
            }

            var handler = handlers.Where(x => x.Id != Guid.Empty).GroupBy(x => x.Id).FirstOrDefault(x => x.Count() > 1);

            return handler is null
                ? null
                : ServiceResult<FormResponseModel>.Invalid("handlers", $"The handler ID {handler.Key} is used more than once.");
        }

        private static ServiceResult<FormResponseModel> NotFound(Guid id) =>
            ServiceResult<FormResponseModel>.NotFound($"The form {id} does not exist.");

        /// <summary>
        /// Gets the path of the place a form goes: the top of the Forms tree, or a Forms tree folder.
        /// </summary>
        private Guid[]? GetParentPath(Guid? parentId, string field, out ServiceResult<FormResponseModel>? problem)
        {
            var root = Guid.Parse(FormConstants.RootId);
            problem = null;

            if (parentId is null)
            {
                return new[] { root };
            }

            var folder = _folderRepository.Get(parentId.Value);

            if (folder is null || folder.Path.Length == 0 || folder.Path[0] != root)
            {
                problem = ServiceResult<FormResponseModel>.Invalid(field, "The parent must be an existing folder in the Forms tree.");

                return null;
            }

            return folder.Path;
        }

        private PersistedFormField ToPersisted(FormFieldModel field) => new()
        {
            Id = field.Id == Guid.Empty ? Guid.NewGuid() : field.Id,
            KindId = field.KindId,
            Name = field.Name,
            Alias = field.Alias,
            Label = field.Label,
            Category = field.Category,
            Validations = field.Validations ?? Array.Empty<Guid>(),
            Data = ConfigurationJson.ToStored(field.Configuration),
        };

        private PersistedFormHandler ToPersisted(FormHandlerModel handler) => new()
        {
            Id = handler.Id == Guid.Empty ? Guid.NewGuid() : handler.Id,
            KindId = handler.KindId,
            Name = handler.Name,
            Alias = handler.Alias,
            Enabled = handler.Enabled,
            Data = ConfigurationJson.ToStored(handler.Configuration),
        };

        private FormResponseModel ToResponse(PersistedForm form)
        {
            var entity = $"form '{form.Name}' ({form.Id})";

            return new FormResponseModel
            {
                Id = form.Id,
                Name = form.Name,
                Alias = form.Alias,
                ParentId = TreeEntities.GetParentId(form),
                Fields = form.Fields.Select(field =>
                {
                    var definition = _fieldDefinitions.FirstOrDefault(field.KindId);

                    return new FormFieldModel
                    {
                        Id = field.Id,
                        KindId = field.KindId,
                        Name = field.Name,
                        Alias = field.Alias,
                        Label = field.Label,
                        Category = field.Category,
                        Validations = field.Validations ?? Array.Empty<Guid>(),
                        Configuration = _configurationJson.FromDefinition(
                            definition is null ? null : () => definition.GetBackOfficeConfiguration(field),
                            field.Data,
                            entity,
                            $"field '{field.Name}' ({field.Id})"),
                    };
                }).ToArray(),
                Handlers = form.Handlers.Select(handler =>
                {
                    var definition = _handlerDefinitions.FirstOrDefault(handler.KindId);

                    return new FormHandlerModel
                    {
                        Id = handler.Id,
                        KindId = handler.KindId,
                        Name = handler.Name,
                        Alias = handler.Alias,
                        Enabled = handler.Enabled,
                        Configuration = _configurationJson.FromDefinition(
                            definition is null ? null : () => definition.GetBackOfficeConfiguration(handler),
                            handler.Data,
                            entity,
                            $"handler '{handler.Name}' ({handler.Id})"),
                    };
                }).ToArray(),
            };
        }
    }
}
