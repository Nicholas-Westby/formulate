namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Linq;
    using Formulate.BackOffice.Api.Json;
    using Formulate.BackOffice.Api.Models.Layout;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.BackOffice.Persistence;
    using Formulate.BackOffice.Utilities;
    using Formulate.Core.Forms;
    using Formulate.Core.Layouts;
    using Formulate.Core.Templates;
    using Formulate.Core.Types;

    /// <summary>
    /// The default implementation of <see cref="ILayoutApiService"/>.
    /// </summary>
    public sealed class LayoutApiService : ILayoutApiService
    {
        private readonly ILayoutEntityRepository _layoutRepository;

        private readonly IFormEntityRepository _formRepository;

        private readonly ITreeEntityRepository _treeRepository;

        private readonly LayoutDefinitionCollection _layoutDefinitions;

        private readonly TemplateDefinitionCollection _templateDefinitions;

        private readonly IGetDefaultTemplateId _defaultTemplateId;

        private readonly ConfigurationJson _configurationJson;

        /// <inheritdoc cref="LayoutApiService"/>
        public LayoutApiService(
            ILayoutEntityRepository layoutRepository,
            IFormEntityRepository formRepository,
            ITreeEntityRepository treeRepository,
            LayoutDefinitionCollection layoutDefinitions,
            TemplateDefinitionCollection templateDefinitions,
            IGetDefaultTemplateId defaultTemplateId,
            ConfigurationJson configurationJson)
        {
            _layoutRepository = layoutRepository;
            _formRepository = formRepository;
            _treeRepository = treeRepository;
            _layoutDefinitions = layoutDefinitions;
            _templateDefinitions = templateDefinitions;
            _defaultTemplateId = defaultTemplateId;
            _configurationJson = configurationJson;
        }

        /// <inheritdoc />
        public ServiceResult<LayoutResponseModel> Get(Guid id)
        {
            var layout = _layoutRepository.Get(id);

            return layout is null ? NotFound(id) : ServiceResult<LayoutResponseModel>.Success(ToResponse(layout));
        }

        /// <inheritdoc />
        public ServiceResult<LayoutResponseModel> Create(CreateLayoutRequestModel request)
        {
            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return ServiceResult<LayoutResponseModel>.Invalid("name", "The name is required.");
            }

            var definition = _layoutDefinitions.FirstOrDefault(request.KindId);

            if (definition is null)
            {
                return ServiceResult<LayoutResponseModel>.Invalid("kindId", $"{request.KindId} is not a layout kind.");
            }

            var form = _formRepository.Get(request.FormId);

            if (form is null)
            {
                return ServiceResult<LayoutResponseModel>.Invalid("formId", $"The form {request.FormId} does not exist.");
            }

            if (request.Id == Guid.Empty)
            {
                return ServiceResult<LayoutResponseModel>.Invalid("id", "The ID is required.");
            }

            // The ID must be new to every kind of item, not only to layouts: lookups by ID search them all.
            if (_treeRepository.Get(request.Id) is not null)
            {
                return ServiceResult<LayoutResponseModel>.Conflict("id", $"Something with the ID {request.Id} already exists.");
            }

            var templateId = GetTemplateId(request.TemplateId, out var templateProblem);

            if (templateProblem is not null)
            {
                return templateProblem;
            }

            var layout = new PersistedLayout
            {
                Id = request.Id,
                Path = form.Path.Append(request.Id).ToArray(),
                Name = request.Name,
                Alias = request.Alias,
                KindId = request.KindId,
                TemplateId = templateId,
                Data = ConfigurationJson.ToStored(request.Configuration),
            };

            var unreadable = CheckConfiguration(definition, layout);

            if (unreadable is not null)
            {
                return unreadable;
            }

            return ServiceResult<LayoutResponseModel>.Success(ToResponse(_layoutRepository.Save(layout)));
        }

        /// <inheritdoc />
        public ServiceResult<LayoutResponseModel> Update(Guid id, UpdateLayoutRequestModel request)
        {
            var existing = _layoutRepository.Get(id);

            if (existing is null)
            {
                return NotFound(id);
            }

            if (string.IsNullOrWhiteSpace(request.Name))
            {
                return ServiceResult<LayoutResponseModel>.Invalid("name", "The name is required.");
            }

            var templateId = GetTemplateId(request.TemplateId, out var templateProblem);

            if (templateProblem is not null)
            {
                return templateProblem;
            }

            var layout = new PersistedLayout
            {
                Id = existing.Id,
                Path = existing.Path,
                KindId = existing.KindId,
                Name = request.Name,
                Alias = request.Alias,
                TemplateId = templateId,
                Data = ConfigurationJson.ToStored(request.Configuration),
            };

            // A layout whose kind is no longer installed keeps its configuration exactly as sent.
            var definition = _layoutDefinitions.FirstOrDefault(existing.KindId);
            var unreadable = definition is null ? null : CheckConfiguration(definition, layout);

            if (unreadable is not null)
            {
                return unreadable;
            }

            return ServiceResult<LayoutResponseModel>.Success(ToResponse(_layoutRepository.Save(layout)));
        }

        /// <inheritdoc />
        public ServiceResult<DeleteResponseModel> Delete(Guid id)
        {
            if (_layoutRepository.Get(id) is null)
            {
                return ServiceResult<DeleteResponseModel>.NotFound($"The layout {id} does not exist.");
            }

            _layoutRepository.Delete(id);

            return ServiceResult<DeleteResponseModel>.Success(new DeleteResponseModel { DeletedIds = new[] { id } });
        }

        private static ServiceResult<LayoutResponseModel> NotFound(Guid id) =>
            ServiceResult<LayoutResponseModel>.NotFound($"The layout {id} does not exist.");

        /// <summary>
        /// Gets the template a layout is saved with: the one asked for, which must be installed, or the
        /// default template when none is asked for. A layout is never saved without a template, because a
        /// form can not be shown without one.
        /// </summary>
        private Guid? GetTemplateId(Guid? requested, out ServiceResult<LayoutResponseModel>? problem)
        {
            problem = null;

            if (requested is null)
            {
                var fallback = _defaultTemplateId.GetValue();

                if (fallback is null)
                {
                    problem = ServiceResult<LayoutResponseModel>.Invalid("templateId", "No template is installed, so a layout can not be saved.");
                }

                return fallback;
            }

            if (_templateDefinitions.FirstOrDefault(requested.Value) is null)
            {
                problem = ServiceResult<LayoutResponseModel>.Invalid("templateId", $"{requested} is not an installed template.");
            }

            return requested;
        }

        /// <summary>
        /// Checks the layout's kind can read its configuration, by running the code the site runs when it
        /// shows the form.
        /// </summary>
        private ServiceResult<LayoutResponseModel>? CheckConfiguration(ILayoutDefinition definition, PersistedLayout layout)
        {
            var readable = _configurationJson.CanRead(
                () =>
                {
                    definition.CreateLayout(layout);
                    definition.GetBackOfficeConfiguration(layout);
                },
                definition.Name,
                $"layout '{layout.Name}' ({layout.Id})");

            return readable
                ? null
                : ServiceResult<LayoutResponseModel>.Invalid("configuration", $"The {definition.Name} kind can not read the configuration of layout '{layout.Name}'.");
        }

        private LayoutResponseModel ToResponse(PersistedLayout layout)
        {
            var definition = _layoutDefinitions.FirstOrDefault(layout.KindId);

            return new LayoutResponseModel
            {
                Id = layout.Id,
                Name = layout.Name,
                Alias = layout.Alias,
                FormId = TreeEntities.GetParentId(layout) ?? Guid.Empty,
                KindId = layout.KindId,
                TemplateId = layout.TemplateId,
                Configuration = _configurationJson.FromDefinition(
                    definition is null ? null : () => definition.GetBackOfficeConfiguration(layout),
                    layout.Data,
                    $"layout '{layout.Name}' ({layout.Id})",
                    "its configuration"),
            };
        }
    }
}
