namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Collections.Generic;
    using System.Linq;
    using Formulate.BackOffice.Api.Json;
    using Formulate.BackOffice.Api.Models.Form;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Definitions.Forms;
    using Formulate.BackOffice.Persistence;
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
        /// <summary>
        /// The name of the tree forms live in, for messages.
        /// </summary>
        private const string TreeLabel = "Forms";

        private readonly IFormEntityRepository _formRepository;

        private readonly ILayoutEntityRepository _layoutRepository;

        private readonly ITreeEntityRepository _treeRepository;

        private readonly FormDefinitionCollection _formDefinitions;

        private readonly FormFieldDefinitionCollection _fieldDefinitions;

        private readonly FormHandlerDefinitionCollection _handlerDefinitions;

        private readonly ConfigurationJson _configurationJson;

        private readonly IShortStringHelper _shortStringHelper;

        /// <inheritdoc cref="FormApiService"/>
        public FormApiService(
            IFormEntityRepository formRepository,
            ILayoutEntityRepository layoutRepository,
            ITreeEntityRepository treeRepository,
            FormDefinitionCollection formDefinitions,
            FormFieldDefinitionCollection fieldDefinitions,
            FormHandlerDefinitionCollection handlerDefinitions,
            ConfigurationJson configurationJson,
            IShortStringHelper shortStringHelper)
        {
            _formRepository = formRepository;
            _layoutRepository = layoutRepository;
            _treeRepository = treeRepository;
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

            // The ID must be new to every kind of item, not only to forms: lookups by ID search them all.
            var placement = CreatePlacement.Check<FormResponseModel>(_treeRepository, TreeTypes.Forms, TreeLabel, request.Id, request.ParentId, out var parentPath);

            if (placement is not null)
            {
                return placement;
            }

            var duplicate = FindDuplicateIds(request.Fields, request.Handlers);

            if (duplicate is not null)
            {
                return duplicate;
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

            var unreadable = FindUnreadableConfiguration(form);

            if (unreadable is not null)
            {
                return unreadable;
            }

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

            var unreadable = FindUnreadableConfiguration(form);

            if (unreadable is not null)
            {
                return unreadable;
            }

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
            var parentPath = TreeEntities.GetParentPath(_treeRepository, TreeTypes.Forms, parentId);

            if (parentPath is null)
            {
                return InvalidParent();
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

        /// <summary>
        /// Says which field or handler is unreadable, naming the kind and the item but not why: the
        /// reason comes from the kind's code and is only logged.
        /// </summary>
        private static ServiceResult<FormResponseModel> Unreadable(string field, string kind, string noun, string? name) =>
            ServiceResult<FormResponseModel>.Invalid(
                field,
                string.IsNullOrWhiteSpace(name)
                    ? $"The {kind} kind can not read the configuration of this {noun}."
                    : $"The {kind} kind can not read the configuration of {noun} '{name}'.");

        private static ServiceResult<FormResponseModel> NotFound(Guid id) =>
            ServiceResult<FormResponseModel>.NotFound($"The form {id} does not exist.");

        private static ServiceResult<FormResponseModel> InvalidParent() =>
            ServiceResult<FormResponseModel>.Invalid("parentId", $"The parent must be an existing folder in the {TreeLabel} tree.");

        /// <summary>
        /// Finds a field or handler whose installed kind can not read its configuration, by running the code
        /// the site runs when it shows the form (fields) or handles a submission (handlers). A kind that is
        /// not installed keeps its configuration exactly as sent.
        /// </summary>
        private ServiceResult<FormResponseModel>? FindUnreadableConfiguration(PersistedForm form)
        {
            for (var i = 0; i < form.Fields.Length; i++)
            {
                var field = form.Fields[i];
                var definition = _fieldDefinitions.FirstOrDefault(field.KindId);

                if (definition is not null && !_configurationJson.CanRead(
                    () =>
                    {
                        definition.CreateField(field);
                        definition.GetBackOfficeConfiguration(field);
                    },
                    definition.Name,
                    $"field '{field.Name}' ({field.Id}) on form '{form.Name}' ({form.Id})"))
                {
                    return Unreadable($"fields[{i}].configuration", definition.Name, "field", field.Name);
                }
            }

            for (var i = 0; i < form.Handlers.Length; i++)
            {
                var handler = form.Handlers[i];
                var definition = _handlerDefinitions.FirstOrDefault(handler.KindId);

                if (definition is not null && !_configurationJson.CanRead(
                    () =>
                    {
                        definition.CreateHandler(handler);
                        definition.GetBackOfficeConfiguration(handler);
                    },
                    definition.Name,
                    $"handler '{handler.Name}' ({handler.Id}) on form '{form.Name}' ({form.Id})"))
                {
                    return Unreadable($"handlers[{i}].configuration", definition.Name, "handler", handler.Name);
                }
            }

            return null;
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
