namespace Formulate.BackOffice.Api.Services
{
    using System;
    using System.Linq;
    using Formulate.BackOffice.Api.Json;
    using Formulate.BackOffice.Api.Models.Layout;
    using Formulate.BackOffice.Api.Models.Shared;
    using Formulate.Core.Forms;
    using Formulate.Core.Layouts;
    using Formulate.Core.Types;

    /// <summary>
    /// The default implementation of <see cref="ILayoutApiService"/>.
    /// </summary>
    public sealed class LayoutApiService : ILayoutApiService
    {
        private readonly ILayoutEntityRepository _layoutRepository;

        private readonly IFormEntityRepository _formRepository;

        private readonly LayoutDefinitionCollection _layoutDefinitions;

        private readonly ConfigurationJson _configurationJson;

        /// <inheritdoc cref="LayoutApiService"/>
        public LayoutApiService(
            ILayoutEntityRepository layoutRepository,
            IFormEntityRepository formRepository,
            LayoutDefinitionCollection layoutDefinitions,
            ConfigurationJson configurationJson)
        {
            _layoutRepository = layoutRepository;
            _formRepository = formRepository;
            _layoutDefinitions = layoutDefinitions;
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

            if (_layoutDefinitions.FirstOrDefault(request.KindId) is null)
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

            if (_layoutRepository.Get(request.Id) is not null || _formRepository.Get(request.Id) is not null)
            {
                return ServiceResult<LayoutResponseModel>.Conflict("id", $"Something with the ID {request.Id} already exists.");
            }

            var layout = new PersistedLayout
            {
                Id = request.Id,
                Path = form.Path.Append(request.Id).ToArray(),
                Name = request.Name,
                Alias = request.Alias,
                KindId = request.KindId,
                TemplateId = request.TemplateId,
                Data = ConfigurationJson.ToStored(request.Configuration),
            };

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

            var layout = new PersistedLayout
            {
                Id = existing.Id,
                Path = existing.Path,
                KindId = existing.KindId,
                Name = request.Name,
                Alias = request.Alias,
                TemplateId = request.TemplateId,
                Data = ConfigurationJson.ToStored(request.Configuration),
            };

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
